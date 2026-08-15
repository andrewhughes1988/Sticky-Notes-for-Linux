# Sticky Notes for Linux: Stability, Performance & Hardening Roadmap

This document outlines the technical findings, stability risks, performance bottlenecks, platform edge cases, and prioritized implementation plan for the **Sticky Notes for Linux** application.

---

## 1. Executive Summary & Goals

* **Primary Objective**: Zero data loss under any circumstance (crashes, sudden OS shutdowns, multi-window concurrent operations, rapid typing/closing).
* **Secondary Objective**: Snappy performance with sub-16ms UI responsiveness (60+ FPS) regardless of note count.
* **Tertiary Objective**: Robust Linux desktop integration across Wayland and X11 environments, multi-monitor setups, and desktop autostart.

---

## 2. Deep Technical Findings & Risk Matrix

### 2.1 Critical Data Loss Vectors (P0)

| Risk ID | Component | Description | Impact | Remediation Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **DATA-01** | `RichEditor.tsx` | Unflushed 300ms debounce timer when window is closed, unfocused, or app terminated. | Unsaved text loss on quick close / power off. | Add synchronous/immediate save flush on `blur`, `beforeunload`, component unmount, and IPC quit signals. |
| **DATA-02** | `windowManager.ts` | Window geometry (bounds/position) debounce timer (300ms) discarded on window close. | Note reverts to previous position/size. | Synchronously query and persist `win.getBounds()` inside `win.on('close')` before destroying the window reference. |
| **DATA-03** | `NoteView.tsx` / `database.ts` | Partial attribute updates (color change, pin toggle) overwrite unpersisted in-flight editor text. | Color change reverts pending text edits in DB. | Flush pending editor content prior to attribute changes, and use targeted atomic SQL updates (`UPDATE notes SET color = ?`). |
| **DATA-04** | `database.ts` | Unhandled SQLite startup exception if `.db-shm` / `.db-wal` or database file is corrupted after a system crash. | App fails to launch completely on startup. | Wrap DB init in `try/catch`, run `PRAGMA quick_check`, and provide automatic corrupted-file rotation and recovery. |

---

### 2.2 Performance & UI Snappiness (P1)

| Risk ID | Component | Description | Impact | Remediation Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **PERF-01** | `ManagerView.tsx` | `notes:changed` broadcast causes full SQLite query and re-renders every `NoteCard` on every keystroke. | Stutter/lag in Manager list when typing in notes. | Wrap `NoteCard` in `React.memo()`, debounce Manager reload, and perform in-memory item patching. |
| **PERF-02** | `RichEditor.tsx` | Reading `.innerText` on every keystroke forces synchronous Chromium layout reflow. | Keystroke latency and dropped frames. | Use `.textContent` for fast title/preview extraction or compute plain text only when saving. |
| **PERF-03** | `database.ts` | FTS5 shadow table query joins on string `id` instead of 64-bit integer `rowid`. | Slower search response times on large note collections. | Change query to `JOIN notes_fts ON notes.rowid = notes_fts.rowid`. |

---

### 2.3 Linux Desktop & Platform Stability (P1)

| Risk ID | Component | Description | Impact | Remediation Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **PLAT-01** | `windowManager.ts` | Notes saved on secondary/external displays spawn off-screen if the display is disconnected. | Note window is invisible and inaccessible to user. | Validate `(x, y)` against `screen.getAllDisplays()` before positioning; fallback to primary workArea if offscreen. |
| **PLAT-02** | `autostart.ts` | Autostart `.desktop` file does not quote `Exec` path containing spaces. | Autostart fails on distributions where AppImage or path has whitespace. | Quote the executable path: `Exec="${execPath}" --autostart`. |
| **PLAT-03** | `windowManager.ts` | Double-clicking frameless drag region on Linux compositors triggers window maximization. | Distorts sticky note dimensions and breaks layout. | Set `maximizable: false` on all note `BrowserWindow` instances. |

---

### 2.4 Security & Input Sanitization (P2)

| Risk ID | Component | Description | Impact | Remediation Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | `RichEditor.tsx` | Direct paste into `contentEditable` bypasses DOMPurify sanitization. | Can introduce un-sanitized HTML, external scripts, or large base64 image blobs. | Implement custom `onPaste` handler that passes clipboard HTML through `sanitizeHtml()` before inserting. |

---

## 3. Prioritized Implementation Roadmap

### Phase 1: Zero Data Loss & Crash Hardening (Completed)
- [x] **Task 1.1**: Implement `flush()` in `RichEditor.tsx` with listeners on `blur`, `beforeunload`, and unmount.
- [x] **Task 1.2**: Update `windowManager.ts` to flush window bounds synchronously on `close` and `before-quit`.
- [x] **Task 1.3**: Refactor `database.ts` to use atomic column-level updates (`UPDATE notes SET color = ? WHERE id = ?`).
- [x] **Task 1.4**: Add SQLite corruption recovery and automated database backup routines in `database.ts`.

### Phase 2: Performance & Rendering Optimization (Completed)
- [x] **Task 2.1**: Memoize `NoteCard.tsx` with `React.memo` and optimize `ManagerView.tsx` note change handler.
- [x] **Task 2.2**: Eliminate forced reflows in `RichEditor.tsx` by replacing `.innerText` with non-blocking extraction.
- [x] **Task 2.3**: Optimize FTS5 table join on `rowid` in `database.ts`.

### Phase 3: Platform Integration & Desktop Polish (Completed)
- [x] **Task 3.1**: Implement multi-monitor boundary validation in `windowManager.ts`.
- [x] **Task 3.2**: Add `maximizable: false` to Sticky Note `BrowserWindow` configurations.
- [x] **Task 3.3**: Quote `Exec` path in `autostart.ts` for whitespace safety.
- [x] **Task 3.4**: Add clipboard paste sanitization in `RichEditor.tsx`.

---

## 4. Architectural Guarantees for Future Sync / Cloud Features

When integrating Microsoft Graph / OneNote or custom cloud synchronization:
1. **Local-First Precedence**: All writes must complete to SQLite WAL locally before queuing remote sync tasks.
2. **Conflict Resolution**: Last-Write-Wins (LWW) based on monotonic timestamp + UUID tiebreaker, with automatic fallback snapshotting to prevent data loss.
3. **Tombstone Cleanup**: Retain deleted note tombstones (`deleted_at IS NOT NULL`) for at least 30 days or until acknowledged by all sync clients before physical SQLite vacuuming.
