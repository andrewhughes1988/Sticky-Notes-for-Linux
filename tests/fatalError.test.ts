import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

for (const scenario of ['normal', 'log-fails', 'close-fails', 'exit-fails', 'reentrant']) {
  test(`fatal exception terminates with status 1: ${scenario}`, () => {
    const child = spawnSync(process.execPath, ['--import', 'tsx', 'tests/fixtures/fatal-error-child.ts', scenario], {
      encoding: 'utf8',
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      timeout: 5000,
    });
    assert.equal(child.status, 1, child.stderr);
    assert.match(child.stdout, /^logged\nclosed\n/, child.stderr);
    if (scenario !== 'reentrant') assert.match(child.stdout, /exit 1\n/);
    else assert.doesNotMatch(child.stdout, /exit 1/);
  });
}
