import { test, expect, _electron as electron } from '@playwright/test';
import path from 'node:path';

type TrayTest = {
  labels(): string[];
  click(label: string): void;
  clickTray(): void;
  setClosing(value: boolean): void;
  actions(): string[];
  destroy(): boolean;
};

test('tray actions open, show, hide, and stop creating notes during shutdown', async () => {
  const app = await electron.launch({
    args: [
      ...(process.env.CI ? ['--no-sandbox'] : []),
      path.join(process.cwd(), 'e2e/fixtures/tray.mjs'),
    ],
    cwd: process.cwd(),
  });
  try {
    const result = await app.evaluate(async () => {
      const tray = (globalThis as unknown as { trayTest: TrayTest }).trayTest;
      const labels = tray.labels();
      tray.clickTray();
      for (const label of ['New Note', 'Notes List', 'Show All Notes', 'Hide All Notes'])
        tray.click(label);
      tray.setClosing(true);
      tray.click('New Note');
      const actions = [...tray.actions()];
      const destroyed = tray.destroy();
      return { labels, actions, destroyed };
    });
    expect(result.labels).toEqual([
      'New Note',
      'Notes List',
      'Show All Notes',
      'Hide All Notes',
      'Quit Sticky Notes',
    ]);
    expect(result.actions).toEqual(['toggle', 'new', 'list', 'show', 'hide']);
    expect(result.destroyed).toBe(true);
  } finally {
    await app.close();
  }
});

test('tray quit action exits the application', async () => {
  const app = await electron.launch({
    args: [
      ...(process.env.CI ? ['--no-sandbox'] : []),
      path.join(process.cwd(), 'e2e/fixtures/tray.mjs'),
    ],
    cwd: process.cwd(),
  });
  const exited = new Promise<number | null>((resolve) => app.process().once('exit', resolve));
  await app
    .evaluate(() => {
      (globalThis as unknown as { trayTest: TrayTest }).trayTest.click('Quit Sticky Notes');
    })
    .catch(() => {});
  expect(await exited).toBe(0);
});
