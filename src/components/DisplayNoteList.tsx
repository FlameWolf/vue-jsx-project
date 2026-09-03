import { computed, onMounted, useTemplateRef, watch } from "vue";
import { VaporFor } from "vue-jsx-vapor";
import { onBeforeRouteLeave, VaporRouterLink } from "vue-router";
import { bulkActions } from "@/constants/actions";
import { colours } from "@/constants/colours";
import * as appStore from "@/stores/app";
import * as notesStore from "@/stores/notes";
import { confirm } from "@/composables/useConfirmDialogue";
import { useDropdown } from "@/composables/useDropdown";
import { exportAllNotes, exportNotes, importFiles } from "@/composables/useFileIO";
import { clearSelection, enterSelectionMode, exitSelectionMode, isSelected, isSelecting, selectAll, selectedCount, toggleSelection } from "@/composables/useNoteSelection";
import { getSortedNotes, setSortField, sortField, sortOrder, toggleSortDirection } from "@/composables/useNoteSort";
import { requestSync } from "@/composables/useNotesSync";
import Icon from "@/components/Icon";
import Spinner from "@/components/Spinner";
import EmptyState from "@/components/EmptyState";
import SortControls from "@/components/SortControls";
import DisplayColourList from "@/components/DisplayColourList";
import DisplayTagList from "@/components/DisplayTagList";
import NoteCard from "@/components/NoteCard";
import SelectionActionBar from "@/components/SelectionActionBar";
import type { NoteModel } from "@/models/NoteModel";
import type { UUID } from "crypto";

type Props = {
	view?: View;
};
type NoteSection = {
	key: string;
	notes: NoteModel[];
	divider?: string;
	showNewCard?: boolean;
};

