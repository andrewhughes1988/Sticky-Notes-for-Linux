import { ipcMain } from 'electron';
import { DatabaseService } from './database';
import { WindowManager } from './windowManager';
import { AutostartManager } from './autostart';
import { Note, AppConfig } from '../shared/types';

export function registerIpcHandlers(
  db: DatabaseService,
  windowManager: WindowManager,
  autostartManager: AutostartManager
): void {
  // Note CRUD & Window Operations
  ipcMain.handle('notes:create', async (_event, initial?: Partial<Note>) => {
    return windowManager.createNewNoteWindow(initial);
  });

  ipcMain.handle('notes:getById', async (_event, id: string) => {
    return db.getNoteById(id);
  });

  ipcMain.handle('notes:getAll', async (_event, options?: { search?: string; includeClosed?: boolean; limit?: number; offset?: number }) => {
    return db.getAllNotes(options);
  });

  ipcMain.handle('notes:update', async (_event, id: string, updates: Partial<Note>) => {
    const updated = db.updateNote(id, updates);
    if (updated) {
      windowManager.broadcast('notes:updated', updated);
      windowManager.broadcast('notes:changed');
    }
    return updated;
  });

  ipcMain.handle('notes:closeWindow', async (_event, id: string) => {
    windowManager.closeNoteWindow(id);
  });

  ipcMain.handle('notes:openWindow', async (_event, id: string) => {
    windowManager.openNote(id);
  });

  ipcMain.handle('notes:delete', async (_event, id: string) => {
    windowManager.deleteNote(id);
  });

  ipcMain.handle('notes:togglePin', async (_event, id: string) => {
    return windowManager.toggleNotePin(id);
  });

  ipcMain.handle('notes:updateBounds', async (_event, id: string, bounds: { x: number; y: number; width: number; height: number }) => {
    db.updateNoteBounds(id, bounds);
  });

  // Manager Operations
  ipcMain.handle('manager:toggle', async () => {
    windowManager.toggleManagerWindow();
  });
  ipcMain.handle('manager:show', async () => {
    windowManager.showManagerWindow();
  });
  ipcMain.handle('manager:close', async () => {
    windowManager.closeManagerWindow();
  });

  // Settings
  ipcMain.handle('settings:getAll', async () => {
    return db.getAllSettings();
  });

  ipcMain.handle('settings:set', async (_event, key: keyof AppConfig, value: any) => {
    db.setSetting(key, value);
    if (key === 'autostart') {
      autostartManager.setEnabled(Boolean(value));
    }
    windowManager.broadcast('settings:changed', key, value);
  });
}
