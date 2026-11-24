import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import {
  Note,
  NoteColor,
  NotePreview,
  DeletedNotePreview,
  AppConfig,
  AppTheme,
  NOTE_COLORS,
} from '../shared/types';
import { NoteCipher } from './crypto';

interface ListOptions {
  search?: string;
  includeClosed?: boolean;
  limit?: number;
  offset?: number;
}

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const SCHEMA_VERSION = 3;
const PREVIEW_COLUMNS = 'notes.id, notes.color, notes.updated_at, notes.is_open, notes.is_pinned';
const DEFAULT_SETTINGS: AppConfig = {
  theme: 'system',
  autostart: true,
};
const VALID_THEMES = new Set<AppTheme>(['system', 'light', 'dark']);
const ASCII_ONLY = /^[\x20-\x7E]+$/;

function createSearchQuery(search?: string) {
  const terms = [...new Set(search?.match(/[\p{L}\p{M}\p{N}]+/gu))];
  const indexedTerms: string[] = [];
  const shortTerms: string[] = [];
  for (const term of terms) {
    ([...term].length >= 3 ? indexedTerms : shortTerms).push(term);
  }
  return {
    indexedTerms,
    shortTerms,
    indexedQuery: indexedTerms.map((term) => `"${term}"`).join(' AND '),
    punctuationOnly: Boolean(search?.trim()) && !terms.length,
  };
}

function originalOffset(text: string, foldedOffset: number): number {
  let offset = 0;
  for (const character of text) {
    const foldedLength = character.toLowerCase().length;
    if (foldedOffset < foldedLength) break;
    foldedOffset -= foldedLength;
    offset += character.length;
  }
  return offset;
}

