import Database from 'better-sqlite3';
import { DatabaseService } from '../src/main/database';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { test } from 'node:test';

test('CRUD, FTS5 search, bounds, pinning, pagination, and soft-delete Trash lifecycle', () => {
  const dbService = new DatabaseService(':memory:');
  try {
    const note1 = dbService.createNote({
      title: 'Test Note 1',
      content_html: '<p>Hello <strong>Parrot Linux</strong> Sticky Notes!</p>',
      content_plain: 'Hello Parrot Linux Sticky Notes!',
      color: 'yellow',
      pos_x: 100,
      pos_y: 200,
      width: 320,
      height: 340,
    });

    const note2 = dbService.createNote({
      title: 'Grocery List',
      content_html: '<ul><li>Apples</li><li>Milk</li><li>Coffee</li></ul>',
      content_plain: 'Apples\nMilk\nCoffee',
      color: 'green',
      is_open: 0,
    });

    assert.equal(dbService.getAllNotes({ search: 'Parrot' })[0]?.id, note1.id);
    assert.equal(dbService.getAllNotes({ search: 'Coffee' })[0]?.id, note2.id);
    assert.equal(dbService.getAllNotes({ search: 'Parrot Sticky' })[0]?.id, note1.id);
    assert.equal(dbService.getAllNotes({ search: 'Parrot* "Sticky":' })[0]?.id, note1.id);

    dbService.updateNote(note1.id, { color: 'purple', title: 'Updated Title' });
    const updated = dbService.getNoteById(note1.id);
    assert.equal(updated?.color, 'purple');
    assert.equal(updated?.title, 'Updated Title');

    assert.equal(dbService.getOpenNotes().length, 1);
    assert.equal(dbService.getOpenNotes()[0]?.id, note1.id);

    dbService.updateNoteBounds(note1.id, { x: 500, y: 400, width: 350, height: 400 });
    const moved = dbService.getNoteById(note1.id);
    assert.equal(moved?.pos_x, 500);
    assert.equal(moved?.pos_y, 400);
    assert.equal(moved?.width, 350);
    assert.equal(moved?.height, 400);

    // Soft-delete moves note to Trash and removes it from active FTS5 search
    dbService.deleteNote(note1.id);
    assert.equal(dbService.getNoteById(note1.id), null);
    assert.deepEqual(dbService.getNotePreviews({ search: 'Parrot' }), []);
    assert.equal(dbService.getDeletedNotes().length, 1);
    assert.equal(dbService.getDeletedNotes()[0]?.id, note1.id);

    // Restoring note returns it to active notes and re-indexes it in FTS5
    assert.equal(dbService.restoreNote(note1.id), true);
    assert.equal(dbService.getNoteById(note1.id)?.id, note1.id);
    assert.equal(dbService.getNotePreviews({ search: 'Parrot' })[0]?.id, note1.id);
    assert.equal(dbService.getDeletedNotes().length, 0);

    // Permanent delete and emptyTrash remove records completely
    dbService.deleteNote(note1.id);
    dbService.permanentlyDeleteNote(note1.id);
    assert.equal(dbService.getDeletedNotes().length, 0);

    dbService.deleteNote(note2.id);
    assert.equal(dbService.getDeletedNotes().length, 1);
    dbService.emptyTrash();
    assert.equal(dbService.getDeletedNotes().length, 0);

    // Pagination
    for (let i = 0; i < 5; i++) {
      dbService.createNote({
        title: `Pagination Note ${i}`,
        content_plain: `Content ${i}`,
        color: 'yellow',
      });
    }
    const page1 = dbService.getAllNotes({ limit: 2, offset: 0 });
    const page2 = dbService.getAllNotes({ limit: 2, offset: 2 });
    assert.equal(page1.length, 2);
    assert.equal(page2.length, 2);
    assert.notEqual(page1[0].id, page2[0].id);
  } finally {
    dbService.close();
  }
});

