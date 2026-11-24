# Sticky Notes for Linux

A lightweight, offline-first, and distraction-free Sticky Notes app for Linux, inspired by Windows Sticky Notes.

---

## Features

- **Classic Sticky Notes Look & Feel** — Choose from 7 color themes: Yellow, Green, Pink, Purple, Blue, Charcoal (Dark), and White.
- **Rich Text Formatting** — Powered by Tiptap/ProseMirror with **Bold**, *Italic*, <u>Underline</u>, ~~Strikethrough~~, links (`Ctrl+Click` to open), and step-based undo/redo.
- **Interactive Checklists & Bullet Lists** — Track to-do items and bullet points with clean keyboard navigation and multi-select batch check/uncheck.
- **Pin Always-on-Top** — Keep important notes pinned above your other windows while you work.
- **Notes Manager, Instant Search & Trash** — Search all notes instantly via SQLite FTS5, recover deleted notes from Trash, or export backups as JSON or Markdown.
- **Automatic State Restoration** — Open notes, sizes, and positions are restored automatically on relaunch.
- **Local Encryption at Rest (Optional)** — Protect note contents on disk with AES-256-GCM keyed via your desktop OS keyring (KWallet / GNOME Keyring) from the Notes Manager footer.
- **Persistent System Tray Integration** — Closing note windows keeps Sticky Notes resident in your system tray for quick access; quit explicitly via Tray → **Quit Sticky Notes** or `Ctrl+Q`.

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + N` | Create a new note |
| `Ctrl + F` | Focus search in Notes Manager |
| `Esc` | Clear search in Notes Manager / close popovers |
| `Ctrl + Q` | Quit Sticky Notes cleanly |
| `Ctrl + B` | Bold selected text |
| `Ctrl + I` | Italic selected text |
| `Ctrl + U` | Underline selected text |
| `Ctrl + T` / `Ctrl + Shift + X` | Strikethrough selected text |
| `Ctrl + Shift + L` | Toggle bulleted list |
| `Ctrl + Shift + 7` | Toggle checklist |
| `Ctrl + Shift + V` | Paste as plain text |
| `Ctrl + Click` | Open a hyperlink in your default browser |
| `Ctrl + Z` | Undo typing |
| `Ctrl + Y` / `Ctrl + Shift + Z` | Redo typing |

---

## Download & Installation

### Download Pre-built Packages
Download the latest `.deb` or `.AppImage` release from the **[GitHub Releases](https://github.com/andrewhughes1988/Sticky-Notes-for-Linux/releases)** page:

- **Debian / Ubuntu / Mint / Parrot OS (`.deb`):**
  ```bash
  sudo dpkg -i sticky-notes-linux_1.2.0_amd64.deb
  ```

- **Universal Linux (`.AppImage`):**
  ```bash
  chmod +x Sticky.Notes-1.2.0.AppImage
  ./Sticky.Notes-1.2.0.AppImage
  ```

---

### Build & Verify from Source

Requires **Node.js 22** or later.

```bash
npm install
npm run lint
npm test
npm run build
npm start
```

### Build Distribution Packages
```bash
npm run dist
```
Built packages are placed in `release/`:
- `sticky-notes-linux_1.2.0_amd64.deb`
- `Sticky.Notes-1.2.0.AppImage`

AppImages built from this source require Chromium's sandbox. If the AppImage fails to launch, run it from a terminal to inspect the startup error.

---

## Local Data, Recovery & Backups

- **Database:** `${XDG_DATA_HOME:-$HOME/.local/share}/sticky-notes/stickynotes.db` (directory `0700`, file `0600`).
- **Error Logs:** `${XDG_STATE_HOME:-$HOME/.local/state}/sticky-notes/logs/app.log` (bounded rotating logs; note contents are never logged).
- **Recovery:** If the app reports a database error, close any running instance and verify the directory is writable with free disk space. Before attempting repairs, copy the entire `sticky-notes` directory (including any `-wal` and `-shm` files) to a safe location.
- **Trash & Backups:** Deleting a note moves it to **Trash** in the Notes Manager where it can be restored or permanently purged. Before schema upgrades, Sticky Notes writes a verified recovery snapshot (`*.pre-v*.bak`) in the data directory; once verified, you can remove those backup files from the Notes Manager banner.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [SECURITY.md](SECURITY.md), and [CHANGELOG.md](CHANGELOG.md) for engineering details.

---

## License

MIT License — see [LICENSE](LICENSE).
