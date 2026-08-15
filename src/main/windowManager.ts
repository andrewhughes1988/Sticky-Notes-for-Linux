import { BrowserWindow, shell, screen, app } from 'electron';
import path from 'node:path';
import { DatabaseService } from './database';
import { Note, NOTE_COLORS } from '../shared/types';

export class WindowManager {
  private noteWindows: Map<string, BrowserWindow> = new Map();
  private managerWindow: BrowserWindow | null = null;
  private db: DatabaseService;
  private preloadPath: string;
  private isDev: boolean;
  private devServerUrl: string;

  constructor(db: DatabaseService) {
    this.db = db;
    this.isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
    this.devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    this.preloadPath = path.join(__dirname, '../preload/preload.js');
  }

  /**
   * Restores all notes that were previously open in the database
   */
  public restoreOpenNotes(): void {
    const openNotes = this.db.getOpenNotes();
    if (openNotes.length === 0) {
      // If no notes are open, open one initial welcome/new note
      const allNotes = this.db.getAllNotes({ includeClosed: true });
      if (allNotes.length === 0) {
        this.createNewNoteWindow({
          title: 'Welcome to Sticky Notes',
          content_html: '<div>Welcome to <b>Sticky Notes</b> for Linux!</div><ul><li>Type your thoughts freely</li><li>Change colors via the <b>...</b> menu</li><li>Format text with <b>B</b>, <i>I</i>, <u>U</u>, <s>S</s></li><li>Search all notes in the Notes Manager</li></ul>',
          content_plain: 'Welcome to Sticky Notes for Linux!\n- Type your thoughts freely\n- Change colors via the ... menu\n- Format text with B, I, U, S\n- Search all notes in the Notes Manager',
          color: 'yellow',
        });
      } else {
        // Just show the Notes Manager
        this.showManagerWindow();
      }
    } else {
      for (const note of openNotes) {
        this.createNoteWindow(note);
      }
    }
  }

  /**
   * Creates a new note in the DB and opens its window
   */
  public createNewNoteWindow(initial: Partial<Note> = {}): Note {
    // Determine positioning offset from active window or center
    let pos_x = initial.pos_x;
    let pos_y = initial.pos_y;

    if (pos_x === undefined || pos_y === undefined) {
      const activeWindow = BrowserWindow.getFocusedWindow();
      if (activeWindow && !activeWindow.isDestroyed()) {
        const bounds = activeWindow.getBounds();
        pos_x = bounds.x + 30;
        pos_y = bounds.y + 30;
      } else {
        const primaryDisplay = screen.getPrimaryDisplay();
        const { width, height } = primaryDisplay.workAreaSize;
        pos_x = Math.round((width - 320) / 2) + Math.floor(Math.random() * 40 - 20);
        pos_y = Math.round((height - 340) / 2) + Math.floor(Math.random() * 40 - 20);
      }
    }

    const newNote = this.db.createNote({
      ...initial,
      pos_x,
      pos_y,
      is_open: 1,
    });

    this.createNoteWindow(newNote);
    this.broadcast('notes:changed');
    return newNote;
  }

  /**
   * Opens or focuses a note window for a specific note
   */
  public openNote(id: string): void {
    const existing = this.noteWindows.get(id);
    if (existing && !existing.isDestroyed()) {
      if (existing.isMinimized()) existing.restore();
      existing.show();
      existing.focus();
      return;
    }

    const note = this.db.getNoteById(id);
    if (note) {
      this.db.setNoteOpenState(id, true);
      this.createNoteWindow(note);
      this.broadcast('notes:changed');
    }
  }

