import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

type PackageFormat = 'appimage' | 'flatpak' | 'snap' | 'system' | 'unknown';

/**
 * Detect the current packaging format based on environment variables
 */
function detectPackageFormat(): PackageFormat {
  // AppImage sets this when running the mounted image
  if (process.env.APPIMAGE) {
    return 'appimage';
  }
  // Flatpak sets FLATPAK_ID and typically runs from /app/
  if (process.env.FLATPAK_ID || process.execPath.startsWith('/app/')) {
    return 'flatpak';
  }
  // Snap sets SNAP_NAME and SNAP_INSTANCE_NAME
  if (process.env.SNAP_NAME || process.env.SNAP_INSTANCE_NAME) {
    return 'snap';
  }
  // Check if running from a system install (e.g., /usr/bin/)
  if (process.execPath.startsWith('/usr/') || process.execPath.startsWith('/opt/')) {
    return 'system';
  }
  return 'unknown';
}

/**
 * Get the appropriate executable path for autostart based on packaging format
 */
function getAutostartExecPath(): string {
  const format = detectPackageFormat();

  switch (format) {
    case 'appimage':
      // APPIMAGE env var contains the path to the mounted AppImage
      return process.env.APPIMAGE || process.execPath;
    case 'flatpak':
      // Flatpak apps are typically launched via flatpak run
      return `flatpak run ${process.env.FLATPAK_ID || 'com.netsysprep.stickynotes'}`;
    case 'snap':
      // Snap apps are launched via snap run
      const snapName = process.env.SNAP_NAME || 'sticky-notes';
      return `snap run ${snapName}`;
    case 'system':
      // System install - use the actual executable path
      return process.execPath;
    case 'unknown':
    default:
      // Fallback: try APPIMAGE first, then execPath
      return process.env.APPIMAGE || process.execPath || 'sticky-notes';
  }
}

export class AutostartManager {
  private autostartDir: string;
  private desktopFilePath: string;

  constructor() {
    const configDir = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
    this.autostartDir = path.join(configDir, 'autostart');
    this.desktopFilePath = path.join(this.autostartDir, 'sticky-notes.desktop');
  }

  public isEnabled(): boolean {
    return fs.existsSync(this.desktopFilePath);
  }

  public setEnabled(enabled: boolean): void {
    try {
      if (enabled) {
        if (!fs.existsSync(this.autostartDir)) {
          fs.mkdirSync(this.autostartDir, { recursive: true, mode: 0o700 });
        }

        const execPath = getAutostartExecPath();
        const desktopEntry = `[Desktop Entry]
Type=Application
Exec="${execPath}" --autostart
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
Name=Sticky Notes
Comment=Windows-style Sticky Notes for Linux
Icon=sticky-notes-linux
Categories=Utility;TextEditor;
StartupNotify=false
Terminal=false
`;

        fs.writeFileSync(this.desktopFilePath, desktopEntry, { encoding: 'utf8', mode: 0o644 });
      } else {
        if (fs.existsSync(this.desktopFilePath)) {
          fs.unlinkSync(this.desktopFilePath);
        }
      }
    } catch (err) {
      console.error('Failed to update autostart desktop entry:', err);
    }
  }
}
