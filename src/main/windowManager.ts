import { BrowserWindow, shell, screen, app, nativeImage, NativeImage } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { DatabaseService } from './database';
import { Note, NOTE_COLORS } from '../shared/types';

export class WindowManager {
  private noteWindows: Map<string, BrowserWindow> = new Map();
  private managerWindow: BrowserWindow | null = null;
  private db: DatabaseService;
  private preloadPath: string;
  private iconPath: string;
  private iconImage: NativeImage | undefined;
  private distPath: string;
  private isDev: boolean;
  private devServerUrl: string;
  private isQuitting: boolean = false;

  constructor(db: DatabaseService) {
    this.db = db;
    this.isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
    this.devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    this.preloadPath = path.join(__dirname, '../preload/preload.js');
    // In dev: build/icon.png relative to dist-electron/main. In packaged app: process.resourcesPath/build/icon.png
    this.iconPath = app.isPackaged
      ? path.join(process.resourcesPath, 'build', 'icon.png')
      : path.join(__dirname, '../../build/icon.png');
    if (fs.existsSync(this.iconPath)) {
      this.iconImage = nativeImage.createFromPath(this.iconPath);
    }
    // In both dev and packaged (inside app.asar), dist/index.html is at ../../dist/index.html relative to dist-electron/main
    this.distPath = path.join(__dirname, '../../dist');
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
        const existing = this.noteWindows.get(note.id);
        if (existing && !existing.isDestroyed()) {
          if (existing.isMinimized()) existing.restore();
          existing.show();
          existing.focus();
        } else {
          this.createNoteWindow(note);
        }
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
      existing.moveTop();
      return;
    }

    const note = this.db.getNoteById(id);
    if (note) {
      this.db.setNoteOpenState(id, true);
      const win = this.createNoteWindow(note);
      win.show();
      win.focus();
      win.moveTop();
      this.broadcast('notes:changed');
    }
  }

  /**
   * Creates and configures an individual Sticky Note BrowserWindow
   */
  private createNoteWindow(note: Note): BrowserWindow {
    const themeDef = NOTE_COLORS[note.color] || NOTE_COLORS.yellow;

    let x = note.pos_x !== null ? note.pos_x : undefined;
    let y = note.pos_y !== null ? note.pos_y : undefined;

    // Multi-monitor safety: ensure saved position is visible on an active display
    if (x !== undefined && y !== undefined) {
      try {
        const displays = screen.getAllDisplays();
        const isVisible = displays.some((d) => {
          const b = d.bounds;
          return x! + 50 > b.x && x! < b.x + b.width && y! + 50 > b.y && y! < b.y + b.height;
        });

        if (!isVisible) {
          const primary = screen.getPrimaryDisplay().workArea;
          x = primary.x + 40;
          y = primary.y + 40;
        }
      } catch {
        // Ignore and fallback
      }
    }

    const win = new BrowserWindow({
      width: note.width || 320,
      height: note.height || 340,
      minWidth: 240,
      minHeight: 200,
      x,
      y,
      frame: false, // Frameless for exact Windows Sticky Notes styling
      maximizable: false,
      icon: this.iconImage || this.iconPath,
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
        spellcheck: false,
        additionalArguments: [`--note-id=${note.id}`, '--window-type=note'],
      },
    });

    if (this.iconImage) {
      try { win.setIcon(this.iconImage); } catch { /* ignore */ }
    }

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

    // When the window is closed via UI, flush final bounds and mark is_open = 0 in DB (unless app is quitting or this is the last note window)
    win.on('close', () => {
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
        resizeTimeout = null;
      }
      try {
        if (!win.isDestroyed()) {
          this.db.updateNoteBounds(note.id, win.getBounds());
        }
      } catch {
        // Ignore
      }

      // If this is the last open note window and manager is closed, the user is closing the app.
      // Preserve is_open = 1 so the active note restores on next application launch.
      const isLastWindow = this.noteWindows.size <= 1 && (!this.managerWindow || this.managerWindow.isDestroyed());

      this.noteWindows.delete(note.id);

      if (!this.isQuitting) {
        if (!isLastWindow) {
          this.db.setNoteOpenState(note.id, false);
        }
        this.broadcast('notes:changed');
      }
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
      win.loadFile(path.join(this.distPath, 'index.html'), {
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
      maximizable: false,
      title: 'Sticky Notes',
      icon: this.iconImage || this.iconPath,
      backgroundColor: '#202020',
      webPreferences: {
        preload: this.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        spellcheck: false,
        additionalArguments: ['--window-type=manager'],
      },
    });

    if (this.iconImage) {
      try { this.managerWindow.setIcon(this.iconImage); } catch { /* ignore */ }
    }

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
      this.managerWindow.loadFile(path.join(this.distPath, 'index.html'), {
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
   * Sets whether the entire application is in the process of shutting down
   */
  public setQuitting(quitting: boolean): void {
    this.isQuitting = quitting;
  }

  /**
   * Synchronously persists bounds for all currently open note windows
   */
  public flushAllOpenNoteBounds(): void {
    for (const [id, win] of this.noteWindows.entries()) {
      if (!win.isDestroyed()) {
        try {
          this.db.updateNoteBounds(id, win.getBounds());
        } catch {
          // Ignore
        }
      }
    }
  }

  private broadcastTimers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Broadcast an event to all open renderer windows (throttled for rapid change events)
   */
  public broadcast(channel: string, ...args: any[]): void {
    if (channel === 'notes:changed') {
      const existing = this.broadcastTimers.get(channel);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(() => {
        this.broadcastTimers.delete(channel);
        this.emitBroadcast(channel, ...args);
      }, 50);
      this.broadcastTimers.set(channel, timer);
      return;
    }

    this.emitBroadcast(channel, ...args);
  }

  private emitBroadcast(channel: string, ...args: any[]): void {
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
