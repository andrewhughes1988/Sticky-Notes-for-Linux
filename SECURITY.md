# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Sticky Notes for Linux, please report it responsibly by emailing **andrew.hughes@netsysprep.com** with:

- A clear description of the issue and affected version
- Minimal reproduction steps or proof-of-concept
- Potential security impact

Please do not disclose unpatched vulnerabilities in public GitHub issues.

## Security Architecture & Threat Model

Sticky Notes for Linux is designed as an **offline-first** desktop application with strict privilege boundaries:

- **Process Isolation:** All renderer windows run with `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, and `webSecurity: true`.
- **Electron Fuses:** Packaged releases disable `RunAsNode`, `EnableNodeOptionsEnvironmentVariable`, and `EnableNodeCliInspectArguments`, and enforce `OnlyLoadAppFromAsar` and ASAR integrity validation.
- **Content Security Policy:** Production builds enforce `connect-src 'none'`, `frame-src 'none'`, `object-src 'none'`, `base-uri 'none'`, and `form-action 'none'`.
- **IPC Role-Based Access Control:** Every IPC call validates its sender frame origin and enforces per-window role scoping (note windows may only read/modify their own note ID; settings and notes-list operations require the Notes Manager window).
- **Defense-in-Depth HTML Sanitization:** Note HTML is constrained by the Tiptap/ProseMirror document schema, sanitized via DOMPurify with strict tag/attribute/class/protocol hooks in the renderer, and sanitized again in the main process before SQLite persistence.
- **External Links & Permissions:** All browser permission requests (camera, mic, geolocation, notifications, etc.) are denied globally. Navigation, redirects, and `<webview>` attachments are blocked; external links open only for `https:`, `http:`, and `mailto:` URLs validated via `new URL()`.
- **Local Storage Permissions:** The data directory (`${XDG_DATA_HOME:-$HOME/.local/share}/sticky-notes`) is created with POSIX mode `0700` and the SQLite database file with mode `0600`. SQLite runs with `PRAGMA secure_delete = ON` and FTS5 `secure-delete` enabled.

## Data-at-Rest Considerations

- **Optional Application-Layer Encryption-at-Rest:** Notes Manager includes an **Encrypt at rest** option backed by your Linux desktop keyring via Electron `safeStorage` (KWallet / GNOME Keyring / libsecret). When enabled, all note titles, HTML bodies, and plain text are encrypted with AES-256-GCM (unique 96-bit IV + per-field AAD binding), the on-disk FTS5 index is cleared (`delete-all`), and SQLite runs `VACUUM` + `wal_checkpoint(TRUNCATE)` to purge old plaintext pages. Search runs transparently in memory while unlocked.
- If your desktop session lacks an OS keyring (`basic_text` fallback), the option stays disabled rather than silently providing weak protection. Full-disk or home-directory encryption (e.g., LUKS, fscrypt) is recommended in addition.
- Pre-migration backup files (`*.pre-v*.bak`) are created with mode `0600` before schema upgrades and can be purged from the Notes Manager once you confirm your notes upgraded cleanly.
