import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { DatabaseService } from './database';
import { WindowManager } from './windowManager';
import { AutostartManager } from './autostart';
import { NoteColor, NOTE_COLORS, Note, NotePreviewQuery } from '../shared/types';

function readFields(value: unknown, allowed: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new Error('Invalid request fields.');
  }
  return value as Record<string, unknown>;
}

function readColor(value: unknown): NoteColor {
  if (typeof value !== 'string' || !Object.hasOwn(NOTE_COLORS, value)) {
    throw new Error('Invalid note color.');
  }
  return value as NoteColor;
}

function readText(value: unknown, max: number): string {
  if (typeof value !== 'string' || value.length > max) throw new Error('Invalid text length.');
  return value;
}

function readInteger(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error('Invalid number.');
  }
  return value;
}

export function registerIpcHandlers(
  db: DatabaseService,
  windowManager: WindowManager,
  autostartManager: AutostartManager
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
    return windowManager.createNewNoteWindow(color === undefined ? {} : { color: readColor(color) });
  });

  ipcMain.handle('notes:getById', (event, id: unknown) => db.getNoteById(requireNote(event, id)));

  ipcMain.handle('notes:getPreviews', (event, value: unknown) => {
    requireManager(event);
    const { search, limit, offset } = value === undefined ? {} : readFields(value, ['search', 'limit', 'offset']);
    const query: NotePreviewQuery = {};
    if (search !== undefined) query.search = readText(search, 256);
    if (limit !== undefined) query.limit = readInteger(limit, 1, 101);
    if (offset !== undefined) query.offset = readInteger(offset, 0, Number.MAX_SAFE_INTEGER);
    return db.getNotePreviews(query);
  });

  ipcMain.handle('notes:update', (event, value: unknown, input: unknown) => {
    const id = requireNote(event, value);
    const { color, content_html, content_plain } = readFields(input, ['color', 'content_html', 'content_plain']);
    const updates: Partial<Note> = {};
    if (color !== undefined) updates.color = readColor(color);
    if (content_html !== undefined || content_plain !== undefined) {
      updates.content_html = readText(content_html, 2_000_000);
      updates.content_plain = readText(content_plain, 1_000_000);
    }
    if (!Object.keys(updates).length) throw new Error('No changes provided.');
    const saved = db.updateNote(id, updates);
    if (!saved) throw new Error('Note no longer exists.');
    windowManager.broadcast('notes:changed');
    return saved;
  });

  ipcMain.handle('notes:closeWindow', (event, id: unknown) => windowManager.closeNoteWindow(requireNote(event, id)));
  ipcMain.handle('notes:openWindow', (event, id: unknown) => {
    requireManager(event);
    windowManager.openNote(readText(id, 128));
  });
  ipcMain.handle('notes:delete', (event, id: unknown) => windowManager.deleteNote(requireNote(event, id, true)));
  ipcMain.handle('notes:togglePin', (event, id: unknown) => windowManager.toggleNotePin(requireNote(event, id)));

  ipcMain.handle('manager:show', (event) => {
    windowManager.rendererRole(event);
    windowManager.showManagerWindow();
  });
  ipcMain.handle('manager:close', (event) => {
    requireManager(event);
    windowManager.closeManagerWindow();
  });

  ipcMain.on('editor:ready', (event) => {
    try {
      if (windowManager.rendererRole(event).noteId !== null) windowManager.markEditorReady(event.sender);
    } catch {
      // Ignore messages from unrecognized frames.
    }
  });

  ipcMain.on('editor:flushed', (event, id: unknown, saved: unknown) => {
    try {
      if (windowManager.rendererRole(event).noteId !== null && typeof id === 'number' && typeof saved === 'boolean') {
        windowManager.acknowledgeEditorFlush(event.sender, id, saved);
      }
    } catch {
      // Ignore messages from unrecognized frames.
    }
  });

  ipcMain.handle('settings:getAll', (event) => {
    requireManager(event);
    return { ...db.getAllSettings(), autostart: autostartManager.isEnabled() };
  });

  ipcMain.handle('settings:set', (event, key: unknown, value: unknown) => {
    requireManager(event);
    if (key !== 'autostart' || typeof value !== 'boolean') throw new Error('Invalid setting.');
    const previouslyEnabled = autostartManager.isEnabled();
    autostartManager.setEnabled(value);
    try {
      db.setSetting(key, value);
    } catch (error) {
      try {
        autostartManager.setEnabled(previouslyEnabled);
      } catch (rollbackError) {
        console.error('Could not restore the previous autostart state:', rollbackError);
      }
      throw error;
    }
    windowManager.broadcast('settings:changed', key, value);
  });
}
