import { app, dialog, safeStorage, session, shell } from 'electron';
import { DatabaseService } from './database';
import { WindowManager } from './windowManager';
import { TrayService } from './tray';
import { AutostartManager } from './autostart';
import { registerIpcHandlers } from './ipcHandlers';
import { parseSafeExternalUrl } from './htmlSanitizer';
import { AesGcmNoteCipher, createElectronKeyringAdapter } from './crypto';
import { DESKTOP_FILE_NAME, WINDOW_WM_CLASS } from './linuxPlatform';
import { logger } from './logger';

// NOTE: Do NOT call app.commandLine.appendSwitch('ozone-platform', ...) here.
// In Electron 38+, the Browser process initializes Ozone before main.js executes;
// mutating ozone-platform from JS creates a Browser/GPU backend mismatch.
// X11/XWayland and --class flags are supplied via .desktop executableArgs & autostart.ts.
if (process.platform === 'linux' && typeof app.setDesktopName === 'function') {
  app.setDesktopName(DESKTOP_FILE_NAME);
}
app.commandLine.appendSwitch('log-level', '3'); // Suppress benign Chromium internal VSync notices

app.setName('Sticky Notes');
if (process.platform === 'win32' || process.platform === 'linux') {
  app.setAppUserModelId(WINDOW_WM_CLASS);
}

// Global fatal error & unhandled rejection logging
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception in main process', error);
});
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection in main process', reason);
});

// Global webContents security hardening across every window/frame
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (e) => e.preventDefault());
  contents.on('will-redirect', (e) => e.preventDefault());
  contents.on('will-attach-webview', (e) => e.preventDefault());
  contents.setWindowOpenHandler(({ url }) => {
    const safeUrl = parseSafeExternalUrl(url);
    if (safeUrl) {
      void shell.openExternal(safeUrl).catch((error) => {
        logger.error('Failed to open external URL', error);
      });
    }
    return { action: 'deny' };
  });
});

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

  app
    .whenReady()
    .then(() => {
      // 0. Deny all browser permission requests globally (offline sticky notes app needs none)
      session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => {
        callback(false);
      });
      session.defaultSession.setPermissionCheckHandler(() => false);

      // 1. Initialize core services
      db = new DatabaseService();
      const keyring = createElectronKeyringAdapter(safeStorage);
      if (db.isEncryptionEnabled()) {
        const wrapped = db.getWrappedEncryptionKey();
        if (!wrapped || !keyring.isAvailable()) {
          throw new Error(
            'Notes encryption is enabled, but the OS keyring is unavailable. Unlock your desktop keyring (e.g., KWallet or GNOME Keyring) and relaunch.'
          );
        }
        const keyHex = keyring.unseal(wrapped);
        db.unlockWithCipher(new AesGcmNoteCipher(Buffer.from(keyHex, 'hex')));
      }
      autostartManager = new AutostartManager();
      windowManager = new WindowManager(db);
      trayService = new TrayService(windowManager);

      // 2. Register typed IPC handlers
      registerIpcHandlers(db, windowManager, autostartManager, keyring);

      // 3. Initialize system tray
      trayService.init();

      // 4. Check autostart status
      try {
        const config = db.getAllSettings();
        if (config.autostart) {
          autostartManager.setEnabled(true);
        }
      } catch (error) {
        logger.error('Failed to apply the autostart setting', error);
      }

      // 5. Restore previously open notes
      const isAutostart = process.argv.includes('--autostart');
      if (isAutostart) {
        // On autostart, restore open notes quietly (stay in tray if none were open)
        const openNotes = db.getOpenNotes();
        for (const note of openNotes) {
          windowManager.openNote(note.id);
        }
      } else {
        windowManager.restoreOpenNotes();
      }
    })
    .catch((error) => {
      logger.error('Could not start Sticky Notes', error);
      dialog.showErrorBox(
        'Sticky Notes could not start',
        'Check that your notes database and its directory are accessible. Keep the database and any companion files together if you need to recover them.'
      );
      app.quit();
    });

  // Stay resident in the system tray when all windows are closed (Decision D1).
  app.on('window-all-closed', () => {
    // Intentionally keep running in the system tray; quit via Tray -> Quit, Ctrl+Q, or OS signals.
  });

  let shutdownPending = false;
  let editorsSaved = false;

  process.on('SIGTERM', () => app.quit());
  process.on('SIGINT', () => app.quit());
  process.on('SIGHUP', () => app.quit());

  app.on('before-quit', (event) => {
    if (!windowManager || editorsSaved) return;
    event.preventDefault();
    if (shutdownPending) return;
    shutdownPending = true;
    void windowManager
      .flushAllEditors()
      .then(() => {
        windowManager.flushAllOpenNoteBounds();
        windowManager.setQuitting(true);
        editorsSaved = true;
        app.quit();
      })
      .catch((error) => {
        shutdownPending = false;
        windowManager.resumeEditors();
        logger.error('Could not save all notes before quitting', error);
        dialog.showErrorBox(
          'Sticky Notes could not quit',
          'Check your open notes for save errors, then try quitting again.'
        );
      });
  });

  app.on('will-quit', () => {
    windowManager?.dispose();
    trayService?.destroy();
    db?.close();
  });
}
