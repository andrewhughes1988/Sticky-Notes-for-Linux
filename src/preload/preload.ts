import { contextBridge, ipcRenderer } from 'electron';
import { Note, AppConfig, StickyNotesAPI } from '../shared/types';

// Parse CLI flags passed to this specific renderer window
const args = process.argv;
const noteIdArg = args.find((arg) => arg.startsWith('--note-id='));
const windowTypeArg = args.find((arg) => arg.startsWith('--window-type='));

const currentNoteId = noteIdArg ? noteIdArg.split('=')[1] : null;
const windowType = windowTypeArg ? windowTypeArg.split('=')[1] : 'note';

const api: StickyNotesAPI = {
  isNoteWindow: windowType === 'note',
  noteId: currentNoteId,

  createNote: (initial?: Partial<Note>) => {
    return ipcRenderer.invoke('notes:create', initial);
  },

  getNote: (id: string) => {
    return ipcRenderer.invoke('notes:getById', id);
  },

  getAllNotes: (query?: { search?: string; includeClosed?: boolean }) => {
    return ipcRenderer.invoke('notes:getAll', query);
  },

  updateNote: (id: string, updates: Partial<Note>) => {
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

  updateNoteBounds: (id: string, bounds: { x: number; y: number; width: number; height: number }) => {
    return ipcRenderer.invoke('notes:updateBounds', id, bounds);
  },

  toggleManagerWindow: () => {
    return ipcRenderer.invoke('manager:toggle');
  },
  showManagerWindow: () => {
    return ipcRenderer.invoke('manager:show');
  },
  closeManagerWindow: () => {
    return ipcRenderer.invoke('manager:close');
  },

  onNoteUpdated: (callback: (note: Note) => void) => {
    const handler = (_event: any, note: Note) => callback(note);
    ipcRenderer.on('notes:updated', handler);
    return () => {
      ipcRenderer.removeListener('notes:updated', handler);
    };
  },

  onNoteDeleted: (callback: (id: string) => void) => {
    const handler = (_event: any, id: string) => callback(id);
    ipcRenderer.on('notes:deleted', handler);
    return () => {
      ipcRenderer.removeListener('notes:deleted', handler);
    };
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

  getConfig: () => {
    return ipcRenderer.invoke('settings:getAll');
  },

  setConfig: (key: keyof AppConfig, value: any) => {
    return ipcRenderer.invoke('settings:set', key, value);
  },
};

contextBridge.exposeInMainWorld('stickyNotesAPI', api);
