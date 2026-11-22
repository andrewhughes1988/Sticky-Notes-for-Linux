import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const MAX_LOG_BYTES = 1_048_576; // 1 MiB
const MAX_ROTATED_FILES = 3;

function resolveLogFilePath(): string {
  const stateHome = process.env.XDG_STATE_HOME;
  const baseDir =
    stateHome && path.isAbsolute(stateHome)
      ? stateHome
      : path.join(os.homedir(), '.local', 'state');
  return path.join(baseDir, 'sticky-notes', 'logs', 'app.log');
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack || `${error.name}: ${error.message}`;
  }
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

class FileLogger {
  private readonly logPath: string;
  private readonly logDir: string;

  constructor(customLogPath?: string) {
    this.logPath = customLogPath ?? resolveLogFilePath();
    this.logDir = path.dirname(this.logPath);
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true, mode: 0o700 });
    }
  }

  private rotateIfNeeded(): void {
    try {
      const stats = fs.statSync(this.logPath);
      if (stats.size < MAX_LOG_BYTES) return;
      for (let i = MAX_ROTATED_FILES; i >= 1; i--) {
        const src = i === 1 ? this.logPath : `${this.logPath}.${i - 1}`;
        const dst = `${this.logPath}.${i}`;
        if (fs.existsSync(src)) {
          fs.renameSync(src, dst);
        }
      }
    } catch {
      // File may not exist yet; ignore
    }
  }

  private write(level: 'INFO' | 'WARN' | 'ERROR', message: string, detail?: unknown): void {
    const timestamp = new Date().toISOString();
    const suffix = detail !== undefined ? ` | ${formatError(detail)}` : '';
    const line = `[${timestamp}] [${level}] ${message}${suffix}\n`;

    if (level === 'ERROR') {
      console.error(message, detail ?? '');
    } else if (level === 'WARN') {
      console.warn(message, detail ?? '');
    }

    try {
      this.ensureDir();
      this.rotateIfNeeded();
      const fd = fs.openSync(this.logPath, 'a', 0o600);
      try {
        fs.writeSync(fd, line, undefined, 'utf8');
      } finally {
        fs.closeSync(fd);
      }
    } catch {
      // Never throw from logging
    }
  }

  public info(message: string): void {
    this.write('INFO', message);
  }

  public warn(message: string, detail?: unknown): void {
    this.write('WARN', message, detail);
  }

  public error(message: string, detail?: unknown): void {
    this.write('ERROR', message, detail);
  }
}

export const logger = new FileLogger();