  /**
   * Creates and configures an individual Sticky Note BrowserWindow
   */
  private createNoteWindow(note: Note): BrowserWindow {
    const themeDef = NOTE_COLORS[note.color] || NOTE_COLORS.yellow;

    const win = new BrowserWindow({
      width: note.width || 320,
      height: note.height || 340,
      minWidth: 240,
      minHeight: 200,
      x: note.pos_x !== null ? note.pos_x : undefined,
      y: note.pos_y !== null ? note.pos_y : undefined,
      frame: false, // Frameless for exact Windows Sticky Notes styling
      hasShadow: true,
      backgroundColor: themeDef.light.body,
      alwaysOnTop: note.is_pinned === 1,
      skipTaskbar: false,
      autoHideMenuBar: true,
      webPreferences: {
        preload: this.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        additionalArguments: [`--note-id=${note.id}`, '--window-type=note'],
      },
    });

    this.noteWindows.set(note.id, win);

    // Save window geometry on move/resize (debounced)
    let resizeTimeout: NodeJS.Timeout | null = null;
    const saveBounds = () => {
      if (win.isDestroyed()) return;
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (win.isDestroyed()) return;
        const bounds = win.getBounds();
        this.db.updateNoteBounds(note.id, bounds);
      }, 300);
    };

    win.on('move', saveBounds);
    win.on('resize', saveBounds);

    // When the window is closed via UI, mark is_open = 0 in DB
    win.on('close', () => {
      this.noteWindows.delete(note.id);
      this.db.setNoteOpenState(note.id, false);
      this.broadcast('notes:changed');
    });

    // Intercept navigation & open external links in default browser safely
    win.webContents.on('will-navigate', (e) => e.preventDefault());
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('https://') || url.startsWith('http://') || url.startsWith('mailto:')) {
        shell.openExternal(url);
      }
      return { action: 'deny' };
    });

    // Load content
    if (this.isDev && process.env.VITE_DEV_SERVER_URL) {
      win.loadURL(`${this.devServerUrl}?noteId=${note.id}&type=note`);
    } else {
      win.loadFile(path.join(__dirname, '../../dist/index.html'), {
        query: { noteId: note.id, type: 'note' },
      });
    }

    return win;
  }

  /**
   * Closes a note window without deleting the note from DB
   */
  public closeNoteWindow(id: string): void {
    const win = this.noteWindows.get(id);
    if (win && !win.isDestroyed()) {
      win.close();
    }
  }

  /**
   * Deletes a note and destroys its window
   */
  public deleteNote(id: string): void {
    this.db.deleteNote(id);
    const win = this.noteWindows.get(id);
    if (win && !win.isDestroyed()) {
      win.destroy();
    }
    this.noteWindows.delete(id);
    this.broadcast('notes:deleted', id);
    this.broadcast('notes:changed');
  }

  /**
   * Toggles Always On Top / Pinned state
   */
  public toggleNotePin(id: string): boolean {
    const isPinned = this.db.toggleNotePin(id);
    const win = this.noteWindows.get(id);
    if (win && !win.isDestroyed()) {
      win.setAlwaysOnTop(isPinned);
    }
    this.broadcast('notes:changed');
    return isPinned;
  }

  /**
   * Shows or creates the central Notes Manager window
   */
  public showManagerWindow(): void {
    if (this.managerWindow && !this.managerWindow.isDestroyed()) {
      if (this.managerWindow.isMinimized()) this.managerWindow.restore();
      this.managerWindow.show();
      this.managerWindow.focus();
      return;
    }

    this.managerWindow = new BrowserWindow({
      width: 400,
      height: 640,
      minWidth: 340,
      minHeight: 450,
      frame: false,
      title: 'Sticky Notes',
      backgroundColor: '#202020',
      webPreferences: {
        preload: this.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        additionalArguments: ['--window-type=manager'],
      },
    });

    this.managerWindow.on('closed', () => {
      this.managerWindow = null;
    });

    this.managerWindow.webContents.on('will-navigate', (e) => e.preventDefault());
    this.managerWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('https://') || url.startsWith('http://')) {
        shell.openExternal(url);
      }
      return { action: 'deny' };
    });

    if (this.isDev && process.env.VITE_DEV_SERVER_URL) {
      this.managerWindow.loadURL(`${this.devServerUrl}?type=manager`);
    } else {
      this.managerWindow.loadFile(path.join(__dirname, '../../dist/index.html'), {
        query: { type: 'manager' },
      });
    }
  }

  public toggleManagerWindow(): void {
    if (this.managerWindow && !this.managerWindow.isDestroyed() && this.managerWindow.isVisible()) {
      this.managerWindow.hide();
    } else {
      this.showManagerWindow();
    }
  }

  public showAllOpenNotes(): void {
    for (const win of this.noteWindows.values()) {
      if (!win.isDestroyed()) {
        if (win.isMinimized()) win.restore();
        win.show();
      }
    }
  }

  public hideAllOpenNotes(): void {
    for (const win of this.noteWindows.values()) {
      if (!win.isDestroyed()) {
        win.hide();
      }
    }
  }

  /**
   * Broadcast an event to all open renderer windows
   */
  public broadcast(channel: string, ...args: any[]): void {
    if (this.managerWindow && !this.managerWindow.isDestroyed()) {
      this.managerWindow.webContents.send(channel, ...args);
    }
    for (const win of this.noteWindows.values()) {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, ...args);
      }
    }
  }
}
