# Architecture Overview

## Process Model

Sticky Notes for Linux follows Electron's strict multi-process security model:

```
┌─────────────────────────────────────────────────────────────────┐
│ Main Process (src/main/)                                        │
│  ├─ main.ts          App lifecycle, single-instance, signals    │
│  ├─ database.ts      SQLite (better-sqlite3) + FTS5 + migrations│
│  ├─ windowManager.ts BrowserWindow registry, flush, recovery    │
│  ├─ ipcHandlers.ts   Role-scoped, schema-validated IPC handlers │
│  ├─ htmlSanitizer.ts Main-process defense-in-depth sanitizer    │
│  ├─ crypto.ts        AES-GCM note encryption and OS keyring     │
│  ├─ linuxPlatform.ts Linux launch arguments and display checks  │
│  ├─ tray.ts          Linux system tray menu                     │
│  ├─ autostart.ts     XDG autostart .desktop manager             │
│  └─ logger.ts        Bounded rotating error log                 │
├─────────────────────────────────────────────────────────────────┤
│ Preload Bridge (src/preload/preload.ts)                         │
│  contextBridge.exposeInMainWorld('stickyNotesAPI', ...)         │
├─────────────────────────────────────────────────────────────────┤
│ Sandboxed Renderer Processes (src/renderer/)                    │
│  ├─ NoteView.tsx     Individual sticky note + Tiptap RichEditor │
│  └─ ManagerView.tsx  Notes list, FTS search, Trash, settings    │
└─────────────────────────────────────────────────────────────────┘
```

## IPC Security & Role Scoping

Every renderer window is launched with `--window-type=note --note-id=<uuid>` or `--window-type=manager`, but **main never trusts renderer-claimed arguments**. Instead, `WindowManager.rendererRole(event)` maps `event.sender` (`WebContents`) directly against the main-process `noteWindows` map and `managerWindow` reference after verifying `event.senderFrame === event.sender.mainFrame` and the exact renderer origin/pathname:

- **Note windows** can only read, update, pin, close, or delete their own `noteId`.
- **Manager window** can query paginated previews/trash, open/restore/delete notes, export backups, purge migration backups, and update settings.

## Database & Persistence (`src/main/database.ts`)

- Location: `${XDG_DATA_HOME:-$HOME/.local/share}/sticky-notes/stickynotes.db` (dir `0700`, file `0600`).
- SQLite configuration: `journal_mode = WAL`, `synchronous = FULL`, `busy_timeout = 5000`, `secure_delete = ON`, `foreign_keys = ON`.
- Full-text search: `notes_fts` FTS5 virtual table using the `trigram` tokenizer (`secure-delete` enabled), kept synchronized via SQL triggers.
- Soft-delete Trash: `deleteNote(id)` sets `deleted_at` (removing the row from active `notes_fts`), allowing recovery via `restoreNote(id)` or permanent purge via `permanentlyDeleteNote(id)`.
- Migrations: Versioned via `PRAGMA user_version` inside an `IMMEDIATE` transaction. Existing databases are snapshotted via `VACUUM INTO` and integrity-checked before applying schema upgrades.

## Autosave & Shutdown Flush Handshake

1. Edits in `RichEditor` mark `Autosave` dirty and schedule `AutosaveTimer` (300 ms idle delay, 2,000 ms max-wait deadline; paused during IME composition).
2. `Autosave.flush()` serializes IPC writes and tracks revision numbers so edits arriving mid-write trigger a follow-up write.
3. On window close or application quit (`before-quit`), `WindowManager` sends `editor:flush` to each ready editor, waits for `editor:flushed` acknowledgment, persists window bounds, checkpoints WAL (`TRUNCATE`), and closes SQLite cleanly.

## Linux Display Backend & Taskbar Identity (`src/main/linuxPlatform.ts`)

In Electron 38 and later, Chromium initializes its Ozone display backend before `main.ts` runs. The app therefore supplies display flags at launch instead of changing them in the main process. The packaged `.deb` and AppImage launch entries currently pass `--ozone-platform=x11` and `--class=com.netsysprep.stickynotes`. The development `npm start` command also selects X11. Autostart adds `--ozone-platform=x11` when `DISPLAY` is set and always passes the window class. X11 and XWayland support always-on-top pinning and desktop coordinates. Native Wayland does not expose those capabilities, so the window manager preserves saved coordinates when Wayland reports `(0, 0)`. The packaged launcher currently forces X11, including on systems without XWayland.

To associate windows with the desktop launcher, `main.ts` calls `app.setDesktopName('sticky-notes-linux.desktop')`. The `.deb` and autostart entries set `StartupWMClass=com.netsysprep.stickynotes`, matching the launch argument. `package.json` sets the packaged desktop file name and executable arguments.

## Testing & Native ABI Notes

Because `better-sqlite3` is compiled against Electron's Node ABI (`npm run rebuild`), unit tests run using the Electron binary in Node mode:

```bash
npm test   # ELECTRON_RUN_AS_NODE=1 electron --import tsx --test tests/*.test.ts
```

Note that packaged releases disable `ELECTRON_RUN_AS_NODE` via `@electron/fuses` (`scripts/after-pack-fuses.js`), so `npm test` uses the unpacked development Electron binary in `node_modules/`.
