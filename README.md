# Sticky Notes for Linux

A pixel-faithful, offline-first Windows Sticky Notes application for Linux (optimized for KDE Plasma, Wayland, and Parrot Security OS).

![Sticky Notes Header](https://img.shields.io/badge/Platform-Linux%20%28Wayland%20%2F%20X11%29-blue)
![Security-Hardened](https://img.shields.io/badge/Security-Air--Gapped%20%2F%20Local--Only-brightgreen)
![License](https://img.shields.io/badge/License-MIT-green)

---

## ✨ Features

- 🎨 **Faithful Windows Fluent Design:** 7 canonical color themes (Yellow, Green, Pink, Purple, Blue, Charcoal, White/Grey) in both light and dark modes.
- 🪟 **True Multi-Window Orchestration:** Independent floating note windows on your desktop. Drag by top header, resize freely, or keep always on top.
- 📋 **Central Notes Manager:** Windows-style Notes List window with instant full-text search (SQLite FTS5), card grid, open/closed status indicators, and permanent delete confirmation.
- ✍️ **Rich Text Editing:** Full support for Bold (`Ctrl+B`), Italic (`Ctrl+I`), Underline (`Ctrl+U`), Strikethrough (`Ctrl+T`), Bullet lists (`Ctrl+Shift+L`), and interactive Checklists/To-do items.
- 💾 **Local-Only & Air-Gapped:** Zero listening network ports, strict CSP (`connect-src 'none'`), DOMPurify XSS protection, and POSIX `0600` database file permissions.
- 🚀 **Smart Autostart & State Restoration:** Restores only notes that were previously in an open state on desktop login via XDG Autostart (`~/.config/autostart/`).
- 📌 **KDE Plasma System Tray Integration:** Tray icon to quickly create notes, toggle Notes Manager, show/hide all notes, or exit.
- 🔄 **Cloud-Ready Sync Architecture:** Built with an adapter pattern ready for Phase 2 Microsoft 365 / OneNote / Exchange Online sync.

---

## 🏗️ Architecture & Security Documents

- 📘 [ARCHITECTURE.md](./ARCHITECTURE.md) - Complete software architecture, component layers, database schema, and Microsoft Graph sync feasibility.
- 🛡️ [SECURITY_REVIEW.md](./SECURITY_REVIEW.md) - Threat model, supply chain assessment, POSIX permissions, and local isolation guarantees.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run in Development Mode
```bash
npm run dev
```

### 3. Launch App
```bash
npm start
```

### 4. Run Automated Database & FTS5 Tests
```bash
npm test
```

### 5. Build Production Linux Package
```bash
npm run dist
```

---

## 🗄️ Database Location

Data is stored locally under the XDG standard:
* **SQLite Database:** `~/.local/share/sticky-notes/stickynotes.db` (POSIX `0600`)
* **Autostart Entry:** `~/.config/autostart/sticky-notes.desktop`
