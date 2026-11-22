import { Tray, Menu, nativeImage, app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { WindowManager } from './windowManager';

export class TrayService {
  private tray: Tray | null = null;
  private windowManager: WindowManager;

  constructor(windowManager: WindowManager) {
    this.windowManager = windowManager;
  }

  public init(): void {
    const iconPath = this.resolveTrayIconPath();
    if (iconPath) {
      this.tray = new Tray(iconPath);
    } else {
      const fallbackImage = this.createFallbackIcon();
      this.tray = new Tray(fallbackImage);
    }

    this.tray.setToolTip('Sticky Notes');

    this.tray.on('click', () => {
      this.windowManager.toggleManagerWindow();
    });

    this.updateContextMenu();
  }

  public updateContextMenu(): void {
    if (!this.tray) return;

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'New Note',
        click: () => {
          if (!this.windowManager.isClosing()) this.windowManager.createNewNoteWindow();
        },
      },
      {
        label: 'Notes List',
        click: () => {
          this.windowManager.showManagerWindow();
        },
      },
      { type: 'separator' },
      {
        label: 'Show All Notes',
        click: () => {
          this.windowManager.showAllOpenNotes();
        },
      },
      {
        label: 'Hide All Notes',
        click: () => {
          this.windowManager.hideAllOpenNotes();
        },
      },
      { type: 'separator' },
      {
        label: 'Quit Sticky Notes',
        click: () => {
          app.quit();
        },
      },
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  private resolveTrayIconPath(): string {
    // 1. Check system installed icon paths
    const systemPaths = [
      '/usr/share/icons/hicolor/24x24/apps/com.netsysprep.stickynotes.png',
      '/usr/share/icons/hicolor/32x32/apps/com.netsysprep.stickynotes.png',
      '/usr/share/icons/hicolor/48x48/apps/com.netsysprep.stickynotes.png',
      '/usr/share/icons/hicolor/24x24/apps/sticky-notes-linux.png',
    ];
    for (const p of systemPaths) {
      if (fs.existsSync(p)) return p;
    }

    // 2. In packaged app (process.resourcesPath)
    if (app.isPackaged) {
      const packagedPaths = [
        path.join(process.resourcesPath, 'build', 'icons', '24x24.png'),
        path.join(process.resourcesPath, 'build', 'tray-icon.png'),
        path.join(process.resourcesPath, 'build', 'icons', '32x32.png'),
        path.join(process.resourcesPath, 'build', 'icon.png'),
      ];
      for (const p of packagedPaths) {
        if (fs.existsSync(p)) return p;
      }
    }

    // 3. In dev mode
    const devPaths = [
      path.join(__dirname, '../../build/icons/24x24.png'),
      path.join(__dirname, '../../build/tray-icon.png'),
      path.join(__dirname, '../../build/icon.png'),
    ];
    for (const p of devPaths) {
      if (fs.existsSync(p)) return p;
    }

    return '';
  }

  private createFallbackIcon(): Electron.NativeImage {
    // Electron's nativeImage decodes PNG/JPEG (not SVG). Provide a valid 16x16 yellow sticky-note PNG fallback.
    const fallbackPngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAIklEQVR42mP8z8DwnwEIwDiqYVQDDQYwkKqBwQDGUSMGAD03B/1f8m+qAAAAAElFTkSuQmCC';
    return nativeImage.createFromDataURL(`data:image/png;base64,${fallbackPngBase64}`);
  }

  public destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}
