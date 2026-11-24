import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

function runLogger(stateHome: string) {
  return spawnSync(process.execPath, ['--import', 'tsx', 'tests/fixtures/logger-child.ts'], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', XDG_STATE_HOME: stateHome },
    encoding: 'utf8',
  });
}

test('logger writes private files, records errors, and keeps bounded rotated files', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sticky-logger-'));
  try {
    const dir = path.join(root, 'sticky-notes', 'logs');
    fs.mkdirSync(dir, { recursive: true });
    const log = path.join(dir, 'app.log');
    fs.writeFileSync(log, Buffer.alloc(1_048_576, 'a'), { mode: 0o600 });
    fs.writeFileSync(`${log}.1`, 'older');
    fs.writeFileSync(`${log}.2`, 'oldest');
    fs.writeFileSync(`${log}.3`, 'discarded');
    const result = runLogger(root);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.statSync(log).mode & 0o777, 0o600);
    assert.match(fs.readFileSync(log, 'utf8'), /\[INFO\] first log entry/);
    assert.match(fs.readFileSync(log, 'utf8'), /\[ERROR\] third log entry.*expected detail/);
    assert.equal(fs.statSync(`${log}.1`).size, 1_048_576);
    assert.equal(fs.readFileSync(`${log}.2`, 'utf8'), 'older');
    assert.equal(fs.readFileSync(`${log}.3`, 'utf8'), 'oldest');
    assert.equal(fs.existsSync(`${log}.4`), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('logger does not throw when its directory is unavailable', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sticky-logger-'));
  try {
    fs.writeFileSync(path.join(root, 'sticky-notes'), 'not a directory');
    const result = runLogger(root);
    assert.equal(result.status, 0, result.stderr);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
