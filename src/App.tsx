import "@/styles.css";
import { onMounted } from "vue";
import { RouterLink, RouterView } from "vue-router";
import { currentColour } from "@/stores/app";
import { isLoading, hydrateNotes } from "@/stores/notes";
import { isNavigating } from "@/router";
import { purgeStaleDrafts } from "@/composables/useNoteDraft";
import Icon from "@/components/Icon";
import SearchBar from "@/components/SearchBar";
import SyncControls from "@/components/SyncControls";
import ThemeToggle from "@/components/ThemeToggle";
import Spinner from "@/components/Spinner";
import ScrollButtons from "@/components/ScrollButtons";
import NotificationList from "@/components/NotificationList";
import ConfirmDialogue from "@/components/ConfirmDialogue";

onMounted(async () => {
	await hydrateNotes();
	purgeStaleDrafts();
});

export default function App() {
	return (
		<>
			<nav class="navbar navbar-expand bg-body-tertiary border-bottom px-2">
				<div class="container gap-2">
					<RouterLink to="/notes" class="navbar-brand">
						<img class="logo" src="/logo.svg" alt="QuickPad Logo"/>
					</RouterLink>
					<SearchBar/>
					<div class="d-flex align-items-center gap-2">
						<SyncControls/>
						<ThemeToggle/>
					</div>
				</div>
			</nav>
			<main class={["flex-grow-1 container px-2 py-4", { [`bg-${currentColour}`]: !!currentColour }]}>
				<Spinner v-if={isLoading} message="Loading notes..."/>
				<RouterView v-else/>
			</main>
			<footer class="bg-body-tertiary border-top">
				<div class="d-flex flex-wrap justify-content-center align-items-center gap-3 small text-muted px-2 py-3">
					<span>QuickPad</span>
					<RouterLink to="/privacy" class="link-secondary text-decoration-none">Privacy Policy</RouterLink>
					<RouterLink to="/terms" class="link-secondary text-decoration-none">Terms of Service</RouterLink>
					<a target="_blank" href="https://github.com/FlameWolf/quick-pad" class="icon-link link-secondary text-decoration-none">
						<Icon type="codeSlash"/>
						<span>Source</span>
					</a>
				</div>
			</footer>
			<ScrollButtons/>
			<NotificationList/>
			<ConfirmDialogue/>
			<div v-if={isNavigating} class="nav-overlay"></div>
		</>
	);
}