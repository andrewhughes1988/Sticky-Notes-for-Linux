import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  readColor,
  readExportFormat,
  readFields,
  readInteger,
  readText,
  readTheme,
  validateNoteUpdates,
} from '../src/main/ipcHandlers';

test('IPC field validators reject malformed objects, prototype keys, and out-of-range inputs', () => {
  assert.deepEqual(readFields({ color: 'yellow' }, ['color']), { color: 'yellow' });
  assert.throws(() => readFields(null, ['color']));
  assert.throws(() => readFields([], ['color']));
  assert.throws(() => readFields({ color: 'yellow', extra: 1 }, ['color']));

  assert.equal(readColor('charcoal'), 'charcoal');
  assert.throws(() => readColor('toString'));
  assert.throws(() => readColor('neon'));

  assert.equal(readTheme('system'), 'system');
  assert.equal(readTheme('dark'), 'dark');
  assert.equal(readTheme('light'), 'light');
  assert.throws(() => readTheme('auto'));

  assert.equal(readText('hello', 10), 'hello');
  assert.throws(() => readText('123456', 5));
  assert.throws(() => readText(42, 10));

  assert.equal(readInteger(50, 1, 101), 50);
  assert.throws(() => readInteger(0, 1, 101));
  assert.throws(() => readInteger(102, 1, 101));
  assert.throws(() => readInteger(1.5, 1, 101));

  assert.equal(readExportFormat('json'), 'json');
  assert.equal(readExportFormat('markdown'), 'markdown');
  assert.throws(() => readExportFormat('html'));
});

test('validateNoteUpdates sanitizes content_html in main process and enforces required fields', () => {
  assert.throws(() => validateNoteUpdates({}));
  assert.throws(() => validateNoteUpdates({ title: 'injected' }));
  assert.throws(() => validateNoteUpdates({ content_html: '<p>only html</p>' }));

  const valid = validateNoteUpdates({
    color: 'blue',
    content_html: '<p>Safe</p><script>alert(1)</script><input type="file">',
    content_plain: 'Safe',
  });
  assert.equal(valid.color, 'blue');
  assert.equal(valid.content_html, '<p>Safe</p>');
  assert.equal(valid.content_plain, 'Safe');
});
