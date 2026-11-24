import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

export function backUpBeforeMigration(
  dbPath: string,
  schemaVersion: number,
  version: number
): string {
  const directory = path.dirname(dbPath);
  const temp = fs.mkdtempSync(path.join(directory, '.sticky-notes-backup-'));
  try {
    const snapshot = path.join(temp, 'snapshot.db');
    fs.closeSync(fs.openSync(snapshot, 'wx', 0o600));
    // The primary connection holds the write lock. A second connection can copy the committed WAL snapshot.
    const source = new Database(dbPath, { readonly: true });
    try {
      source.prepare('VACUUM INTO ?').run(snapshot);
    } finally {
      source.close();
    }
    const copy = new Database(snapshot, { readonly: true });
    try {
      if (
        copy.pragma('user_version', { simple: true }) !== version ||
        copy.pragma('integrity_check(1)', { simple: true }) !== 'ok'
      ) {
        throw new Error('The notes migration backup failed its integrity check');
      }
    } finally {
      copy.close();
    }
    const snapshotFd = fs.openSync(snapshot, 'r');
    try {
      fs.fsyncSync(snapshotFd);
    } finally {
      fs.closeSync(snapshotFd);
    }
    const backup = `${dbPath}.pre-v${schemaVersion}-${crypto.randomUUID()}.bak`;
    fs.linkSync(snapshot, backup);
    const directoryFd = fs.openSync(directory, 'r');
    try {
      fs.fsyncSync(directoryFd);
    } finally {
      fs.closeSync(directoryFd);
    }
    return backup;
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
