import Database from 'better-sqlite3';
import { DatabaseService } from '../src/main/database';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';

console.log('--- TESTING DATABASE SERVICE ---');

const dbService = new DatabaseService(':memory:');

// 1. Create a note
const note1 = dbService.createNote({
  title: 'Test Note 1',
  content_html: '<div>Hello <b>Parrot Linux</b> Sticky Notes!</div>',
  content_plain: 'Hello Parrot Linux Sticky Notes!',
  color: 'yellow',
  pos_x: 100,
  pos_y: 200,
  width: 320,
  height: 340,
});
console.log('Created note 1:', note1.id, note1.title, note1.color);

// 2. Create a second note
const note2 = dbService.createNote({
  title: 'Grocery List',
  content_html: '<ul><li>Apples</li><li>Milk</li><li>Coffee</li></ul>',
  content_plain: 'Apples\nMilk\nCoffee',
  color: 'green',
  is_open: 0, // closed
});
console.log('Created note 2 (closed):', note2.id, note2.title, note2.color);

// 3. Test Full-Text Search (FTS5) - Single word, multi-word, and special characters
const searchResults = dbService.getAllNotes({ search: 'Parrot' });
console.log(`FTS search for 'Parrot' found ${searchResults.length} note(s). Match ID:`, searchResults[0]?.id);
if (searchResults.length !== 1 || searchResults[0]?.id !== note1.id) {
  throw new Error('FTS search test failed!');
}

const groceryResults = dbService.getAllNotes({ search: 'Coffee' });
console.log(`FTS search for 'Coffee' found ${groceryResults.length} note(s). Match ID:`, groceryResults[0]?.id);
if (groceryResults.length !== 1 || groceryResults[0]?.id !== note2.id) {
  throw new Error('FTS search test failed for grocery!');
}

// Test multi-word non-adjacent search (e.g. "Parrot Sticky")
const multiWordResults = dbService.getAllNotes({ search: 'Parrot Sticky' });
console.log(`FTS multi-word search for 'Parrot Sticky' found ${multiWordResults.length} note(s).`);
if (multiWordResults.length !== 1 || multiWordResults[0]?.id !== note1.id) {
  throw new Error('Multi-word search test failed!');
}

// Test special characters in search (e.g. quotes, colons, stars)
const specialCharResults = dbService.getAllNotes({ search: 'Parrot* "Sticky":' });
console.log(`FTS special char search found ${specialCharResults.length} note(s).`);
if (specialCharResults.length !== 1 || specialCharResults[0]?.id !== note1.id) {
  throw new Error('Special characters search test failed!');
}

// 4. Test Update
dbService.updateNote(note1.id, { color: 'purple', title: 'Updated Title' });
const updated = dbService.getNoteById(note1.id);
console.log('Updated note color:', updated?.color, 'Title:', updated?.title);
if (updated?.color !== 'purple' || updated?.title !== 'Updated Title') {
  throw new Error('Update test failed!');
}

// 5. Test Open Notes Query
const openNotes = dbService.getOpenNotes();
console.log('Open notes count (should be 1):', openNotes.length);
if (openNotes.length !== 1 || openNotes[0]?.id !== note1.id) {
  throw new Error('Open notes query failed!');
}

// 6. Test Geometry update
dbService.updateNoteBounds(note1.id, { x: 500, y: 400, width: 350, height: 400 });
const moved = dbService.getNoteById(note1.id);
console.log('Moved bounds:', moved?.pos_x, moved?.pos_y, moved?.width, moved?.height);
if (moved?.pos_x !== 500 || moved?.pos_y !== 400 || moved?.width !== 350 || moved?.height !== 400) {
  throw new Error('Geometry update failed!');
}

// 7. Test Delete
dbService.deleteNote(note1.id);
const deleted = dbService.getNoteById(note1.id);
console.log('Deleted note result (should be null):', deleted);
if (deleted !== null) {
  throw new Error('Delete test failed!');
}

// 8. Test Pagination (LIMIT & OFFSET)
for (let i = 0; i < 5; i++) {
  dbService.createNote({
    title: `Pagination Note ${i}`,
    content_plain: `Content ${i}`,
    color: 'yellow',
  });
}
const page1 = dbService.getAllNotes({ limit: 2, offset: 0 });
console.log('Pagination page 1 count (should be 2):', page1.length);
if (page1.length !== 2) throw new Error('Pagination page 1 failed!');

