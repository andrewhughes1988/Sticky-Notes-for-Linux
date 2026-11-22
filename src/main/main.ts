import { app, dialog } from 'electron';
import { DatabaseService } from './database';
import { WindowManager } from './windowManager';
import { TrayService } from './tray';
import { AutostartManager } from './autostart';
import { registerIpcHandlers } from './ipcHandlers';

// Configure Ozone / Wayland hardware acceleration flags for Linux
app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
app.commandLine.appendSwitch('enable-features', 'WaylandWindowDecorations');
app.commandLine.appendSwitch('log-level', '3'); // Suppress benign Chromium internal VSync notices

app.setName('Sticky Notes');
if (process.platform === 'win32' || process.platform === 'linux') {
  app.setAppUserModelId('com.netsysprep.stickynotes');
}

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  let db: DatabaseService;
  let windowManager: WindowManager;
  let trayService: TrayService;
  let autostartManager: AutostartManager;

  app.on('second-instance', () => {
    if (windowManager) {
      windowManager.restoreOpenNotes();
    }
  });

  app.whenReady().then(() => {
    // 1. Initialize core services
    db = new DatabaseService();
    autostartManager = new AutostartManager();
    windowManager = new WindowManager(db);
    trayService = new TrayService(windowManager);

    // 2. Register typed IPC handlers
    registerIpcHandlers(db, windowManager, autostartManager);

    // 3. Initialize system tray
    trayService.init();

    // 4. Check autostart status
    try {
      const config = db.getAllSettings();
      if (config.autostart) {
        autostartManager.setEnabled(true);
      }
    } catch (error) {
      console.error('Failed to apply the autostart setting:', error);
    }

    // 5. Restore previously open notes
    const isAutostart = process.argv.includes('--autostart');
    if (isAutostart) {
      // On autostart, restore open notes quietly
      const openNotes = db.getOpenNotes();
      for (const note of openNotes) {
        windowManager.openNote(note.id);
      }
    } else {
      windowManager.restoreOpenNotes();
    }
  }).catch((error) => {
    console.error('Could not start Sticky Notes:', error);
    dialog.showErrorBox('Sticky Notes could not start',
      'Check that your notes database and its directory are accessible. Keep the database and any companion files together if you need to recover them.');
    app.quit();
  });

  // When all windows are closed, exit cleanly so note state and bounds are preserved for next launch
  app.on('window-all-closed', () => {
    app.quit();
  });

  let shutdownPending = false;
  let editorsSaved = false;

  process.on('SIGTERM', () => app.quit());
  process.on('SIGINT', () => app.quit());

  app.on('before-quit', (event) => {
    if (!windowManager || editorsSaved) return;
    event.preventDefault();
    if (shutdownPending) return;
    shutdownPending = true;
    void windowManager.flushAllEditors().then(() => {
      windowManager.flushAllOpenNoteBounds();
      windowManager.setQuitting(true);
      editorsSaved = true;
      app.quit();
    }).catch((error) => {
      shutdownPending = false;
      windowManager.resumeEditors();
      console.error('Could not save all notes before quitting', error);
      dialog.showErrorBox('Sticky Notes could not quit', 'Check your open notes for save errors, then try quitting again.');
    });
  });

  app.on('will-quit', () => {
    trayService?.destroy();
    db?.close();
  });
}
