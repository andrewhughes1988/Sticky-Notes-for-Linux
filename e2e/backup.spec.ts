import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('exports recent edits and imports a JSON backup as a separate note', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sticky-backup-e2e-'));
  const file = path.join(root, 'backup.json');
  const app = await electron.launch({
    args: [...(process.env.CI ? ['--no-sandbox'] : []), '--ozone-platform=x11', '.'],
    cwd: process.cwd(),
    env: {
      ...process.env,
      XDG_DATA_HOME: path.join(root, 'data'),
      XDG_CONFIG_HOME: path.join(root, 'config'),
      XDG_STATE_HOME: path.join(root, 'state'),
    },
  });
  try {
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showSaveDialog = (async () => ({
        canceled: false,
        filePath,
      })) as typeof dialog.showSaveDialog;
      dialog.showOpenDialog = (async () => ({
        canceled: false,
        filePaths: [filePath],
      })) as typeof dialog.showOpenDialog;
    }, file);
    const note = await app.firstWindow();
    const editor = note.getByRole('textbox', { name: 'Note text' });
    await expect(editor).toBeVisible();
    const managerPromise = app.waitForEvent('window');
    await note.getByRole('button', { name: 'Note options' }).click();
    await note.getByRole('button', { name: 'Notes list' }).click();
    const manager = await managerPromise;
    await manager.waitForLoadState('domcontentloaded');
    await editor.click();
    await note.keyboard.press('Control+a');
    await note.keyboard.insertText('Backup newest text');
    const result = await manager.evaluate(() => window.stickyNotesAPI.exportNotes('json'));
    expect(result.exported).toBe(true);
    const saved = JSON.parse(fs.readFileSync(file, 'utf8')) as {
      notes: Array<{ content_plain: string }>;
    };
    expect(saved.notes.some((item) => item.content_plain.includes('Backup newest text'))).toBe(
      true
    );
    fs.appendFileSync(file, ' '.repeat(50_000_001));
    await expect(editor).not.toHaveAttribute('inert', '');
    const imported = await manager.evaluate(() => window.stickyNotesAPI.importNotes());
    expect(imported).toEqual({ imported: true, count: saved.notes.length });
    const previews = await manager.evaluate(() =>
      window.stickyNotesAPI.getNotePreviews({ search: 'Backup newest text' })
    );
    expect(previews).toHaveLength(2);
  } finally {
    await app.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
