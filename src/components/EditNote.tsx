import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from "vue";
import { onBeforeRouteLeave, VaporRouterLink, useRoute, useRouter } from "vue-router";
import { emptyString } from "@/constants/common";
import { areArraysEqual, areSetsEqual, copyNullableArray } from "@/utils/common";
import { getSentenceCount, getWordCount, getCharacterCount } from "@/utils/text-analysis";
import { debounce } from "@/utils/timing";
import { NoteModel } from "@/models/NoteModel";
import * as appStore from "@/stores/app";
import * as notesStore from "@/stores/notes";
import { addNotification } from "@/stores/notifications";
import { listViewRoutes } from "@/router";
import { confirm } from "@/composables/useConfirmDialogue";
import { useDropdown } from "@/composables/useDropdown";
import { exportNote } from "@/composables/useFileIO";
import { clearDraft, loadDraft, saveDraft } from "@/composables/useNoteDraft";
import { requestSync } from "@/composables/useNotesSync";
import { useTruncate } from "@/composables/useTruncate";
import { useUndoRedo } from "@/composables/useUndoRedo";
import Icon from "@/components/Icon";
import DisplayColourList from "@/components/DisplayColourList";
import Spinner from "@/components/Spinner";
import DisplayTagList from "@/components/DisplayTagList";
import type { FormEvent } from "vue-jsx-vapor";
import type { UUID } from "crypto";

type Props = {
	id?: UUID;
	backRoute?: string;
};

