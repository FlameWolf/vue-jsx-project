import { computed, reactive, readonly, ref, toRaw, toRef } from "vue";
import { emptyString } from "@/constants/common";
import { TRASH_RETENTION_MS } from "@/constants/notes";
import { arrayContainsSet, mergeArrays } from "@/utils/common";
import { contains } from "@/utils/text-analysis";
import { notesRepository } from "@/storage/NotesRepository";
import { tagsRepository } from "@/storage/TagsRepository";
import type { NoteModel } from "@/models/NoteModel";
import type { UUID } from "crypto";

type FilterType = "any" | "all";

interface NotesState {
	notes: NoteModel[];
	tags: string[];
	searchText: string;
	searchColours: Set<string>;
	searchTags: Set<string>;
	tagFilter: FilterType;
	isLoading: boolean;
	isSearching: boolean;
}

let hydrated = false;
const store = reactive<NotesState>({
	notes: [],
	tags: [],
	searchText: emptyString,
	searchColours: new Set<string>(),
	searchTags: new Set<string>(),
	tagFilter: "any",
	isLoading: true,
	isSearching: false
});
const contentMatchedIds = ref(new Set<UUID>());
export const notes = readonly(toRef(() => store.notes));
export const tags = readonly(toRef(() => store.tags));
export const searchText = computed(() => store.searchText);
export const searchColours = computed(() => store.searchColours);
export const searchTags = computed(() => store.searchTags);
export const tagFilter = computed(() => store.tagFilter);
export const isLoading = computed(() => store.isLoading);
export const isSearching = computed(() => store.isSearching);
export const searchResults = computed(() => {
	const trimmed = store.searchText.trim();
	const predicates: Array<(note: NoteModel) => boolean> = [];
	if (trimmed) {
		predicates.push(note => contains(note.title, trimmed) || contentMatchedIds.value.has(note.id));
	}
	if (store.searchColours.size > 0) {
		predicates.push(note => !!note.colour && store.searchColours.has(note.colour));
	}
	if (store.searchTags.size > 0) {
		predicates.push(note => {
			switch (store.tagFilter) {
				case "any": {
					return note.tags?.some(tag => store.searchTags.has(tag)) ?? false;
				}
				case "all": {
					return !!note.tags && arrayContainsSet(note.tags, store.searchTags);
				}
			}
		});
	}
	const results = store.notes.filter(note => predicates.every(predicate => predicate(note)));
	return results;
});
export const activeNotes = computed(() => searchResults.value.filter(note => !note.archivedAt && !note.deletedAt));
export const favedNotes = computed(() => searchResults.value.filter(note => note.favedAt && !note.deletedAt));
export const archivedNotes = computed(() => searchResults.value.filter(note => note.archivedAt && !note.deletedAt));
export const trashedNotes = computed(() => searchResults.value.filter(note => note.deletedAt));

export async function hydrateNotes(): Promise<void> {
	if (hydrated) {
		return;
	}
	hydrated = true;
	try {
		store.notes = await notesRepository.loadAll();
		store.tags = mergeArrays(
			store.notes
				.map(note => note.tags)
				.filter(Boolean)
				.flat() as string[],
			await tagsRepository.loadAll()
		);
	} catch (err) {
		store.notes = [];
		console.error("Failed to load notes from storage", err);
	} finally {
		store.isLoading = false;
	}
}

export function setSearchText(query: string) {
	const trimmed = query.trim();
	store.searchText = trimmed;
	if (!trimmed) {
		store.isSearching = false;
		contentMatchedIds.value.clear();
		return;
	}
	store.isSearching = true;
	notesRepository
		.search(content => contains(content, trimmed))
		.then(matches => {
			contentMatchedIds.value = matches as Set<UUID>;
		})
		.finally(() => {
			store.isSearching = false;
		});
}

export function toggleSearchColour(colour: string) {
	if (!store.searchColours.has(colour)) {
		store.searchColours.add(colour);
		return;
	}
	store.searchColours.delete(colour);
}

export function setSearchColours(colours: string[]) {
	store.searchColours = new Set(colours);
}

export function addSearchTag(tag: string) {
	store.searchTags.add(tag);
}

export function setSearchTags(tags: string[]) {
	store.searchTags = new Set(tags);
}

export function setFilterType(type: FilterType) {
	store.tagFilter = type;
}

export function setNoteTags(id: UUID, tags: string[] | undefined) {
	const note = store.notes.find(note => note.id === id);
	if (note) {
		note.tags = tags?.length ? tags : undefined;
	}
}

export async function addNote(note: NoteModel) {
	store.notes.push(note);
	store.tags = mergeArrays(store.tags, note.tags);
	await notesRepository.saveFull(toRaw(note));
}

export async function updateNote(data: { id: UUID; title: string; content: string }) {
	const note = store.notes.find(note => note.id === data.id);
	if (note) {
		note.update(data.title, data.content);
		store.tags = mergeArrays(store.tags, note.tags);
		await notesRepository.saveFull(toRaw(note));
	}
}

export const getNote = (id: UUID): NoteModel | undefined => {
	return store.notes.find(note => note.id === id);
};

export const getNoteContent = (id: UUID): Promise<string | undefined> => {
	return notesRepository.loadContent(id);
};

async function applyToNote(id: UUID, mutator: (note: NoteModel) => void) {
	const note = store.notes.find(note => note.id === id);
	if (note) {
		mutator(note);
		await notesRepository.saveMeta(toRaw(note));
	}
}

