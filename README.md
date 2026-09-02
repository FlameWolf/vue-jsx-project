# QuickPad

A simple, fast, offline-first note-taking web app built with Vue and TypeScript.

QuickPad keeps your notes in your browser, works without an Internet connection, and can optionally sync to your own Google Drive when you sign in.

## Features

### Notes

- Create, view, search, edit, tag, favourite, pin, archive, and delete plain-text notes from a tile-based dashboard.
- Each tile shows the title, last-updated date, a short summary preview, the note's tags, the sentence / word / character counts, and pin / favourite status badges.
- Sentence, word, and character counts are Unicode-aware (via `Intl.Segmenter`). Cached counts are shown while reading and recalculated live while editing.
- Counts and summaries are computed once and cached per note; the counts are recalculated live while editing, and the summary is refreshed when the note is saved.
- Note bodies are **lazy-loaded**: only metadata is read on startup, and the full content is fetched on demand when a note is opened (with a loading spinner while it streams in).
- Search matches both note titles (case-insensitive) and note bodies (content is scanned on demand) across the active, favourited, archived, and trash views, and can be combined with a tag filter.
- Per-note undo / redo history while editing (debounced by 300 ms, up to 100 steps).
- **Draft autosave**: unsaved edits (title, body, and tags) are written to `localStorage` (debounced by 500 ms) and flushed on page hide, so an accidental reload or crash doesn't lose work. On reopening a note with a newer draft, a "Restore unsaved draft?" prompt offers to restore or discard it. Stale drafts are purged after 30 days (and on app start).
- "Discard unsaved changes" guard when navigating away or reloading mid-edit (via `beforeunload` and an in-app confirm dialog).
- Confirm dialog (with Enter / Escape keyboard shortcuts and click-outside-to-cancel) protects destructive actions.
- Tapping a note tile opens it in read-only mode. A one-tap **Copy** button allows easy copy-pasting of note contents anywhere (with a toast confirming success or failure). Tap **Edit** to switch to _Edit_ mode.
- The editing area auto-grows to fit your text (using CSS `field-sizing` where supported, with a JavaScript fallback).
- **Adjustable font size**: A+ / A− buttons scale the editor/reader font (levels 0–10 via a `--font-scale-factor` CSS variable); the choice is remembered in `localStorage`.
- Note titles are capped at 1024 characters (graphemes).
- Create a new note from a dedicated **+** tile on the dashboard.
- When a list is empty, an empty-state panel is shown — on the dashboard it offers quick actions to create a note, import files, or jump to the Archive / Trash.

### Tags

- Organise notes with **tags**. The tag catalogue is seeded with three defaults (**Ideas**, **Personal**, **Work**) on first launch and grows as you create more. Tags are displayed sorted in alphanumeric order.
- Tags are stored case-insensitively but keep their original casing for display; names are normalised (trimmed, internal whitespace collapsed, Unicode NFC) and capped at 256 characters.
- Assign or remove tags on a single note while editing, or on many notes at once in multi-select mode (with a confirmation prompt).
- **Filter by tags**: tap a `#tag` badge on any note tile (or tick the checkbox next to a tag in the tag list) to add it to the active tag filter; the note list then shows only notes having the selected tags — either all of them or at least one based on a toggle. The tag filter can be combined with a text search.
- Manage the catalogue from the tag bar's dropdown: search, create, select-all / deselect-all, and delete tags globally. Deleting a tag also strips it from every note that used it.
- The tag bar (`DisplayTagList`) adapts to context via `allowCreate` / `allowDelete` / `allowEdit` / `allowManage` props — an editable selector inside a note or a full manager on the dashboard.

### Colours

