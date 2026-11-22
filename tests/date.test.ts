import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatFriendlyDate } from '../src/renderer/utils/date';

test('formatFriendlyDate formats Today, Yesterday, same-year, and prior-year dates', () => {
  const now = new Date(2026, 10, 21, 15, 30, 0); // Nov 21, 2026 3:30 PM

  const today = new Date(2026, 10, 21, 9, 15, 0).getTime();
  assert.match(formatFriendlyDate(today, now), /^Today at /);

  const yesterday = new Date(2026, 10, 20, 18, 45, 0).getTime();
  assert.match(formatFriendlyDate(yesterday, now), /^Yesterday at /);

  const earlierThisYear = new Date(2026, 4, 5, 11, 0, 0).getTime();
  assert.match(formatFriendlyDate(earlierThisYear, now), /May 5 at /);

  const lastYear = new Date(2025, 1, 14, 8, 0, 0).getTime();
  assert.match(formatFriendlyDate(lastYear, now), /2025/);
  assert.ok(!formatFriendlyDate(lastYear, now).includes(' at '));
});
