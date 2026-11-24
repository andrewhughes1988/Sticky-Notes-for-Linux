import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatFriendlyDate } from '../src/renderer/utils/date';

test('formats relative days and dates in the requested locale', () => {
  const now = new Date(2026, 10, 21, 15, 30);
  assert.match(
    formatFriendlyDate(new Date(2026, 10, 21, 9, 15).getTime(), now, 'en-US'),
    /^today, /i
  );
  assert.match(
    formatFriendlyDate(new Date(2026, 10, 20, 9, 15).getTime(), now, 'fr-FR'),
    /^hier, /i
  );
  assert.match(formatFriendlyDate(new Date(2026, 4, 5, 11, 0).getTime(), now, 'en-US'), /May 5/);
  assert.match(formatFriendlyDate(new Date(2025, 1, 14, 8, 0).getTime(), now, 'en-US'), /2025/);
});
