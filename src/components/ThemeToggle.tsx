import { computed, onMounted } from "vue";
import { activeTheme, applyTheme, Theme, toggleTheme } from "@/composables/useTheme";
import Icon from "@/components/Icon";

export default function ThemeToggle() {
	const isDark = computed(() => activeTheme.value === Theme.Dark);

	onMounted(() => {
		applyTheme(activeTheme.value);
	});

	return (
		<>
			<button class="btn btn-secondary btn-sm" onClick={toggleTheme} aria-label={`Switch to ${isDark ? Theme.Light : Theme.Dark} theme`}>
				<Icon type={isDark.value ? `moonStarsFill` : `sunFill`}/>
			</button>
		</>
	);
}