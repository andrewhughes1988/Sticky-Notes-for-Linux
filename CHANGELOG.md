# Changelog

All notable changes to Sticky Notes for Linux are documented in this file.

## [1.2.0] - 2026-11-21

### Added
- **Tiptap / ProseMirror Rich Text Editor:** Replaced the custom `contentEditable` implementation with a schema-driven headless Tiptap editor featuring step-based undo/redo, clean checklist editing, legacy HTML checklist upgrade compatibility, and atomic multi-select checklist toggling.
- **Persistent System Tray Lifecycle:** Closing or deleting the last open note keeps the application resident in the system tray; quit explicitly via Tray → Quit, `Ctrl+Q`, or OS signals (`SIGTERM`, `SIGINT`, `SIGHUP`).
- **Soft-Delete Trash & Export/Backup:** Deleted notes move to Trash for recovery or permanent deletion; added JSON/Markdown export and pre-migration backup cleanup in Notes Manager.
- **Keyboard Shortcuts & Context Menu:** Implemented `Ctrl+N` (new note), `Ctrl+Q` (quit), `Ctrl+F` (focus search), `Escape` (clear search), `Ctrl+Shift+V` (paste plain text), `Ctrl+Click` to open links, and native right-click Cut/Copy/Paste/Select All context menus.
- **Electron Fuses & Global Security Hardening:** Configured `@electron/fuses` on packaging, global `session` permission denial, `will-redirect`/`will-attach-webview` blocking, and main-process HTML sanitization.
- **Structured File Logging & Crash Handling:** Added rotating error logs in `${XDG_STATE_HOME:-~/.local/state}/sticky-notes/logs` and `uncaughtException`/`unhandledRejection`/`SIGHUP` handling.
- **CI/CD, Linting & Expanded Tests:** Added GitHub Actions CI, ESLint + Prettier, `tsconfig.test.json`, and security/IPC/sanitizer unit tests.

### Changed
- Unified theme setting (`system` / `light` / `dark`) in SQLite with automatic one-time migration from `localStorage`.
- Improved SQLite reliability (`PRAGMA busy_timeout = 5000`, `wal_checkpoint(TRUNCATE)` on close, `0600` pre-creation) and search performance (eliminated N+1 preview queries, cached dynamic `UPDATE` statements, native short-term filtering).
- Upgraded toolbar and header buttons for full WCAG 2.1 Level A keyboard operability (`onClick`, `aria-label`, `aria-pressed`, `role="toolbar"`, checkbox `:focus-visible`, `prefers-reduced-motion`).
- Fixed `.deb` `after-remove.sh` so package upgrades preserve installed icons; removed dead sync stubs and unused config keys; added root `LICENSE` file.

## [1.1.1] - 2026-11-21
- Improved FTS5 trigram search excerpts and autosave idle/deadline coordination.
- Added verified pre-migration `VACUUM INTO` database backups.

## [1.1.0] - 2026-11-21
- Security and performance improvements.
- Multi-select checklist check/uncheck support.

## [1.0.0] - 2026-08-15
- Initial release with multi-color sticky notes, rich text formatting, checklists, pinning, Notes Manager with search, system tray integration, and Linux autostart.
