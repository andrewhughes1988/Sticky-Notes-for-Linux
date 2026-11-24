import {
  BrowserWindow,
  Menu,
  MenuItemConstructorOptions,
  shell,
  screen,
  app,
  nativeImage,
  nativeTheme,
  NativeImage,
  WebContents,
  IpcMainEvent,
  IpcMainInvokeEvent,
  dialog,
} from 'electron';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { DatabaseService, WindowBounds } from './database';
import { parseSafeExternalUrl } from './htmlSanitizer';
import { isRunningOnNativeWayland, preserveWaylandPosition } from './linuxPlatform';
import { logger } from './logger';
import { Note, NOTE_COLORS, ExportResult } from '../shared/types';

function isPositionVisible(x: number, y: number): boolean {
  try {
    const displays = screen.getAllDisplays();
    return displays.some((d) => {
      const b = d.bounds;
      return x + 50 > b.x && x < b.x + b.width && y + 50 > b.y && y < b.y + b.height;
    });
  } catch {
    return true;
  }
}

export function attachContextMenu(win: BrowserWindow): void {
  win.webContents.on('context-menu', (_event, params) => {
    const template: MenuItemConstructorOptions[] = [];

    if (params.linkURL) {
      const safeUrl = parseSafeExternalUrl(params.linkURL);
      if (safeUrl) {
        template.push(
          {
            label: 'Open Link in Browser',
            click: () => {
              void shell.openExternal(safeUrl).catch((err) => {
                logger.error('Failed to open external link from context menu', err);
              });
            },
          },
          { type: 'separator' }
        );
      }
    }

    if (params.isEditable) {
      template.push(
        { label: 'Cut', role: 'cut', enabled: params.editFlags.canCut },
        { label: 'Copy', role: 'copy', enabled: params.editFlags.canCopy },
        { label: 'Paste', role: 'paste', enabled: params.editFlags.canPaste },
        {
          label: 'Paste as Plain Text',
          role: 'pasteAndMatchStyle',
          enabled: params.editFlags.canPaste,
        },
        { type: 'separator' },
        { label: 'Select All', role: 'selectAll', enabled: params.editFlags.canSelectAll }
      );
    } else if (params.selectionText) {
      template.push({ label: 'Copy', role: 'copy' });
    }

    if (template.length > 0) {
      const menu = Menu.buildFromTemplate(template);
      menu.popup({ window: win });
    }
  });
}

export class WindowManager {
  private noteWindows: Map<string, BrowserWindow> = new Map();
  private managerWindow: BrowserWindow | null = null;
  private db: DatabaseService;
  private preloadPath: string;
  private iconPath: string;
  private iconImage: NativeImage | undefined;
  private distPath: string;
  private rendererUrl: URL;
  private readyEditors = new Set<WebContents>();
  private stalledEditors = new WeakMap<WebContents, () => void>();
  private approvedCloses = new Set<string>();
  private closingNotes = new Map<string, Promise<void>>();
  private flushRequests = new Map<
    WebContents,
    { id: number; finish: (saved: boolean) => void; promise: Promise<void> }
  >();
  private flushId = 0;
  private flushingAll = false;
  private isQuitting = false;
  private isNativeWayland = false;
  private restoreTimers = new Set<NodeJS.Timeout>();
  private broadcastTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(db: DatabaseService) {
    this.db = db;
    this.isNativeWayland =
      process.platform === 'linux' && isRunningOnNativeWayland(process.env, process.argv);
    this.preloadPath = path.join(__dirname, '../preload/preload.js');
    this.iconPath = app.isPackaged
      ? path.join(process.resourcesPath, 'build', 'icon.png')
      : path.join(__dirname, '../../build/icon.png');
    if (fs.existsSync(this.iconPath)) {
      this.iconImage = nativeImage.createFromPath(this.iconPath);
    }
    this.distPath = path.join(__dirname, '../../dist');
    const devUrl = !app.isPackaged && process.env.VITE_DEV_SERVER_URL;
    this.rendererUrl = devUrl
      ? new URL(devUrl)
      : pathToFileURL(path.join(this.distPath, 'index.html'));
    if (
      devUrl &&
      (!['http:', 'https:'].includes(this.rendererUrl.protocol) ||
        !['localhost', '127.0.0.1', '[::1]'].includes(this.rendererUrl.hostname))
    ) {
      throw new Error('The development renderer must run on loopback.');
    }
  }

