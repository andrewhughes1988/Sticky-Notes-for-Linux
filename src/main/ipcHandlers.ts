import { app, ipcMain, IpcMainInvokeEvent, shell } from 'electron';
import { DatabaseService } from './database';
import { WindowManager } from './windowManager';
import { AutostartManager } from './autostart';
import { parseSafeExternalUrl, sanitizeNoteHtmlMain } from './htmlSanitizer';
import { AesGcmNoteCipher, generateDataEncryptionKey, KeyringAdapter } from './crypto';
import { logger } from './logger';
import {
  AppTheme,
  EncryptionStatus,
  NoteColor,
  NOTE_COLORS,
  Note,
  NotePreviewQuery,
} from '../shared/types';

export function readFields(value: unknown, allowed: string[]): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !allowed.includes(key))
  ) {
    throw new Error('Invalid request fields.');
  }
  return value as Record<string, unknown>;
}

export function readColor(value: unknown): NoteColor {
  if (typeof value !== 'string' || !Object.hasOwn(NOTE_COLORS, value)) {
    throw new Error('Invalid note color.');
  }
  return value as NoteColor;
}

export function readTheme(value: unknown): AppTheme {
  if (value !== 'system' && value !== 'light' && value !== 'dark') {
    throw new Error('Invalid theme.');
  }
  return value;
}

export function readText(value: unknown, max: number): string {
  if (typeof value !== 'string' || value.length > max) throw new Error('Invalid text length.');
  return value;
}

export function readInteger(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error('Invalid number.');
  }
  return value;
}

export function readExportFormat(value: unknown): 'json' | 'markdown' {
  if (value !== 'json' && value !== 'markdown') {
    throw new Error('Invalid export format.');
  }
  return value;
}

export function validateNoteUpdates(input: unknown): Partial<Note> {
  const { color, content_html, content_plain } = readFields(input, [
    'color',
    'content_html',
    'content_plain',
  ]);
  const updates: Partial<Note> = {};
  if (color !== undefined) updates.color = readColor(color);
  if (content_html !== undefined || content_plain !== undefined) {
    updates.content_html = sanitizeNoteHtmlMain(readText(content_html, 2_000_000));
    updates.content_plain = readText(content_plain, 1_000_000);
  }
  if (!Object.keys(updates).length) throw new Error('No changes provided.');
  return updates;
}

