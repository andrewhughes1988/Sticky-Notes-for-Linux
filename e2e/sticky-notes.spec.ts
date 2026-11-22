import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function createTempEnv() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sticky-notes-e2e-'));
  const dataHome = path.join(root, 'data');
  const configHome = path.join(root, 'config');
  const stateHome = path.join(root, 'state');
  fs.mkdirSync(dataHome, { recursive: true, mode: 0o700 });
  fs.mkdirSync(configHome, { recursive: true, mode: 0o700 });
  fs.mkdirSync(stateHome, { recursive: true, mode: 0o700 });
  return { root, dataHome, configHome, stateHome };
}

async function launchApp(envDirs: ReturnType<typeof createTempEnv>): Promise<ElectronApplication> {
  const args = process.env.CI ? ['--no-sandbox', '.'] : ['.'];
  return electron.launch({
    args,
    cwd: process.cwd(),
    env: {
      ...process.env,
      XDG_DATA_HOME: envDirs.dataHome,
      XDG_CONFIG_HOME: envDirs.configHome,
      XDG_STATE_HOME: envDirs.stateHome,
    },
  });
}

test('full lifecycle: create, edit with Tiptap, search, Trash/restore, tray persistence, and relaunch', async () => {
  const envDirs = createTempEnv();
  let app: ElectronApplication | undefined;

  try {
    app = await launchApp(envDirs);
    const noteWindow: Page = await app.firstWindow();
    await noteWindow.waitForLoadState('domcontentloaded');

    // 1. Verify accessible header & formatting toolbar buttons on initial Welcome note
    const editor = noteWindow.getByRole('textbox', { name: 'Note text' });
    await expect(editor).toBeVisible();
    await expect(noteWindow.getByRole('button', { name: 'New note' })).toBeVisible();
    await expect(noteWindow.getByRole('toolbar', { name: 'Text formatting' })).toBeVisible();

    // 1b. Toggle Pin Always-on-Top and verify BrowserWindow.isAlwaysOnTop() updates in main process
    const pinButton = noteWindow.getByRole('button', { name: 'Pin always on top' });
    await pinButton.click();
    await expect(noteWindow.getByRole('button', { name: 'Unpin from top' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    const isPinnedInMain = await app.evaluate(({ BrowserWindow }) => {
      const wins = BrowserWindow.getAllWindows();
      return wins.some((w) => w.isAlwaysOnTop());
    });
    expect(isPinnedInMain).toBe(true);
    await noteWindow.getByRole('button', { name: 'Unpin from top' }).click();

    // 2. Type unique text and toggle Bold + Checklist via accessible toolbar buttons
    await editor.click();
    await noteWindow.keyboard.press('Control+a');
    await noteWindow.keyboard.press('Backspace');
    await noteWindow.keyboard.type('Playwright E2E Checklist Item');
    await noteWindow.getByRole('button', { name: 'Checklist' }).click();
    await expect(noteWindow.locator('ul[data-type="taskList"] input[type="checkbox"]')).toBeVisible();

    // Wait for autosave idle window (300ms + margin)
    await noteWindow.waitForTimeout(500);

    // 3. Create a second note via Ctrl+N keyboard shortcut
    const secondWindowPromise = app.waitForEvent('window');
    await noteWindow.keyboard.press('Control+n');
    const secondWindow = await secondWindowPromise;
    await secondWindow.waitForLoadState('domcontentloaded');
    const secondEditor = secondWindow.getByRole('textbox', { name: 'Note text' });
    await expect(secondEditor).toBeVisible();
    await secondEditor.click();
    await secondWindow.keyboard.type('Second Note To Trash');
    await secondWindow.waitForTimeout(500);

    // 4. Open Notes Manager from Note Options menu
    const managerPromise = app.waitForEvent('window');
    await secondWindow.getByRole('button', { name: 'Note options' }).click();
    await secondWindow.getByRole('button', { name: 'Notes list' }).click();
    const managerWindow = await managerPromise;
    await managerWindow.waitForLoadState('domcontentloaded');

    // 5. Search for the first note in Manager
    const searchInput = managerWindow.getByRole('textbox', { name: 'Search notes' });
    await searchInput.fill('Playwright E2E');
    await expect(
      managerWindow.getByRole('button', { name: /Open note: Playwright E2E Checklist Item/ })
    ).toBeVisible();

    // Clear search with Escape
    await searchInput.press('Escape');
    await expect(searchInput).toHaveValue('');

    // 6. Soft-delete the second note to Trash, then restore it
    await managerWindow.getByRole('button', { name: /Move note to Trash: Second Note To Trash/ }).click();
    await managerWindow.getByRole('button', { name: 'Move to Trash' }).click();
    await expect(
      managerWindow.getByRole('button', { name: /Open note: Second Note To Trash/ })
    ).toHaveCount(0);

    await managerWindow.getByRole('button', { name: 'Open Trash' }).click();
    await expect(managerWindow.getByText('Second Note To Trash')).toBeVisible();
    await managerWindow.getByRole('button', { name: 'Restore' }).click();
    await managerWindow.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(
      managerWindow.getByRole('button', { name: /Open note: Second Note To Trash/ })
    ).toBeVisible();

    // 7. Quit cleanly and relaunch to verify persistence
    await app.close();
    app = await launchApp(envDirs);
    const restoredWindow = await app.firstWindow();
    await restoredWindow.waitForLoadState('domcontentloaded');
    await expect(restoredWindow.getByRole('textbox', { name: 'Note text' })).toContainText(
      'Playwright E2E Checklist Item'
    );
  } finally {
    if (app) {
      await app.close().catch(() => {});
    }
    fs.rmSync(envDirs.root, { recursive: true, force: true });
  }
});
