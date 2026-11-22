import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { AutostartManager } from '../src/main/autostart';

test('Linux autostart writes separate, escaped desktop entry arguments', (context) => {
  const config = fs.mkdtempSync(path.join(os.tmpdir(), 'sticky-notes-autostart-'));
  const env = {
    XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
    APPIMAGE: process.env.APPIMAGE,
    FLATPAK_ID: process.env.FLATPAK_ID,
    SNAP_NAME: process.env.SNAP_NAME,
    SNAP_INSTANCE_NAME: process.env.SNAP_INSTANCE_NAME,
  };
  context.after(() => {
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    fs.rmSync(config, { recursive: true, force: true });
  });

  process.env.XDG_CONFIG_HOME = config;
  process.env.APPIMAGE = '/tmp/Sticky Notes "Dollar$" Back\\slash 100%.AppImage';
  const manager = new AutostartManager();
  const autostartDir = path.join(config, 'autostart');
  const entryPath = path.join(autostartDir, 'sticky-notes.desktop');
  const readExec = () => fs.readFileSync(entryPath, 'utf8').split('\n').find((line) => line.startsWith('Exec='));

  assert.equal(manager.isEnabled(), false);
  manager.setEnabled(true);
  assert.equal(manager.isEnabled(), true);
  assert.equal(
    readExec(),
    String.raw`Exec=/usr/bin/env -- "/tmp/Sticky Notes \\"Dollar\\$\\" Back\\\\slash 100%%.AppImage" --autostart`,
  );

  delete process.env.APPIMAGE;
  process.env.FLATPAK_ID = 'com.netsysprep.stickynotes';
  manager.setEnabled(true);
  assert.equal(readExec(), 'Exec=flatpak run com.netsysprep.stickynotes --autostart');
  delete process.env.FLATPAK_ID;

  process.env.SNAP_NAME = 'sticky-notes';
  process.env.SNAP_INSTANCE_NAME = 'sticky-notes_work';
  manager.setEnabled(true);
  assert.equal(readExec(), 'Exec=snap run sticky-notes_work --autostart');

  manager.setEnabled(false);
  manager.setEnabled(false);
  assert.equal(manager.isEnabled(), false);

  const userFile = path.join(config, 'user-file');
  fs.writeFileSync(userFile, 'keep this');
  fs.symlinkSync(userFile, entryPath);
  manager.setEnabled(true);
  assert.equal(fs.readFileSync(userFile, 'utf8'), 'keep this');
  assert.equal(fs.lstatSync(entryPath).isFile(), true);
  assert.deepEqual(fs.readdirSync(autostartDir), ['sticky-notes.desktop']);

  manager.setEnabled(false);
  fs.mkdirSync(entryPath);
  assert.throws(() => manager.setEnabled(true));
  assert.throws(() => manager.setEnabled(false));
  assert.deepEqual(fs.readdirSync(autostartDir), ['sticky-notes.desktop']);
});
