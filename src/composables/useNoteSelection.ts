import { computed, reactive } from "vue";
import type { UUID } from "crypto";

interface SelectionState {
	isSelecting: boolean;
	selectedIds: Set<UUID>;
}

const state = reactive<SelectionState>({
	isSelecting: false,
	selectedIds: new Set<UUID>()
});
export const isSelecting = computed(() => state.isSelecting);
export const selectedIds = computed(() => state.selectedIds);
export const selectedCount = computed(() => state.selectedIds.size);

export function enterSelectionMode() {
	state.isSelecting = true;
}

export function exitSelectionMode() {
	state.selectedIds = new Set();
	state.isSelecting = false;
}

export function toggleSelection(id: UUID) {
	const next = new Set(state.selectedIds);
	if (next.has(id)) {
		next.delete(id);
	} else {
		next.add(id);
	}
	state.selectedIds = next;
}

export function isSelected(id: UUID): boolean {
	return state.selectedIds.has(id);
}

export function selectAll(ids: UUID[]) {
	state.selectedIds = new Set(ids);
}

export function clearSelection() {
	state.selectedIds = new Set();
}