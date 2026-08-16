# Sticky Notes for Linux

A lightweight, beautiful, and distraction-free Sticky Notes app for Linux, inspired by Windows Sticky Notes.

---

## ✨ Features

- **Classic Sticky Notes Look & Feel** — Choose from 7 color themes: Yellow, Green, Pink, Purple, Blue, Charcoal (Dark), and White.
- **Rich Text Formatting** — Format your thoughts with **Bold**, *Italic*, <u>Underline</u>, and ~~Strikethrough~~.
- **Interactive Checklists & Bullet Lists** — Track to-do items and bullet points with clean keyboard and click interactions.
- **Pin Always-on-Top** — Keep important notes pinned above all your other windows while you work.
- **Notes List & Instant Search** — Easily search and browse all your open and closed notes from the central Notes List.
- **Automatic State Restoration** — Your open desktop notes and their exact positions are remembered and restored when you reopen the app.
- **System Tray Integration** — Access your notes, create new notes, or show/hide all notes directly from your desktop system tray.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + N` | Create a new note |
| `Ctrl + B` | Bold selected text |
| `Ctrl + I` | Italic selected text |
| `Ctrl + U` | Underline selected text |
| `Ctrl + T` | Strikethrough selected text |
| `Ctrl + Z` | Undo typing |
| `Ctrl + Y` | Redo typing |

---

## 📦 Download & Installation

### Download Pre-built Packages
Download the latest `.deb` or `.AppImage` release from the **[GitHub Releases](https://github.com/andrewhughes1988/Sticky-Notes-for-Linux/releases)** page:

- **Debian / Ubuntu / Mint / Parrot OS (`.deb`):**
  ```bash
  sudo dpkg -i sticky-notes-linux_1.0.0_amd64.deb
  ```

- **Universal Linux (`.AppImage`):**
  ```bash
  chmod +x "Sticky Notes-1.0.0.AppImage"
  ./"Sticky Notes-1.0.0.AppImage"
  ```

---

### Build from Source
```bash
npm install
npm run build
npm start
```

### Build Distribution Packages
```bash
npm run dist
```
The built packages will be placed in the `release/` directory:
- `sticky-notes-linux_1.0.0_amd64.deb`
- `Sticky Notes-1.0.0.AppImage`

---

## 📄 License

MIT License.
