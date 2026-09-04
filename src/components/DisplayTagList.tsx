import { computed, onMounted, ref, useTemplateRef, watch, type SetupContext } from "vue";
import { normalizeClass, VaporFor } from "vue-jsx-vapor";
import { useRouter } from "vue-router";
import { emptyString } from "@/constants/common";
import { areSetsEqual, normaliseTag, titleCase } from "@/utils/common";
import { getTime } from "@/utils/dates";
import { contains, equals, sort } from "@/utils/text-analysis";
import * as notesStore from "@/stores/notes";
import { confirm } from "@/composables/useConfirmDialogue";
import { useDropdown } from "@/composables/useDropdown";
import { exitSelectionMode, isSelecting, selectedCount, selectedIds } from "@/composables/useNoteSelection";
import { requestSync } from "@/composables/useNotesSync";
import { useTruncate } from "@/composables/useTruncate";
import Icon from "@/components/Icon";

type Props = {
	activeTags?: string[];
	allowCreate?: boolean;
	allowDelete?: boolean;
	allowEdit?: boolean;
	allowManage?: boolean;
	showFilterType?: boolean;
};
type Events = {
	selectionChanged: (tags: string[]) => void;
};

export default function DisplayTagList(props: Props & EventBindings<Events>, { emit }: SetupContext<Events>) {
	let syncingUp = false;
	let syncingDown = false;
	let lastSelected: string[] = [];
	const router = useRouter();
	const searchText = ref(emptyString);
	const selectedTags = ref<string[]>([]);
	const dropdownToggle = useTemplateRef<HTMLElement>("dropdown-toggle");
	const dropdownMenu = useTemplateRef<HTMLElement>("dropdown-menu");
	const dropdown = useDropdown(dropdownToggle, {
		autoClose: false,
		dropdown: dropdownMenu
	});
	const flexModifiers = computed(() => ({
		[dropdown.show.value ? "flex-column" : "flex-wrap"]: true
	}));
	const filteredTags = computed(() => sort(!searchText.value ? notesStore.tags.value : notesStore.tags.value.filter(tag => contains(tag, searchText.value))));
	const allSelected = computed(() => filteredTags.value.every(tag => selectedTags.value.includes(tag)));
	const hasExactMatch = computed(() => !searchText.value || notesStore.tags.value.some(tag => equals(tag, normaliseTag(searchText.value))));
	const enableActions = computed(() => !!(selectedCount.value && selectedTags.value.length));

	function syncState(direction: "up" | "down") {
		if (!props.allowEdit || isSelecting.value) {
			return;
		}
		if (areSetsEqual(new Set(selectedTags.value), notesStore.searchTags.value)) {
			return;
		}
		switch (direction) {
			case "up": {
				syncingUp = true;
				notesStore.setSearchTags(selectedTags.value);
				break;
			}
			case "down": {
				syncingDown = true;
				selectedTags.value = Array.from(notesStore.searchTags.value);
				break;
			}
		}
	}

	function isTagSelected(tag: string) {
		return selectedTags.value.includes(tag);
	}

	function toggleTagSelection(tag: string) {
		if (isTagSelected(tag)) {
			selectedTags.value.splice(selectedTags.value.indexOf(tag), 1);
			return;
		}
		selectedTags.value.push(tag);
	}

	function toggleSelectAll() {
		if (!allSelected.value) {
			selectedTags.value = Array.from(filteredTags.value);
			return;
		}
		selectedTags.value = [];
	}

	function unselectTag(tag: string) {
		const index = selectedTags.value.indexOf(tag);
		if (index !== -1) {
			selectedTags.value.splice(index, 1);
		}
	}

	async function createTag(tag: string) {
		const normalised = normaliseTag(tag);
		await notesStore.createTag(normalised);
		selectedTags.value.push(normalised);
	}

	async function deleteTags(tags: string[]) {
		const hasMany = tags.length > 1;
		const suffix = hasMany ? "s" : emptyString;
		dropdown.toggle(false);
		const ok = await confirm({
			title: `Delete selected tag${suffix} permanently?`,
			message: `The selected tag${suffix} will be deleted permanently. ${hasMany ? "They" : "It"} will also be removed from any notes that use ${hasMany ? "them" : "it"}.`,
			confirmText: "Delete Tags",
			cancelText: "Cancel",
			variant: "danger"
		});
		if (ok) {
			selectedTags.value = selectedTags.value.filter(tag => !tags.includes(tag));
			const affectedCount = await notesStore.deleteTags(tags.map(normaliseTag));
			if (affectedCount) {
				requestSync();
			}
		}
	}

	async function updateNoteTags(action: "add" | "remove") {
		const now = Date.now();
		const isAdding = action === "add";
		dropdown.toggle(false);
		const ok = await confirm({
			title: `${titleCase(action)} tags`,
			message: `The selected tags will be ${isAdding ? "added" : "removed"} ${isAdding ? "to" : "from"} the selected notes. Do you want to proceed?`,
			confirmText: "Confirm",
			cancelText: "Cancel",
			variant: "warning"
		});
		if (!ok) {
			return;
		}
		switch (action) {
			case "add": {
				notesStore.addTagsMultiple(Array.from(selectedIds.value), selectedTags.value);
				break;
			}
			case "remove": {
				notesStore.removeTagsMultiple(Array.from(selectedIds.value), selectedTags.value);
				break;
			}
		}
		if (notesStore.notes.value.some(note => selectedIds.value.has(note.id) && getTime(note.stateChangedAt) > now)) {
			requestSync();
		}
		exitSelectionMode();
	}

	function addToSearchTags(tag: string) {
		if (props.allowEdit) {
			return;
		}
		notesStore.addSearchTag(tag);
		router.push("/");
	}

	useTruncate(useTemplateRef("tag-input"), searchText, 256);

	onMounted(() => {
		selectedTags.value = props.activeTags ?? [];
	});

	watch(isSelecting, (curr, prev) => {
		if (!prev) {
			lastSelected = Array.from(selectedTags.value);
		}
		if (!curr) {
			selectedTags.value = Array.from(lastSelected);
		}
	});

	watch(
		() => props.allowEdit,
		value => {
			if (!value) {
				dropdown.toggle(false);
				selectedTags.value = props.activeTags ?? [];
			}
		}
	);

	watch(
		selectedTags,
		tags => {
			emit("selectionChanged", tags);
			if (!syncingDown && props.allowManage) {
				syncState("up");
			}
			syncingDown = false;
		},
		{ deep: true }
	);

	watch(
		notesStore.searchTags,
		() => {
			if (!syncingUp) {
				syncState("down");
			}
			syncingUp = false;
		},
		{ deep: true }
	);

	return (
		<>
			<div class={normalizeClass(["d-flex gap-1 p-1 border rounded", flexModifiers.value])}>
				<div class="dropdown w-100">
					<div ref="dropdown-menu" class={normalizeClass(["d-flex gap-1 align-items-center", flexModifiers.value])}>
						<button v-if={props.allowEdit} ref="dropdown-toggle" class="btn btn-sm btn-outline-secondary align-self-start dropdown-toggle" onClick={() => dropdown.toggle()}>Tags</button>
						<label v-else class="small align-self-start border rounded px-2 py-1">Tags</label>
						<div v-if={dropdown.show.value} class="dropdown-menu show w-100 position-relative tag-list">
							<template v-if={props.allowManage}>
								<div class="d-flex gap-2 px-3 py-1">
									<label class="btn btn-sm btn-outline-secondary flex-grow-1">
										<input type="checkbox" class="form-check-input" checked={allSelected.value} disabled={!filteredTags.value.length} onChange={toggleSelectAll}/>
										<span class="ms-2">{allSelected.value ? "Deselect All" : "Select All"}</span>
									</label>
									<button v-if={props.allowDelete} class="btn btn-sm btn-outline-danger flex-grow-1" disabled={!selectedTags.value.length} onClick={() => deleteTags(selectedTags.value)}>Delete Selected</button>
								</div>
								<div class="dropdown-divider"></div>
							</template>
							<div class="d-flex gap-2 px-3 py-1">
								<div class={normalizeClass(["flex-nowrap w-100", { [`input-group`]: props.allowCreate }])}>
									<input ref="tag-input" value={searchText.value} type="text" class="form-control form-control-sm" placeholder="Search" onInput={e => searchText.value = e.currentTarget.value.trim()}/>
									<button v-if={props.allowCreate} class="btn btn-sm btn-outline-secondary" disabled={hasExactMatch.value} onClick={() => createTag(searchText.value)}>
										<Icon type="plusLg"/>
									</button>
								</div>
							</div>
							<template v-if={filteredTags.value.length}>
								<div class="dropdown-divider"></div>
								<div class="d-flex flex-wrap gap-4 px-3">
									<VaporFor in={filteredTags.value}>
										{tag => (
											<>
												<label>
													<input type="checkbox" class="form-check-input" checked={isTagSelected(tag)} onChange={() => toggleTagSelection(tag)}/>
													<span class="text-wrap text-break ms-2">{tag}</span>
												</label>
											</>
										)}
									</VaporFor>
								</div>
							</template>
						</div>
						<template v-else-if={selectedTags.value.length}>
							<VaporFor in={selectedTags.value}>
								{tag => (
									<>
										<component is={props.allowEdit ? `div` : `a`} class={normalizeClass(["badge text-bg-secondary", { [`py-2`]: !props.allowEdit }])} onClick={() => addToSearchTags(tag)} v-bind={props.allowEdit ? {} : { [`role`]: `button` }}>
											<span>{tag}</span>
											<button v-if={props.allowEdit} class="small btn-close ms-2" onClick={() => unselectTag(tag)}></button>
										</component>
									</>
								)}
							</VaporFor>
						</template>
						<template v-if={selectedTags.value.length}>
							<div v-if={props.showFilterType} class="input-group input-group-sm flex-nowrap w-auto ms-auto">
								<span class="input-group-text">Match:</span>
								<label class={normalizeClass(["btn btn-outline-secondary", { [`active`]: notesStore.tagFilter.value === `any` }])}>
									<input type="radio" class="btn-check" name="filter-type" onChange={() => notesStore.setFilterType(`any`)}/>
									<span>Any</span>
								</label>
								<label class={normalizeClass(["btn btn-outline-secondary", { [`active`]: notesStore.tagFilter.value === `all` }])}>
									<input type="radio" class="btn-check" name="filter-type" onChange={() => notesStore.setFilterType(`all`)}/>
									<span>All</span>
								</label>
							</div>
							<div v-else-if={isSelecting.value} class="d-flex gap-1 ms-auto">
								<button class="btn btn-sm btn-outline-primary" disabled={!enableActions.value} onClick={() => updateNoteTags(`add`)}>Apply</button>
								<button class="btn btn-sm btn-outline-danger" disabled={!enableActions.value} onClick={() => updateNoteTags(`remove`)}>Remove</button>
							</div>
						</template>
					</div>
				</div>
			</div>
		</>
	);
}