  /**
   * Restores all notes that were previously open in the database.
   * Staggers window creation when restoring more than 4 notes to avoid compositor spikes.
   */
  public restoreOpenNotes(): void {
    if (this.flushingAll) return;
    const openNotes = this.db.getOpenNotes();
    if (openNotes.length === 0) {
      const mostRecent = this.db.getMostRecentlyActiveNote();
      if (mostRecent) {
        this.openNote(mostRecent.id);
      } else {
        this.createNewNoteWindow({
          title: 'Welcome to Sticky Notes',
          content_html:
            '<p>Welcome to <strong>Sticky Notes</strong> for Linux!</p><ul><li><p>Type your thoughts freely</p></li><li><p>Change colors via the <strong>...</strong> menu</p></li><li><p>Format text with <strong>B</strong>, <em>I</em>, <u>U</u>, <s>S</s></p></li><li><p>Search all notes in the Notes Manager</p></li></ul>',
          content_plain:
            'Welcome to Sticky Notes for Linux!\n- Type your thoughts freely\n- Change colors via the ... menu\n- Format text with B, I, U, S\n- Search all notes in the Notes Manager',
          color: 'yellow',
        });
      }
      return;
    }

    openNotes.forEach((note, index) => {
      const openOne = () => {
        if (this.isQuitting || this.flushingAll) return;
        const existing = this.noteWindows.get(note.id);
        if (existing && !existing.isDestroyed()) {
          if (existing.isMinimized()) existing.restore();
          existing.show();
          existing.focus();
        } else {
          this.createNoteWindow(note);
        }
      };

      if (index < 4) {
        openOne();
      } else {
        const timer = setTimeout(() => {
          this.restoreTimers.delete(timer);
          openOne();
        }, (index - 3) * 35);
        this.restoreTimers.add(timer);
      }
    });
  }

  /**
   * Creates a new note in the DB and opens its window
   */
  public createNewNoteWindow(initial: Partial<Note> = {}): Note {
    if (this.flushingAll) throw new Error('Sticky Notes is closing.');
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
    if (this.flushingAll) throw new Error('Sticky Notes is closing.');
    const existing = this.noteWindows.get(id);
    if (existing && !existing.isDestroyed()) {
      if (existing.isMinimized()) existing.restore();
      existing.show();
      existing.focus();
      existing.moveTop();
      this.db.recordNoteActivity(id);
      this.stalledEditors.get(existing.webContents)?.();
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
    } else {
      throw new Error('Note no longer exists.');
    }
  }

  /**
   * Creates and configures an individual Sticky Note BrowserWindow
   */
  private createNoteWindow(note: Note): BrowserWindow {
    const themeDef = NOTE_COLORS[note.color] || NOTE_COLORS.yellow;

    let x = note.pos_x !== null ? note.pos_x : undefined;
    let y = note.pos_y !== null ? note.pos_y : undefined;

    if (x !== undefined && y !== undefined && !isPositionVisible(x, y)) {
      const primary = screen.getPrimaryDisplay().workArea;
      x = primary.x + 40;
      y = primary.y + 40;
    }

    const win = new BrowserWindow({
      width: note.width || 320,
      height: note.height || 340,
      minWidth: 240,
      minHeight: 200,
      x,
      y,
      frame: false,
      maximizable: false,
      icon: this.iconImage || this.iconPath,
      hasShadow: true,
      backgroundColor: themeDef.body,
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
      try {
        win.setIcon(this.iconImage);
      } catch {
        // Ignore
      }
    }

    // Re-assert always-on-top after window realization so KWin/XWayland reliably applies _NET_WM_STATE_ABOVE
    if (note.is_pinned === 1) {
      win.once('ready-to-show', () => {
        if (!win.isDestroyed()) win.setAlwaysOnTop(true);
      });
    }

    this.noteWindows.set(note.id, win);
    attachContextMenu(win);

    const persistNoteBounds = () => {
      if (win.isDestroyed()) return;
      const bounds = win.getBounds();
      // Native Wayland cannot read global (x, y) coordinates and reports (0, 0).
      // Preserve previously stored coordinates instead of overwriting them with (0, 0).
      if (this.isNativeWayland && bounds.x === 0 && bounds.y === 0) {
        const existing = this.db.getNoteById(note.id);
        if (existing && existing.pos_x !== null && existing.pos_y !== null) {
          bounds.x = existing.pos_x;
          bounds.y = existing.pos_y;
        }
      }
      this.db.updateNoteBounds(note.id, bounds);
    };

    // Save window geometry on move/resize (debounced)
    let resizeTimeout: NodeJS.Timeout | null = null;
    const saveBounds = () => {
      if (win.isDestroyed()) return;
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        try {
          persistNoteBounds();
        } catch (error) {
          logger.error('Failed to save note window bounds', error);
        }
      }, 300);
    };

