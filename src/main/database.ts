import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import { Note, NoteColor, NotePreview, AppConfig } from '../shared/types';

interface ListOptions {
  search?: string;
  includeClosed?: boolean;
  limit?: number;
  offset?: number;
}

export class DatabaseService {
  private db!: Database.Database;
  private dbPath: string;

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

    this.db = new Database(this.dbPath);
    // WAL and shared-memory sidecars inherit the database file mode when SQLite creates them.
    if (this.dbPath !== ':memory:') {
      try { fs.chmodSync(this.dbPath, 0o600); } catch { /* unsupported filesystem */ }
    }
    try {
      if (this.db.pragma('quick_check(1)', { simple: true }) !== 'ok') {
        throw new Error('SQLite integrity check failed');
      }
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('secure_delete = ON');
      this.db.pragma('foreign_keys = ON');
      this.db.function('contains_folded', { deterministic: true }, (value: string, term: string) =>
        value.toLowerCase().includes(term.toLowerCase()) ? 1 : 0
      );
      this.db.transaction(() => {
        this.initSchema();
        this.initStatements();
      }).immediate();
    } catch (error) {
      this.db.close();
      throw error;
    }
  }

  // Pre-compiled prepared statements for high-throughput operations
  private stmtInsertNote!: Database.Statement;
  private stmtGetNoteById!: Database.Statement;
  private stmtGetOpenNotes!: Database.Statement;
  private stmtUpdateNoteBounds!: Database.Statement;
  private stmtSetNoteOpenState!: Database.Statement;
  private stmtToggleNotePin!: Database.Statement;
  private stmtHardDeleteNote!: Database.Statement;
  private stmtGetSetting!: Database.Statement;
  private stmtGetAllSettings!: Database.Statement;
  private stmtSetSetting!: Database.Statement;

  private initStatements(): void {
    this.stmtInsertNote = this.db.prepare(`
      INSERT INTO notes (
        id, title, content_html, content_plain, color, is_open, is_pinned,
        pos_x, pos_y, width, height, z_order, created_at, updated_at,
        deleted_at, remote_id, sync_status, change_key, last_synced_at
      ) VALUES (
        @id, @title, @content_html, @content_plain, @color, @is_open, @is_pinned,
        @pos_x, @pos_y, @width, @height, @z_order, @created_at, @updated_at,
        @deleted_at, @remote_id, @sync_status, @change_key, @last_synced_at
      )
    `);

    this.stmtGetNoteById = this.db.prepare('SELECT * FROM notes WHERE id = ? AND deleted_at IS NULL');
    this.stmtGetOpenNotes = this.db.prepare('SELECT * FROM notes WHERE is_open = 1 AND deleted_at IS NULL ORDER BY updated_at ASC');
    this.stmtUpdateNoteBounds = this.db.prepare(`
      UPDATE notes SET
        pos_x = ?,
        pos_y = ?,
        width = ?,
        height = ?,
        updated_at = ?
      WHERE id = ? AND deleted_at IS NULL
    `);
    this.stmtSetNoteOpenState = this.db.prepare(`
      UPDATE notes SET
        is_open = ?,
        updated_at = ?
      WHERE id = ? AND deleted_at IS NULL
    `);
    this.stmtToggleNotePin = this.db.prepare('UPDATE notes SET is_pinned = ?, updated_at = ? WHERE id = ?');
    this.stmtHardDeleteNote = this.db.prepare('DELETE FROM notes WHERE id = ?');
    this.stmtGetSetting = this.db.prepare('SELECT value FROM settings WHERE key = ?');
    this.stmtGetAllSettings = this.db.prepare('SELECT key, value FROM settings');
    this.stmtSetSetting = this.db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);
  }

  private initSchema(): void {
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

    const version = this.db.pragma('user_version', { simple: true });
    if (version !== 0 && version !== 1) throw new Error('Unsupported notes database schema version');
    this.db.exec(schema);
    if (version === 0) {
      // Remove legacy triggers before purging tombstones: deleted rows were absent from the old FTS index.
      this.db.exec(`
        DROP TRIGGER IF EXISTS notes_ai;
        DROP TRIGGER IF EXISTS notes_ad;
        DROP TRIGGER IF EXISTS notes_au;
        DROP TABLE IF EXISTS notes_fts;
        DELETE FROM notes WHERE deleted_at IS NOT NULL;
        DROP INDEX IF EXISTS idx_notes_updated;
        CREATE INDEX idx_notes_page ON notes(updated_at DESC, id ASC);
        CREATE VIRTUAL TABLE notes_fts USING fts5(title, content_plain, content='notes', tokenize='trigram');
        INSERT INTO notes_fts(notes_fts, rank) VALUES('secure-delete', 1);
        INSERT INTO notes_fts(notes_fts) VALUES('rebuild');
        CREATE TRIGGER notes_ai AFTER INSERT ON notes BEGIN
          INSERT INTO notes_fts(rowid, title, content_plain) VALUES(new.rowid, new.title, new.content_plain);
        END;
        CREATE TRIGGER notes_ad AFTER DELETE ON notes BEGIN
          INSERT INTO notes_fts(notes_fts, rowid, title, content_plain)
            VALUES('delete', old.rowid, old.title, old.content_plain);
        END;
        CREATE TRIGGER notes_au AFTER UPDATE OF title, content_plain ON notes
        WHEN new.title IS NOT old.title OR new.content_plain IS NOT old.content_plain BEGIN
          INSERT INTO notes_fts(notes_fts, rowid, title, content_plain)
            VALUES('delete', old.rowid, old.title, old.content_plain);
          INSERT INTO notes_fts(rowid, title, content_plain) VALUES(new.rowid, new.title, new.content_plain);
        END;
        PRAGMA user_version = 1;
      `);
    }

    // Set default settings if not exists
    const defaultSettings: AppConfig = {
      theme: 'system',
      autostart: true,
      alwaysOnTopDefault: false,
      confirmDelete: true,
    };

    const insertSetting = this.db.prepare(
      'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
    );

    for (const [key, value] of Object.entries(defaultSettings)) {
      insertSetting.run(key, JSON.stringify(value));
    }
  }

  // --- Note Operations ---

  public createNote(initial: Partial<Note> = {}): Note {
    const id = initial.id || crypto.randomUUID();
    const now = Date.now();

    const note: Note = {
      id,
      title: initial.title || '',
      content_html: initial.content_html || '',
      content_plain: initial.content_plain || '',
      color: (initial.color as NoteColor) || 'yellow',
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

    this.stmtInsertNote.run(note);
    return note;
  }

  public getNoteById(id: string): Note | null {
    const result = this.stmtGetNoteById.get(id) as Note | undefined;
    return result || null;
  }

  public getOpenNotes(): Note[] {
    return this.stmtGetOpenNotes.all() as Note[];
  }

  public getAllNotes(options: ListOptions = {}): Note[] {
    return this.listNotes('notes.*', options) as Note[];
  }

  public getNotePreviews(options: ListOptions = {}): NotePreview[] {
    const limit = Number.isSafeInteger(options.limit) ? Math.max(1, Math.min(101, options.limit!)) : 50;
    const columns = `notes.id, notes.color, notes.updated_at, notes.is_open,
      substr(coalesce(nullif(notes.content_plain, ''), notes.title), 1, 500) AS preview`;
    return this.listNotes(columns, { ...options, limit }) as NotePreview[];
  }

  private listNotes(columns: string, options: ListOptions): unknown[] {
    const conditions = ['notes.deleted_at IS NULL'];
    const params: (string | number)[] = [];
    if (options.includeClosed === false) conditions.push('notes.is_open = 1');

    // Every word fragment must occur somewhere in the title or body. Punctuation separates terms.
    const terms = options.search?.match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
    if (options.search?.trim() && terms.length === 0) return [];
    const indexedTerms: string[] = [];
    for (const term of terms) {
      if ([...term].length >= 3) {
        indexedTerms.push(`"${term}"`);
      } else {
        // The trigram index has no entries for one- and two-character queries.
        conditions.push('(contains_folded(notes.title, ?) OR contains_folded(notes.content_plain, ?))');
        params.push(term, term);
      }
    }
    if (indexedTerms.length) {
      conditions.push('notes.rowid IN (SELECT rowid FROM notes_fts WHERE notes_fts MATCH ?)');
      params.push(indexedTerms.join(' AND '));
    }
    const limit = Number.isSafeInteger(options.limit) && options.limit! > 0 ? options.limit! : -1;
    const offset = Number.isSafeInteger(options.offset) && options.offset! > 0 ? options.offset! : 0;
    return this.db.prepare(`
      SELECT ${columns} FROM notes WHERE ${conditions.join(' AND ')}
      ORDER BY notes.updated_at DESC, notes.id ASC LIMIT ? OFFSET ?
    `).all(...params, limit, offset);
  }

  public updateNote(id: string, updates: Partial<Note>): Note | null {
    const fields: string[] = [];
    const values: any[] = [];

    // Auto derive title from plain content if not explicitly provided
    if (updates.content_plain !== undefined && !updates.title) {
      const firstLine = updates.content_plain.trim().split('\n')[0] || '';
      updates.title = firstLine.slice(0, 80);
    }

    const allowedKeys: (keyof Note)[] = [
      'title', 'content_html', 'content_plain', 'color',
      'is_open', 'is_pinned', 'pos_x', 'pos_y',
      'width', 'height', 'z_order', 'remote_id',
      'change_key', 'last_synced_at'
    ];

    for (const key of allowedKeys) {
      if (updates[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(updates[key]);
      }
    }

    fields.push('updated_at = ?');
    values.push(updates.updated_at || Date.now());

    fields.push("sync_status = 'pending_update'");

    values.push(id);
    const sql = `UPDATE notes SET ${fields.join(', ')} WHERE id = ? AND deleted_at IS NULL`;
    const stmt = this.db.prepare(sql);
    const info = stmt.run(...values);

    if (info.changes === 0) {
      return null;
    }

    return this.getNoteById(id);
  }

  public updateNoteBounds(id: string, bounds: { x: number; y: number; width: number; height: number }): void {
    this.stmtUpdateNoteBounds.run(bounds.x, bounds.y, bounds.width, bounds.height, Date.now(), id);
  }

  public setNoteOpenState(id: string, isOpen: boolean): void {
    this.stmtSetNoteOpenState.run(isOpen ? 1 : 0, Date.now(), id);
  }

  public toggleNotePin(id: string): boolean {
    const note = this.getNoteById(id);
    if (!note) return false;
    const newPin = note.is_pinned ? 0 : 1;
    this.stmtToggleNotePin.run(newPin, Date.now(), id);
    return newPin === 1;
  }

  public deleteNote(id: string): void {
    this.stmtHardDeleteNote.run(id);
  }

  // --- Settings Store ---

  public getSetting<T>(key: keyof AppConfig): T {
    const row = this.stmtGetSetting.get(key) as { value: string } | undefined;
    if (!row) {
      throw new Error(`Setting ${key} not found`);
    }
    return JSON.parse(row.value) as T;
  }

  public getAllSettings(): AppConfig {
    const rows = this.stmtGetAllSettings.all() as { key: string; value: string }[];
    const result: Partial<AppConfig> = {};
    for (const row of rows) {
      try {
        result[row.key as keyof AppConfig] = JSON.parse(row.value);
      } catch {
        // Ignore corrupt setting
      }
    }
    return result as AppConfig;
  }

  public setSetting(key: keyof AppConfig, value: any): void {
    this.stmtSetSetting.run(key, JSON.stringify(value));
  }

  public close(): void {
    // Checkpoint WAL before closing to merge -wal file back into main database
    try {
      this.db.pragma('wal_checkpoint(PASSIVE)');
    } catch {
      // Ignore checkpoint errors on close
    }
    this.db.close();
  }
}