export default function DisplayNoteList(props: Props) {
	const dropdownToggle = useTemplateRef<HTMLElement>("dropdown-toggle");
	const dropdownMenu = useTemplateRef<HTMLElement>("dropdown-menu");
	const dropdown = useDropdown(dropdownToggle, {
		autoClose: false,
		dropdown: dropdownMenu
	});
	const view = computed<View>(() => props.view ?? "active");
	const isSearchMode = computed(() => !!notesStore.searchText.value);
	const sourceNotes = computed(() => {
		switch (view.value) {
			case "favourited":
				return notesStore.favedNotes.value;
			case "archived":
				return notesStore.archivedNotes.value;
			case "trash":
				return notesStore.trashedNotes.value;
			default:
				return notesStore.activeNotes.value;
		}
	});
	const sortedNotes = computed(() => getSortedNotes(sourceNotes.value));
	const noteSections = computed<NoteSection[]>(() => {
		if (view.value === "favourited") {
			const sections: NoteSection[] = [
				{
					key: "active",
					notes: sortedNotes.value.filter(n => !n.archivedAt)
				}
			];
			const archived = sortedNotes.value.filter(n => n.archivedAt);
			if (archived.length) {
				sections.push({
					key: "archived",
					notes: archived,
					divider: "ARCHIVE"
				});
			}
			return sections;
		}
		return [
			{
				key: "all",
				notes: sortedNotes.value,
				showNewCard: view.value === "active"
			}
		];
	});
	const hasNotes = computed(() => sourceNotes.value.length > 0);
	const allSelected = computed(() => sourceNotes.value.length > 0 && selectedCount.value === sourceNotes.value.length);
	const selectAllText = computed(() => (allSelected.value ? "Deselect All" : "Select All"));
	const pageTitle = computed(() => {
		switch (view.value) {
			case "favourited":
				return "Favourited";
			case "archived":
				return "Archived";
			case "trash":
				return "Trash";
			default:
				return "Notes";
		}
	});
	const emptyMessage = computed(() => {
		switch (view.value) {
			case "favourited":
				return "No favourited notes";
			case "archived":
				return "No archived notes";
			case "trash":
				return "Trash is empty";
			default:
				return "No notes yet";
		}
	});
	const selectionActions = computed<SelectionAction[]>(() => {
		if (view.value === "trash") {
			return bulkActions.filter(action => action.key === "restore" || action.key === "permanent");
		}
		const actionKeys = new Set<SelectionAction["key"]>(["export", "trash"]);
		switch (view.value) {
			case "favourited": {
				actionKeys.add("unfave");
				break;
			}
			case "archived": {
				actionKeys.add("unarchive");
				break;
			}
			default: {
				actionKeys.add("fave");
				actionKeys.add("archive");
				break;
			}
		}
		return bulkActions.filter(action => actionKeys.has(action.key));
	});

	function toggleSelectAll() {
		if (allSelected.value) {
			clearSelection();
		} else {
			selectAll(sourceNotes.value.map(n => n.id));
		}
	}

	function getSelectedNotes(): NoteModel[] {
		return sourceNotes.value.filter(n => isSelected(n.id));
	}

	function getSelectedIds(): UUID[] {
		return getSelectedNotes().map(n => n.id);
	}

	async function handleImport() {
		const importedCount = await importFiles();
		if (importedCount > 0) {
			requestSync();
		}
	}

	function isValidColour(input: string): boolean {
		return colours.includes(input as Colour);
	}

	function updateSearchColours(colour: Colour) {
		switch (colour) {
			case "none": {
				notesStore.setSearchColours([]);
				break;
			}
			default: {
				notesStore.toggleSearchColour(colour);
				break;
			}
		}
	}

	async function handleSelectionAction(key: SelectionAction["key"]) {
		const ids = getSelectedIds();
		const idCount = ids.length;
		if (idCount === 0) {
			return;
		}
		let syncNotes = true;
		let purgeNotes = false;
		const noun = idCount === 1 ? "note" : "notes";
		switch (key) {
			case "export": {
				await exportNotes(getSelectedNotes());
				syncNotes = false;
				break;
			}
			case "fave": {
				await notesStore.faveMultiple(ids);
				break;
			}
			case "unfave": {
				await notesStore.unfaveMultiple(ids);
				break;
			}
			case "archive": {
				await notesStore.archiveMultiple(ids);
				break;
			}
			case "unarchive": {
				await notesStore.unarchiveMultiple(ids);
				break;
			}
			case "trash": {
				const ok = await confirm({
					title: `Move ${idCount} ${noun} to Trash?`,
					message: `${idCount === 1 ? "This note" : "These notes"} can be restored from Trash within 30 days.`,
					confirmText: "Move to Trash",
					cancelText: "Cancel",
					variant: "danger"
				});
				if (!ok) {
					return;
				}
				await notesStore.trashMultiple(ids);
				break;
			}
			case "restore": {
				await notesStore.restoreFromTrashMultiple(ids);
				break;
			}
			case "permanent": {
				const ok = await confirm({
					title: `Permanently delete ${idCount} ${noun}?`,
					message: "This action cannot be undone.",
					confirmText: "Delete Permanently",
					cancelText: "Cancel",
					variant: "danger"
				});
				if (!ok) {
					return;
				}
				await notesStore.permanentlyDeleteMultiple(ids);
				purgeNotes = true;
				break;
			}
			default: {
				if (isValidColour(key)) {
					if (key === "none") {
						await notesStore.unsetColourMultiple(ids);
						break;
					}
					await notesStore.setColourMultiple(ids, key);
				}
				break;
			}
		}
		if (syncNotes) {
			requestSync(purgeNotes ? ids : undefined);
		}
		exitSelectionMode();
	}

	async function handleEmptyTrash() {
		const count = notesStore.trashedNotes.value.length;
		if (count === 0) {
			return;
		}
		const ok = await confirm({
			title: "Empty Trash?",
			message: `${count} ${count === 1 ? "note" : "notes"} will be permanently deleted. This cannot be undone.`,
			confirmText: "Empty Trash",
			cancelText: "Cancel",
			variant: "danger"
		});
		if (!ok) {
			return;
		}
		const trashedNoteIds = notesStore.trashedNotes.value.map(n => n.id);
		await notesStore.permanentlyDeleteMultiple(trashedNoteIds);
		requestSync(trashedNoteIds);
	}

	onMounted(() => {
		exitSelectionMode();
	});

	onBeforeRouteLeave(() => {
		appStore.lastView.value = view.value;
	});

	watch(view, exitSelectionMode);

	return (
		<>
			<div v-if={view.value !== `active`} class="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
				<h2 class="mb-0">{pageTitle.value}</h2>
				<VaporRouterLink to="/notes" class="btn btn-secondary btn-sm">
					<Icon type="chevronLeft"/>
					<span class="ms-2">Back to Notes</span>
				</VaporRouterLink>
			</div>
			<Spinner v-if={notesStore.isLoading.value || notesStore.isSearching.value} message={notesStore.isSearching.value ? `Searching...` : `Loading notes...`}/>
			<EmptyState v-else-if={!(hasNotes.value || notesStore.searchTags.value.size || notesStore.searchColours.value.size)} showActions={view.value === `active`} showCreate={!isSearchMode.value} onImport={handleImport}>
				<template v-if={isSearchMode.value}>
					<span>No results found for <mark>{notesStore.searchText.value}</mark></span>
					<div v-if={view.value === "active"} class="mt-3">
						<em>Look in:</em>
					</div>
				</template>
				<template v-else>{emptyMessage.value}</template>
			</EmptyState>
			<template v-else>
				<div class="d-flex gap-2 mb-3 justify-content-end flex-wrap">
					<template v-if={isSelecting.value}>
						<button class="btn btn-outline-secondary btn-sm" onClick={toggleSelectAll} title={selectAllText.value} aria-label={selectAllText.value}>
							<Icon type={allSelected.value ? `list` : `listCheck`}/>
							<span class="d-none d-sm-inline ms-2">{selectAllText.value}</span>
						</button>
						<button class="btn btn-outline-secondary btn-sm" onClick={exitSelectionMode} title="Cancel" aria-label="Cancel">
							<Icon type="xCircle"/>
							<span class="d-none d-sm-inline ms-2">Cancel</span>
						</button>
					</template>
					<template v-else>
						<SortControls sortField={sortField.value} sortOrder={sortOrder.value} onChangeField={setSortField} onToggleDirection={toggleSortDirection}/>
						<div ref="dropdown-toggle" class="colour-circle vibgyor toolbar-icon rounded-circle" onClick={() => dropdown.toggle()} role="button" aria-label="Colour Filters">
							<Icon v-if={notesStore.searchColours.value.size} type="check2"/>
						</div>
						<button class="btn btn-outline-secondary btn-sm" onClick={enterSelectionMode} title="Select" aria-label="Select">
							<Icon type="check2Square"/>
							<span class="d-none d-sm-inline ms-2">Select</span>
						</button>
						<template v-if={view.value === `active`}>
							<button class="btn btn-outline-secondary btn-sm" onClick={handleImport} title="Import" aria-label="Import">
								<Icon type="boxArrowDownRight"/>
								<span class="d-none d-sm-inline ms-2">Import</span>
							</button>
							<button class="btn btn-outline-secondary btn-sm" onClick={exportAllNotes} title="Export All" aria-label="Export All">
								<Icon type="boxArrowUpRight"/>
								<span class="d-none d-sm-inline ms-2">Export All</span>
							</button>
							<VaporRouterLink to="/notes/favourite" class="btn btn-outline-secondary btn-sm" title="Favourited" aria-label="Favourited">
								<Icon type="star"/>
								<span class="d-none d-sm-inline ms-2">Favourited</span>
							</VaporRouterLink>
							<VaporRouterLink to="/notes/archive" class="btn btn-outline-secondary btn-sm" title="Archived" aria-label="Archived">
								<Icon type="archive"/>
								<span class="d-none d-sm-inline ms-2">Archived</span>
							</VaporRouterLink>
							<VaporRouterLink to="/notes/trash" class="btn btn-outline-secondary btn-sm" title="Trash" aria-label="Trash">
								<Icon type="trash"/>
								<span class="d-none d-sm-inline ms-2">Trash</span>
							</VaporRouterLink>
						</template>
						<template v-if={view.value === `trash`}>
							<button class="btn btn-outline-danger btn-sm" onClick={handleEmptyTrash} title="Empty Trash" aria-label="Empty Trash">
								<Icon type="trashFill"/>
								<span class="d-none d-sm-inline ms-2">Empty Trash</span>
							</button>
						</template>
					</template>
				</div>
				<div v-if={dropdown.show.value} ref="dropdown-menu" class="d-flex justify-content-end mb-3">
					<DisplayColourList filterMode={true} onSelectionChanged={updateSearchColours}/>
				</div>
				<DisplayTagList class="mb-3" activeTags={Array.from(notesStore.searchTags.value)} allowCreate={isSelecting.value} allowDelete={true} allowEdit={true} allowManage={!isSelecting.value} showFilterType={!isSelecting.value}/>
				<VaporFor in={noteSections.value}>
					{section => (
						<template key={section.key}>
							<div v-if={section.divider} class="d-flex align-items-center my-4">
								<div class="flex-grow-1 border-bottom"></div>
								<span class="px-3 text-muted small">{section.divider}</span>
								<div class="flex-grow-1 border-bottom"></div>
							</div>
							<div class="notes-grid">
								<VaporRouterLink v-if={section.showNewCard && !isSelecting.value} to="/notes/new" class="card note-card new-note-card text-decoration-none">
									<div class="card-body d-flex align-items-center justify-content-center">
										<span class="fs-1 text-muted">+</span>
									</div>
								</VaporRouterLink>
								<VaporFor in={section.notes}>{note => <NoteCard key={note.id} note={note} selectionMode={isSelecting.value} selected={isSelected(note.id)} onToggleSelect={toggleSelection}/>}</VaporFor>
							</div>
						</template>
					)}
				</VaporFor>
				<SelectionActionBar v-if={isSelecting.value && selectedCount.value > 0} selectedCount={selectedCount.value} actions={selectionActions.value} showColours={true} onAction={handleSelectionAction} onCancel={exitSelectionMode}/>
			</template>
		</>
	);
}