import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

test('packaged launcher selects a backend at launch and preserves explicit options', (context) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sticky-launch-'));
  context.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const launcher = path.join(dir, 'sticky-notes-linux');
  fs.copyFileSync('build/launch.sh', launcher);
  fs.chmodSync(launcher, 0o755);
  fs.writeFileSync(`${launcher}.bin`, '#!/bin/sh\nprintf "%s\\n" "$@"\n', { mode: 0o755 });
  const run = (env: NodeJS.ProcessEnv, args: string[] = []) =>
    execFileSync(launcher, args, { env: { PATH: process.env.PATH, ...env }, encoding: 'utf8' }).trim().split('\n');
  const wmClass = '--class=com.netsysprep.stickynotes';
  assert.deepEqual(run({ DISPLAY: ':0' }), [wmClass, '--ozone-platform=x11']);
  assert.deepEqual(run({ DISPLAY: ':0', WAYLAND_DISPLAY: 'wayland-0' }), [wmClass, '--ozone-platform=x11']);
  assert.deepEqual(run({ WAYLAND_DISPLAY: 'wayland-0' }), [wmClass, '--ozone-platform=wayland']);
  assert.deepEqual(run({ DISPLAY: ':0' }, ['--ozone-platform=wayland', 'a b']), [wmClass, '--ozone-platform=wayland', 'a b']);
  assert.deepEqual(run({ DISPLAY: ':0' }, ['--ozone-platform', 'wayland']), [wmClass, '--ozone-platform', 'wayland']);
});