    win.on('move', saveBounds);
    win.on('resize', saveBounds);

    const contents = win.webContents;
    win.on('close', (event) => {
      if (!this.isQuitting && !this.approvedCloses.has(note.id)) {
        event.preventDefault();
        if (!this.flushingAll) {
          void this.closeNoteWindow(note.id).catch(() => {
            if (!win.isDestroyed() && !this.stalledEditors.has(contents)) {
              dialog.showErrorBox(
                'Note could not close',
                'Check the note for a save error and try again.'
              );
            }
          });
        }
        return;
      }
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
        resizeTimeout = null;
      }
      try {
        persistNoteBounds();
      } catch {
        // Ignore
      }

      this.noteWindows.delete(note.id);

      // When closing an individual note window (not quitting the app), mark it closed in DB.
      // Because the app stays resident in the system tray, quitting preserves is_open = 1 for all open notes.
      if (!this.isQuitting) {
        try {
          this.db.setNoteOpenState(note.id, false);
        } catch (error) {
          logger.error('Failed to save note window state', error);
        }
        this.broadcast('notes:changed');
      }
    });

    contents.on('did-start-navigation', ({ isMainFrame, isSameDocument }) => {
      if (isMainFrame && !isSameDocument) this.detachEditor(contents);
    });
    contents.on('destroyed', () => this.detachEditor(contents));
    win.once('closed', () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
    });
    this.watchNoteRenderer(win, note.id);
    void win.loadURL(this.rendererUrl.href).catch((error) => {
      logger.error('Failed to load note window', error);
    });

    return win;
  }

  private detachEditor(contents: WebContents): void {
    this.readyEditors.delete(contents);
    this.flushRequests.get(contents)?.finish(false);
  }

  private watchNoteRenderer(win: BrowserWindow, noteId: string): void {
    const contents = win.webContents;
    let activePrompt: AbortController | undefined;
    let rendererExited = false;

    const dismissPrompt = () => {
      activePrompt?.abort();
      activePrompt = undefined;
    };

    const offerRecovery = async (exited: boolean) => {
      if (
        this.isQuitting ||
        win.isDestroyed() ||
        this.noteWindows.get(noteId) !== win ||
        activePrompt
      ) {
        return;
      }
      const prompt = new AbortController();
      activePrompt = prompt;
      try {
        const { response } = await dialog.showMessageBox(win, {
          type: 'warning',
          title: 'Sticky Notes',
          message: exited ? 'This note stopped unexpectedly.' : 'This note is not responding.',
          detail: 'Reopening restores the last saved version. Unsaved changes may be lost.',
          buttons: ['Reopen last saved note', exited ? 'Close note' : 'Keep waiting'],
          defaultId: exited ? 0 : 1,
          cancelId: 1,
          signal: prompt.signal,
        });
        if (
          prompt.signal.aborted ||
          this.isQuitting ||
          win.isDestroyed() ||
          this.noteWindows.get(noteId) !== win
        ) {
          return;
        }
        if (response === 0) {
          const saved = this.db.getNoteById(noteId);
          if (!saved) throw new Error('The saved note no longer exists.');
          const { x, y, width, height } = win.getBounds();
          this.createNoteWindow({ ...saved, pos_x: x, pos_y: y, width, height });
          win.destroy();
        } else if (exited) {
          await this.closeNoteWindow(noteId);
        }
      } catch (error) {
        if (!prompt.signal.aborted) {
          logger.error('Could not recover note window', error);
          dialog.showErrorBox(
            'Note recovery failed',
            'Check Notes Manager for the last saved version.'
          );
        }
      } finally {
        if (activePrompt === prompt) activePrompt = undefined;
      }
    };

    const recover = () => {
      void offerRecovery(rendererExited);
    };
    contents.on('unresponsive', () => {
      if (!rendererExited) {
        this.stalledEditors.set(contents, recover);
        recover();
      }
    });
    contents.on('responsive', () => {
      if (!rendererExited) {
        this.stalledEditors.delete(contents);
        dismissPrompt();
      }
    });
    contents.on('render-process-gone', () => {
      rendererExited = true;
      this.detachEditor(contents);
      dismissPrompt();
      this.stalledEditors.set(contents, recover);
      recover();
    });
    win.once('closed', dismissPrompt);
  }

  /**
   * Closes a note window without deleting the note from DB
   */
  public closeNoteWindow(id: string): Promise<void> {
    const pending = this.closingNotes.get(id);
    if (pending) return pending;
    const win = this.noteWindows.get(id);
    if (!win || win.isDestroyed() || this.flushingAll) return Promise.resolve();
    const contents = win.webContents;
    const closing = this.flushEditor(contents)
      .then(() => {
        if (!win.isDestroyed() && !this.flushingAll) {
          this.approvedCloses.add(id);
          try {
            win.close();
          } finally {
            this.approvedCloses.delete(id);
          }
        }
      })
      .catch((error) => {
        if (this.readyEditors.has(contents) && !contents.isDestroyed() && !this.flushingAll) {
          contents.send('editor:resume');
        }
        throw error;
      })
      .finally(() => this.closingNotes.delete(id));
    this.closingNotes.set(id, closing);
    return closing;
  }

  public rendererRole(event: IpcMainEvent | IpcMainInvokeEvent): { noteId: string | null } {
    const frame = event.senderFrame;
    if (frame && frame === event.sender.mainFrame && frame.url) {
      let url: URL;
      try {
        url = new URL(frame.url);
      } catch {
        throw new Error('Unrecognized renderer.');
      }
      if (
        url.protocol === this.rendererUrl.protocol &&
        url.host === this.rendererUrl.host &&
        url.pathname === this.rendererUrl.pathname &&
        url.username === '' &&
        url.password === ''
      ) {
        if (this.managerWindow?.webContents === event.sender) return { noteId: null };
        for (const [noteId, win] of this.noteWindows) {
          if (win.webContents === event.sender) return { noteId };
        }
      }
    }
    throw new Error('Unrecognized renderer.');
  }

  public markEditorReady(contents: WebContents): void {
    this.readyEditors.add(contents);
  }

  public markEditorUnready(contents: WebContents): void {
    this.detachEditor(contents);
  }

  public acknowledgeEditorFlush(contents: WebContents, id: number, saved: boolean): void {
    const request = this.flushRequests.get(contents);
    if (request?.id === id) request.finish(saved);
  }

  private flushEditor(contents: WebContents): Promise<void> {
    if (!this.readyEditors.has(contents)) return Promise.resolve();
    const existing = this.flushRequests.get(contents);
    if (existing) return existing.promise;

    const id = ++this.flushId;
    let finish!: (saved: boolean) => void;
    const promise = new Promise<void>((resolve, reject) => {
      finish = (saved) => {
        clearTimeout(timeout);
        this.flushRequests.delete(contents);
        if (saved) resolve();
        else reject(new Error('The note did not acknowledge its save.'));
      };
      const timeout = setTimeout(() => {
        finish(false);
        this.stalledEditors.get(contents)?.();
      }, 5000);
    });
    this.flushRequests.set(contents, { id, finish, promise });
    try {
      contents.send('editor:flush', id);
    } catch {
      finish(false);
    }
    return promise;
  }

  public async flushAllEditors(): Promise<void> {
    this.flushingAll = true;
    const results = await Promise.allSettled(
      [...this.noteWindows.values()].map((win) => this.flushEditor(win.webContents))
    );
    if (results.some((result) => result.status === 'rejected')) {
      throw new Error('One or more notes could not be saved.');
    }
  }

  public resumeEditors(): void {
    this.flushingAll = false;
    for (const contents of this.readyEditors) {
      if (!contents.isDestroyed()) contents.send('editor:resume');
    }
  }

  /**
   * Soft-deletes a note to Trash and destroys its window (tray remains active).
   */
  public deleteNote(id: string): void {
    if (this.flushingAll) throw new Error('Sticky Notes is closing.');
    this.db.deleteNote(id);
    const win = this.noteWindows.get(id);
    if (win && !win.isDestroyed()) {
      win.destroy();
    }
    this.noteWindows.delete(id);
    this.broadcast('notes:changed');
  }

  public restoreNote(id: string): void {
    if (this.flushingAll) throw new Error('Sticky Notes is closing.');
    if (!this.db.restoreNote(id)) {
      throw new Error('Deleted note no longer exists.');
    }
    this.broadcast('notes:changed');
  }

  public permanentlyDeleteNote(id: string): void {
    if (this.flushingAll) throw new Error('Sticky Notes is closing.');
    this.db.permanentlyDeleteNote(id);
    const win = this.noteWindows.get(id);
    if (win && !win.isDestroyed()) {
      win.destroy();
    }
    this.noteWindows.delete(id);
    this.broadcast('notes:changed');
  }

  public emptyTrash(): void {
    if (this.flushingAll) throw new Error('Sticky Notes is closing.');
    this.db.emptyTrash();
    this.broadcast('notes:changed');
  }

  /**
   * Export all active notes as JSON or Markdown via native save dialog.
   */
  public async exportNotes(format: 'json' | 'markdown'): Promise<ExportResult> {
    const notes = this.db.getAllNotes();
    const dateStamp = new Date().toISOString().slice(0, 10);
    const ext = format === 'json' ? 'json' : 'md';
    const filters =
      format === 'json'
        ? [{ name: 'JSON Backup', extensions: ['json'] }]
        : [{ name: 'Markdown Document', extensions: ['md'] }];

    const parent = this.managerWindow && !this.managerWindow.isDestroyed() ? this.managerWindow : undefined;
    const dialogOptions = {
      title: 'Export Sticky Notes',
      defaultPath: path.join(app.getPath('documents'), `sticky-notes-${dateStamp}.${ext}`),
      filters,
    };
    const { canceled, filePath } = parent
      ? await dialog.showSaveDialog(parent, dialogOptions)
      : await dialog.showSaveDialog(dialogOptions);

    if (canceled || !filePath) {
      return { exported: false, count: 0 };
    }

    let payload: string;
    if (format === 'json') {
      payload = JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          version: app.getVersion(),
          notes: notes.map((n) => ({
            id: n.id,
            title: n.title,
            color: n.color,
            is_pinned: Boolean(n.is_pinned),
            created_at: n.created_at,
            updated_at: n.updated_at,
            content_plain: n.content_plain,
            content_html: n.content_html,
          })),
        },
        null,
        2
      );
    } else {
      payload = notes
        .map((n) => {
          const heading = n.title || 'Untitled Note';
          const updated = new Date(n.updated_at).toISOString();
          return `# ${heading}\n\n_Color: ${n.color} | Updated: ${updated}_\n\n${n.content_plain}\n`;
        })
        .join('\n---\n\n');
    }

    fs.writeFileSync(filePath, payload, { encoding: 'utf8', mode: 0o600 });
    return { exported: true, count: notes.length, filePath };
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

  private resolveManagerBackgroundColor(): string {
    try {
      const theme = this.db.getAllSettings().theme;
      const isDark =
        theme === 'dark' || (theme === 'system' && nativeTheme.shouldUseDarkColors);
      return isDark ? '#202020' : '#F3F3F3';
    } catch {
      return nativeTheme.shouldUseDarkColors ? '#202020' : '#F3F3F3';
    }
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

    const savedBounds: WindowBounds | null = this.db.getManagerBounds();
    let x = savedBounds?.x;
    let y = savedBounds?.y;
    if (x !== undefined && y !== undefined && !isPositionVisible(x, y)) {
      x = undefined;
      y = undefined;
    }

    const managerWin = new BrowserWindow({
      width: savedBounds?.width ?? 400,
      height: savedBounds?.height ?? 640,
      minWidth: 340,
      minHeight: 450,
      x,
      y,
      frame: false,
      maximizable: false,
      title: 'Sticky Notes',
      icon: this.iconImage || this.iconPath,
      backgroundColor: this.resolveManagerBackgroundColor(),
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
    this.managerWindow = managerWin;

    if (this.iconImage) {
      try {
        managerWin.setIcon(this.iconImage);
      } catch {
        // Ignore
      }
    }

    attachContextMenu(managerWin);

    let managerBoundsTimer: NodeJS.Timeout | null = null;
    const persistManagerBounds = () => {
      if (managerWin.isDestroyed()) return;
      if (managerBoundsTimer) clearTimeout(managerBoundsTimer);
      managerBoundsTimer = setTimeout(() => {
        if (managerWin.isDestroyed()) return;
        try {
          this.saveManagerBounds(managerWin);
        } catch (error) {
          logger.error('Failed to save manager window bounds', error);
        }
      }, 300);
    };

    managerWin.on('move', persistManagerBounds);
    managerWin.on('resize', persistManagerBounds);
    managerWin.on('close', () => {
      if (managerBoundsTimer) {
        clearTimeout(managerBoundsTimer);
        managerBoundsTimer = null;
      }
      if (!managerWin.isDestroyed()) {
        try {
          this.saveManagerBounds(managerWin);
        } catch {
          // Ignore
        }
      }
    });
    managerWin.on('closed', () => {
      if (managerBoundsTimer) clearTimeout(managerBoundsTimer);
      this.managerWindow = null;
    });

    void managerWin.loadURL(this.rendererUrl.href).catch((error) => {
      logger.error('Failed to load notes list', error);
    });
  }

  public closeManagerWindow(): void {
    if (this.managerWindow && !this.managerWindow.isDestroyed()) {
      this.managerWindow.close();
      this.managerWindow = null;
    }
  }

  public toggleManagerWindow(): void {
    if (this.managerWindow && !this.managerWindow.isDestroyed() && this.managerWindow.isVisible()) {
      this.closeManagerWindow();
    } else {
      this.showManagerWindow();
    }
  }

  public showAllOpenNotes(): void {
    if (this.noteWindows.size === 0) {
      this.restoreOpenNotes();
      return;
    }
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

  public isClosing(): boolean {
    return this.flushingAll;
  }

  public setQuitting(quitting: boolean): void {
    this.isQuitting = quitting;
  }

  private saveManagerBounds(win: BrowserWindow): void {
    const bounds = win.getBounds();
    const saved =
      this.isNativeWayland && bounds.x === 0 && bounds.y === 0 ? this.db.getManagerBounds() : null;
    this.db.setManagerBounds(preserveWaylandPosition(bounds, saved, this.isNativeWayland));
  }

  public flushAllOpenNoteBounds(): void {
    for (const [id, win] of this.noteWindows.entries()) {
      if (!win.isDestroyed()) {
        try {
          const bounds = win.getBounds();
          if (this.isNativeWayland && bounds.x === 0 && bounds.y === 0) {
            const existing = this.db.getNoteById(id);
            if (existing && existing.pos_x !== null && existing.pos_y !== null) {
              bounds.x = existing.pos_x;
              bounds.y = existing.pos_y;
            }
          }
          this.db.updateNoteBounds(id, bounds);
        } catch {
          // Ignore
        }
      }
    }
    if (this.managerWindow && !this.managerWindow.isDestroyed()) {
      try {
        this.saveManagerBounds(this.managerWindow);
      } catch {
        // Ignore
      }
    }
  }

  public dispose(): void {
    for (const timer of this.broadcastTimers.values()) {
      clearTimeout(timer);
    }
    this.broadcastTimers.clear();
    for (const timer of this.restoreTimers) {
      clearTimeout(timer);
    }
    this.restoreTimers.clear();
  }

  /**
   * Broadcast an event to renderer windows (throttled for rapid notes:changed events).
   */
  public broadcast(channel: string, ...args: unknown[]): void {
    if (channel === 'notes:changed') {
      const existing = this.broadcastTimers.get(channel);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(() => {
        this.broadcastTimers.delete(channel);
        this.emitBroadcast(channel, false, ...args);
      }, 50);
      this.broadcastTimers.set(channel, timer);
      return;
    }

    this.emitBroadcast(channel, true, ...args);
  }

  private emitBroadcast(channel: string, includeNoteWindows: boolean, ...args: unknown[]): void {
    if (this.managerWindow && !this.managerWindow.isDestroyed()) {
      this.managerWindow.webContents.send(channel, ...args);
    }
    if (includeNoteWindows) {
      for (const win of this.noteWindows.values()) {
        if (!win.isDestroyed()) {
          win.webContents.send(channel, ...args);
        }
      }
    }
  }
}
