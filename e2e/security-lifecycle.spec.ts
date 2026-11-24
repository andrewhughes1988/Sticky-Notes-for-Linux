import { test, expect, _electron as electron, ElectronApplication } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('notes enforce isolation and the manager controls note access', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sticky-security-e2e-'));
  let app: ElectronApplication | undefined;
  try {
    app = await electron.launch({
      args: [...(process.env.CI ? ['--no-sandbox'] : []), '--ozone-platform=x11', '.'],
      cwd: process.cwd(),
      env: {
        ...process.env,
        XDG_DATA_HOME: path.join(root, 'data'),
        XDG_CONFIG_HOME: path.join(root, 'config'),
        XDG_STATE_HOME: path.join(root, 'state'),
      },
    });
    const first = await app.firstWindow();
    await expect(first.getByRole('textbox', { name: 'Note text' })).toBeVisible();
    const firstId = await first.evaluate(() => window.stickyNotesAPI.noteId);
    expect(firstId).toBeTruthy();
    const secondPromise = app.waitForEvent('window');
    await first.getByRole('button', { name: 'New note' }).click();
    const second = await secondPromise;
    await expect(second.getByRole('textbox', { name: 'Note text' })).toBeVisible();
    const secondId = await second.evaluate(() => window.stickyNotesAPI.noteId);
    expect(secondId).toBeTruthy();
    expect(secondId).not.toBe(firstId);
    const own = await first.evaluate((id) => window.stickyNotesAPI.getNote(id!), firstId);
    expect(own?.id).toBe(firstId);
    await expect(
      first.evaluate((id) => window.stickyNotesAPI.getNote(id!), secondId)
    ).rejects.toThrow();
    await expect(
      first.evaluate((id) => window.stickyNotesAPI.updateNote(id!, { color: 'blue' }), secondId)
    ).rejects.toThrow();
    await expect(first.evaluate(() => window.stickyNotesAPI.getNotePreviews({}))).rejects.toThrow();
    const managerPromise = app.waitForEvent('window');
    await first.getByRole('button', { name: 'Note options' }).click();
    await first.getByRole('button', { name: 'Notes list' }).click();
    const manager = await managerPromise;
    await expect(manager.getByRole('textbox', { name: 'Search notes' })).toBeVisible();
    const previews = await manager.evaluate(() => window.stickyNotesAPI.getNotePreviews({}));
    expect(previews.some((note) => note.id === firstId)).toBe(true);
    expect(previews.some((note) => note.id === secondId)).toBe(true);
    await expect(
      manager.evaluate((id) => window.stickyNotesAPI.getNote(id!), firstId)
    ).rejects.toThrow();

    const untrusted = await app.evaluate(
      async ({ BrowserWindow }, preload) => {
        const window = new BrowserWindow({
          show: false,
          webPreferences: { preload, sandbox: true, contextIsolation: true },
        });
        try {
          await window.loadURL('data:text/html,<html><body>untrusted</body></html>');
          return await window.webContents.executeJavaScript(
            `window.stickyNotesAPI.getNotePreviews({}).then(() => 'allowed', () => 'denied')`
          );
        } finally {
          window.destroy();
        }
      },
      path.join(process.cwd(), 'dist-electron/preload/preload.js')
    );
    expect(untrusted).toBe('denied');
  } finally {
    if (app) await app.close().catch(() => {});
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('closing a note saves pending editor changes', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sticky-flush-e2e-'));
  let app: ElectronApplication | undefined;
  try {
    app = await electron.launch({
      args: [...(process.env.CI ? ['--no-sandbox'] : []), '--ozone-platform=x11', '.'],
      cwd: process.cwd(),
      env: {
        ...process.env,
        XDG_DATA_HOME: path.join(root, 'data'),
        XDG_CONFIG_HOME: path.join(root, 'config'),
        XDG_STATE_HOME: path.join(root, 'state'),
      },
    });
    const note = await app.firstWindow();
    const editor = note.getByRole('textbox', { name: 'Note text' });
    await expect(editor).toBeVisible();
    const noteId = await note.evaluate(() => window.stickyNotesAPI.noteId);
    await note.getByRole('button', { name: 'Note options' }).click();
    const managerPromise = app.waitForEvent('window');
    await note.getByRole('button', { name: 'Notes list' }).click();
    const manager = await managerPromise;
    await expect(manager.getByRole('textbox', { name: 'Search notes' })).toBeVisible();
    await editor.fill('Latest unsaved note text');
    await Promise.all([
      note.waitForEvent('close'),
      note
        .evaluate((id) => {
          void window.stickyNotesAPI.closeNoteWindow(id!);
        }, noteId)
        .catch(() => {}),
    ]);
    await expect
      .poll(
        async () =>
          (await manager.evaluate(() => window.stickyNotesAPI.getNotePreviews({}))).find(
            (n) => n.id === noteId
          )?.preview
      )
      .toContain('Latest unsaved note text');
  } finally {
    if (app) await app.close().catch(() => {});
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('note and manager controls expose their state and perform their actions', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sticky-controls-e2e-'));
  let app: ElectronApplication | undefined;
  try {
    app = await electron.launch({
      args: [...(process.env.CI ? ['--no-sandbox'] : []), '--ozone-platform=x11', '.'],
      cwd: process.cwd(),
      env: {
        ...process.env,
        XDG_DATA_HOME: path.join(root, 'data'),
        XDG_CONFIG_HOME: path.join(root, 'config'),
        XDG_STATE_HOME: path.join(root, 'state'),
      },
    });
    const note = await app.firstWindow();
    const editor = note.getByRole('textbox', { name: 'Note text' });
    await expect(editor).toBeVisible();
    await editor.fill('A control test note');
    const bold = note.getByRole('button', { name: 'Bold', exact: true });
    await bold.click();
    await expect(bold).toHaveAttribute('aria-pressed', 'true');
    await bold.click();
    await expect(bold).toHaveAttribute('aria-pressed', 'false');

    const options = note.getByRole('button', { name: 'Note options' });
    await options.click();
    const picker = note.getByRole('dialog', { name: 'Note options' });
    await expect(picker.getByRole('button', { name: 'Yellow' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await picker.getByRole('button', { name: 'Blue' }).click();
    await expect(note.locator('.note-container')).toHaveAttribute('data-color', 'blue');
    await options.click();
    await expect(picker.getByRole('button', { name: 'Blue' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await note.keyboard.press('Escape');
    await expect(picker).toHaveCount(0);
    await expect(options).toBeFocused();

    const managerPromise = app.waitForEvent('window');
    await options.click();
    await picker.getByRole('button', { name: 'Notes list' }).click();
    const manager = await managerPromise;
    const card = manager.getByRole('button', { name: /Open note: A control test note/ });
    await expect(card).toBeVisible();
    const menuButton = manager.getByRole('button', { name: 'Settings and actions' });
    await menuButton.click();
    const dark = manager.getByRole('switch', { name: 'Dark mode' });
    const initialDark = await dark.getAttribute('aria-checked');
    await dark.click();
    await expect(dark).toHaveAttribute('aria-checked', initialDark === 'true' ? 'false' : 'true');
    await manager.keyboard.press('Escape');
    await expect(menuButton).toBeFocused();

    await manager.getByRole('button', { name: /Move note to Trash: A control test note/ }).click();
    const dialog = manager.getByRole('alertdialog', { name: 'Move note to Trash?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).not.toBeVisible();
    await expect(card).toBeVisible();
  } finally {
    if (app) await app.close().catch(() => {});
    fs.rmSync(root, { recursive: true, force: true });
  }
});