async function applyToMany(ids: ReadonlyArray<UUID>, mutator: (note: NoteModel) => void): Promise<void> {
	const idSet = new Set(ids);
	const targetNotes = store.notes.filter(note => idSet.has(note.id));
	targetNotes.forEach(mutator);
	await notesRepository.saveManyMeta(targetNotes.map(toRaw));
}

export async function faveNote(id: UUID) {
	await applyToNote(id, note => note.fave());
}

export async function faveMultiple(ids: ReadonlyArray<UUID>) {
	await applyToMany(ids, note => note.fave());
}

export async function unfaveNote(id: UUID) {
	await applyToNote(id, note => note.unfave());
}

export async function unfaveMultiple(ids: ReadonlyArray<UUID>) {
	await applyToMany(ids, note => note.unfave());
}

export async function pinNote(id: UUID) {
	await applyToNote(id, note => note.pin());
}

export async function unpinNote(id: UUID) {
	await applyToNote(id, note => note.unpin());
}

export async function archiveNote(id: UUID) {
	await applyToNote(id, note => note.archive());
}

export async function archiveMultiple(ids: ReadonlyArray<UUID>) {
	await applyToMany(ids, note => note.archive());
}

export async function unarchiveNote(id: UUID) {
	await applyToNote(id, note => note.unarchive());
}

export async function unarchiveMultiple(ids: ReadonlyArray<UUID>) {
	await applyToMany(ids, note => note.unarchive());
}

export async function trashNote(id: UUID) {
	await applyToNote(id, note => note.trash());
}

export async function trashMultiple(ids: ReadonlyArray<UUID>) {
	await applyToMany(ids, note => note.trash());
}

export async function restoreFromTrash(id: UUID) {
	await applyToNote(id, note => note.restore());
}

export async function restoreFromTrashMultiple(ids: ReadonlyArray<UUID>) {
	await applyToMany(ids, note => note.restore());
}

export async function setColour(id: UUID, colour: string) {
	await applyToNote(id, note => note.setColour(colour));
}

export async function setColourMultiple(ids: ReadonlyArray<UUID>, colour: string) {
	await applyToMany(ids, note => note.setColour(colour));
}

export async function unsetColour(id: UUID) {
	await applyToNote(id, note => note.unsetColour());
}

export async function unsetColourMultiple(ids: ReadonlyArray<UUID>) {
	await applyToMany(ids, note => note.unsetColour());
}

export async function addTags(id: UUID, tags: string[]) {
	await applyToNote(id, note => note.addTags(tags));
	store.tags = mergeArrays(store.tags, tags);
}

export async function addTagsMultiple(ids: ReadonlyArray<UUID>, tags: string[]) {
	await applyToMany(ids, note => note.addTags(tags));
	store.tags = mergeArrays(store.tags, tags);
}

export async function removeTags(id: UUID, tags: string[]) {
	await applyToNote(id, note => note.removeTags(tags));
}

export async function removeTagsMultiple(ids: ReadonlyArray<UUID>, tags: string[]) {
	await applyToMany(ids, note => note.removeTags(tags));
}

export async function permanentlyDelete(id: UUID) {
	const index = store.notes.findIndex(note => note.id === id);
	if (index !== -1) {
		store.notes.splice(index, 1);
		await notesRepository.remove(id);
	}
}

export async function permanentlyDeleteMultiple(ids: ReadonlyArray<UUID>) {
	const idSet = new Set<UUID>(ids);
	store.notes = store.notes.filter(note => !idSet.has(note.id));
	await notesRepository.removeMany(ids as UUID[]);
}

export async function purgeExpiredTrash() {
	const cutoff = Date.now() - TRASH_RETENTION_MS;
	const expiredIds = store.notes
		.filter(note => {
			if (!note.deletedAt) {
				return false;
			}
			const tombstoneTime = note.deletedAt.getTime();
			return tombstoneTime > 0 && tombstoneTime < cutoff;
		})
		.map(expired => expired.id);
	if (expiredIds.length > 0) {
		await permanentlyDeleteMultiple(expiredIds);
	}
	return expiredIds;
}

function addOrUpdate(updatedNote: NoteModel) {
	const index = store.notes.findIndex(note => note.id === updatedNote.id);
	if (index === -1) {
		store.notes.push(updatedNote);
	} else {
		store.notes.splice(index, 1, updatedNote);
	}
	store.tags = mergeArrays(store.tags, updatedNote.tags);
}

export async function replaceNote(updatedNote: NoteModel) {
	addOrUpdate(updatedNote);
	await notesRepository.saveFull(toRaw(updatedNote));
}

export async function replaceMultiple(updatedNotes: NoteModel[]) {
	updatedNotes.forEach(addOrUpdate);
	await notesRepository.saveManyFull(updatedNotes.map(toRaw));
}

export async function createTag(tag: string) {
	if (!store.tags.includes(tag)) {
		store.tags.push(tag);
	}
	await tagsRepository.save(tag);
}

export async function createTags(tags: string[]) {
	tags.filter(tag => !store.tags.includes(tag)).forEach(tag => store.tags.push(tag));
	await tagsRepository.saveMany(tags);
}

export async function deleteTags(tags: string[]) {
	const tagSet = new Set(tags);
	const affectedIds = store.notes.reduce((ids, note) => {
		if (note.tags?.some(tag => tagSet.has(tag))) {
			ids.push(note.id);
		}
		return ids;
	}, [] as UUID[]);
	await applyToMany(affectedIds, note => note.removeTags(tags));
	store.tags = store.tags.filter(tag => !tagSet.has(tag));
	await Promise.all(tags.map(tag => tagsRepository.remove(tag)));
	return affectedIds.length;
}