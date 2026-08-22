import { computed, reactive, toRef, watch } from "vue";
import { emptyString } from "@/constants/common";
import { FONT_SCALE_FACTOR } from "@/constants/ui";

interface AppState {
	lastView: View | null | undefined;
	currentColour: Colour | undefined;
	fontScaleFactor: number;
}

const store = reactive<AppState>({
	lastView: null,
	currentColour: undefined,
	fontScaleFactor: getFontScaleFactor()
});
export const lastView = toRef(store, "lastView");
export const currentColour = toRef(store, "currentColour");
export const fontScaleFactor = computed(() => store.fontScaleFactor);

function getFontScaleFactor(): number {
	const factor = parseInt(localStorage.getItem(FONT_SCALE_FACTOR) ?? emptyString);
	if (Number.isNaN(factor)) {
		return 0;
	}
	return factor;
}

export function setFontScaleFactor(factor: number) {
	if (factor < 0 || factor > 10) {
		return;
	}
	store.fontScaleFactor = factor;
	if (factor === 0) {
		localStorage.removeItem(FONT_SCALE_FACTOR);
		return;
	}
	localStorage.setItem(FONT_SCALE_FACTOR, factor.toString());
}

watch(
	[fontScaleFactor, currentColour],
	([factor, colour]) => {
		const rootElement = document.documentElement;
		if (factor === 0) {
			rootElement.style.removeProperty("--font-scale-factor");
		} else {
			rootElement.style.setProperty("--font-scale-factor", factor.toString());
		}
		if (colour === undefined) {
			rootElement.style.removeProperty("--bg-colour-base");
		} else {
			rootElement.style.setProperty("--bg-colour-base", colour);
		}
	},
	{ immediate: true }
);