test('Search excerpts, Unicode folding, short-term search, and metadata isolation', () => {
  const searchDb = new DatabaseService(':memory:');
  try {
    const prefix = 'Early paragraph without a match.\n'.repeat(30);
    searchDb.createNote({
      id: 'departure',
      updated_at: 200,
      content_plain: prefix + 'Shipment leaves on Friday.',
    });
    searchDb.createNote({
      id: 'arrival',
      updated_at: 100,
      content_plain: prefix + 'Shipment arrives on Monday.',
    });
    searchDb.createNote({
      id: 'title-match',
      updated_at: 50,
      title: 'International Shipment',
      content_plain: prefix,
    });
    searchDb.createNote({
      id: 'unicode',
      title: 'Symbols',
      content_plain: prefix + 'İ and 🚚 followed by café ＡＢＣ.',
    });
    searchDb.createNote({
      id: 'greek',
      content_plain: prefix + 'The word ΟΣΚΟΣ appears here.',
    });
    const longTerm = 'searchterm'.repeat(25) + 'ending';
    searchDb.createNote({
      id: 'long-token',
      content_plain: 'x'.repeat(900) + longTerm + ' with context.',
    });

    const first = searchDb.getNotePreviews({ search: 'a SHIPMENT', limit: 1 });
    assert.equal(first[0]?.id, 'departure');
    assert.match(first[0]?.preview, /Shipment leaves on Friday/);

    const second = searchDb.getNotePreviews({ search: 'a SHIPMENT', limit: 1, offset: 1 });
    assert.equal(second[0]?.id, 'arrival');
    assert.match(second[0]?.preview, /Shipment arrives on Monday/);

    assert.match(
      searchDb.getNotePreviews({ search: 'shipment', offset: 2 })[0]?.preview,
      /International Shipment/
    );
    assert.match(searchDb.getNotePreviews({ search: 'SH', limit: 1 })[0]?.preview, /Shipment leaves/);
    assert.match(searchDb.getNotePreviews({ search: 'CAFÉ' })[0]?.preview, /café/);
    assert.match(searchDb.getNotePreviews({ search: 'i\u0307' })[0]?.preview, /İ/);
    assert.match(searchDb.getNotePreviews({ search: 'a οσκοσ' })[0]?.preview, /ΟΣΚΟΣ/);

    const longPreview = searchDb.getNotePreviews({ search: longTerm })[0]?.preview;
    assert.ok(longPreview.includes(longTerm));
    assert.ok(longPreview.indexOf(longTerm) < 40);
    assert.match(
      searchDb.getNotePreviews().find((result) => result.id === 'departure')?.preview ?? '',
      /^Early paragraph/
    );

    searchDb.updateNoteBounds('arrival', { x: 25, y: 30, width: 400, height: 345 });
    searchDb.setNoteOpenState('arrival', false);
    assert.equal(searchDb.getMostRecentlyActiveNote()?.id, 'arrival');
    assert.equal(searchDb.toggleNotePin('arrival'), true);
    searchDb.updateNote('arrival', { color: 'pink' });
    searchDb.recordNoteActivity('arrival');
    assert.equal(searchDb.getMostRecentlyActiveNote()?.id, 'arrival');
    assert.deepEqual(
      searchDb.getNotePreviews({ search: 'shipment' }).map((note) => [note.id, note.updated_at]),
      [
        ['departure', 200],
        ['arrival', 100],
        ['title-match', 50],
      ]
    );
    searchDb.updateNote('arrival', { content_plain: prefix + 'Shipment arrived.' });
    assert.equal(searchDb.getNotePreviews({ search: 'shipment' })[0]?.id, 'arrival');
  } finally {
    searchDb.close();
  }
});

test('Settings defaults, corrupt JSON resilience, and manager bounds persistence', () => {
  const dbService = new DatabaseService(':memory:');
  try {
    assert.deepEqual(dbService.getAllSettings(), { theme: 'system', autostart: true, spellcheck: false });
    dbService.setSetting('theme', 'dark');
    dbService.setSetting('autostart', false);
    dbService.setSetting('spellcheck', true);
    assert.deepEqual(dbService.getAllSettings(), { theme: 'dark', autostart: false, spellcheck: true });

    // Inject corrupt setting row and ensure defaults still merge safely
    const rawDb = (dbService as unknown as { db: Database.Database }).db;
    rawDb.prepare("UPDATE settings SET value = '{invalid json' WHERE key = 'theme'").run();
    assert.deepEqual(dbService.getAllSettings(), { theme: 'system', autostart: false, spellcheck: true });

    assert.equal(dbService.getManagerBounds(), null);
    dbService.setManagerBounds({ x: 120, y: 140, width: 420, height: 680 });
    assert.deepEqual(dbService.getManagerBounds(), { x: 120, y: 140, width: 420, height: 680 });
  } finally {
    dbService.close();
  }
});

