import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { WebContents } from 'electron';
import { EditorFlush } from '../src/main/editorFlush';

test('flush waits for the matching acknowledgement and joins concurrent requests', async () => {
  const sent: Array<[string, number | undefined]> = [];
  const contents = {
    send: (channel: string, id?: number) => sent.push([channel, id]),
    isDestroyed: () => false,
  } as unknown as WebContents;
  const flush = new EditorFlush(() => {});
  flush.markReady(contents);
  const first = flush.flush(contents);
  assert.equal(flush.flush(contents), first);
  assert.deepEqual(sent, [['editor:flush', 1]]);
  flush.acknowledge(contents, 2, true);
  flush.acknowledge(contents, 1, true);
  await first;
  flush.resumeAll();
  assert.deepEqual(sent, [
    ['editor:flush', 1],
    ['editor:resume', undefined],
  ]);
});

test('detaching a saving editor rejects the pending save and stops future flushes', async () => {
  const contents = { send: () => {}, isDestroyed: () => false } as unknown as WebContents;
  const flush = new EditorFlush(() => {});
  flush.markReady(contents);
  const pending = flush.flush(contents);
  flush.detach(contents);
  await assert.rejects(pending, /did not acknowledge/);
  await flush.flush(contents);
});