export default function EditNote(props: Props) {
	const router = useRouter();
	const route = useRoute();
	const isCreateMode = computed(() => route.path === "/notes/new");
	const existingNote = computed(() => (props.id && !isCreateMode.value ? notesStore.getNote(props.id) : undefined));
	const isEditing = ref(isCreateMode.value);
	const editTitle = ref(existingNote.value?.title ?? emptyString);
	const editContent = ref(emptyString);
	const editColour = ref<Colour | undefined>();
	const editTags = ref<string[] | undefined>();
	const loadedContent = ref(emptyString);
	const isContentLoaded = ref(isCreateMode.value);
	const editTextArea = useTemplateRef<HTMLElement>("edit-text-area");
	const dropdownToggle = useTemplateRef<HTMLElement>("dropdown-toggle");
	const dropdown = useDropdown(dropdownToggle);
	const undoRedo = useUndoRedo(editContent.value);
	const sentenceCount = computed(() => (isEditing.value ? getSentenceCount(editContent.value) : (existingNote.value?.sentenceCount ?? 0)));
	const wordCount = computed(() => (isEditing.value ? getWordCount(editContent.value) : (existingNote.value?.wordCount ?? 0)));
	const characterCount = computed(() => (isEditing.value ? getCharacterCount(editContent.value) : (existingNote.value?.characterCount ?? 0)));
	const hasContent = computed(() => !!sentenceCount.value || !!wordCount.value || !!characterCount.value);
	const isFaved = computed(() => !!existingNote.value?.favedAt && !existingNote.value?.deletedAt);
	const isPinned = computed(() => !!existingNote.value?.pinnedAt && !existingNote.value?.deletedAt);
	const isArchived = computed(() => !!existingNote.value?.archivedAt && !existingNote.value?.deletedAt);
	const isTrashed = computed(() => !!existingNote.value?.deletedAt);
	const backRoute = computed(() => props.backRoute ?? "/notes");
	const hasUnsavedChanges = computed(() => {
		if (!isEditing.value) {
			return false;
		}
		if (isCreateMode.value) {
			return editTitle.value.trim().length > 0 || editContent.value.length > 0 || !areSetsEqual(new Set(editTags.value), notesStore.searchTags.value);
		}
		const note = existingNote.value;
		if (!note) {
			return false;
		}
		return editTitle.value !== note.title || editContent.value !== loadedContent.value || editColour.value !== note.colour || !areArraysEqual(editTags.value, note.tags);
	});
	const draftId = computed(() => (isCreateMode.value ? "new" : props.id!));
	const debouncedPushUndo = debounce((value: string) => undoRedo.push(value), 300);
	const persistDraft = debounce(() => {
		if (hasUnsavedChanges.value) {
			saveDraft(draftId.value, editTitle.value, editContent.value, editTags.value);
		} else {
			clearDraft(draftId.value);
		}
	}, 500);

	function adjustTextAreaHeight() {
		if (CSS.supports("field-sizing", "content")) {
			return;
		}
		if (isEditing.value) {
			const editor = editTextArea.value;
			const editorParent = editor?.parentElement;
			if (!editorParent) {
				return;
			}
			const editorClone = editor.cloneNode() as HTMLTextAreaElement;
			editorClone.classList.add("d-hidden");
			editorClone.style.setProperty("height", "auto");
			editorClone.value = editContent.value;
			editorParent.appendChild(editorClone);
			editor.style.setProperty("height", `calc(${editorClone.scrollHeight}px + 0.5rem)`);
			editorParent.removeChild(editorClone);
		}
	}

	function setFontScaling(operator: "+" | "-") {
		const multiplier = operator === "+" ? 1 : -1;
		appStore.setFontScaleFactor(appStore.fontScaleFactor.value + 1 * multiplier);
	}

	function onContentInput(e: FormEvent<HTMLTextAreaElement>) {
		const value = (e.target as HTMLTextAreaElement).value;
		editContent.value = value;
		debouncedPushUndo(value);
	}

	function doUndo() {
		undoRedo.undo();
		editContent.value = undoRedo.current.value;
	}

	function doRedo() {
		undoRedo.redo();
		editContent.value = undoRedo.current.value;
	}

	function copyToClipboard() {
		navigator.clipboard
			.writeText(loadedContent.value)
			.then(() => {
				addNotification("success", "Copied to clipboard");
			})
			.catch(err => {
				addNotification("danger", `Failed to copy: ${(err as Error).message}`);
			});
	}

	function startEditing() {
		editTitle.value = existingNote.value?.title ?? emptyString;
		editContent.value = loadedContent.value;
		undoRedo.push(editContent.value);
		isEditing.value = true;
		setTimeout(adjustTextAreaHeight);
	}

	async function confirmDiscardChanges(): Promise<boolean> {
		return confirm({
			title: "Discard unsaved changes?",
			message: "You have unsaved changes that will be lost if you leave this note.",
			confirmText: "Discard",
			cancelText: "Keep editing",
			variant: "danger"
		});
	}

	async function cancelEditing() {
		if (hasUnsavedChanges.value) {
			const ok = await confirmDiscardChanges();
			if (!ok) {
				return;
			}
			clearDraft(draftId.value);
		}
		if (isCreateMode.value) {
			isEditing.value = false;
			router.push(backRoute.value);
		} else {
			const note = existingNote.value;
			if (note) {
				editTitle.value = note.title ?? emptyString;
				editContent.value = loadedContent.value;
				editColour.value = note.colour as Colour;
				editTags.value = copyNullableArray(note.tags);
			}
			isEditing.value = false;
		}
	}

	async function saveNote() {
		const title = editTitle.value.trim() || "Untitled";
		const content = editContent.value;
		const colour = editColour.value;
		const tags = editTags.value;
		isEditing.value = false;
		if (isCreateMode.value) {
			const note = new NoteModel(title, content);
			note.colour = colour;
			note.tags = tags?.length ? Array.from(tags) : undefined;
			await notesStore.addNote(note);
			router.push(`/notes/${note.id}`);
		} else if (existingNote.value) {
			const noteId = existingNote.value.id;
			if (colour) {
				notesStore.setColour(noteId, colour);
			} else {
				notesStore.unsetColour(noteId);
			}
			notesStore.setNoteTags(noteId, tags);
			await notesStore.updateNote({ id: noteId, title, content });
			loadedContent.value = content;
		}
		clearDraft(draftId.value);
		requestSync();
	}

	async function updateColour(colour: Colour) {
		if (colour === "none") {
			editColour.value = undefined;
			return;
		}
		editColour.value = colour;
	}

	async function deleteNote() {
		if (!existingNote.value) {
			return;
		}
		const ok = await confirm({
			title: "Move note to Trash?",
			message: "This note will be moved to Trash. You can restore it within 30 days.",
			confirmText: "Move to Trash",
			cancelText: "Cancel",
			variant: "danger"
		});
		if (!ok) {
			return;
		}
		await notesStore.trashNote(existingNote.value.id);
		requestSync();
		router.push(backRoute.value);
	}

	async function faveNote() {
		if (!existingNote.value) {
			return;
		}
		await notesStore.faveNote(existingNote.value.id);
		requestSync();
	}

	async function unfaveNote() {
		if (!existingNote.value) {
			return;
		}
		await notesStore.unfaveNote(existingNote.value.id);
		requestSync();
	}

	async function pinNote() {
		if (!existingNote.value) {
			return;
		}
		await notesStore.pinNote(existingNote.value.id);
		requestSync();
	}

	async function unpinNote() {
		if (!existingNote.value) {
			return;
		}
		await notesStore.unpinNote(existingNote.value.id);
		requestSync();
	}

	async function archiveNote() {
		if (!existingNote.value) {
			return;
		}
		await notesStore.archiveNote(existingNote.value.id);
		requestSync();
		if (appStore.lastView.value !== "favourited") {
			router.push(backRoute.value);
		}
	}

	async function unarchiveNote() {
		if (!existingNote.value) {
			return;
		}
		await notesStore.unarchiveNote(existingNote.value.id);
		requestSync();
		if (appStore.lastView.value !== "favourited") {
			router.push(backRoute.value);
		}
	}

	async function restoreNote() {
		if (!existingNote.value) {
			return;
		}
		await notesStore.restoreFromTrash(existingNote.value.id);
		requestSync();
		router.push(backRoute.value);
	}

	async function permanentlyDeleteNote() {
		if (!existingNote.value) {
			return;
		}
		const ok = await confirm({
			title: "Permanently delete note?",
			message: "This note will be permanently deleted. This action cannot be undone.",
			confirmText: "Delete Permanently",
			cancelText: "Cancel",
			variant: "danger"
		});
		if (!ok) {
			return;
		}
		const existingNoteId = existingNote.value.id;
		await notesStore.permanentlyDelete(existingNoteId);
		requestSync([existingNoteId]);
		router.push(backRoute.value);
	}

	async function restoreDraft() {
		const draft = loadDraft(draftId.value);
		const baselineTitle = existingNote.value?.title ?? emptyString;
		if (draft && (draft.title !== baselineTitle || draft.content !== loadedContent.value)) {
			const ok = await confirm({
				title: "Restore unsaved draft?",
				message: `An unsaved draft from ${new Date(draft.savedAt).toLocaleString()} was found for this note.`,
				confirmText: "Restore",
				cancelText: "Discard draft"
			});
			if (ok) {
				isEditing.value = true;
				editTitle.value = draft.title;
				editContent.value = draft.content;
				editTags.value = draft.tags;
				undoRedo.push(editContent.value);
			} else {
				clearDraft(draftId.value);
			}
		}
	}

	function flushDraft() {
		persistDraft.cancel();
		if (hasUnsavedChanges.value) {
			saveDraft(draftId.value, editTitle.value, editContent.value, editTags.value);
		}
	}

	function formatDate(date?: Date): string {
		if (!date) {
			return emptyString;
		}
		return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
	}

	function onBeforeUnload(e: BeforeUnloadEvent) {
		if (hasUnsavedChanges.value) {
			e.preventDefault();
		}
	}

	useTruncate(useTemplateRef("title-input"), editTitle, 1024);

	onMounted(() => {
		if (!listViewRoutes.includes(backRoute.value)) {
			appStore.lastView.value = null;
		}
		window.addEventListener("beforeunload", onBeforeUnload);
		window.addEventListener("resize", adjustTextAreaHeight);
		window.addEventListener("pagehide", flushDraft);
	});

	onBeforeUnmount(() => {
		persistDraft.cancel();
		debouncedPushUndo.cancel();
		appStore.currentColour.value = undefined;
		window.removeEventListener("pagehide", flushDraft);
		window.removeEventListener("resize", adjustTextAreaHeight);
		window.removeEventListener("beforeunload", onBeforeUnload);
	});

	onBeforeRouteLeave(async () => {
		if (!hasUnsavedChanges.value) {
			return true;
		}
		const ok = await confirmDiscardChanges();
		if (ok) {
			clearDraft(draftId.value);
		}
		return ok;
	});

	watch(
		() => props.id,
		async id => {
			isContentLoaded.value = isCreateMode.value;
			loadedContent.value = emptyString;
			editContent.value = emptyString;
			editColour.value = undefined;
			editTags.value = undefined;
			isEditing.value = isCreateMode.value;
			if (id && !isCreateMode.value) {
				const note = existingNote.value;
				if (note) {
					loadedContent.value = (await notesStore.getNoteContent(id)) ?? emptyString;
					editColour.value = note.colour as Colour;
					editTags.value = copyNullableArray(note.tags);
				}
			} else {
				editTags.value = Array.from(notesStore.searchTags.value);
			}
			isContentLoaded.value = true;
			undoRedo.reset(loadedContent.value);
			await restoreDraft();
		},
		{ immediate: true }
	);

	watch(
		[editTitle, editContent, editTags],
		() => {
			adjustTextAreaHeight();
			persistDraft();
		},
		{ deep: true }
	);

	watch(editColour, colour => {
		appStore.currentColour.value = colour;
	});

	return (
		<>
			<div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
				<VaporRouterLink to={backRoute.value} class="btn btn-secondary btn-sm" aria-label="Back to notes">
					<Icon type="chevronLeft"/>
					<span class="ms-2">Back</span>
				</VaporRouterLink>
				<div class="d-flex flex-wrap gap-2 ms-auto">
					<button class="btn btn-outline-secondary btn-sm" onClick={() => setFontScaling(`+`)} title="Increase font size" aria-label="Increase font size">
						<Icon type="aPlus"/>
					</button>
					<button class="btn btn-outline-secondary btn-sm" onClick={() => setFontScaling(`-`)} title="Decrease font size" aria-label="Decrease font size">
						<Icon type="aMinus"/>
					</button>
				</div>
				<div class="d-flex flex-wrap gap-2" v-if={!isCreateMode && !isEditing && isTrashed}>
					<button class="btn btn-outline-primary btn-sm" onClick={restoreNote} title="Restore" aria-label="Restore">
						<Icon type="reply"/>
						<span class="d-none d-sm-inline ms-2">Restore</span>
					</button>
					<button class="btn btn-outline-secondary btn-sm" v-if={existingNote} onClick={() => exportNote(existingNote.value!)} title="Export" aria-label="Export">
						<Icon type="download"/>
						<span class="d-none d-sm-inline ms-2">Export</span>
					</button>
					<button class="btn btn-outline-danger btn-sm" onClick={permanentlyDeleteNote} title="Delete Permanently" aria-label="Delete Permanently">
						<Icon type="trashFill"/>
						<span class="d-none d-sm-inline ms-2">Delete Permanently</span>
					</button>
				</div>
				<div class="d-flex flex-wrap gap-2" v-else-if={!isCreateMode && !isEditing}>
					<button class="btn btn-outline-primary btn-sm" onClick={startEditing} title="Edit" aria-label="Edit">
						<Icon type="pen"/>
						<span class="d-none d-sm-inline ms-2">Edit</span>
					</button>
					<button class="btn btn-outline-secondary btn-sm" onClick={copyToClipboard} title="Copy to clipboard" aria-label="Copy to clipboard">
						<Icon type="copy"/>
						<span class="d-none d-sm-inline ms-2">Copy</span>
					</button>
					<button class="btn btn-outline-secondary btn-sm" v-if={!isFaved} onClick={faveNote} title="Favourite" aria-label="Favourite">
						<Icon type="star"/>
						<span class="d-none d-sm-inline ms-2">Favourite</span>
					</button>
					<button class="btn btn-outline-secondary btn-sm" v-else onClick={unfaveNote} title="Unfavourite" aria-label="Unfavourite">
						<Icon type="starFill"/>
						<span class="d-none d-sm-inline ms-2">Unfavourite</span>
					</button>
					<template v-if={!isArchived}>
						<button class="btn btn-outline-secondary btn-sm" v-if={!isPinned} onClick={pinNote} title="Pin" aria-label="Pin">
							<Icon type="pinAngle"/>
							<span class="d-none d-sm-inline ms-2">Pin</span>
						</button>
						<button class="btn btn-outline-secondary btn-sm" v-else onClick={unpinNote} title="Unpin" aria-label="Unpin">
							<Icon type="pinAngleFill"/>
							<span class="d-none d-sm-inline ms-2">Unpin</span>
						</button>
					</template>
					<button class="btn btn-outline-secondary btn-sm" v-if={existingNote} onClick={() => exportNote(existingNote.value!)} title="Download" aria-label="Download">
						<Icon type="download"/>
						<span class="d-none d-sm-inline ms-2">Download</span>
					</button>
					<button class="btn btn-outline-secondary btn-sm" v-if={isArchived} onClick={unarchiveNote} title="Unarchive" aria-label="Unarchive">
						<Icon type="boxArrowUp"/>
						<span class="d-none d-sm-inline ms-2">Unarchive</span>
					</button>
					<button class="btn btn-outline-secondary btn-sm" v-else onClick={archiveNote} title="Archive" aria-label="Archive">
						<Icon type="archive"/>
						<span class="d-none d-sm-inline ms-2">Archive</span>
					</button>
					<button class="btn btn-outline-danger btn-sm" onClick={deleteNote} title="Delete" aria-label="Delete">
						<Icon type="trash"/>
						<span class="d-none d-sm-inline ms-2">Delete</span>
					</button>
				</div>
				<div class="d-flex flex-wrap gap-2" v-if={isEditing}>
					<div ref="dropdown-toggle" class={["colour-circle toolbar-icon rounded-circle", { [!!editColour ? `bg-${editColour}` : `vibgyor`]: true }]} onClick={() => dropdown.toggle()} role="button" aria-label="Apply Colour"></div>
					<button class="btn btn-outline-secondary btn-sm" disabled={!undoRedo.canUndo.value} onClick={doUndo} title="Undo" aria-label="Undo">
						<Icon type="arrowCounterclockwise"/>
						<span class="d-none d-sm-inline ms-2">Undo</span>
					</button>
					<button class="btn btn-outline-secondary btn-sm" disabled={!undoRedo.canRedo.value} onClick={doRedo} title="Redo" aria-label="Redo">
						<Icon type="arrowClockwise"/>
						<span class="d-none d-sm-inline ms-2">Redo</span>
					</button>
					<button class="btn btn-primary btn-sm" disabled={!hasUnsavedChanges} onClick={saveNote} title="Save" aria-label="Save">
						<Icon type="floppy"/>
						<span class="d-none d-sm-inline ms-2">Save</span>
					</button>
					<button class="btn btn-outline-secondary btn-sm" onClick={cancelEditing} title="Cancel" aria-label="Cancel">
						<Icon type="xLg"/>
						<span class="d-none d-sm-inline ms-2">Cancel</span>
					</button>
				</div>
			</div>
			<div v-if={dropdown.show.value} class="d-flex justify-content-end mb-3">
				<DisplayColourList selected={editColour.value} selection-changed={updateColour}/>
			</div>
			<template v-if={!isEditing && existingNote.value}>
				<h2 class="note-title mb-3">{existingNote.value!.title}</h2>
				<div class="d-flex flex-wrap gap-2">
					<div class="badge text-bg-secondary">Created {formatDate(existingNote.value!.createdAt)}</div>
					<div class="badge text-bg-secondary" v-if={existingNote.value!.modifiedAt}>Modified {formatDate(existingNote.value!.modifiedAt)}</div>
				</div>
				<hr/>
				<Spinner v-if={!isContentLoaded} message="Loading note..." show-message={false}/>
				<div v-else class="note-content">{loadedContent}</div>
			</template>
			<div class="edit-note">
				<template v-if={isEditing}>
					<input ref="title-input" value={editTitle.value.trim()} type="text" class="form-control form-control-lg" placeholder="Title" onInput={e => (editTitle.value = e.currentTarget.value.trim())}/>
					<hr class="my-1"/>
					<textarea ref="edit-text-area" value={editContent.value} onInput={onContentInput} class="form-control note-textarea" placeholder="Start writing..." rows="12"></textarea>
				</template>
			</div>
			<DisplayTagList v-if={!!editTags.value?.length || isEditing.value} class="my-3" activeTags={editTags.value} allowEdit={isEditing.value} allowCreate={true} onSelectionChanged={tags => (editTags.value = tags)}/>
			<hr v-else/>
			<div class="d-flex flex-wrap gap-2 mt-3" v-if={hasContent}>
				<span class="badge text-bg-secondary" v-if={sentenceCount}>{sentenceCount} sentences</span>
				<span class="badge text-bg-secondary" v-if={wordCount}>{wordCount} words</span>
				<span class="badge text-bg-secondary" v-if={characterCount}>{characterCount} characters</span>
			</div>
		</>
	);
}