test('Corrupt DB protection, transactional migrations, verified backups, and backup purge', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sticky-notes-db-'));
  try {
    const corruptPath = path.join(tempDir, 'damaged.db');
    const corruptBytes = Buffer.from('not a sqlite database');
    fs.writeFileSync(corruptPath, corruptBytes);
    assert.throws(() => new DatabaseService(corruptPath));
    assert.deepEqual(fs.readFileSync(corruptPath), corruptBytes);
    assert.deepEqual(fs.readdirSync(tempDir), ['damaged.db']);

    const dbPath = path.join(tempDir, 'legacy.db');
    const seed = new DatabaseService(dbPath);
    assert.equal(fs.statSync(dbPath).mode & 0o777, 0o600);
    seed.createNote({ id: 'old', title: 'Forgotten', content_plain: 'hidden' });
    seed.createNote({ id: 'live', title: 'Blueberry', content_plain: 'Notebook' });
    seed.close();

    const legacy = new Database(dbPath);
    legacy.exec(`
      DROP TRIGGER notes_ai;
      DROP TRIGGER notes_au;
      DROP TRIGGER notes_ad;
      DROP TRIGGER notes_au_del;
      DROP TRIGGER notes_au_restore;
      DROP INDEX idx_notes_page;
      DROP INDEX idx_notes_deleted_at;
      DROP TABLE notes_fts;
      ALTER TABLE notes DROP COLUMN last_active_at;
      UPDATE notes SET deleted_at = 123 WHERE id = 'old';
      CREATE VIRTUAL TABLE notes_fts USING fts5(id UNINDEXED, content_plain, content='notes');
      INSERT INTO notes_fts(rowid, id, content_plain)
        SELECT rowid, id, content_plain FROM notes WHERE deleted_at IS NULL;
      PRAGMA user_version = 0;
    `);

    // Force an error mid-migration to confirm rollback & backup cleanup
    legacy.exec('CREATE INDEX idx_notes_page ON notes(id)');
    assert.throws(() => new DatabaseService(dbPath), /idx_notes_page/);
    assert.equal(fs.readdirSync(tempDir).filter((name) => name.endsWith('.bak')).length, 0);
    assert.equal(legacy.pragma('user_version', { simple: true }), 0);
    assert.deepEqual(legacy.prepare('SELECT COUNT(*) AS n FROM notes').get(), { n: 2 });
    legacy.exec('DROP INDEX idx_notes_page');
    legacy.close();

    const upgraded = new DatabaseService(dbPath);
    const rawUpgraded = (upgraded as unknown as { db: Database.Database }).db;
    assert.equal(rawUpgraded.pragma('synchronous', { simple: true }), 2); // FULL
    assert.equal(rawUpgraded.pragma('busy_timeout', { simple: true }), 5000);

    const inspect = new Database(dbPath);
    assert.equal(inspect.pragma('user_version', { simple: true }), 3);
    const rowCount = inspect.prepare('SELECT count(*) AS n FROM notes');
    assert.deepEqual(rowCount.get(), { n: 1 });
    assert.equal(upgraded.getNotePreviews({ search: 'UEB oo' })[0]?.id, 'live');
    assert.equal(upgraded.getNotePreviews({ search: 'U' })[0]?.id, 'live');
    assert.deepEqual(upgraded.getNotePreviews({ search: '*:' }), []);
    assert.match(upgraded.getNotePreviews({ search: 'UEB oo' })[0]?.preview, /Notebook|Blueberry/);

    const indexPages = inspect.prepare('SELECT id, block FROM notes_fts_data ORDER BY id');
    const beforeMetadata = indexPages.all();
    upgraded.updateNoteBounds('live', { x: 5, y: 9, width: 320, height: 340 });
    upgraded.updateNote('live', { color: 'blue', title: 'Blueberry' });
    assert.deepEqual(indexPages.all(), beforeMetadata);

    upgraded.updateNote('live', { title: 'Apricot' });
    assert.deepEqual(upgraded.getNotePreviews({ search: 'UEB' }), []);
    assert.equal(upgraded.getNotePreviews({ search: 'ric' })[0]?.id, 'live');

    upgraded.permanentlyDeleteNote('live');
    assert.deepEqual(rowCount.get(), { n: 0 });
    assert.deepEqual(upgraded.getNotePreviews({ search: 'ric' }), []);

    for (let i = 0; i < 105; i++) {
      upgraded.createNote({
        id: String(i).padStart(3, '0'),
        updated_at: 123,
        content_plain: 'x'.repeat(700),
      });
    }
    const previews = upgraded.getNotePreviews({ limit: 1000 });
    assert.equal(previews.length, 101);
    assert.deepEqual(Object.keys(previews[0]).sort(), [
      'color',
      'id',
      'is_open',
      'is_pinned',
      'preview',
      'updated_at',
    ]);
    assert.equal(previews[0].preview.length, 500);
    assert.equal(previews[100].id, '100');
    assert.equal(upgraded.getNotePreviews({ offset: 101 }).length, 4);
    assert.equal(upgraded.getNotePreviews().length, 50);

    // Unsupported future schema version fails cleanly without touching WAL
    inspect.exec('PRAGMA user_version = 100');
    assert.ok(fs.existsSync(dbPath + '-wal'));
    assert.throws(() => new DatabaseService(dbPath), /Unsupported notes database/);
    assert.ok(fs.existsSync(dbPath + '-wal'));
    assert.deepEqual(rowCount.get(), { n: 105 });
    upgraded.close();
    inspect.close();

    // v1 -> v3 migration preserves uncommitted WAL writes inside verified pre-v3 backup & supports purge
    const v1Path = path.join(tempDir, 'version-one.db');
    const v1Seed = new DatabaseService(v1Path);
    v1Seed.createNote({ id: 'v1-old', updated_at: 2, content_plain: 'Before the migration' });
    v1Seed.close();

    const v1Writer = new Database(v1Path);
    try {
      v1Writer.exec(`
        ALTER TABLE notes DROP COLUMN last_active_at;
        PRAGMA user_version = 1;
        INSERT INTO notes(rowid, id, created_at, updated_at, content_plain)
          VALUES(50, 'v1-wal', 1, 5, 'This note is still in the WAL');
      `);
      assert.ok(fs.statSync(v1Path + '-wal').size > 0);
      const migrated = new DatabaseService(v1Path);
      try {
        assert.equal(migrated.getMostRecentlyActiveNote()?.id, 'v1-wal');
        assert.equal(migrated.getNotePreviews({ search: 'still' })[0]?.id, 'v1-wal');
        assert.equal(migrated.getNoteById('v1-old')?.updated_at, 2);

        const backups = migrated.listMigrationBackups();
        assert.equal(backups.length, 1);
        assert.match(path.basename(backups[0]), /^version-one\.db\.pre-v3-.*\.bak$/);
        assert.equal(fs.statSync(backups[0]).mode & 0o777, 0o600);

        const restored = new Database(backups[0], { readonly: true });
        try {
          assert.equal(restored.pragma('user_version', { simple: true }), 1);
          assert.deepEqual(
            restored
              .prepare(
                `
            SELECT notes.rowid, notes.id FROM notes_fts JOIN notes ON notes.rowid = notes_fts.rowid
            WHERE notes_fts MATCH ?
          `
              )
              .get('still'),
            { rowid: 50, id: 'v1-wal' }
          );
        } finally {
          restored.close();
        }

        assert.equal(migrated.purgeMigrationBackups(), 1);
        assert.equal(migrated.listMigrationBackups().length, 0);
      } finally {
        migrated.close();
      }
    } finally {
      v1Writer.close();
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
