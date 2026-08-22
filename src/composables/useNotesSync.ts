import { computed, reactive, ref, watch } from "vue";
import { emptyString } from "@/constants/common";
import { NOTE_PREFIX } from "@/constants/storage";
import { AUTO_SYNC_KEY, DEBOUNCE_MS, LAST_SYNCED_TO_CLOUD_KEY, LAST_SYNCED_TO_LOCAL_KEY } from "@/constants/sync";
import { getTime } from "@/utils/dates";
import { debounce } from "@/utils/timing";
import { NoteModel } from "@/models/NoteModel";
import { deleteKV, getKV, setKV } from "@/storage/db";
import * as notesStore from "@/stores/notes";
import { addNotification } from "@/stores/notifications";
import { isSignedIn } from "@/composables/useGoogleAuth";
import { deleteFile, findFile, listFiles, readJSONById, writeJSON, writeJSONById } from "@/composables/useGoogleDrive";
import type { NoteJSON } from "@/models/NoteModel";
import type { UUID } from "crypto";

interface SyncState {
	isSyncing: boolean;
	autoSyncEnabled: boolean;
	syncError: string | null;
}
enum NoteUploadResult {
	Uploaded = "uploaded",
	Conflict = "conflict"
}
enum NoteChangeOrigin {
	Local = "local",
	Remote = "remote",
	Neither = "neither"
}

let hydrated = false;
const state = reactive<SyncState>({
	isSyncing: false,
	autoSyncEnabled: true,
	syncError: null
});
const lastSyncedToLocalAt = ref<Date | null>(null);
const lastSyncedToCloudAt = ref<Date | null>(null);
const pendingPurges = new Set<UUID>();
const debouncedFlush = debounce(() => {
	if (isSignedIn.value && state.autoSyncEnabled) {
		saveToCloud()
			.then(() => {
				addNotification("success", "Synced to cloud");
			})
			.catch(() => {
				addNotification("danger", "Sync failed");
			});
	}
}, DEBOUNCE_MS);
export const isSyncing = computed(() => state.isSyncing);
export const autoSyncEnabled = computed(() => state.autoSyncEnabled);
export const syncError = computed(() => state.syncError);
export const lastSyncedAt = computed(() => {
	const max = Math.max(getTime(lastSyncedToLocalAt.value), getTime(lastSyncedToCloudAt.value));
	return max > 0 ? new Date(max) : null;
});
export const requestSync = Object.assign(
	function (purged: ReadonlyArray<UUID> = []) {
		if (purged.length > 0) {
			purged.forEach(Set.prototype.add, pendingPurges);
		}
		debouncedFlush();
	},
	{
		cancel() {
			debouncedFlush.cancel();
		}
	}
);

export async function hydrateSyncMetadata(): Promise<void> {
	if (hydrated) {
		return;
	}
	hydrated = true;
	const storedLocal = await getKV(LAST_SYNCED_TO_LOCAL_KEY);
	const storedCloud = await getKV(LAST_SYNCED_TO_CLOUD_KEY);
	const storedAutoSync = await getKV(AUTO_SYNC_KEY);
	lastSyncedToLocalAt.value = storedLocal ? new Date(storedLocal) : null;
	lastSyncedToCloudAt.value = storedCloud ? new Date(storedCloud) : null;
	state.autoSyncEnabled = storedAutoSync === undefined ? true : storedAutoSync;
	watch(lastSyncedToLocalAt, async date => {
		if (date) {
			await setKV(LAST_SYNCED_TO_LOCAL_KEY, date.toISOString());
		} else {
			await deleteKV(LAST_SYNCED_TO_LOCAL_KEY);
		}
	});
	watch(lastSyncedToCloudAt, async date => {
		if (date) {
			await setKV(LAST_SYNCED_TO_CLOUD_KEY, date.toISOString());
		} else {
			await deleteKV(LAST_SYNCED_TO_CLOUD_KEY);
		}
	});
	watch(
		() => state.autoSyncEnabled,
		async flag => {
			await setKV(AUTO_SYNC_KEY, flag);
		}
	);
}

function noteEffectiveTime(note: NoteModel): number {
	return Math.max(note.createdAt.getTime(), getTime(note.modifiedAt), getTime(note.favedAt), getTime(note.pinnedAt), getTime(note.archivedAt), getTime(note.deletedAt), getTime(note.stateChangedAt));
}

function revisionSource(remote: NoteModel, local: NoteModel): NoteChangeOrigin {
	const remoteEffectiveTime = noteEffectiveTime(remote);
	const localEffectiveTime = noteEffectiveTime(local);
	if (remoteEffectiveTime > localEffectiveTime) {
		return NoteChangeOrigin.Remote;
	}
	if (localEffectiveTime > remoteEffectiveTime) {
		return NoteChangeOrigin.Local;
	}
	return NoteChangeOrigin.Neither;
}

function mergeNotesByModifiedAt(local: ReadonlyArray<NoteModel>, remote: ReadonlyArray<NoteModel>): NoteModel[] {
	const localMap = new Map<string, NoteModel>(local.map(note => [note.id, note]));
	const changes: NoteModel[] = [];
	for (const remoteNote of remote) {
		const localNote = localMap.get(remoteNote.id);
		if (!localNote || revisionSource(remoteNote, localNote) === NoteChangeOrigin.Remote) {
			changes.push(remoteNote);
		}
	}
	return changes;
}