function excerptAroundMatch(text: string, foldedTerms: string[]): string | undefined {
  const folded = text.toLowerCase();
  let matchIndex = -1;
  let matchLength = 0;
  for (const term of foldedTerms) {
    const index = folded.indexOf(term);
    if (
      index >= 0 &&
      (term.length > matchLength || (term.length === matchLength && index < matchIndex))
    ) {
      matchIndex = index;
      matchLength = term.length;
    }
  }
  if (matchIndex === -1) return;

  // Lowercasing can expand a character, for example dotted capital I.
  const matchStart = folded.length === text.length ? matchIndex : originalOffset(text, matchIndex);
  const foldedEnd = matchIndex + matchLength - 1;
  const matchEnd =
    folded.length === text.length ? foldedEnd + 1 : originalOffset(text, foldedEnd) + 1;
  let start = Math.max(0, matchStart - 32);
  let end = Math.min(text.length, Math.max(matchEnd + 48, start + 100));
  // Keep surrogate pairs intact at the cut boundaries.
  if (/[\uDC00-\uDFFF]/.test(text.charAt(start))) start--;
  if (/[\uDC00-\uDFFF]/.test(text.charAt(end))) end++;
  const excerpt = text.slice(start, end).replace(/\s+/g, ' ').trim();
  return `${start > 0 ? '…' : ''}${excerpt}${end < text.length ? '…' : ''}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class DatabaseService {
  private db!: Database.Database;
  private dbPath: string;
  private updateStmtCache = new Map<string, Database.Statement>();
  private cipher: NoteCipher | null = null;

  constructor(customPath?: string) {
    if (customPath) {
      this.dbPath = customPath;
    } else {
      const dataDir = process.env.XDG_DATA_HOME
        ? path.join(process.env.XDG_DATA_HOME, 'sticky-notes')
        : path.join(os.homedir(), '.local', 'share', 'sticky-notes');

      // Ensure directory exists with POSIX 0700 (drwx------)
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
      } else {
        try {
          fs.chmodSync(dataDir, 0o700);
        } catch {
          // Ignore on unsupported platforms
        }
      }

      this.dbPath = path.join(dataDir, 'stickynotes.db');
    }

    // Pre-create database file with POSIX 0600 before opening SQLite to avoid a 0644 TOCTOU window.
    if (this.dbPath !== ':memory:') {
      try {
        fs.closeSync(fs.openSync(this.dbPath, 'a', 0o600));
        fs.chmodSync(this.dbPath, 0o600);
      } catch {
        // Unsupported filesystem or read-only error will surface on Database open
      }
    }

    this.db = new Database(this.dbPath);
    let migrationBackup: string | undefined;
    try {
      this.db.pragma('busy_timeout = 5000');
      if (this.db.pragma('quick_check(1)', { simple: true }) !== 'ok') {
        throw new Error('SQLite integrity check failed');
      }
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = FULL');
      this.db.pragma('secure_delete = ON');
      this.db.pragma('foreign_keys = ON');
      this.db.function('contains_folded', { deterministic: true }, (value: string, term: string) =>
        value.toLowerCase().includes(term.toLowerCase()) ? 1 : 0
      );
      this.db
        .transaction(() => {
          const version = this.db.pragma('user_version', { simple: true }) as number;
          if (version < 0 || version > SCHEMA_VERSION) {
            throw new Error('Unsupported notes database schema version');
          }
          if (
            version < SCHEMA_VERSION &&
            this.dbPath !== ':memory:' &&
            this.db
              .prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'notes'")
              .get()
          ) {
            migrationBackup = this.backUpBeforeMigration(version);
          }
          this.initSchema(version);
          this.initStatements();
        })
        .immediate();
    } catch (error) {
      this.db.close();
      if (migrationBackup) {
        try {
          fs.unlinkSync(migrationBackup);
        } catch (cleanupError) {
          console.error(
            'Could not remove a redundant backup after a failed migration:',
            cleanupError
          );
        }
      }
      throw error;
    }
  }

  // Pre-compiled prepared statements for high-throughput operations
  private stmtInsertNote!: Database.Statement;
  private stmtGetNoteById!: Database.Statement;
  private stmtGetOpenNotes!: Database.Statement;
  private stmtGetMostRecentlyActiveNote!: Database.Statement;
  private stmtRecordNoteActivity!: Database.Statement;
  private stmtGetIndexedExcerpt!: Database.Statement;
  private stmtUpdateNoteBounds!: Database.Statement;
  private stmtSetNoteOpenState!: Database.Statement;
  private stmtToggleNotePin!: Database.Statement;
  private stmtSoftDeleteNote!: Database.Statement;
  private stmtRestoreNote!: Database.Statement;
  private stmtGetDeletedNotes!: Database.Statement;
  private stmtHardDeleteNote!: Database.Statement;
  private stmtEmptyTrash!: Database.Statement;
  private stmtGetSetting!: Database.Statement;
  private stmtGetAllSettings!: Database.Statement;
  private stmtSetSetting!: Database.Statement;

  private initStatements(): void {
    this.stmtInsertNote = this.db.prepare(`
      INSERT INTO notes (
        id, title, content_html, content_plain, color, is_open, is_pinned,
        pos_x, pos_y, width, height, z_order, created_at, updated_at,
        deleted_at, remote_id, sync_status, change_key, last_synced_at, last_active_at
      ) VALUES (
        @id, @title, @content_html, @content_plain, @color, @is_open, @is_pinned,
        @pos_x, @pos_y, @width, @height, @z_order, @created_at, @updated_at,
        @deleted_at, @remote_id, @sync_status, @change_key, @last_synced_at, @updated_at
      )
    `);

    this.stmtGetNoteById = this.db.prepare(
      'SELECT * FROM notes WHERE id = ? AND deleted_at IS NULL'
    );
    this.stmtGetOpenNotes = this.db.prepare(`
      SELECT * FROM notes WHERE is_open = 1 AND deleted_at IS NULL ORDER BY last_active_at ASC, id DESC
    `);
    this.stmtGetMostRecentlyActiveNote = this.db.prepare(`
      SELECT id FROM notes WHERE deleted_at IS NULL ORDER BY last_active_at DESC, id ASC LIMIT 1
    `);
    this.stmtRecordNoteActivity = this.db.prepare(
      'UPDATE notes SET last_active_at = ? WHERE id = ? AND deleted_at IS NULL'
    );
    this.stmtGetIndexedExcerpt = this.db.prepare(`
      SELECT snippet(notes_fts, -1, '', '', '…', 48) AS preview
      FROM notes_fts WHERE rowid = (SELECT rowid FROM notes WHERE id = ?) AND notes_fts MATCH ?
    `);
    this.stmtUpdateNoteBounds = this.db.prepare(`
      UPDATE notes SET
        pos_x = @x, pos_y = @y, width = @width, height = @height
      WHERE id = @id AND deleted_at IS NULL
        AND (pos_x IS NOT @x OR pos_y IS NOT @y OR width IS NOT @width OR height IS NOT @height)
    `);
    this.stmtSetNoteOpenState = this.db.prepare(`
      UPDATE notes SET is_open = @open, last_active_at = @now
      WHERE id = @id AND deleted_at IS NULL AND is_open IS NOT @open
    `);
    this.stmtToggleNotePin = this.db.prepare(`
      UPDATE notes SET is_pinned = CASE WHEN is_pinned = 0 THEN 1 ELSE 0 END
      WHERE id = ? AND deleted_at IS NULL RETURNING is_pinned
    `);
    this.stmtSoftDeleteNote = this.db.prepare(`
      UPDATE notes SET deleted_at = @now, is_open = 0
      WHERE id = @id AND deleted_at IS NULL
    `);
    this.stmtRestoreNote = this.db.prepare(`
      UPDATE notes SET deleted_at = NULL, last_active_at = @now
      WHERE id = @id AND deleted_at IS NOT NULL
    `);
    this.stmtGetDeletedNotes = this.db.prepare(`
      SELECT id, color, updated_at, deleted_at,
        substr(coalesce(nullif(content_plain, ''), title), 1, 300) AS preview
      FROM notes WHERE deleted_at IS NOT NULL
      ORDER BY deleted_at DESC, id ASC
    `);
    this.stmtHardDeleteNote = this.db.prepare('DELETE FROM notes WHERE id = ?');
    this.stmtEmptyTrash = this.db.prepare('DELETE FROM notes WHERE deleted_at IS NOT NULL');
    this.stmtGetSetting = this.db.prepare('SELECT value FROM settings WHERE key = ?');
    this.stmtGetAllSettings = this.db.prepare('SELECT key, value FROM settings');
    this.stmtSetSetting = this.db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);
  }

  private backUpBeforeMigration(version: number): string {
    const directory = path.dirname(this.dbPath);
    const temp = fs.mkdtempSync(path.join(directory, '.sticky-notes-backup-'));
    try {
      const snapshot = path.join(temp, 'snapshot.db');
      fs.closeSync(fs.openSync(snapshot, 'wx', 0o600));
      // The primary connection holds the write lock. A second connection can copy the committed WAL snapshot.
      const source = new Database(this.dbPath, { readonly: true });
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
      const backup = `${this.dbPath}.pre-v${SCHEMA_VERSION}-${crypto.randomUUID()}.bak`;
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

  private initSchema(version: number): void {
    const schema = `
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT '',
        content_html TEXT NOT NULL DEFAULT '',
        content_plain TEXT NOT NULL DEFAULT '',
        color TEXT NOT NULL DEFAULT 'yellow',
        is_open INTEGER NOT NULL DEFAULT 1,
        is_pinned INTEGER NOT NULL DEFAULT 0,
        pos_x INTEGER,
        pos_y INTEGER,
        width INTEGER NOT NULL DEFAULT 320,
        height INTEGER NOT NULL DEFAULT 340,
        z_order INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER DEFAULT NULL,
        remote_id TEXT DEFAULT NULL,
        sync_status TEXT NOT NULL DEFAULT 'synced',
        change_key TEXT DEFAULT NULL,
        last_synced_at INTEGER DEFAULT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_notes_is_open ON notes(is_open) WHERE deleted_at IS NULL;

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `;

    this.db.exec(schema);
    if (version === 0) {
      // Remove legacy triggers before purging tombstones: deleted rows were absent from the old FTS index.
      this.db.exec(`
        DROP TRIGGER IF EXISTS notes_ai;
        DROP TRIGGER IF EXISTS notes_ad;
        DROP TRIGGER IF EXISTS notes_au;
        DROP TRIGGER IF EXISTS notes_au_del;
        DROP TRIGGER IF EXISTS notes_au_restore;
        DROP TABLE IF EXISTS notes_fts;
        DELETE FROM notes WHERE deleted_at IS NOT NULL;
        DROP INDEX IF EXISTS idx_notes_updated;
        CREATE INDEX idx_notes_page ON notes(updated_at DESC, id ASC);
        CREATE VIRTUAL TABLE notes_fts USING fts5(title, content_plain, content='notes', tokenize='trigram');
        INSERT INTO notes_fts(notes_fts, rank) VALUES('secure-delete', 1);
        INSERT INTO notes_fts(notes_fts) VALUES('rebuild');
      `);
    }
    if (version < 2) {
      this.db.exec(`
        ALTER TABLE notes ADD COLUMN last_active_at INTEGER NOT NULL DEFAULT 0;
        UPDATE notes SET last_active_at = updated_at;
      `);
    }
    if (version < 3) {
      // v3: Soft-delete aware FTS5 triggers + Trash index
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_notes_deleted_at ON notes(deleted_at DESC) WHERE deleted_at IS NOT NULL;
        PRAGMA user_version = ${SCHEMA_VERSION};
      `);
      this.createFtsTriggers();
    }

    const insertSetting = this.db.prepare(
      'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
    );

    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      insertSetting.run(key, JSON.stringify(value));
    }
  }

  private createFtsTriggers(): void {
    this.db.exec(`
      DROP TRIGGER IF EXISTS notes_ai;
      DROP TRIGGER IF EXISTS notes_ad;
      DROP TRIGGER IF EXISTS notes_au;
      DROP TRIGGER IF EXISTS notes_au_del;
      DROP TRIGGER IF EXISTS notes_au_restore;
      CREATE TRIGGER notes_ai AFTER INSERT ON notes WHEN new.deleted_at IS NULL BEGIN
        INSERT INTO notes_fts(rowid, title, content_plain) VALUES(new.rowid, new.title, new.content_plain);
      END;
      CREATE TRIGGER notes_ad AFTER DELETE ON notes WHEN old.deleted_at IS NULL BEGIN
        INSERT INTO notes_fts(notes_fts, rowid, title, content_plain)
          VALUES('delete', old.rowid, old.title, old.content_plain);
      END;
      CREATE TRIGGER notes_au_del AFTER UPDATE OF deleted_at ON notes
      WHEN old.deleted_at IS NULL AND new.deleted_at IS NOT NULL BEGIN
        INSERT INTO notes_fts(notes_fts, rowid, title, content_plain)
          VALUES('delete', old.rowid, old.title, old.content_plain);
      END;
      CREATE TRIGGER notes_au_restore AFTER UPDATE OF deleted_at ON notes
      WHEN old.deleted_at IS NOT NULL AND new.deleted_at IS NULL BEGIN
        INSERT INTO notes_fts(rowid, title, content_plain) VALUES(new.rowid, new.title, new.content_plain);
      END;
      CREATE TRIGGER notes_au AFTER UPDATE OF title, content_plain ON notes
      WHEN old.deleted_at IS NULL AND new.deleted_at IS NULL
        AND (new.title IS NOT old.title OR new.content_plain IS NOT old.content_plain) BEGIN
        INSERT INTO notes_fts(notes_fts, rowid, title, content_plain)
          VALUES('delete', old.rowid, old.title, old.content_plain);
        INSERT INTO notes_fts(rowid, title, content_plain) VALUES(new.rowid, new.title, new.content_plain);
      END;
    `);
  }

  private dropFtsTriggers(): void {
    this.db.exec(`
      DROP TRIGGER IF EXISTS notes_ai;
      DROP TRIGGER IF EXISTS notes_ad;
      DROP TRIGGER IF EXISTS notes_au;
      DROP TRIGGER IF EXISTS notes_au_del;
      DROP TRIGGER IF EXISTS notes_au_restore;
    `);
  }

  // --- Encryption-at-Rest ---

  public isEncryptionEnabled(): boolean {
    const row = this.stmtGetSetting.get('encryption_enabled') as { value: string } | undefined;
    if (!row) return false;
    try {
      return JSON.parse(row.value) === true;
    } catch {
      return false;
    }
  }

  public getWrappedEncryptionKey(): string | null {
    const row = this.stmtGetSetting.get('encryption_key_wrapped') as { value: string } | undefined;
    if (!row) return null;
    try {
      const parsed: unknown = JSON.parse(row.value);
      return typeof parsed === 'string' && parsed.length > 0 ? parsed : null;
    } catch {
      return null;
    }
  }

  public unlockWithCipher(cipher: NoteCipher): void {
    const canaryRow = this.stmtGetSetting.get('encryption_canary') as { value: string } | undefined;
    if (!canaryRow) {
      throw new Error('Encrypted notes database is missing its verification canary.');
    }
    const canaryCiphertext = JSON.parse(canaryRow.value) as string;
    const decrypted = cipher.decrypt(canaryCiphertext, 'sticky-notes:canary');
    if (decrypted !== 'sticky-notes-ok') {
      throw new Error('Invalid encryption key.');
    }
    this.cipher = cipher;
  }

  public enableEncryption(cipher: NoteCipher, wrappedKey: string): void {
    if (this.isEncryptionEnabled() && !this.cipher) {
      throw new Error('Notes database is already encrypted and locked.');
    }
    this.db
      .transaction(() => {
        const rows = this.db
          .prepare('SELECT id, title, content_html, content_plain FROM notes')
          .all() as Pick<Note, 'id' | 'title' | 'content_html' | 'content_plain'>[];

        this.dropFtsTriggers();
        this.db.exec("INSERT INTO notes_fts(notes_fts) VALUES('delete-all');");

        const updateRow = this.db.prepare(
          'UPDATE notes SET title = ?, content_html = ?, content_plain = ? WHERE id = ?'
        );
        for (const row of rows) {
          const plainTitle = this.cipher
            ? this.cipher.decrypt(row.title, `${row.id}:title`)
            : row.title;
          const plainHtml = this.cipher
            ? this.cipher.decrypt(row.content_html, `${row.id}:content_html`)
            : row.content_html;
          const plainText = this.cipher
            ? this.cipher.decrypt(row.content_plain, `${row.id}:content_plain`)
            : row.content_plain;
          updateRow.run(
            cipher.encrypt(plainTitle, `${row.id}:title`),
            cipher.encrypt(plainHtml, `${row.id}:content_html`),
            cipher.encrypt(plainText, `${row.id}:content_plain`),
            row.id
          );
        }

        const canary = cipher.encrypt('sticky-notes-ok', 'sticky-notes:canary');
        this.stmtSetSetting.run('encryption_canary', JSON.stringify(canary));
        this.stmtSetSetting.run('encryption_key_wrapped', JSON.stringify(wrappedKey));
        this.stmtSetSetting.run('encryption_enabled', JSON.stringify(true));
        this.cipher = cipher;
      })
      .immediate();

    // Purge old plaintext SQLite pages from disk
    this.db.exec('VACUUM');
    try {
      this.db.pragma('wal_checkpoint(TRUNCATE)');
    } catch {
      // Ignore checkpoint error on :memory:
    }
  }

  public disableEncryption(): void {
    if (!this.isEncryptionEnabled()) return;
    this.requireUnlocked();
    const activeCipher = this.cipher!;

    this.db
      .transaction(() => {
        const rows = this.db
          .prepare('SELECT id, title, content_html, content_plain FROM notes')
          .all() as Pick<Note, 'id' | 'title' | 'content_html' | 'content_plain'>[];

        const updateRow = this.db.prepare(
          'UPDATE notes SET title = ?, content_html = ?, content_plain = ? WHERE id = ?'
        );
        for (const row of rows) {
          updateRow.run(
            activeCipher.decrypt(row.title, `${row.id}:title`),
            activeCipher.decrypt(row.content_html, `${row.id}:content_html`),
            activeCipher.decrypt(row.content_plain, `${row.id}:content_plain`),
            row.id
          );
        }

        this.createFtsTriggers();
        this.db.exec(`
          INSERT INTO notes_fts(notes_fts) VALUES('delete-all');
          INSERT INTO notes_fts(rowid, title, content_plain)
            SELECT rowid, title, content_plain FROM notes WHERE deleted_at IS NULL;
        `);

        this.stmtSetSetting.run('encryption_enabled', JSON.stringify(false));
        this.db
          .prepare(
            "DELETE FROM settings WHERE key IN ('encryption_key_wrapped', 'encryption_canary')"
          )
          .run();
        this.cipher = null;
      })
      .immediate();

    try {
      this.db.pragma('wal_checkpoint(TRUNCATE)');
    } catch {
      // Ignore checkpoint error on :memory:
    }
  }

  private requireUnlocked(): void {
    if (this.isEncryptionEnabled() && !this.cipher) {
      throw new Error('Notes database is locked.');
    }
  }

  private decryptNote(note: Note): Note {
    if (!this.cipher) return note;
    return {
      ...note,
      title: this.cipher.decrypt(note.title, `${note.id}:title`),
      content_html: this.cipher.decrypt(note.content_html, `${note.id}:content_html`),
      content_plain: this.cipher.decrypt(note.content_plain, `${note.id}:content_plain`),
    };
  }

  private encryptField(
    id: string,
    field: 'title' | 'content_html' | 'content_plain',
    value: string
  ): string {
    return this.cipher ? this.cipher.encrypt(value, `${id}:${field}`) : value;
  }

  // --- Note Operations ---

  public createNote(initial: Partial<Note> = {}): Note {
    this.requireUnlocked();
    const id = initial.id || crypto.randomUUID();
    const now = Date.now();
    const color: NoteColor =
      initial.color && Object.hasOwn(NOTE_COLORS, initial.color) ? initial.color : 'yellow';

    const note: Note = {
      id,
      title: initial.title || '',
      content_html: initial.content_html || '',
      content_plain: initial.content_plain || '',
      color,
      is_open: initial.is_open !== undefined ? initial.is_open : 1,
      is_pinned: initial.is_pinned !== undefined ? initial.is_pinned : 0,
      pos_x: initial.pos_x !== undefined ? initial.pos_x : null,
      pos_y: initial.pos_y !== undefined ? initial.pos_y : null,
      width: initial.width || 320,
      height: initial.height || 340,
      z_order: initial.z_order || 0,
      created_at: initial.created_at || now,
      updated_at: initial.updated_at || now,
      deleted_at: null,
      remote_id: initial.remote_id || null,
      sync_status: initial.sync_status || 'synced',
      change_key: initial.change_key || null,
      last_synced_at: initial.last_synced_at || null,
    };

    const storedNote: Note = this.cipher
      ? {
          ...note,
          title: this.encryptField(id, 'title', note.title),
          content_html: this.encryptField(id, 'content_html', note.content_html),
          content_plain: this.encryptField(id, 'content_plain', note.content_plain),
        }
      : note;

    this.stmtInsertNote.run(storedNote);
    return note;
  }

  public getNoteById(id: string): Note | null {
    this.requireUnlocked();
    const result = this.stmtGetNoteById.get(id) as Note | undefined;
    return result ? this.decryptNote(result) : null;
  }

  public getOpenNotes(): Note[] {
    this.requireUnlocked();
    return (this.stmtGetOpenNotes.all() as Note[]).map((n) => this.decryptNote(n));
  }

  public getMostRecentlyActiveNote(): Pick<Note, 'id'> | null {
    return (this.stmtGetMostRecentlyActiveNote.get() as Pick<Note, 'id'> | undefined) ?? null;
  }

  public recordNoteActivity(id: string): void {
    this.stmtRecordNoteActivity.run(Date.now(), id);
  }

  public getAllNotes(options: ListOptions = {}): Note[] {
    this.requireUnlocked();
    if (this.cipher) {
      const all = (
        this.db
          .prepare(
            `SELECT * FROM notes WHERE deleted_at IS NULL${
              options.includeClosed === false ? ' AND is_open = 1' : ''
            } ORDER BY updated_at DESC, id ASC`
          )
          .all() as Note[]
      ).map((n) => this.decryptNote(n));
      const query = createSearchQuery(options.search);
      if (query.punctuationOnly) return [];
      const terms = [...query.indexedTerms, ...query.shortTerms].map((t) => t.toLowerCase());
      const filtered = terms.length
        ? all.filter((n) => {
            const hay = `${n.title}\n${n.content_plain}`.toLowerCase();
            return terms.every((term) => hay.includes(term));
          })
        : all;
      const offset =
        Number.isSafeInteger(options.offset) && options.offset! > 0 ? options.offset! : 0;
      const limit =
        Number.isSafeInteger(options.limit) && options.limit! > 0 ? options.limit! : undefined;
      return limit !== undefined ? filtered.slice(offset, offset + limit) : filtered.slice(offset);
    }
    return this.listNotes('notes.*', options) as Note[];
  }

  public getNotePreviews(options: ListOptions = {}): NotePreview[] {
    this.requireUnlocked();
    const limit = Number.isSafeInteger(options.limit)
      ? Math.max(1, Math.min(101, options.limit!))
      : 50;
    const offset =
      Number.isSafeInteger(options.offset) && options.offset! > 0 ? options.offset! : 0;
    const query = createSearchQuery(options.search);

    if (this.cipher) {
      if (query.punctuationOnly) return [];
      const rows = this.db
        .prepare(
          `SELECT ${PREVIEW_COLUMNS}, notes.title, notes.content_plain FROM notes
           WHERE notes.deleted_at IS NULL${options.includeClosed === false ? ' AND notes.is_open = 1' : ''}
           ORDER BY notes.updated_at DESC, notes.id ASC`
        )
        .all() as (Omit<NotePreview, 'preview'> & Pick<Note, 'title' | 'content_plain'>)[];

      const terms = [...query.indexedTerms, ...query.shortTerms].map((t) => t.toLowerCase());
      const matched: NotePreview[] = [];
      let skipped = 0;

      for (const row of rows) {
        const title = this.cipher.decrypt(row.title, `${row.id}:title`);
        const contentPlain = this.cipher.decrypt(row.content_plain, `${row.id}:content_plain`);
        if (terms.length > 0) {
          const hay = `${title}\n${contentPlain}`.toLowerCase();
          if (!terms.every((term) => hay.includes(term))) continue;
        }
        if (skipped < offset) {
          skipped++;
          continue;
        }
        const preview =
          terms.length > 0
            ? (excerptAroundMatch(contentPlain, terms) ??
              excerptAroundMatch(title, terms) ??
              (contentPlain || title).slice(0, 500))
            : (contentPlain || title).slice(0, 500);
        matched.push({
          id: row.id,
          color: row.color,
          updated_at: row.updated_at,
          is_open: row.is_open,
          is_pinned: row.is_pinned,
          preview,
        });
        if (matched.length >= limit) break;
      }
      return matched;
    }

    const boundedOptions = { ...options, limit };
    if (!query.indexedQuery && !query.shortTerms.length) {
      const columns = `${PREVIEW_COLUMNS}, substr(coalesce(nullif(notes.content_plain, ''), notes.title), 1, 500) AS preview`;
      return this.listNotes(columns, boundedOptions, query) as NotePreview[];
    }

    // Fetch title & content_plain directly in the single bounded query (eliminates N+1 queries).
    const rows = this.listNotes(
      `${PREVIEW_COLUMNS}, notes.title, notes.content_plain`,
      boundedOptions,
      query
    ) as (Omit<NotePreview, 'preview'> & Pick<Note, 'title' | 'content_plain'>)[];

    const excerptTerms = query.indexedQuery ? query.indexedTerms : query.shortTerms;
    const foldedTerms = excerptTerms.map((term) => term.toLowerCase());
    return rows.map(({ title, content_plain, ...note }) => {
      let preview =
        excerptAroundMatch(content_plain, foldedTerms) ?? excerptAroundMatch(title, foldedTerms);
      // SQLite's Unicode folding can differ from JavaScript's. Ask FTS for context when it found a match we did not.
      if (!preview && query.indexedQuery) {
        const match = this.stmtGetIndexedExcerpt.get(note.id, query.indexedQuery) as
          { preview: string } | undefined;
        preview = match?.preview.replace(/\s+/g, ' ').trim();
      }
      return { ...note, preview: preview ?? (content_plain || title).slice(0, 500) };
    });
  }

  private listNotes(
    columns: string,
    options: ListOptions,
    query = createSearchQuery(options.search)
  ): unknown[] {
    const conditions = ['notes.deleted_at IS NULL'];
    const params: (string | number)[] = [];
    if (options.includeClosed === false) conditions.push('notes.is_open = 1');

    // Every word fragment must occur somewhere in the title or body. Punctuation separates terms.
    if (query.punctuationOnly) return [];
    // The trigram index has no entries for one- and two-character queries.
    // Use native SQLite instr(lower(...), ?) for ASCII terms to avoid V8 UDF overhead per row;
    // keep contains_folded() for non-ASCII Unicode terms where SQLite lower() only folds ASCII.
    for (const term of query.shortTerms) {
      if (ASCII_ONLY.test(term)) {
        const lowered = term.toLowerCase();
        conditions.push(
          '(instr(lower(notes.title), ?) > 0 OR instr(lower(notes.content_plain), ?) > 0)'
        );
        params.push(lowered, lowered);
      } else {
        conditions.push(
          '(contains_folded(notes.title, ?) OR contains_folded(notes.content_plain, ?))'
        );
        params.push(term, term);
      }
    }
    if (query.indexedQuery) {
      conditions.push('notes.rowid IN (SELECT rowid FROM notes_fts WHERE notes_fts MATCH ?)');
      params.push(query.indexedQuery);
    }
    const limit = Number.isSafeInteger(options.limit) && options.limit! > 0 ? options.limit! : -1;
    const offset =
      Number.isSafeInteger(options.offset) && options.offset! > 0 ? options.offset! : 0;
    return this.db
      .prepare(
        `
      SELECT ${columns} FROM notes WHERE ${conditions.join(' AND ')}
      ORDER BY notes.updated_at DESC, notes.id ASC LIMIT ? OFFSET ?
    `
      )
      .all(...params, limit, offset);
  }

  public updateNote(id: string, updates: Partial<Note>): Note | null {
    this.requireUnlocked();
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    // Auto derive title from plain content if not explicitly provided
    const effectiveUpdates: Partial<Note> = { ...updates };
    if (effectiveUpdates.content_plain !== undefined && !effectiveUpdates.title) {
      const firstLine = effectiveUpdates.content_plain.trim().split('\n', 1)[0] || '';
      effectiveUpdates.title = firstLine.slice(0, 80);
    }

    const allowedKeys: (keyof Note)[] = [
      'title',
      'content_html',
      'content_plain',
      'color',
      'is_open',
      'is_pinned',
      'pos_x',
      'pos_y',
      'width',
      'height',
      'z_order',
    ];

    for (const key of allowedKeys) {
      let val = effectiveUpdates[key];
      if (val !== undefined) {
        if (
          this.cipher &&
          (key === 'title' || key === 'content_html' || key === 'content_plain') &&
          typeof val === 'string'
        ) {
          val = this.encryptField(id, key, val);
        }
        fields.push(`${key} = ?`);
        values.push(val as string | number | null);
      }
    }

    const contentEdited =
      effectiveUpdates.title !== undefined ||
      effectiveUpdates.content_html !== undefined ||
      effectiveUpdates.content_plain !== undefined;
    if (contentEdited || effectiveUpdates.updated_at !== undefined) {
      fields.push('updated_at = ?');
      values.push(effectiveUpdates.updated_at ?? Date.now());
    }
    if (contentEdited) {
      fields.push('last_active_at = ?');
      values.push(Date.now());
    }

    if (fields.length === 0) {
      return this.getNoteById(id);
    }

    const cacheKey = fields.join(',');
    let stmt = this.updateStmtCache.get(cacheKey);
    if (!stmt) {
      const sql = `UPDATE notes SET ${fields.join(', ')} WHERE id = ? AND deleted_at IS NULL`;
      stmt = this.db.prepare(sql);
      this.updateStmtCache.set(cacheKey, stmt);
    }

    values.push(id);
    const info = stmt.run(...values);

    if (info.changes === 0) {
      return null;
    }

    return this.getNoteById(id);
  }

  public updateNoteBounds(id: string, bounds: WindowBounds): void {
    this.stmtUpdateNoteBounds.run({ ...bounds, id });
  }

  public setNoteOpenState(id: string, isOpen: boolean): void {
    this.stmtSetNoteOpenState.run({ open: isOpen ? 1 : 0, now: Date.now(), id });
  }

  public toggleNotePin(id: string): boolean {
    const result = this.stmtToggleNotePin.get(id) as Pick<Note, 'is_pinned'> | undefined;
    return result?.is_pinned === 1;
  }

  /** Soft-delete a note to Trash so it can be restored or permanently purged. */
  public deleteNote(id: string): void {
    this.stmtSoftDeleteNote.run({ now: Date.now(), id });
  }

  public getDeletedNotes(): DeletedNotePreview[] {
    this.requireUnlocked();
    if (this.cipher) {
      const rows = this.db
        .prepare(
          `SELECT id, color, updated_at, deleted_at, title, content_plain
           FROM notes WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC, id ASC`
        )
        .all() as (Omit<DeletedNotePreview, 'preview'> & Pick<Note, 'title' | 'content_plain'>)[];
      return rows.map((row) => {
        const plain = this.cipher!.decrypt(row.content_plain, `${row.id}:content_plain`);
        const title = this.cipher!.decrypt(row.title, `${row.id}:title`);
        return {
          id: row.id,
          color: row.color,
          updated_at: row.updated_at,
          deleted_at: row.deleted_at,
          preview: (plain || title).slice(0, 300),
        };
      });
    }
    return this.stmtGetDeletedNotes.all() as DeletedNotePreview[];
  }

  public restoreNote(id: string): boolean {
    const info = this.stmtRestoreNote.run({ now: Date.now(), id });
    return info.changes > 0;
  }

  public permanentlyDeleteNote(id: string): void {
    this.stmtHardDeleteNote.run(id);
  }

  public emptyTrash(): void {
    this.stmtEmptyTrash.run();
  }

  // --- Migration Backup Lifecycle ---

  public listMigrationBackups(): string[] {
    if (this.dbPath === ':memory:') return [];
    const directory = path.dirname(this.dbPath);
    const baseName = path.basename(this.dbPath);
    const pattern = new RegExp(`^${escapeRegExp(baseName)}\\.pre-v\\d+-[0-9a-f-]+\\.bak$`);
    try {
      return fs
        .readdirSync(directory)
        .filter((name) => pattern.test(name))
        .map((name) => path.join(directory, name));
    } catch {
      return [];
    }
  }

  public purgeMigrationBackups(): number {
    const backups = this.listMigrationBackups();
    let removed = 0;
    for (const file of backups) {
      try {
        fs.unlinkSync(file);
        removed++;
      } catch {
        // Ignore individual removal errors
      }
    }
    return removed;
  }

  // --- Settings Store ---

  public getAllSettings(): AppConfig {
    const rows = this.stmtGetAllSettings.all() as { key: string; value: string }[];
    const result: AppConfig = { ...DEFAULT_SETTINGS };
    for (const row of rows) {
      try {
        const parsed: unknown = JSON.parse(row.value);
        if (
          row.key === 'theme' &&
          typeof parsed === 'string' &&
          VALID_THEMES.has(parsed as AppTheme)
        ) {
          result.theme = parsed as AppTheme;
        } else if (row.key === 'autostart' && typeof parsed === 'boolean') {
          result.autostart = parsed;
        }
      } catch {
        // Ignore corrupt setting; keep default
      }
    }
    return result;
  }

  public setSetting<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    this.stmtSetSetting.run(key, JSON.stringify(value));
  }

  public getManagerBounds(): WindowBounds | null {
    const row = this.stmtGetSetting.get('manager_bounds') as { value: string } | undefined;
    if (!row) return null;
    try {
      const parsed: unknown = JSON.parse(row.value);
      if (
        parsed &&
        typeof parsed === 'object' &&
        typeof (parsed as WindowBounds).x === 'number' &&
        typeof (parsed as WindowBounds).y === 'number' &&
        typeof (parsed as WindowBounds).width === 'number' &&
        typeof (parsed as WindowBounds).height === 'number' &&
        Number.isFinite((parsed as WindowBounds).x) &&
        Number.isFinite((parsed as WindowBounds).y) &&
        (parsed as WindowBounds).width >= 340 &&
        (parsed as WindowBounds).height >= 450
      ) {
        return parsed as WindowBounds;
      }
    } catch {
      // Ignore corrupt bounds
    }
    return null;
  }

  public setManagerBounds(bounds: WindowBounds): void {
    this.stmtSetSetting.run('manager_bounds', JSON.stringify(bounds));
  }

  public close(): void {
    // Checkpoint & truncate WAL before closing to merge -wal file cleanly back into main database
    try {
      this.db.pragma('wal_checkpoint(TRUNCATE)');
    } catch {
      // Ignore checkpoint errors on close
    }
    this.updateStmtCache.clear();
    this.db.close();
  }
}
