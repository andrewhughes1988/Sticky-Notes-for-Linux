import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseService } from '../src/main/database';
import { AesGcmNoteCipher, generateDataEncryptionKey } from '../src/main/crypto';

test('encrypted search stays current through note changes and encryption transitions', () => {
  const db = new DatabaseService(':memory:');
  const cipher = new AesGcmNoteCipher(generateDataEncryptionKey());
  try {
    db.createNote({ id: 'a', title: 'First', content_plain: 'orchid alpha', is_open: 0, updated_at: 100 });
    db.createNote({ id: 'b', title: 'Second', content_plain: 'orchid beta', is_open: 1, updated_at: 200 });
    const before = db.getNotePreviews({ search: 'orchid' });
    db.enableEncryption(cipher, 'wrapped');
    assert.deepEqual(db.getNotePreviews({ search: 'orchid' }), before);
    assert.deepEqual(db.getNotePreviews({ search: 'orchid', limit: 1, offset: 1 }).map(n => n.id), ['a']);
    assert.deepEqual(db.getAllNotes({ search: 'orchid', limit: 1 }).map(n => n.id), ['b']);
    assert.deepEqual(db.getNotePreviews({ search: 'orchid', includeClosed: false }).map(n => n.id), ['b']);
    db.createNote({ id: 'c', title: 'Third', content_plain: 'orchid gamma', is_open: 0, updated_at: 300 });
    assert.deepEqual(db.getNotePreviews({ search: 'orchid' }).map(n => n.id), ['c', 'b', 'a']);
    db.updateNote('a', { content_plain: 'violet alpha', color: 'blue', updated_at: 400 });
    assert.deepEqual(db.getNotePreviews({ search: 'orchid' }).map(n => n.id), ['c', 'b']);
    assert.equal(db.getNotePreviews({ search: 'violet' })[0].color, 'blue');
    db.setNoteOpenState('a', true);
    assert.equal(db.getNotePreviews({ search: 'violet', includeClosed: false }).length, 1);
    assert.equal(db.toggleNotePin('a'), true);
    assert.equal(db.getNotePreviews({ search: 'violet' })[0].is_pinned, 1);
    db.deleteNote('a');
    assert.equal(db.getNotePreviews({ search: 'violet' }).length, 0);
    assert.equal(db.restoreNote('a'), true);
    assert.equal(db.getNotePreviews({ search: 'violet' }).length, 1);
    db.deleteNote('a');
    db.permanentlyDeleteNote('a');
    assert.equal(db.getNotePreviews({ search: 'violet' }).length, 0);
    db.deleteNote('c');
    db.emptyTrash();
    assert.deepEqual(db.getNotePreviews({ search: 'orchid' }).map(n => n.id), ['b']);
    db.disableEncryption();
    assert.deepEqual(db.getNotePreviews({ search: 'orchid' }).map(n => n.id), ['b']);
    db.enableEncryption(cipher, 'wrapped');
    assert.deepEqual(db.getNotePreviews({ search: 'orchid' }).map(n => n.id), ['b']);
  } finally {
    db.close();
  }
});

test('a rolled-back outer transaction cannot leave imported notes in encrypted search', () => {
  const db = new DatabaseService(':memory:');
  try {
    db.createNote({ id: 'existing', content_plain: 'original' });
    db.enableEncryption(new AesGcmNoteCipher(generateDataEncryptionKey()), 'wrapped');
    db.getNotePreviews({ search: 'original' });
    const sqlite = (db as unknown as { db: import('better-sqlite3').Database }).db;
    assert.throws(() => sqlite.transaction(() => {
      db.createNote({ id: 'imported', content_plain: 'imported orchid' });
      throw new Error('simulate later import failure');
    })());
    assert.deepEqual(db.getNotePreviews({ search: 'imported' }), []);
    assert.deepEqual(db.getNotePreviews({ search: 'original' }).map(n => n.id), ['existing']);
  } finally {
    db.close();
  }
});

test('encrypted search is available only after reopening and unlocking', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sticky-search-'));
  const file = path.join(directory, 'notes.db');
  const cipher = new AesGcmNoteCipher(generateDataEncryptionKey());
  try {
    const first = new DatabaseService(file);
    first.createNote({ id: 'private', content_plain: 'secret orchid' });
    first.enableEncryption(cipher, 'wrapped');
    assert.equal(first.getNotePreviews({ search: 'orchid' }).length, 1);
    first.close();
    const reopened = new DatabaseService(file);
    try {
      assert.throws(() => reopened.getNotePreviews({ search: 'orchid' }), /locked/);
      reopened.unlockWithCipher(cipher);
      assert.deepEqual(reopened.getNotePreviews({ search: 'orchid' }).map(n => n.id), ['private']);
    } finally {
      reopened.close();
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
