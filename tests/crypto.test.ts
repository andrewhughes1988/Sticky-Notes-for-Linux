import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import Database from 'better-sqlite3';
import { AesGcmNoteCipher, generateDataEncryptionKey } from '../src/main/crypto';
import { DatabaseService } from '../src/main/database';

test('AesGcmNoteCipher encrypts with unique IVs, authenticates AAD, and detects tampering', () => {
  const key = generateDataEncryptionKey();
  const cipher = new AesGcmNoteCipher(key);

  const enc1 = cipher.encrypt('Secret meeting notes', 'note-1:content_plain');
  const enc2 = cipher.encrypt('Secret meeting notes', 'note-1:content_plain');
  assert.ok(cipher.isEncrypted(enc1));
  assert.notEqual(enc1, enc2); // unique random 96-bit IV per write
  assert.equal(cipher.decrypt(enc1, 'note-1:content_plain'), 'Secret meeting notes');

  // Swapping AAD (different note or field) must fail authentication
  assert.throws(() => cipher.decrypt(enc1, 'note-2:content_plain'));
  assert.throws(() => cipher.decrypt(enc1, 'note-1:title'));

  // Wrong key must fail authentication
  const otherCipher = new AesGcmNoteCipher(generateDataEncryptionKey());
  assert.throws(() => otherCipher.decrypt(enc1, 'note-1:content_plain'));

  // Tampering with ciphertext byte must fail authentication
  const tampered = enc1.slice(0, -2) + (enc1.endsWith('AA') ? 'BB' : 'AA');
  assert.throws(() => cipher.decrypt(tampered, 'note-1:content_plain'));
});

test('DatabaseService encryption-at-rest eliminates plaintext on disk, preserves search, and toggles cleanly', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sticky-notes-enc-'));
  const dbPath = path.join(tempDir, 'encrypted.db');
  const secretPhrase = 'UltraSecretProjectPhoenix2026';

  try {
    const db = new DatabaseService(dbPath);
    const note = db.createNote({
      id: 'enc-note-1',
      title: 'Confidential',
      content_html: `<p>${secretPhrase}</p>`,
      content_plain: secretPhrase,
      color: 'yellow',
    });

    const key = generateDataEncryptionKey();
    const cipher = new AesGcmNoteCipher(key);
    db.enableEncryption(cipher, 'wrapped-key-blob');
    assert.equal(db.isEncryptionEnabled(), true);

    // Search, preview, read, update, soft-delete, and restore all work transparently while encrypted
    assert.equal(db.getNoteById(note.id)?.content_plain, secretPhrase);
    assert.equal(db.getNotePreviews({ search: 'Phoenix' })[0]?.id, note.id);
    assert.match(db.getNotePreviews({ search: 'Phoenix' })[0]?.preview ?? '', /Phoenix/);

    db.updateNote(note.id, {
      content_html: `<p>${secretPhrase} Updated</p>`,
      content_plain: `${secretPhrase} Updated`,
    });
    assert.equal(db.getNoteById(note.id)?.content_plain, `${secretPhrase} Updated`);

    db.deleteNote(note.id);
    assert.equal(db.getDeletedNotes().length, 1);
    assert.equal(db.getDeletedNotes()[0]?.preview, `${secretPhrase} Updated`);
    db.restoreNote(note.id);
    assert.equal(db.getNotePreviews({ search: 'Updated' })[0]?.id, note.id);

    db.close();

    // Verify raw SQLite file on disk contains ZERO plaintext occurrences of secretPhrase
    const rawFile = fs.readFileSync(dbPath);
    assert.equal(rawFile.includes(Buffer.from(secretPhrase, 'utf8')), false);

    // Verify raw SQLite notes table stores enc:v1: ciphertext and FTS5 table is empty
    const inspect = new Database(dbPath, { readonly: true });
    try {
      const row = inspect
        .prepare('SELECT title, content_html, content_plain FROM notes WHERE id = ?')
        .get(note.id) as { title: string; content_html: string; content_plain: string };
      assert.ok(row.title.startsWith('enc:v1:'));
      assert.ok(row.content_html.startsWith('enc:v1:'));
      assert.ok(row.content_plain.startsWith('enc:v1:'));
      assert.deepEqual(inspect.prepare('SELECT COUNT(*) AS n FROM notes_fts_docsize').get(), {
        n: 0,
      });
      assert.deepEqual(
        inspect.prepare('SELECT rowid FROM notes_fts WHERE notes_fts MATCH \'"Phoenix"\'').all(),
        []
      );
    } finally {
      inspect.close();
    }

    // Reopening encrypted DB fails closed until unlocked with the right cipher
    const lockedDb = new DatabaseService(dbPath);
    try {
      assert.equal(lockedDb.isEncryptionEnabled(), true);
      assert.throws(() => lockedDb.getNoteById(note.id), /locked/i);
      assert.throws(() =>
        lockedDb.unlockWithCipher(new AesGcmNoteCipher(generateDataEncryptionKey()))
      );

      lockedDb.unlockWithCipher(new AesGcmNoteCipher(key));
      assert.equal(lockedDb.getNoteById(note.id)?.content_plain, `${secretPhrase} Updated`);

      // Disabling encryption restores plaintext + FTS5 index cleanly
      lockedDb.disableEncryption();
      assert.equal(lockedDb.isEncryptionEnabled(), false);
      assert.equal(lockedDb.getNotePreviews({ search: 'Phoenix' })[0]?.id, note.id);
    } finally {
      lockedDb.close();
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
