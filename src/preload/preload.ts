import { contextBridge, ipcRenderer } from 'electron';
import { AppConfig, SettingChangeListener, StickyNotesAPI } from '../shared/types';

const identity = ipcRenderer.sendSync('window:getIdentity') as { noteId: string | null } | null;
if (!identity) throw new Error('Unrecognized renderer.');

const api: StickyNotesAPI = {
  isNoteWindow: identity.noteId !== null,
  noteId: identity.noteId,

  createNote: (initial) => ipcRenderer.invoke('notes:create', initial),
  getNote: (id: string) => ipcRenderer.invoke('notes:getById', id),
  getNotePreviews: (query) => ipcRenderer.invoke('notes:getPreviews', query),
  updateNote: (id, updates) => ipcRenderer.invoke('notes:update', id, updates),
  closeNoteWindow: (id: string) => ipcRenderer.invoke('notes:closeWindow', id),
  openNoteWindow: (id: string) => ipcRenderer.invoke('notes:openWindow', id),
  deleteNote: (id: string) => ipcRenderer.invoke('notes:delete', id),
  togglePin: (id: string) => ipcRenderer.invoke('notes:togglePin', id),

  getDeletedNotes: () => ipcRenderer.invoke('notes:getDeleted'),
  restoreNote: (id: string) => ipcRenderer.invoke('notes:restore', id),
  permanentlyDeleteNote: (id: string) => ipcRenderer.invoke('notes:deletePermanent', id),
  emptyTrash: () => ipcRenderer.invoke('notes:emptyTrash'),
  exportNotes: (format) => ipcRenderer.invoke('notes:export', format),
  getMigrationBackupCount: () => ipcRenderer.invoke('backups:count'),
  purgeMigrationBackups: () => ipcRenderer.invoke('backups:purge'),

  getEncryptionStatus: () => ipcRenderer.invoke('security:getEncryptionStatus'),
  setEncryptionEnabled: (enabled: boolean) => ipcRenderer.invoke('security:setEncryption', enabled),

  showManagerWindow: () => ipcRenderer.invoke('manager:show'),
  closeManagerWindow: () => ipcRenderer.invoke('manager:close'),
  quitApp: () => ipcRenderer.invoke('app:quit'),
  openExternalLink: (url: string) => ipcRenderer.invoke('shell:openExternal', url),

  onNotesChanged: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('notes:changed', handler);
    return () => {
      ipcRenderer.removeListener('notes:changed', handler);
    };
  },

  onSettingsChanged: (callback: SettingChangeListener) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      key: keyof AppConfig,
      value: AppConfig[keyof AppConfig]
    ) => callback(key, value);
    ipcRenderer.on('settings:changed', handler);
    return () => {
      ipcRenderer.removeListener('settings:changed', handler);
    };
  },

  onFlushRequested: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, requestId: number) => {
      Promise.resolve()
        .then(callback)
        .then(
          () => ipcRenderer.send('editor:flushed', requestId, true),
          () => ipcRenderer.send('editor:flushed', requestId, false)
        );
    };
    ipcRenderer.on('editor:flush', listener);
    ipcRenderer.send('editor:ready');
    return () => {
      ipcRenderer.removeListener('editor:flush', listener);
      ipcRenderer.send('editor:unready');
    };
  },

  onFlushCancelled: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('editor:resume', listener);
    return () => {
      ipcRenderer.removeListener('editor:resume', listener);
    };
  },

  getConfig: () => ipcRenderer.invoke('settings:getAll'),
  setConfig: (key, value) => ipcRenderer.invoke('settings:set', key, value),
};

contextBridge.exposeInMainWorld('stickyNotesAPI', api);
