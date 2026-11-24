import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseBackup, snapshotAfterFlush } from '../src/main/backupImport';
import { DatabaseService } from '../src/main/database';

const backup = {
  notes: [
    {
      id: 'existing',
      title: 'Hello',
      color: 'green',
      is_pinned: true,
      created_at: 1000,
      updated_at: 2000,
      content_plain: 'Hello',
      content_html: '<p>Hello<script>alert(1)</script></p>',
    },
  ],
};

test('imports sanitized copies without overwriting existing notes', () => {
  const db = new DatabaseService(':memory:');
  try {
    db.createNote({ id: 'existing', title: 'Original', is_open: 0 });
    db.importNotes(parseBackup(backup));
    const all = db.getAllNotes();
    assert.equal(all.length, 2);
    assert.equal(db.getNoteById('existing')?.title, 'Original');
    const imported = all.find((note) => note.id !== 'existing');
    assert.equal(imported?.content_html, '<p>Hello</p>');
    assert.equal(imported?.is_open, 0);
    assert.equal(imported?.is_pinned, 1);
    assert.equal(imported?.created_at, 1000);
  } finally {
    db.close();
  }
});

test('rejects malformed backups before writing any notes', () => {
  const db = new DatabaseService(':memory:');
  try {
    const invalid = { notes: [...backup.notes, { ...backup.notes[0], color: 'invalid' }] };
    assert.throws(() => db.importNotes(parseBackup(invalid)));
    assert.equal(db.getAllNotes().length, 0);
    assert.throws(() => parseBackup({ notes: 'wrong' }));
  } finally {
    db.close();
  }
});

test('accepts exports with more than 10,000 notes and legacy long text', () => {
  const longNote = {
    ...backup.notes[0],
    title: 't'.repeat(1001),
    content_plain: 'p'.repeat(1_000_001),
    content_html: `<p>${'h'.repeat(2_000_001)}</p>`,
  };
  const notes = Array.from({ length: 10_001 }, () => backup.notes[0]);
  notes[10_000] = longNote;
  const imported = parseBackup({ notes });
  assert.equal(imported.length, 10_001);
  assert.equal(imported[10_000].title, longNote.title);
  assert.equal(imported[10_000].content_plain, longNote.content_plain);
  assert.equal(imported[10_000].content_html, longNote.content_html);
});

test('snapshots only after save and resumes editors after success or failure', async () => {
  let saved = 'old';
  let resumed = 0;
  const snapshot = await snapshotAfterFlush(
    async () => {
      saved = 'new';
    },
    () => saved,
    () => {
      resumed++;
    }
  );
  assert.equal(snapshot, 'new');
  assert.equal(resumed, 1);
  await assert.rejects(
    snapshotAfterFlush(
      async () => {
        throw new Error('failed');
      },
      () => saved,
      () => {
        resumed++;
      }
    )
  );
  assert.equal(resumed, 2);
});

test('rolls back all imports if a later insert fails', () => {
  const db = new DatabaseService(':memory:');
  try {
    const notes = parseBackup({ notes: [...backup.notes, backup.notes[0]] });
    const create = db.createNote.bind(db);
    let calls = 0;
    db.createNote = (note) => {
      if (++calls === 2) throw new Error('disk error');
      return create(note);
    };
    assert.throws(() => db.importNotes(notes));
    assert.equal(db.getAllNotes().length, 0);
  } finally {
    db.close();
  }
});
