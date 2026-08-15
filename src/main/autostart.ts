import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

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

        const execPath = process.env.APPIMAGE || process.execPath || 'sticky-notes';
        const desktopEntry = `[Desktop Entry]
Type=Application
Exec="${execPath}" --autostart
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
Name=Sticky Notes
Comment=Windows-style Sticky Notes for Linux
Icon=sticky-notes
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
