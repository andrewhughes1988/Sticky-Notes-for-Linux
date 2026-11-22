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

Starting in Electron 38+, Linux automatically selects native Wayland when `WAYLAND_DISPLAY` is set. Because the Wayland `xdg-shell` protocol does not allow client applications to set always-on-top (`setAlwaysOnTop`) or read/restore global desktop coordinates (`x`, `y`), Sticky Notes prefers the `x11` (XWayland) Ozone backend whenever `DISPLAY` is present—preserving pinning, exact desktop position restoration, and `moveTop()` on KDE Plasma and GNOME Wayland sessions—while falling back cleanly to native Wayland (`ozone-platform-hint=auto` + `WaylandWindowDecorations`) on pure-Wayland systems without XWayland (and preserving stored coordinates rather than overwriting them with `(0, 0)`). Users can override this at any time via `--ozone-platform=wayland`.

To ensure running windows associate with the pinned `.desktop` launcher instead of spawning a duplicate taskbar icon, `main.ts` explicitly sets `--class=com.netsysprep.stickynotes` and `app.setDesktopName('sticky-notes-linux.desktop')` (mirrored by `desktopName` in `package.json` and `StartupWMClass=com.netsysprep.stickynotes` in both the `.deb` and autostart desktop entries).

## Testing & Native ABI Notes

Because `better-sqlite3` is compiled against Electron's Node ABI (`npm run rebuild`), unit tests run using the Electron binary in Node mode:

```bash
npm test   # ELECTRON_RUN_AS_NODE=1 electron --import tsx --test tests/*.test.ts
```

Note that packaged releases disable `ELECTRON_RUN_AS_NODE` via `@electron/fuses` (`scripts/after-pack-fuses.js`), so `npm test` uses the unpacked development Electron binary in `node_modules/`.