- Colour-code notes for quick visual organisation. A palette of 16 colours is available (**black**, **silver**, **grey**, **white**, **maroon**, **red**, **purple**, **fuchsia**, **green**, **lime**, **olive**, **yellow**, **navy**, **blue**, **teal**, **aqua**).
- Apply or remove colours when creating or editing a single note via a colour picker.
- Apply or remove colours on many notes at once in multi-select mode via the **Apply Colour** button.
- **Filter by colours**: tap the colour-wheel icon in the toolbar to show only notes of selected colours. The colour filter can be combined with tag filters and text search.
- Colours travel to Drive with each note on sync, persisted in each note's JSON file.

### Favourites and pinning

- **Favourite** any note (individually or in bulk) to collect it in a dedicated **Favourited** view (`/notes/favourite`) without moving it out of the main dashboard.
- **Pin** a note to keep it at the top of whichever list it appears in, regardless of the chosen sort field or direction; the most-recently-pinned note sorts first.
- Pinning is blocked for archived or trashed notes, and archiving or trashing a note automatically clears its pin.

### Organisation

- Sort notes by **Updated**, **Created**, **Colour**, **Title**, or **Sentence / Word / Character Count**, ascending or descending. Pinned notes always sort to the top, ahead of the chosen ordering.
- Sort field and direction are remembered between sessions (persisted in IndexedDB).
- Multi-select mode: tap **Select**, pick notes (or **Select All** / **Deselect All**), then run a bulk action.
- The available bulk actions are view-specific — e.g. export, favourite, archive, and trash on the dashboard; export, unfavourite, and trash in Favourited; export, unarchive, and trash in Archive; restore and permanently delete in Trash. Tags and colours can also be applied or removed in bulk: tags via the tag bar, and colours via the **Apply Colour** button in the selection action bar.
- Selected count and per-view actions are shown in a sticky selection action bar.
- Scroll position is preserved per list view (active, favourited, archived, trash), with quick scroll-to-top / scroll-to-bottom buttons.

### Archive and Trash

- Archive notes you want to keep but not see on the main dashboard; unarchive them at any time.
- Deleting a note moves it to **Trash** rather than removing it immediately, so you can change your mind.
- Trashed notes are kept for **30 days** and then automatically purged on app start.
- Dedicated `/notes/favourite`, `/notes/archive`, and `/notes/trash` views support the same select / bulk-action workflow as the dashboard.
- **Empty Trash** permanently removes all trashed notes in one step.
- Trashed notes can be restored or permanently deleted; individual trashed notes can also be exported.

### Import / Export

- Import any plain-text file as a new note. Files are content-sniffed (magic numbers, NUL bytes, control-character ratio, UTF-8 validation) over the first 8 KB before import; the note title is derived from the filename (a trailing `.txt` is stripped). Empty files are accepted as empty notes, and unsupported or unreadable files are reported in a toast.
- Multiple files can be imported in one go; files that fail the sniff are skipped without aborting the rest of the batch.
- Export a single note as a `.txt` file.
- Export selected notes, or **Export All** (every active note), as a `quick-pad-notes.zip` archive (powered by JSZip, loaded on demand), with title collisions automatically de-duplicated and unsafe filename characters sanitised.

### Offline / PWA

- Installable as a Progressive Web App (standalone display, custom theme colour, app icon).
- A hand-written service worker caches the app shell so it loads and works offline after the first visit (registered only in production builds). A custom Vite build plugin stamps each build with a content-hashed cache version (`quickpad-<sha256[:8]>`) and a precache manifest, so a new deploy invalidates the old cache automatically.
- The service worker answers navigations by serving the cached `index.html` shell and revalidating it in the background, and serves other same-origin GETs cache-first; `/api/*` and cross-origin requests are left to the network.
- All notes are stored locally in **IndexedDB** — no account required to use the app. On startup the app also requests **persistent storage** (`navigator.storage.persist()`) so the browser is less likely to evict your notes under storage pressure.

### Theme

- Follows your OS light/dark preference via `prefers-color-scheme` on first run, applying the Bootstrap theme (`data-bs-theme`) on the fly.
- A sun/moon toggle in the navbar flips the theme instantly, and the manual choice is **remembered** (persisted to `localStorage`), taking precedence over the OS preference on the next visit.