function getFileName(id: UUID) {
	return `${NOTE_PREFIX}${id}.json`;
}

async function readRemoteNotes(force = false, token?: string): Promise<{ token: string | undefined; notes: NoteModel[] }> {
	const { pageToken, fileList } = await listFiles(NOTE_PREFIX, force ? null : lastSyncedToLocalAt.value, token);
	const notes: NoteModel[] = [];
	await Promise.all(
		fileList.map(async file => {
			try {
				const data = await readJSONById<NoteJSON>(file.id);
				if (data) {
					notes.push(NoteModel.fromJSON(data));
				}
			} catch (err) {
				console.warn(`Failed to read note file ${file.name}`, err);
			}
		})
	);
	return { token: pageToken, notes };
}

async function purgeRemoteFiles(fileIdsToPurge: ReadonlyArray<UUID>) {
	fileIdsToPurge.forEach(Set.prototype.add, pendingPurges);
	if (pendingPurges.size > 0) {
		const purgeSnapshot = Array.from(pendingPurges);
		await Promise.all(purgeSnapshot.map(getFileName).map(deleteFile));
		purgeSnapshot.forEach(Set.prototype.delete, pendingPurges);
	}
}

async function buildUploadPayload(note: NoteModel): Promise<NoteJSON> {
	const content = await notesStore.getNoteContent(note.id);
	return Object.assign(note.toJSON(), {
		content: content ?? emptyString
	});
}

async function uploadNote(note: NoteModel): Promise<NoteUploadResult> {
	const fileName = getFileName(note.id);
	const remoteFile = await findFile(fileName);
	if (remoteFile) {
		const remoteJSON = await readJSONById<NoteJSON>(remoteFile.id);
		if (remoteJSON) {
			const remoteNote = NoteModel.fromJSON(remoteJSON);
			switch (revisionSource(remoteNote, note)) {
				case NoteChangeOrigin.Remote: {
					await notesStore.replaceNote(remoteNote);
					return NoteUploadResult.Conflict;
				}
				case NoteChangeOrigin.Local: {
					await writeJSONById(remoteFile.id, await buildUploadPayload(note));
					return NoteUploadResult.Uploaded;
				}
				default: {
					break;
				}
			}
		}
	} else {
		await writeJSON(fileName, await buildUploadPayload(note));
	}
	return NoteUploadResult.Uploaded;
}

async function runPull(force = false) {
	let pageToken: string | undefined;
	let remoteNotes: NoteModel[];
	let remoteCount: number = 0;
	let downloaded: number = 0;
	const syncStartedAt = new Date();
	do {
		({ token: pageToken, notes: remoteNotes } = await readRemoteNotes(force, pageToken));
		const readCount = remoteNotes.length;
		if (readCount === 0) {
			continue;
		}
		remoteCount += readCount;
		const changes = mergeNotesByModifiedAt(notesStore.notes.value as ReadonlyArray<NoteModel>, remoteNotes);
		const changeCount = changes.length;
		if (changeCount > 0) {
			await notesStore.replaceMultiple(changes);
			downloaded += changeCount;
		}
		addNotification("success", `Fetching remote notes (${remoteCount} loaded)`);
	} while (pageToken);
	await purgeRemoteFiles(await notesStore.purgeExpiredTrash());
	lastSyncedToLocalAt.value = syncStartedAt;
	return { remoteCount, downloaded };
}

async function runPush(purged: ReadonlyArray<UUID> = [], force = false) {
	const syncStartedAt = new Date();
	await purgeRemoteFiles(purged);
	const threshold = getTime(lastSyncedToCloudAt.value ?? lastSyncedToLocalAt.value);
	const candidates = force ? notesStore.notes.value : notesStore.notes.value.filter(n => noteEffectiveTime(n as NoteModel) > threshold);
	const results = await Promise.all((candidates as ReadonlyArray<NoteModel>).map(uploadNote));
	lastSyncedToCloudAt.value = syncStartedAt;
	return {
		conflicts: results.filter(r => r === "conflict").length
	};
}

async function saveToCloud(purged: ReadonlyArray<UUID> = []) {
	if (state.isSyncing) {
		return;
	}
	try {
		state.isSyncing = true;
		await runPush(purged, false);
	} finally {
		state.isSyncing = false;
	}
}

export async function doPullAndPush({ force = false as boolean, purged = [] as ReadonlyArray<UUID> } = {}) {
	if (state.isSyncing) {
		return;
	}
	state.isSyncing = true;
	state.syncError = null;
	try {
		const pullResult = await runPull(force);
		const pushResult = await runPush(purged, force);
		const empty = pullResult.remoteCount === 0 && notesStore.notes.value.length === 0;
		const changes = pushResult.conflicts + pullResult.downloaded;
		addNotification("success", empty ? "Nothing to sync" : `Synced${changes > 0 ? ` (pulled ${changes} change${changes > 1 ? "s" : emptyString} from cloud)` : emptyString}`);
	} catch (err: any) {
		state.syncError = err?.message ?? "Sync failed";
		addNotification("danger", `Sync failed: ${state.syncError}`);
	} finally {
		state.isSyncing = false;
	}
}

export async function setAutoSync(enabled: boolean) {
	state.autoSyncEnabled = enabled;
	if (!enabled) {
		requestSync.cancel();
	}
}