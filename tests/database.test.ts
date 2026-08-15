import Database from 'better-sqlite3';
import { DatabaseService } from '../src/main/database';
import fs from 'node:fs';
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

// 3. Test Full-Text Search (FTS5)
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

// 7. Test Soft Delete
dbService.deleteNote(note1.id);
const deleted = dbService.getNoteById(note1.id);
console.log('Deleted note result (should be null):', deleted);
if (deleted !== null) {
  throw new Error('Soft delete test failed!');
}

// Clean up
dbService.deleteNote(note2.id, true);
dbService.deleteNote(note1.id, true);
dbService.close();

console.log('--- ALL DATABASE TESTS PASSED SUCCESSFULLY! ---');
