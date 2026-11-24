import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatNoteExport } from '../src/main/noteExport';

const note = {
  id: 'id-1',
  title: '',
  color: 'yellow' as const,
  is_pinned: 1,
  created_at: 1,
  updated_at: 0,
  content_plain: 'Hello',
  content_html: '<p>Hello</p>',
};

test('exports portable JSON fields with boolean pin state', () => {
  const output = JSON.parse(formatNoteExport([note], 'json', '1.2.0', '2026-01-01T00:00:00.000Z'));
  assert.deepEqual(output, {
    exportedAt: '2026-01-01T00:00:00.000Z',
    version: '1.2.0',
    notes: [{ ...note, is_pinned: true }],
  });
});

test('exports Markdown with title fallback and note separators', () => {
  const output = formatNoteExport(
    [note, { ...note, title: 'Second' }],
    'markdown',
    '1.2.0',
    'ignored'
  );
  assert.equal(
    output,
    '# Untitled Note\n\n_Color: yellow | Updated: 1970-01-01T00:00:00.000Z_\n\nHello\n\n---\n\n# Second\n\n_Color: yellow | Updated: 1970-01-01T00:00:00.000Z_\n\nHello\n'
  );
});
