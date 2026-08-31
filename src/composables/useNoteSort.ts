import { computed, reactive, watch } from "vue";
import { colours } from "@/constants/colours";
import { SORT_BY_KEY, SORT_DIRECTION_KEY, SORT_DIRECTIONS, SORT_FIELDS } from "@/constants/sort";
import { getKV, setKV } from "@/storage/db";
import type { NoteModel } from "@/models/NoteModel";

export type SortField = (typeof SORT_FIELDS)[number];
export type SortOrder = (typeof SORT_DIRECTIONS)[number];

interface SortState {
	sortField: SortField;
	sortOrder: SortOrder;
}

let hydrated = false;
const state = reactive<SortState>({
	sortField: "modifiedAt",
	sortOrder: "desc"
});
export const sortField = computed(() => state.sortField);
export const sortOrder = computed(() => state.sortOrder);

export async function hydrateSortPrefs(): Promise<void> {
	if (hydrated) {
		return;
	}
	hydrated = true;
	const storedBy = await getKV(SORT_BY_KEY);
	if (SORT_FIELDS.includes(storedBy as SortField)) {
		state.sortField = storedBy as SortField;
	}
	const storedDir = await getKV(SORT_DIRECTION_KEY);
	if (SORT_DIRECTIONS.includes(storedDir as SortOrder)) {
		state.sortOrder = storedDir as SortOrder;
	}
	watch(
		() => state.sortField,
		async field => {
			await setKV(SORT_BY_KEY, field);
		}
	);
	watch(
		() => state.sortOrder,
		async order => {
			await setKV(SORT_DIRECTION_KEY, order);
		}
	);
}

function getColourValue(name: string | undefined): number {
	if (!name) {
		return 0;
	}
	return colours.indexOf(name as Colour);
}

function compareNotes(a: NoteModel, b: NoteModel, field: SortField): number {
	switch (field) {
		case "title":
			return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
		case "createdAt":
			return a.createdAt.getTime() - b.createdAt.getTime();
		case "modifiedAt": {
			const aTime = (a.modifiedAt ?? a.createdAt).getTime();
			const bTime = (b.modifiedAt ?? b.createdAt).getTime();
			return aTime - bTime;
		}
		case "colour": {
			const aColour = getColourValue(a.colour);
			const bcolour = getColourValue(b.colour);
			return aColour - bcolour;
		}
		case "sentenceCount":
			return a.sentenceCount - b.sentenceCount;
		case "wordCount":
			return a.wordCount - b.wordCount;
		case "characterCount":
			return a.characterCount - b.characterCount;
	}
}

export function setSortField(field: SortField) {
	state.sortField = field;
}

export function setSortOrer(direction: SortOrder) {
	state.sortOrder = direction;
}

export function toggleSortDirection() {
	setSortOrer(state.sortOrder === "asc" ? "desc" : "asc");
}

export function getSortedNotes(notes: ReadonlyArray<NoteModel>): NoteModel[] {
	const multiplier = state.sortOrder === "asc" ? 1 : -1;
	return notes.toSorted((a, b) => {
		if (a.pinnedAt && !b.pinnedAt) {
			return -1;
		}
		if (b.pinnedAt && !a.pinnedAt) {
			return 1;
		}
		if (a.pinnedAt && b.pinnedAt) {
			return b.pinnedAt.getTime() - a.pinnedAt.getTime();
		}
		return compareNotes(a, b, state.sortField) * multiplier;
	});
}