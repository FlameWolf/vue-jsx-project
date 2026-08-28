import { ref, computed, watch, onMounted, onBeforeUnmount, useTemplateRef } from "vue";
import { isLoading, purgeExpiredTrash } from "@/stores/notes";
import { confirm } from "@/composables/useConfirmDialogue";
import { useDropdown } from "@/composables/useDropdown";
import { hydrateAuthState, isConfigured, isReady, isSignedIn, signIn, signOut, tryRestoreSession, user } from "@/composables/useGoogleAuth";
import { autoSyncEnabled, doPullAndPush, hydrateSyncMetadata, isSyncing, lastSyncedAt, requestSync, setAutoSync, syncError } from "@/composables/useNotesSync";
import Spinner from "@/components/Spinner";
import Icon from "@/components/Icon";

export default function SyncControls() {
	let readyTimeout: ReturnType<typeof setTimeout> | null = null;
	const syncMenuTrigger = useTemplateRef<HTMLElement>("sync-menu-trigger");
	const dropdown = useDropdown(syncMenuTrigger);
	const authTimedOut = ref(false);

	async function handleSync(force = false) {
		if (!force) {
			await doPullAndPush();
			return;
		}
		const ok = await confirm({
			title: "Force Sync",
			message: "This will pull and push all notes from cloud and local. It might take more time and use more data than a normal sync. Are you sure you want to continue?",
			confirmText: "Yes",
			cancelText: "Cancel",
			variant: "warning"
		});
		if (ok) {
			await doPullAndPush({ force: true });
		}
	}

	async function handleSignOut() {
		const ok = await confirm({
			title: "Sign Out",
			message: "Are you sure you want to sign out? This will stop syncing your notes with Google Drive.",
			confirmText: "Sign Out",
			cancelText: "Cancel",
			variant: "warning"
		});
		if (ok) {
			await signOut();
		}
	}

	async function handleToggleAutoSync() {
		await setAutoSync(!autoSyncEnabled.value);
	}

	const lastSyncedLabel = computed(() => {
		if (!lastSyncedAt.value) {
			return null;
		}
		const diff = Date.now() - lastSyncedAt.value.getTime();
		const seconds = Math.floor(diff / 1000);
		if (seconds < 60) {
			return "just now";
		}
		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) {
			return `${minutes}m ago`;
		}
		const hours = Math.floor(minutes / 60);
		if (hours < 24) {
			return `${hours}h ago`;
		}
		return lastSyncedAt.value.toLocaleDateString();
	});

	watch(
		[isSignedIn, autoSyncEnabled],
		async ([signedIn, autoSync]) => {
			if (signedIn && autoSync) {
				await doPullAndPush();
			}
		},
		{ immediate: true }
	);

	watch(
		() => isLoading,
		async loading => {
			if (loading) {
				return;
			}
			const purgedIds = await purgeExpiredTrash();
			if (purgedIds.length > 0) {
				requestSync(purgedIds);
			}
		}
	);

	onMounted(async () => {
		if (isConfigured) {
			readyTimeout = setTimeout(() => {
				if (!isReady.value) {
					authTimedOut.value = true;
				}
			}, 6000);
		}
		await hydrateSyncMetadata();
		await hydrateAuthState();
		tryRestoreSession();
	});

	onBeforeUnmount(() => {
		if (readyTimeout) {
			clearTimeout(readyTimeout);
		}
	});

	return (
		<>
			<template v-if={isConfigured}>
				<template v-if={isReady.value}>
					<template v-if={isSignedIn.value}>
						<div class="dropdown">
							<button ref="sync-menu-trigger" class="btn btn-outline-secondary btn-sm" onClick={() => dropdown.toggle()} disabled={isSyncing.value} title={syncError.value ? `Sync error ${syncError.value}` : `Google Drive Sync`} aria-label="Google Drive Sync">
								<span v-if={isSyncing.value}>
									<Spinner minimal={true}/>
								</span>
								<span v-else-if={syncError.value} class="text-warning">
									<Icon type="exclamationTriangle"/>
								</span>
								<span v-else-if={lastSyncedAt.value} class="text-success">
									<Icon type="check2"/>
								</span>
								<span v-else>
									<Icon type="cloud"/>
								</span>
								<span class="d-none d-md-inline ms-2">{user.value?.name ?? "Sync"}</span>
							</button>
							<ul v-if={dropdown.show.value} class="dropdown-menu show end-0 mt-1">
								<li class="dropdown-header text-muted small px-3 py-1 text-truncate">{user.value?.email}</li>
								<li class="dropdown-divider"></li>
								<li>
									<label class="dropdown-item">
										<input type="checkbox" checked={autoSyncEnabled.value} class="form-check-input" onClick={handleToggleAutoSync}/>
										<span class="ms-2">Auto-sync</span>
									</label>
								</li>
								<li class="dropdown-divider"></li>
								<li>
									<button class="dropdown-item" onClick={() => handleSync(false)} disabled={isSyncing.value}>
										<Icon type="arrowRepeat"/>
										<span class="ms-2">Sync</span>
									</button>
								</li>
								<li>
									<button class="dropdown-item" onClick={() => handleSync(true)} disabled={isSyncing.value}>
										<Icon type="lightningCharge"/>
										<span class="ms-2">Force Sync</span>
									</button>
								</li>
								<li v-if={lastSyncedLabel.value} class="dropdown-header text-muted small px-3 py-1">Last synced: {lastSyncedLabel.value}</li>
								<li class="dropdown-divider"></li>
								<li>
									<button class="dropdown-item text-danger" onClick={handleSignOut}>
										<Icon type="boxArrowRight"/>
										<span class="ms-2">Sign out</span>
									</button>
								</li>
							</ul>
						</div>
					</template>
					<template v-else>
						<button class="btn btn-outline-primary btn-sm" onClick={signIn} aria-label="Sign in with Google">
							<Icon type="google"/>
						</button>
					</template>
				</template>
				<template v-else>
					<button v-if={authTimedOut.value} class="btn btn-outline-secondary btn-sm" disabled={true} title="Google Sign-In library could not be loaded" aria-label="Sign-in unavailable">
						<Icon type="cloudSlash"/>
						<span class="d-none d-sm-inline ms-2">Sign-in unavailable</span>
					</button>
					<button v-else class="btn btn-outline-secondary btn-sm" disabled={true} aria-label="Initialising Google Sign-In">
						<Spinner minimal={true} tag="span"/>
					</button>
				</template>
			</template>
		</>
	);
}