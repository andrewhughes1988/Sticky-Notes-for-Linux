import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('logs only bounded renderer error categories', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sticky-logging-'));
  const args = [
    ...(process.env.CI ? ['--no-sandbox'] : []),
    ...(process.env.DISPLAY ? ['--ozone-platform=x11'] : []),
    '.',
  ];
  const app = await electron.launch({
    args,
    env: {
      ...process.env,
      XDG_DATA_HOME: path.join(root, 'data'),
      XDG_CONFIG_HOME: path.join(root, 'config'),
      XDG_STATE_HOME: path.join(root, 'state'),
    },
  });
  try {
    const page = await app.firstWindow();
    await page.getByRole('textbox', { name: 'Note text' }).waitFor();
    await page.evaluate(async () => {
      await window.stickyNotesAPI.logRendererError('TypeError');
      await window.stickyNotesAPI.logRendererError('private note text');
      for (let i = 0; i < 8; i++) await window.stickyNotesAPI.logRendererError('Error');
    });
    const log = fs.readFileSync(path.join(root, 'state/sticky-notes/logs/app.log'), 'utf8');
    expect(log).toContain('Renderer error caught | TypeError');
    expect(log).not.toContain('private note text');
    expect(log.match(/Renderer error caught/g)).toHaveLength(5);
    await expect(page.evaluate(() => window.stickyNotesAPI.logRendererError('x'.repeat(65)))).rejects.toThrow();
  } finally {
    await app.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