### Notifications

- Actions surface transient toast notifications (bottom-right). Non-error toasts auto-dismiss after 5 seconds; error (`danger`) toasts persist until dismissed. The stack is capped at five, and duplicate messages are de-duplicated.

### Optional Google Drive sync

- Sign in with Google to back up notes to your Drive's app-data folder (the app cannot see any other files in your Drive). Sign-in happens in a popup window, and the result is posted back to the app.
- Each note is stored as its own file (`qp-note:<id>.json`) in the Drive app-data folder.
- **Sync** performs a full pull-and-push on demand, **Force Sync** re-syncs every note regardless of timestamps (after a confirmation prompt), and an **Auto-sync** toggle (on by default) debounces a push a few seconds (3 s) after each change.
- Merging is timestamp-based: each note's effective time is the latest of its created, modified, favourited, pinned, archived, deleted, and state-changed times, so local and remote are combined without losing edits. When the remote copy of a note is newer, it wins and is pulled into the local store. Pull and push are tracked with separate last-synced timestamps for efficient incremental syncs, and a pull is paginated 25 files at a time.
- Per-note tags travel to Drive inside each note's JSON; the global tag catalogue itself stays local-only.
- Permanent deletions are queued (in memory) and propagated to Drive — the corresponding files are removed on the next sync — and the 30-day trash purge propagates the same way.
- A sync indicator reflects its state (syncing, signed-in-but-not-yet-synced, last-synced time, or a sync error); a toast confirms success / failure. The sync menu also exposes the signed-in account and sign-out.
- Authentication uses the OAuth 2.0 authorization-code flow with a serverless backend: the refresh token is kept server-side in an AES-256-GCM-encrypted, httpOnly session cookie, and access tokens are refreshed silently in the background (with a 60-second expiry buffer), so the user only signs in once. Sign out revokes the grant and clears the session.
- If no Google client ID is configured, the sync UI stays hidden and the app runs in local-only mode.

## Tech stack