export function registerIpcHandlers(
  db: DatabaseService,
  windowManager: WindowManager,
  autostartManager: AutostartManager,
  keyring: KeyringAdapter
): void {
  function requireManager(event: IpcMainInvokeEvent): void {
    if (windowManager.rendererRole(event).noteId !== null) throw new Error('Notes list required.');
  }

  function requireNote(event: IpcMainInvokeEvent, value: unknown, allowManager = false): string {
    const id = readText(value, 128);
    const role = windowManager.rendererRole(event);
    if (!id || (role.noteId !== id && !(allowManager && role.noteId === null))) {
      throw new Error('Note access denied.');
    }
    return id;
  }

  ipcMain.handle('notes:create', (event, value?: unknown) => {
    windowManager.rendererRole(event);
    if (value === undefined) return windowManager.createNewNoteWindow();
    const { color } = readFields(value, ['color']);
    return windowManager.createNewNoteWindow(
      color === undefined ? {} : { color: readColor(color) }
    );
  });

  ipcMain.handle('notes:getById', (event, id: unknown) => db.getNoteById(requireNote(event, id)));

  ipcMain.handle('notes:getPreviews', (event, value: unknown) => {
    requireManager(event);
    const { search, limit, offset } =
      value === undefined ? {} : readFields(value, ['search', 'limit', 'offset']);
    const query: NotePreviewQuery = {};
    if (search !== undefined) query.search = readText(search, 256);
    if (limit !== undefined) query.limit = readInteger(limit, 1, 101);
    if (offset !== undefined) query.offset = readInteger(offset, 0, Number.MAX_SAFE_INTEGER);
    return db.getNotePreviews(query);
  });

  ipcMain.handle('notes:update', (event, value: unknown, input: unknown) => {
    const id = requireNote(event, value);
    const updates = validateNoteUpdates(input);
    const saved = db.updateNote(id, updates);
    if (!saved) throw new Error('Note no longer exists.');
    windowManager.broadcast('notes:changed');
    return saved;
  });

  ipcMain.handle('notes:closeWindow', (event, id: unknown) =>
    windowManager.closeNoteWindow(requireNote(event, id))
  );
  ipcMain.handle('notes:openWindow', (event, id: unknown) => {
    requireManager(event);
    windowManager.openNote(readText(id, 128));
  });
  ipcMain.handle('notes:delete', (event, id: unknown) =>
    windowManager.deleteNote(requireNote(event, id, true))
  );
  ipcMain.handle('notes:togglePin', (event, id: unknown) =>
    windowManager.toggleNotePin(requireNote(event, id))
  );

  // Trash & Backup Lifecycle (Manager-only)
  ipcMain.handle('notes:getDeleted', (event) => {
    requireManager(event);
    return db.getDeletedNotes();
  });
  ipcMain.handle('notes:restore', (event, id: unknown) => {
    requireManager(event);
    windowManager.restoreNote(readText(id, 128));
  });
  ipcMain.handle('notes:deletePermanent', (event, id: unknown) => {
    requireManager(event);
    windowManager.permanentlyDeleteNote(readText(id, 128));
  });
  ipcMain.handle('notes:emptyTrash', (event) => {
    requireManager(event);
    windowManager.emptyTrash();
  });
  ipcMain.handle('notes:export', (event, format: unknown) => {
    requireManager(event);
    return windowManager.exportNotes(readExportFormat(format));
  });
  ipcMain.handle('backups:count', (event) => {
    requireManager(event);
    return db.listMigrationBackups().length;
  });
  ipcMain.handle('backups:purge', (event) => {
    requireManager(event);
    return db.purgeMigrationBackups();
  });

  // Encryption-at-Rest (Manager-only, backed by OS keyring)
  const readEncryptionStatus = (): EncryptionStatus => ({
    enabled: db.isEncryptionEnabled(),
    available: keyring.isAvailable(),
    backend: keyring.backendName(),
  });

  ipcMain.handle('security:getEncryptionStatus', (event) => {
    requireManager(event);
    return readEncryptionStatus();
  });

  ipcMain.handle('security:setEncryption', (event, enabled: unknown) => {
    requireManager(event);
    if (typeof enabled !== 'boolean') throw new Error('Invalid encryption flag.');
    if (enabled) {
      if (!keyring.isAvailable()) {
        throw new Error('OS keyring encryption is not available on this desktop session.');
      }
      if (!db.isEncryptionEnabled()) {
        const key = generateDataEncryptionKey();
        const wrapped = keyring.seal(key.toString('hex'));
        db.enableEncryption(new AesGcmNoteCipher(key), wrapped);
      }
    } else if (db.isEncryptionEnabled()) {
      db.disableEncryption();
    }
    return readEncryptionStatus();
  });

  // Manager & App Controls
  ipcMain.handle('manager:show', (event) => {
    windowManager.rendererRole(event);
    windowManager.showManagerWindow();
  });
  ipcMain.handle('manager:close', (event) => {
    requireManager(event);
    windowManager.closeManagerWindow();
  });
  ipcMain.handle('app:quit', (event) => {
    windowManager.rendererRole(event);
    app.quit();
  });
  ipcMain.handle('shell:openExternal', async (event, rawUrl: unknown) => {
    windowManager.rendererRole(event);
    const url = readText(rawUrl, 4096);
    const safeUrl = parseSafeExternalUrl(url);
    if (!safeUrl) throw new Error('Invalid external link.');
    await shell.openExternal(safeUrl);
  });

  // Editor Flush Handshake
  ipcMain.on('editor:ready', (event) => {
    try {
      if (windowManager.rendererRole(event).noteId !== null) {
        windowManager.markEditorReady(event.sender);
      }
    } catch {
      // Ignore messages from unrecognized frames.
    }
  });

  ipcMain.on('editor:unready', (event) => {
    try {
      if (windowManager.rendererRole(event).noteId !== null) {
        windowManager.markEditorUnready(event.sender);
      }
    } catch {
      // Ignore messages from unrecognized frames.
    }
  });

  ipcMain.on('editor:flushed', (event, id: unknown, saved: unknown) => {
    try {
      if (
        windowManager.rendererRole(event).noteId !== null &&
        typeof id === 'number' &&
        typeof saved === 'boolean'
      ) {
        windowManager.acknowledgeEditorFlush(event.sender, id, saved);
      }
    } catch {
      // Ignore messages from unrecognized frames.
    }
  });

  // Settings (Manager-only)
  ipcMain.handle('settings:getAll', (event) => {
    requireManager(event);
    return { ...db.getAllSettings(), autostart: autostartManager.isEnabled() };
  });

  ipcMain.handle('settings:set', (event, key: unknown, value: unknown) => {
    requireManager(event);
    if (key === 'theme') {
      const theme = readTheme(value);
      db.setSetting('theme', theme);
      windowManager.broadcast('settings:changed', 'theme', theme);
      return;
    }
    if (key === 'autostart' && typeof value === 'boolean') {
      const previouslyEnabled = autostartManager.isEnabled();
      autostartManager.setEnabled(value);
      try {
        db.setSetting('autostart', value);
      } catch (error) {
        try {
          autostartManager.setEnabled(previouslyEnabled);
        } catch (rollbackError) {
          logger.error('Could not restore the previous autostart state', rollbackError);
        }
        throw error;
      }
      windowManager.broadcast('settings:changed', 'autostart', value);
      return;
    }
    throw new Error('Invalid setting.');
  });
}
