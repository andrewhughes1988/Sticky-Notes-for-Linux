import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('reports IPC failures and retries settings', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sticky-ipc-errors-'));
  const args = [
    ...(process.env.CI ? ['--no-sandbox'] : []),
    ...(process.env.DISPLAY ? ['--ozone-platform=x11'] : []),
    '.',
  ];
  const app = await electron.launch({
    args,
    cwd: process.cwd(),
    env: {
      ...process.env,
      XDG_DATA_HOME: path.join(root, 'data'),
      XDG_CONFIG_HOME: path.join(root, 'config'),
      XDG_STATE_HOME: path.join(root, 'state'),
    },
  });
  try {
    const note = await app.firstWindow();
    await expect(note.getByRole('textbox', { name: 'Note text' })).toBeVisible();
    await app.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('app:quit');
      ipcMain.handle('app:quit', () => {
        throw new Error('quit failed');
      });
      ipcMain.removeHandler('shell:openExternal');
      ipcMain.handle('shell:openExternal', () => {
        throw new Error('link failed');
      });
      ipcMain.removeHandler('backups:count');
      let backupAttempts = 0;
      ipcMain.handle('backups:count', () => {
        if (++backupAttempts === 1) throw new Error('backup lookup failed');
        return 0;
      });
      ipcMain.removeHandler('security:getEncryptionStatus');
      let encryptionAttempts = 0;
      ipcMain.handle('security:getEncryptionStatus', () => {
        if (++encryptionAttempts === 1) throw new Error('encryption lookup failed');
        return { enabled: false, available: true, backend: 'test' };
      });
    });
    await note.keyboard.press('Control+q');
    await expect(note.getByRole('alert')).toContainText('Could not quit Sticky Notes');
    const editor = note.getByRole('textbox', { name: 'Note text' });
    await editor.click();
    await note.keyboard.press('Control+a');
    await note.keyboard.type('https://example.com ');
    await note.locator('.note-editor-content a').click({ modifiers: ['Control'] });
    await expect(note.getByText('Could not open this link.')).toBeVisible();
    await note.getByRole('button', { name: 'Dismiss' }).click();
    await expect(note.getByText('Could not open this link.')).toHaveCount(0);
    const managerPromise = app.waitForEvent('window');
    await note.getByRole('button', { name: 'Note options' }).click();
    await note.getByRole('button', { name: 'Notes list' }).click();
    const manager = await managerPromise;
    await expect(manager.getByRole('alert')).toContainText(
      'Could not load backup information. Could not load encryption status.'
    );
    await manager.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(manager.getByText('Could not load encryption status.')).toHaveCount(0);
    await manager.getByRole('button', { name: 'Settings and actions' }).click();
    await expect(manager.getByRole('switch', { name: 'Encrypt at rest' })).toBeVisible();
    await manager.keyboard.press('Control+q');
    await expect(manager.getByRole('alert')).toContainText('Could not quit Sticky Notes');
  } finally {
    await app.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
