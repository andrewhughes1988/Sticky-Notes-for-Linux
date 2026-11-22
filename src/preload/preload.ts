import { contextBridge, ipcRenderer } from 'electron';
import { StickyNotesAPI } from '../shared/types';

// Parse CLI flags passed to this specific renderer window
const args = process.argv;
const noteIdArg = args.find((arg) => arg.startsWith('--note-id='));
const windowTypeArg = args.find((arg) => arg.startsWith('--window-type='));

const currentNoteId = noteIdArg ? noteIdArg.split('=')[1] : null;
const windowType = windowTypeArg ? windowTypeArg.split('=')[1] : 'note';

const api: StickyNotesAPI = {
  isNoteWindow: windowType === 'note',
  noteId: currentNoteId,

  createNote: (initial) => {
    return ipcRenderer.invoke('notes:create', initial);
  },

  getNote: (id: string) => {
    return ipcRenderer.invoke('notes:getById', id);
  },

  getNotePreviews: (query) => {
    return ipcRenderer.invoke('notes:getPreviews', query);
  },

  updateNote: (id, updates) => {
    return ipcRenderer.invoke('notes:update', id, updates);
  },

  closeNoteWindow: (id: string) => {
    return ipcRenderer.invoke('notes:closeWindow', id);
  },

  openNoteWindow: (id: string) => {
    return ipcRenderer.invoke('notes:openWindow', id);
  },

  deleteNote: (id: string) => {
    return ipcRenderer.invoke('notes:delete', id);
  },

  togglePin: (id: string) => {
    return ipcRenderer.invoke('notes:togglePin', id);
  },

  showManagerWindow: () => {
    return ipcRenderer.invoke('manager:show');
  },
  closeManagerWindow: () => {
    return ipcRenderer.invoke('manager:close');
  },

  onNotesChanged: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('notes:changed', handler);
    return () => {
      ipcRenderer.removeListener('notes:changed', handler);
    };
  },

  onSettingsChanged: (callback: (key: string, value: any) => void) => {
    const handler = (_event: any, key: string, value: any) => callback(key, value);
    ipcRenderer.on('settings:changed', handler);
    return () => {
      ipcRenderer.removeListener('settings:changed', handler);
    };
  },

  onFlushRequested: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, requestId: number) => {
      Promise.resolve().then(callback).then(
        () => ipcRenderer.send('editor:flushed', requestId, true),
        () => ipcRenderer.send('editor:flushed', requestId, false),
      );
    };
    ipcRenderer.on('editor:flush', listener);
    ipcRenderer.send('editor:ready');
    return () => { ipcRenderer.removeListener('editor:flush', listener); };
  },

  onFlushCancelled: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('editor:resume', listener);
    return () => { ipcRenderer.removeListener('editor:resume', listener); };
  },

  getConfig: () => {
    return ipcRenderer.invoke('settings:getAll');
  },

  setConfig: (key, value) => {
    return ipcRenderer.invoke('settings:set', key, value);
  },
};

contextBridge.exposeInMainWorld('stickyNotesAPI', api);
