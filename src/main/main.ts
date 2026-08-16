import { app } from 'electron';
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
    } catch {
      // Ignore
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
  });

  // When all windows are closed, exit cleanly so note state and bounds are preserved for next launch
  app.on('window-all-closed', () => {
    app.quit();
  });

  const handleGracefulShutdown = () => {
    try {
      if (windowManager) {
        windowManager.setQuitting(true);
        windowManager.flushAllOpenNoteBounds();
      }
      if (trayService) trayService.destroy();
      if (db) db.close();
    } catch {
      // Ignore
    }
    app.exit(0);
  };

  process.on('SIGTERM', handleGracefulShutdown);
  process.on('SIGINT', handleGracefulShutdown);

  app.on('before-quit', () => {
    if (windowManager) {
      windowManager.setQuitting(true);
      windowManager.flushAllOpenNoteBounds();
    }
    if (trayService) trayService.destroy();
    if (db) db.close();
  });
}
