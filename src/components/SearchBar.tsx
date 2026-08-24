import { computed, useTemplateRef } from "vue";
import { useRoute } from "vue-router";
import { emptyString } from "@/constants/common";
import { debounce } from "@/utils/timing";
import * as notesStore from "@/stores/notes";
import { listViewRoutes } from "@/router";

export default function SearchBar() {
	const route = useRoute();
	const searchInput = useTemplateRef<HTMLInputElement>("search-input");
	const isSearchMode = computed(() => !!notesStore.searchText.value);
	const debouncedSearch = debounce(() => {
		notesStore.setSearchText(searchInput.value?.value?.trim() ?? emptyString);
	}, 300);

	function clearSearch() {
		debouncedSearch.cancel();
		searchInput.value!.value = emptyString;
		notesStore.setSearchText(emptyString);
	}

	return (
		<>
			<div class="me-auto position-relative">
				<input ref="search-input" type="text" class="form-control pe-5" placeholder="Search" aria-label="Search notes" disabled={!listViewRoutes.includes(route.path)} onInput={debouncedSearch}/>
				<button v-if={isSearchMode} class="btn-close small position-absolute top-50 end-0 translate-middle-y me-2" onClick={clearSearch} aria-label="Clear search"></button>
			</div>
		</>
	);
}