const page2 = dbService.getAllNotes({ limit: 2, offset: 2 });
console.log('Pagination page 2 count (should be 2):', page2.length);
if (page2.length !== 2 || page2[0].id === page1[0].id) throw new Error('Pagination page 2 failed!');

// Clean up
dbService.deleteNote(note2.id);
dbService.deleteNote(note1.id);
dbService.close();

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
  seed.createNote({ id: 'old', title: 'Forgotten', content_plain: 'hidden' });
  seed.createNote({ id: 'live', title: 'Blueberry', content_plain: 'Notebook' });
  seed.close();
  const legacy = new Database(dbPath);
  legacy.exec(`
    DROP TRIGGER notes_ai;
    DROP TRIGGER notes_au;
    DROP TRIGGER notes_ad;
    DROP INDEX idx_notes_page;
    DROP TABLE notes_fts;
    UPDATE notes SET deleted_at = 123 WHERE id = 'old';
    CREATE VIRTUAL TABLE notes_fts USING fts5(id UNINDEXED, content_plain, content='notes');
    INSERT INTO notes_fts(rowid, id, content_plain)
      SELECT rowid, id, content_plain FROM notes WHERE deleted_at IS NULL;
    PRAGMA user_version = 0;
  `);
  // Force an error after the migration has purged tombstones and dropped the old FTS table.
  legacy.exec('CREATE INDEX idx_notes_page ON notes(id)');
  assert.throws(() => new DatabaseService(dbPath), /idx_notes_page/);
  assert.equal(legacy.pragma('user_version', { simple: true }), 0);
  assert.deepEqual(legacy.prepare('SELECT COUNT(*) AS n FROM notes').get(), { n: 2 });
  assert.deepEqual(legacy.prepare("SELECT id FROM notes_fts WHERE notes_fts MATCH 'notebook'").get(), { id: 'live' });
  legacy.exec('DROP INDEX idx_notes_page');
  legacy.close();
  const upgraded = new DatabaseService(dbPath);
  const inspect = new Database(dbPath);
  const rowCount = inspect.prepare('SELECT count(*) AS n FROM notes');
  assert.deepEqual(rowCount.get(), { n: 1 });
  assert.equal(upgraded.getNotePreviews({ search: 'UEB oo' })[0]?.id, 'live');
  assert.equal(upgraded.getNotePreviews({ search: 'U' })[0]?.id, 'live');
  assert.deepEqual(upgraded.getNotePreviews({ search: '*:' }), []);
  const indexPages = inspect.prepare('SELECT id, block FROM notes_fts_data ORDER BY id');
  const beforeMetadata = indexPages.all();
  upgraded.updateNoteBounds('live', { x: 5, y: 9, width: 320, height: 340 });
  upgraded.updateNote('live', { color: 'blue', title: 'Blueberry' });
  assert.deepEqual(indexPages.all(), beforeMetadata);
  upgraded.updateNote('live', { title: 'Apricot' });
  assert.deepEqual(upgraded.getNotePreviews({ search: 'UEB' }), []);
  assert.equal(upgraded.getNotePreviews({ search: 'ric' })[0]?.id, 'live');
  upgraded.deleteNote('live');
  assert.deepEqual(rowCount.get(), { n: 0 });
  assert.deepEqual(upgraded.getNotePreviews({ search: 'ric' }), []);

  for (let i = 0; i < 105; i++) {
    upgraded.createNote({ id: String(i).padStart(3, '0'), updated_at: 123, content_plain: 'x'.repeat(700) });
  }
  const previews = upgraded.getNotePreviews({ limit: 1000 });
  assert.equal(previews.length, 101);
  assert.deepEqual(Object.keys(previews[0]).sort(), ['color', 'id', 'is_open', 'preview', 'updated_at']);
  assert.equal(previews[0].preview.length, 500);
  assert.equal(previews[100].id, '100');
  assert.equal(upgraded.getNotePreviews({ offset: 101 }).length, 4);
  assert.equal(upgraded.getNotePreviews().length, 50);
  inspect.exec('PRAGMA user_version = 100');
  assert.ok(fs.existsSync(dbPath + '-wal'));
  assert.throws(() => new DatabaseService(dbPath), /Unsupported notes database/);
  assert.ok(fs.existsSync(dbPath + '-wal'));
  assert.deepEqual(rowCount.get(), { n: 105 });
  upgraded.close();
  inspect.close();
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

console.log('--- ALL DATABASE TESTS PASSED SUCCESSFULLY! ---');
