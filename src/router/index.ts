import { ref } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import DisplayNoteList from "@/components/DisplayNoteList";
import EditNote from "@/components/EditNote";

declare module "vue-router" {
	interface RouteMeta {
		fromPath?: string;
	}
}

export const isNavigating = ref(false);
export const listViewRoutes = ["/notes", "/notes/favourite", "/notes/archive", "/notes/trash"];
const scrollPositions = new Map<string, number>();
const router = createRouter({
	history: createWebHistory(import.meta.env.BASE_URL),
	routes: [
		{ path: "/", redirect: "/notes" },
		{ path: "/favourite", redirect: "/notes/favourite" },
		{ path: "/archive", redirect: "/notes/archive" },
		{ path: "/trash", redirect: "/notes/trash" },
		{
			path: "/notes",
			component: DisplayNoteList,
			props: { view: "active" }
		},
		{
			path: "/notes/favourite",
			component: DisplayNoteList,
			props: { view: "favourited" }
		},
		{
			path: "/notes/archive",
			component: DisplayNoteList,
			props: { view: "archived" }
		},
		{
			path: "/notes/trash",
			component: DisplayNoteList,
			props: { view: "trash" }
		},
		{ path: "/notes/new", component: EditNote },
		{
			path: "/notes/:id",
			component: EditNote,
			props: route => Object.assign(route.params, { backRoute: route.meta.fromPath })
		},
		{ path: "/privacy", component: () => import("@/components/PrivacyPolicy") },
		{ path: "/terms", component: () => import("@/components/TermsOfService") }
	]
});
router.beforeEach((to, from) => {
	isNavigating.value = true;
	const fromPath = from.path;
	if (listViewRoutes.includes(fromPath)) {
		scrollPositions.set(fromPath, window.scrollY);
		to.meta.fromPath = fromPath;
	}
});
router.afterEach((to, _) => {
	const toPath = to.path;
	const scrollTop = (listViewRoutes.includes(toPath) && scrollPositions.get(toPath)) || 0;
	setTimeout(() => {
		window.scrollTo({
			top: scrollTop,
			behavior: "instant"
		});
	});
	isNavigating.value = false;
});

export default router;