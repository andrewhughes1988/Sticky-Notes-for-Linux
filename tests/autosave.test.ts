import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Autosave, AutosaveTimer } from '../src/renderer/utils/autosave';

test('close joins the pending save and waits for edits made during that save', async () => {
  const autosave = new Autosave();
  let release!: () => void;
  const firstWrite = new Promise<void>(resolve => { release = resolve; });
  let body = 'first';
  const writes: string[] = [];
  const write = async () => {
    writes.push(body);
    if (writes.length === 1) await firstWrite;
  };
  autosave.edited();
  const save = autosave.flush(write);
  body = 'second';
  autosave.edited();
  const close = autosave.flush(write);
  assert.deepEqual(writes, ['first']);
  release();
  await Promise.all([save, close]);
  assert.deepEqual(writes, ['first', 'second']);
  await autosave.flush(write);
  assert.equal(writes.length, 2);
});

test('failed writes remain dirty and retry captures the latest body', async () => {
  const autosave = new Autosave();
  autosave.edited();
  await assert.rejects(autosave.flush(() => { throw new Error('disk full'); }));
  autosave.edited();
  let writes = 0;
  await autosave.flush(async () => { writes++; });
  await autosave.flush(async () => { writes++; });
  assert.equal(writes, 1);
});

test('continuous edits save at the deadline and then return to the idle delay', ({ mock }) => {
  mock.timers.enable({ apis: ['setTimeout'] });
  let now = 0;
  const timer = new AutosaveTimer(() => now);
  const save = mock.fn();
  const advance = (ms: number) => {
    now += ms;
    mock.timers.tick(ms);
  };

  timer.schedule(save);
  for (let edit = 0; edit < 9; edit++) {
    advance(200);
    timer.schedule(save);
  }
  advance(199);
  assert.equal(save.mock.callCount(), 0);
  advance(1);
  assert.equal(save.mock.callCount(), 1);

  timer.schedule(save);
  advance(299);
  assert.equal(save.mock.callCount(), 1);
  advance(1);
  assert.equal(save.mock.callCount(), 2);
});

test('IME composition pauses the timer and saves promptly when composition ends', ({ mock }) => {
  mock.timers.enable({ apis: ['setTimeout'] });
  let now = 0;
  const timer = new AutosaveTimer(() => now);
  const save = mock.fn();

  timer.schedule(save);
  timer.pause();
  now = 3000;
  mock.timers.tick(now);
  assert.equal(save.mock.callCount(), 0);

  timer.schedule(save);
  mock.timers.tick(1);
  assert.equal(save.mock.callCount(), 1);
});
