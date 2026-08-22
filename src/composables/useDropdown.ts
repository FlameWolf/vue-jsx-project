import { onBeforeUnmount, onMounted, readonly, ref, type TemplateRef } from "vue";

type DropdownOptions = {
	initialState?: boolean;
	autoClose?: boolean;
	dropdown?: TemplateRef<HTMLElement>;
};

export function useDropdown(trigger: TemplateRef<HTMLElement>, { initialState = false, autoClose = true, dropdown }: DropdownOptions = {}) {
	const show = ref(initialState);

	function toggle(force?: boolean) {
		show.value = force ?? !show.value;
	}

	function clickedOutside(event: MouseEvent) {
		if (!show.value) {
			return;
		}
		const path = event.composedPath();
		for (const target of path) {
			if (target === trigger.value) {
				return;
			}
			if (!autoClose && target === dropdown?.value) {
				return;
			}
		}
		show.value = false;
	}

	onMounted(() => {
		document.addEventListener("click", clickedOutside);
	});

	onBeforeUnmount(() => {
		document.removeEventListener("click", clickedOutside);
	});

	return {
		show: readonly(show),
		toggle
	};
}