import { IPC_CHANNELS } from '../shared/ipc';
import { contextBridge, ipcRenderer } from 'electron';
import { AppConfig, SettingChangeListener, StickyNotesAPI } from '../shared/types';

// Parse CLI flags passed to this specific renderer window
const args = process.argv;
const noteIdArg = args.find((arg) => arg.startsWith('--note-id='));
const windowTypeArg = args.find((arg) => arg.startsWith('--window-type='));

const currentNoteId = noteIdArg ? noteIdArg.slice('--note-id='.length) : null;
const windowType = windowTypeArg ? windowTypeArg.slice('--window-type='.length) : 'note';

const api: StickyNotesAPI = {
  isNoteWindow: windowType === 'note',
  noteId: currentNoteId,

  createNote: (initial) => ipcRenderer.invoke(IPC_CHANNELS.NOTES_CREATE, initial),
  getNote: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.NOTES_GET_BY_ID, id),
  getNotePreviews: (query) => ipcRenderer.invoke(IPC_CHANNELS.NOTES_GET_PREVIEWS, query),
  updateNote: (id, updates) => ipcRenderer.invoke(IPC_CHANNELS.NOTES_UPDATE, id, updates),
  closeNoteWindow: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.NOTES_CLOSE_WINDOW, id),
  openNoteWindow: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.NOTES_OPEN_WINDOW, id),
  deleteNote: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.NOTES_DELETE, id),
  togglePin: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.NOTES_TOGGLE_PIN, id),

  getDeletedNotes: () => ipcRenderer.invoke(IPC_CHANNELS.NOTES_GET_DELETED),
  restoreNote: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.NOTES_RESTORE, id),
  permanentlyDeleteNote: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.NOTES_DELETE_PERMANENT, id),
  emptyTrash: () => ipcRenderer.invoke(IPC_CHANNELS.NOTES_EMPTY_TRASH),
  exportNotes: (format) => ipcRenderer.invoke(IPC_CHANNELS.NOTES_EXPORT, format),
  getMigrationBackupCount: () => ipcRenderer.invoke(IPC_CHANNELS.BACKUPS_COUNT),
  purgeMigrationBackups: () => ipcRenderer.invoke(IPC_CHANNELS.BACKUPS_PURGE),

  getEncryptionStatus: () => ipcRenderer.invoke(IPC_CHANNELS.SECURITY_GET_ENCRYPTION_STATUS),
  setEncryptionEnabled: (enabled: boolean) =>
    ipcRenderer.invoke(IPC_CHANNELS.SECURITY_SET_ENCRYPTION, enabled),

  showManagerWindow: () => ipcRenderer.invoke(IPC_CHANNELS.MANAGER_SHOW),
  closeManagerWindow: () => ipcRenderer.invoke(IPC_CHANNELS.MANAGER_CLOSE),
  quitApp: () => ipcRenderer.invoke(IPC_CHANNELS.APP_QUIT),
  openExternalLink: (url: string) => ipcRenderer.invoke(IPC_CHANNELS.SHELL_OPEN_EXTERNAL, url),

  onNotesChanged: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on(IPC_CHANNELS.NOTES_CHANGED, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.NOTES_CHANGED, handler);
    };
  },

  onSettingsChanged: (callback: SettingChangeListener) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      key: keyof AppConfig,
      value: AppConfig[keyof AppConfig]
    ) => callback(key, value);
    ipcRenderer.on(IPC_CHANNELS.SETTINGS_CHANGED, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.SETTINGS_CHANGED, handler);
    };
  },

  onFlushRequested: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, requestId: number) => {
      Promise.resolve()
        .then(callback)
        .then(
          () => ipcRenderer.send(IPC_CHANNELS.EDITOR_FLUSHED, requestId, true),
          () => ipcRenderer.send(IPC_CHANNELS.EDITOR_FLUSHED, requestId, false)
        );
    };
    ipcRenderer.on(IPC_CHANNELS.EDITOR_FLUSH, listener);
    ipcRenderer.send(IPC_CHANNELS.EDITOR_READY);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.EDITOR_FLUSH, listener);
      ipcRenderer.send(IPC_CHANNELS.EDITOR_UNREADY);
    };
  },

  onFlushCancelled: (callback) => {
    const listener = () => callback();
    ipcRenderer.on(IPC_CHANNELS.EDITOR_RESUME, listener);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.EDITOR_RESUME, listener);
    };
  },

  getConfig: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET_ALL),
  setConfig: (key, value) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, key, value),
};

contextBridge.exposeInMainWorld('stickyNotesAPI', api);
