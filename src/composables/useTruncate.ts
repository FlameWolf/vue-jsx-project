import { nextTick, watch, type Ref, type TemplateRef } from "vue";
import { isTextWithin, truncate } from "@/utils/text-analysis";

export function useTruncate(input: TemplateRef<HTMLInputElement>, model: Ref<string>, limit: number) {
	watch(model, content => {
		if (isTextWithin(content, limit)) {
			return;
		}
		model.value = truncate(content, limit);
		const elem = input.value;
		if (elem && document.activeElement === elem) {
			const start = elem.selectionStart;
			const end = elem.selectionEnd;
			nextTick(() => {
				elem.setSelectionRange(start, end);
			});
		}
	});
}