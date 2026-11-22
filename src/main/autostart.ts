import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function getAutostartCommand(): string[] {
  if (process.env.APPIMAGE) return [process.env.APPIMAGE];

  if (process.env.FLATPAK_ID || process.execPath.startsWith('/app/')) {
    return ['flatpak', 'run', process.env.FLATPAK_ID || 'com.netsysprep.stickynotes'];
  }

  const snapName = process.env.SNAP_INSTANCE_NAME || process.env.SNAP_NAME;
  if (snapName) return ['snap', 'run', snapName];

  if (process.defaultApp && process.argv[1]) {
    return [process.execPath, path.resolve(process.argv[1])];
  }
  return [process.execPath];
}

function escapeExecArgument(argument: string): string {
  // Desktop Entry string escaping is processed before Exec argument quoting.
  const quoted = argument.replace(/["`$\\]/g, '\\$&').replace(/%/g, '%%');
  const escaped = quoted.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
  return /^[\w./-]+$/.test(escaped) ? escaped : `"${escaped}"`;
}

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT';
}

export class AutostartManager {
  private readonly autostartDir: string;
  private readonly desktopFilePath: string;

  constructor() {
    const configHome = process.env.XDG_CONFIG_HOME;
    const configDir = configHome && path.isAbsolute(configHome)
      ? configHome
      : path.join(os.homedir(), '.config');

    this.autostartDir = path.join(configDir, 'autostart');
    this.desktopFilePath = path.join(this.autostartDir, 'sticky-notes.desktop');
  }

  public isEnabled(): boolean {
    try {
      if (!fs.lstatSync(this.desktopFilePath).isFile()) return false;
      const entry = fs.readFileSync(this.desktopFilePath, 'utf8');
      const section = entry.split(/^\[/m).find((section) => section.startsWith('Desktop Entry]'));
      return Boolean(section && /^Exec=\S/m.test(section)
        && !/^Hidden\s*=\s*true\s*$/m.test(section)
        && !/^X-GNOME-Autostart-enabled\s*=\s*false\s*$/m.test(section));
    } catch (error) {
      if (isMissing(error)) return false;
      throw error;
    }
  }

  public setEnabled(enabled: boolean): void {
    if (!enabled) {
      try {
        fs.unlinkSync(this.desktopFilePath);
      } catch (error) {
        if (!isMissing(error)) throw error;
      }
      return;
    }

    const command = getAutostartCommand();
    if (!command[0] || command[0].includes('=') || command.some((argument) => argument.includes('\0'))) {
      throw new Error('The launch command cannot be written to a desktop entry.');
    }
    // GLib checks the executable path before expanding escaped percent characters.
    const argv = command[0].includes('%') ? ['/usr/bin/env', '--', ...command] : command;
    const exec = [...argv, '--autostart'].map(escapeExecArgument).join(' ');
    const desktopEntry = `[Desktop Entry]
Type=Application
Exec=${exec}
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
Name=Sticky Notes
Comment=Windows-style Sticky Notes for Linux
Icon=com.netsysprep.stickynotes
Categories=Utility;TextEditor;
StartupNotify=false
Terminal=false
`;

    fs.mkdirSync(this.autostartDir, { recursive: true, mode: 0o700 });
    const temporaryDir = fs.mkdtempSync(path.join(this.autostartDir, '.sticky-notes-'));
    const temporaryFile = path.join(temporaryDir, 'entry');
    try {
      fs.writeFileSync(temporaryFile, desktopEntry, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
      fs.renameSync(temporaryFile, this.desktopFilePath);
    } finally {
      fs.rmSync(temporaryDir, { recursive: true, force: true });
    }
  }
}
