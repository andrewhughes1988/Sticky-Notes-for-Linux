import { Tray, Menu, nativeImage, app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { WindowManager } from './windowManager';

export class TrayService {
  private tray: Tray | null = null;
  private windowManager: WindowManager;
  private cachedIcon: Electron.NativeImage | null = null;

  constructor(windowManager: WindowManager) {
    this.windowManager = windowManager;
  }

  public init(): void {
    const icon = this.createTrayIcon();
    this.tray = new Tray(icon);
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

  private createTrayIcon(): Electron.NativeImage {
    if (this.cachedIcon) {
      return this.cachedIcon;
    }

    const trayIconPath = path.join(__dirname, '../../build/tray-icon.png');
    if (fs.existsSync(trayIconPath)) {
      const img = nativeImage.createFromPath(trayIconPath);
      this.cachedIcon = img.resize({ width: 22, height: 22 });
      return this.cachedIcon;
    }

    // Fallback vector icon
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
    const image = nativeImage.createFromDataURL(`data:image/svg+xml;base64,${base64}`);
    this.cachedIcon = image.resize({ width: 20, height: 20 });
    return this.cachedIcon;
  }

  public destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}
