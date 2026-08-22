import { ref, readonly, toValue } from "vue";

export enum Theme {
	Dark = "dark",
	Light = "light"
}

const theme = ref(
	toValue(() => {
		const savedTheme = localStorage.getItem("theme");
		if (savedTheme === Theme.Dark || savedTheme === Theme.Light) {
			return savedTheme;
		}
		return window.matchMedia("(prefers-color-scheme: dark)").matches ? Theme.Dark : Theme.Light;
	})
);
export const activeTheme = readonly(theme);

export function applyTheme(newTheme: Theme) {
	theme.value = newTheme;
	document.documentElement.setAttribute("data-bs-theme", newTheme);
	localStorage.setItem("theme", newTheme);
}

export function toggleTheme() {
	applyTheme(theme.value === Theme.Dark ? Theme.Light : Theme.Dark);
}