- [Vue](https://vuejs.org/) (`<script setup>`, Composition API)
- [TypeScript](https://www.typescriptlang.org/)
- [Vue Router](https://router.vuejs.org/)
- [Bootstrap](https://getbootstrap.com/) for styling (icons are inline SVGs — no icon-font dependency)
- [idb](https://github.com/jakearchibald/idb/) for IndexedDB storage
- [JSZip](https://stuk.github.io/jszip/) for archive export (dynamically imported)
- [Vite](https://vitejs.dev/) build tooling (with `@vitejs/plugin-vue` and `@vitejs/plugin-vue-jsx`)
- [PurgeCSS](https://purgecss.com/) (via `@fullhuman/postcss-purgecss`) to strip unused Bootstrap CSS from production builds
- [Vercel](https://vercel.com/docs/cli/) for hosting and the serverless auth functions

## Architecture

The `src/` tree is organised by responsibility:

| Folder         | Responsibility                                                                                                    |
| -------------- | ----------------------------------------------------------------------------------------------------------------- |
| `constants/`   | Configuration values grouped by domain (`storage`, `sort`, `auth`, `sync`, `notes`, `actions`, `ui`, `common`)    |
| `types/`       | Ambient / global TypeScript types (typed KV schema, `View`, selection actions, legal-page shapes)                 |
| `utils/`       | Pure, framework-agnostic helpers (`text-analysis`, `file-detection`, `dates`, `numbers`, `timing`, `common`)      |
| `storage/`     | Persistence: `db` (low-level `idb`), `NotesRepository` + `TagsRepository` (domain APIs), `migrate`, `persistence` |
| `models/`      | `NoteModel` — the note domain object, its lifecycle methods, and its (de)serialisation                            |
| `composables/` | Reusable Composition-API units and app-global state singletons                                                    |
| `stores/`      | The larger app-global reactive singletons (`notes`, `app`, `notifications`) — plain modules                       |
| `components/`  | Vue components                                                                                                    |
| `content/`     | Static copy for the Privacy Policy and Terms of Service pages, plus the inline SVG icon set                       |
| `router/`      | Vue Router route definitions, plus per-view scroll preservation and navigation state                              |

### Storage layering

Components and stores never touch `idb` directly. `storage/db.ts` is the only module that opens the database and runs raw transactions; `storage/NotesRepository.ts` and `storage/TagsRepository.ts` build the note- and tag-domain APIs on top of it. `NotesRepository` owns the metadata/content split and the lazy-content "working-set contract", and delegates tag persistence to `TagsRepository`. Both repositories are plain, non-reactive module-level singleton class instances (`notesRepository`, `tagsRepository`). Key/value access is type-checked by key through the global `KVSchema` declared in `types/index.d.ts`, so `getKV`/`setKV` are safe without per-call casts (the one-time `localStorage` migration in `storage/migrate.ts` uses the explicit `setKVRaw` escape hatch for legacy data).

### State management

Shared, app-wide state lives in **module-level reactive singletons** built on Vue's standalone reactivity APIs (`reactive`, `ref`, `computed`, `readonly`, `toRef`). There is one of each piece of state (one collection of notes, one theme, one selection, one sort preference, one sync session), so each module creates a single module-scoped reactive object and exports read-only views plus mutator functions; every importer shares the same instance by design.

- The `stores/` folder holds the larger domain singletons, consumed via namespace imports (e.g. `import * as notesStore from "@/stores/notes"`):
  - `stores/notes.ts` — the note collection, tag catalogue, search text / tag filter, and the full CRUD + lifecycle + tag action surface; derives `searchResults`, `activeNotes`, `favedNotes`, `archivedNotes`, and `trashedNotes`.
  - `stores/app.ts` — miscellaneous UI state (`lastView`, `currentColour`, `fontScaleFactor`).
  - `stores/notifications.ts` — the toast queue.
- `composables/` holds the rest of the shared singletons — `useTheme`, `useConfirmDialogue`, `useNoteSelection`, `useNoteSort`, `useNotesSync`, `useGoogleAuth`, `useGoogleDrive`, and `useFileIO` — alongside per-component composables (`useDropdown`, `useNoteDraft`, `useUndoRedo`, `useTruncate`).
- Persistence is split by concern: theme and font scale → `localStorage`; sort preferences, sync metadata, and auth cache → the IndexedDB `kv` store; notes and the tag catalogue → IndexedDB via the repositories; selection, notifications, confirm-dialog, and drafts state are transient (drafts live in `localStorage`). Hydration functions (`hydrate*`) load initial values once; persistence watchers are registered once at module scope.

## Getting started

### Prerequisites

- Node.js — a version supported by the toolchain (Vite 8 requires Node `^20.19.0 || >=22.12.0`).
- npm
- Vercel CLI (`npm i -g vercel`; see [Vercel CLI setup](#3-vercel-cli-setup)).

### Install

```sh
npm install
```

### Development server

```sh
npm run dev
```

> This runs `scripts/run-all.js`, which starts the Vercel dev server (the `api/auth/*` functions) and the Vite UI together and shuts both down if either one exits. It requires the Vercel CLI — see [Configuration → Vercel CLI setup](#3-vercel-cli-setup).

### Type-check and build for production

```sh
npm run build
```

This runs `vue-tsc --build` (type-check) followed by `vite build`.

### Type-check only

```sh
npm run type-check
```

### Preview the production build

First build the app (`npm run build`), then:

```sh
npm run preview
```

This also runs through `scripts/run-all.js`, starting the Vercel CLI (`vercel dev`, serving the `api/auth/*` functions) alongside `vite preview` (serving the built UI from `dist/`), so the OAuth flow works against the production build. It does not rebuild automatically — run `npm run build` first.

### Format source files

```sh
npm run format
```

## Configuration

Google Drive sync is optional and uses the OAuth 2.0 **authorization-code flow** with a small serverless backend (the functions in `api/auth/`: `start`, `callback`, `token`, and `signout`). The user signs in once via a popup; the refresh token is held server-side in an encrypted, httpOnly cookie, and access tokens are refreshed silently — there is no recurring sign-in popup. If the client ID is left blank, the sync controls are hidden and the app works entirely offline.

### 1. Create the OAuth client

In the [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an **OAuth 2.0 Client ID** of type **Web application**, then add:

- **Authorized JavaScript origins**: your app origin, e.g. `https://your-app.vercel.app` (and `http://localhost:3000` for local development).
- **Authorized redirect URIs**: the callback endpoint — `https://your-app.vercel.app/api/auth/callback` (and `http://localhost:3000/api/auth/callback` for local development). This must match exactly, including the scheme and path.

The app requests the `drive.appdata`, `openid`, `email`, and `profile` scopes. Each note is stored as a separate `qp-note:<id>.json` file in the Drive app-data folder, which is private to QuickPad.

### 2. Set environment variables

Copy `environment.config` to `.env` and fill in the values:

```env
# Frontend (exposed to the browser)
VITE_GOOG_OAUTH_CLIENT_ID="your-client-id.apps.googleusercontent.com"

# Backend (server-only — never prefix with VITE_)
GOOGLE_OAUTH_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_OAUTH_CLIENT_SECRET="your-client-secret"
SESSION_SECRET="a-long-random-string"   # node -e "console.log(require("crypto").randomBytes(32).toString("base64"))"
```

> The serverless backend prefers `GOOGLE_OAUTH_CLIENT_ID` but falls back to `VITE_GOOG_OAUTH_CLIENT_ID` if it is unset, so a single client ID value works for both the browser and the server. The backend reports itself as "not configured" — and sign-in and token refresh fail — unless the client ID, `GOOGLE_OAUTH_CLIENT_SECRET`, and `SESSION_SECRET` are all set. The encrypted session cookie is valid for up to 400 days.

On **Vercel**, set the same variables under **Project Settings → Environment Variables** (the `.env` file is git-ignored and only used locally).

### 3. Vercel CLI setup

`npm run dev` and `npm run preview` start `vercel dev` to serve the `api/auth/*` serverless functions, so the Vercel CLI must be installed and the project linked before the local OAuth flow works.

1. **Install the CLI** (globally, or use `npx vercel` for any command below):

    ```sh
    npm i -g vercel
    ```

2. **Log in** to your Vercel account:

    ```sh
    vercel login
    ```

3. **Link the project.** A fresh clone has no `.vercel/` folder (it is git-ignored), so you must link the directory to a Vercel project. This creates `.vercel/project.json` with the project and org IDs:

    ```sh
    vercel link
    ```

    Follow the prompts to select (or create) the project. `vercel dev` — and therefore `npm run dev` — will not run until the directory is linked.

4. **Pull environment variables (optional).** Instead of maintaining `.env` by hand ([step 2](#2-set-environment-variables)), you can manage the variables in the Vercel dashboard and pull them locally after linking:

    ```sh
    vercel env pull .env            # download Project Settings → Environment Variables (Development) into .env
    vercel env add SESSION_SECRET   # interactively add a variable to the linked project
    ```

### 4. Local development

The `api/auth/*` functions run on Vercel's serverless runtime, so the OAuth flow only works when the functions are served alongside the app. Use the [Vercel CLI](https://vercel.com/docs/cli):

```sh
npm run dev
```

The console will display two `http://localhost` URLs: one for the API served by `vercel dev` (usually `http://localhost:3000`) and one for the UI served by Vite. Visit the UI URL to use the app — it will be `http://localhost:5173` for `npm run dev`, or `http://localhost:4173` for `npm run preview`. The UI proxies `/api/*` requests to the Vercel dev server on port 3000.

## Deployment

QuickPad deploys to [Vercel](https://vercel.com/) as a single project — the Vite-built static UI plus the `api/auth/*` serverless functions.

1. Install, authenticate, and link the CLI as described in [Vercel CLI setup](#3-vercel-cli-setup).
2. Set the backend variables (`VITE_GOOG_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `SESSION_SECRET`) under **Project Settings → Environment Variables** in the Vercel dashboard. The local `.env` is git-ignored and is **not** uploaded.
3. Add your production origin and `https://<your-app>.vercel.app/api/auth/callback` to the OAuth client's authorized JavaScript origins and redirect URIs (see [step 1](#1-create-the-oauth-client)).
4. Deploy:

    ```sh
    vercel            # create a preview deployment
    vercel --prod     # deploy to production (alias of `vercel deploy --prod`)
    ```

Routing is handled by `vercel.json`: every non-`/api/` path is rewritten to `/index.html` so the Vue Router SPA owns client-side routing.

## Routes

| Path               | View                                              |
| ------------------ | ------------------------------------------------- |
| `/notes`           | Active notes / dashboard                          |
| `/notes/favourite` | Favourited notes                                  |
| `/notes/archive`   | Archived notes                                    |
| `/notes/trash`     | Trashed notes (auto-purged after 30 days)         |
| `/notes/new`       | Create a new note                                 |
| `/notes/:id`       | View / edit a note (active, archived, or trashed) |
| `/privacy`         | Privacy Policy (lazy-loaded)                      |
| `/terms`           | Terms of Service (lazy-loaded)                    |

`/`, `/favourite`, `/archive`, and `/trash` redirect to their `/notes/...` equivalents. Tags are a filter over the note list rather than a route of their own. The Privacy Policy and Terms of Service pages are linked from the app footer (alongside a link to the source repository).

## Data storage

Notes and preferences are stored in an IndexedDB database named `quick-pad` (data from older `localStorage`-based versions is migrated automatically on first launch and then cleared). The schema is at **version 3**: the version-1 → 2 upgrade split note bodies out of the `notes` store into a separate `contents` store so metadata can load without the bodies, and the version-2 → 3 upgrade added the `tags` store (seeded with the default tags **Ideas**, **Personal**, and **Work**).

The database has four object stores:

| Object store | Purpose                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------ |
| `notes`      | Note metadata (id, title, summary, counts, dates, tags, favourite/pin/archive/trash state) |
| `contents`   | Note bodies, keyed by note id and loaded lazily                                            |
| `kv`         | Preferences and sync / auth state (keys below)                                             |
| `tags`       | The tag catalogue, keyed by the lower-cased tag (value keeps original casing)              |

Typed keys in the `kv` store (declared by the `KVSchema`):

| Key                       | Purpose                                                 |
| ------------------------- | ------------------------------------------------------- |
| `sort-by`                 | Sort field preference                                   |
| `sort-direction`          | Sort direction preference                               |
| `last-synced-to-local`    | Timestamp of last successful pull from Drive            |
| `last-synced-to-cloud`    | Timestamp of last successful push to Drive              |
| `auto-sync`               | Auto-sync on/off (defaults to on)                       |
| `google-session-hint`     | Marker that a Google session was previously established |
| `google-access-token`     | Cached Google OAuth access token                        |
| `google-token-expires-at` | Expiry timestamp for the cached access token            |
| `google-user-info`        | Cached Google user name and email                       |
| `__migrated-to-idb`       | Flag marking the one-time migration from `localStorage` |

A few pieces of state live outside IndexedDB, in `localStorage`: the theme choice (`theme`), the font-scale level (`font-scale-factor`), and per-note edit drafts (`qp-draft:<id>`). Pending permanent-deletion ids awaiting propagation to Drive are held in an in-memory set during a session and flushed to Drive on the next sync.

Clearing site data will remove all notes that have not been synced to Drive.