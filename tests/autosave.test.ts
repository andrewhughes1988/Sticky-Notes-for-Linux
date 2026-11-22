import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Autosave } from '../src/renderer/utils/autosave';

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
