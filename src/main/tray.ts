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
          this.windowManager.createNewNoteWindow();
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
    // Fallback vector icon if no png file exists on disk
    const svgString = `
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">
        <rect x="2" y="2" width="18" height="18" rx="3" fill="#FFD600" />
        <path d="M14 20 L20 14 L14 14 Z" fill="#E6B800" opacity="0.9" />
        <line x1="5" y1="6" x2="17" y2="6" stroke="#5D4037" stroke-width="1.5" stroke-linecap="round" />
        <line x1="5" y1="10" x2="14" y2="10" stroke="#5D4037" stroke-width="1.5" stroke-linecap="round" />
        <line x1="5" y1="14" x2="11" y2="14" stroke="#5D4037" stroke-width="1.5" stroke-linecap="round" />
      </svg>
    `;
    const base64 = Buffer.from(svgString).toString('base64');
    return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${base64}`).resize({ width: 22, height: 22 });
  }

  public destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}
