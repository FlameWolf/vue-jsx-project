import { ref, computed, readonly, type Ref, type ComputedRef, type DeepReadonly } from "vue";
import { MAX_HISTORY } from "@/constants/notes";

export interface UndoRedo<T> {
	current: Readonly<Ref<DeepReadonly<T>>>;
	push: (value: T) => void;
	reset: (value: T) => void;
	undo: () => void;
	redo: () => void;
	canUndo: ComputedRef<boolean>;
	canRedo: ComputedRef<boolean>;
}

export function useUndoRedo<T>(initial: T): UndoRedo<T> {
	const current = ref<T>(initial) as Ref<T>;
	const past = ref<T[]>([]) as Ref<T[]>;
	const future = ref<T[]>([]) as Ref<T[]>;
	const canUndo = computed(() => past.value.length > 0);
	const canRedo = computed(() => future.value.length > 0);

	function push(value: T) {
		if (value === current.value) {
			return;
		}
		past.value.push(current.value);
		if (past.value.length > MAX_HISTORY) {
			past.value.shift();
		}
		current.value = value;
		future.value = [];
	}

	function reset(value: T) {
		current.value = value;
		past.value = [];
		future.value = [];
	}

	function undo() {
		if (past.value.length === 0) {
			return;
		}
		future.value.push(current.value);
		current.value = past.value.pop()!;
	}

	function redo() {
		if (future.value.length === 0) {
			return;
		}
		past.value.push(current.value);
		current.value = future.value.pop()!;
	}

	return {
		current: readonly(current),
		canUndo,
		canRedo,
		push,
		reset,
		undo,
		redo
	};
}