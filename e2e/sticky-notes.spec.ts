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
  const args: string[] = [];
  if (process.env.CI) args.push('--no-sandbox');
  if (process.env.DISPLAY) args.push('--ozone-platform=x11');
  args.push('--class=com.netsysprep.stickynotes', '.');
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

interface CspViolation {
  violatedDirective: string;
  effectiveDirective: string;
  sourceFile: string;
}

function installCspMonitor(): void {
  const win = window as unknown as { __cspViolations?: CspViolation[] };
  win.__cspViolations = [];
  window.addEventListener('securitypolicyviolation', (event) => {
    win.__cspViolations?.push({
      violatedDirective: event.violatedDirective,
      effectiveDirective: event.effectiveDirective,
      sourceFile: event.sourceFile,
    });
  });
}

async function attachCspMonitor(app: ElectronApplication): Promise<void> {
  await app.context().addInitScript(installCspMonitor);
}

async function ensureFirstWindowCspMonitor(page: Page): Promise<void> {
  await page.addInitScript(installCspMonitor);
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
}

function trackConsoleErrors(page: Page, errors: string[]): void {
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
}

async function assertNoCspViolations(page: Page, label: string): Promise<void> {
  const violations = await page.evaluate(() => {
    const win = window as unknown as { __cspViolations?: unknown };
    return win.__cspViolations;
  });
  expect(Array.isArray(violations), `CSP monitor was not active in ${label}`).toBe(true);
  expect(violations, `CSP violations in ${label}`).toEqual([]);
}

test('full lifecycle: create, edit with Tiptap, search, Trash/restore, tray persistence, and relaunch', async () => {
  const envDirs = createTempEnv();
  let app: ElectronApplication | undefined;
  const consoleErrors: string[] = [];

  try {
    app = await launchApp(envDirs);
    await attachCspMonitor(app);
    const noteWindow: Page = await app.firstWindow();
    trackConsoleErrors(noteWindow, consoleErrors);
    await ensureFirstWindowCspMonitor(noteWindow);

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
    await expect(
      noteWindow.locator('ul[data-type="taskList"] input[type="checkbox"]')
    ).toBeVisible();

    await editor.press('End');
    await editor.press('Enter');
    await noteWindow.keyboard.type('Another checklist item');
    const checkboxes = noteWindow.getByRole('checkbox', { name: 'Toggle checklist item' });
    await expect(checkboxes).toHaveCount(2);
    await editor.press('Control+a');
    await checkboxes.first().click();
    await expect(checkboxes.first()).toBeChecked();
    await expect(checkboxes.nth(1)).toBeChecked();
    await editor.press('Control+a');
    await checkboxes.first().click();
    await expect(checkboxes.first()).not.toBeChecked();
    await expect(checkboxes.nth(1)).not.toBeChecked();

    // 2b. Open color picker and switch note color
    await noteWindow.getByRole('button', { name: 'Note options' }).click();
    await noteWindow.getByRole('button', { name: 'Blue' }).click();
    await expect(noteWindow.locator('.note-container')).toHaveAttribute('data-color', 'blue');

    await expect.poll(() => noteWindow.evaluate(async () => {
      const api = window.stickyNotesAPI;
      return (await api.getNote(api.noteId!))?.content_plain;
    })).toContain('Playwright E2E Checklist Item');

    // 3. Create a second note via Ctrl+N keyboard shortcut
    const secondWindowPromise = app.waitForEvent('window');
    await noteWindow.keyboard.press('Control+n');
    const secondWindow = await secondWindowPromise;
    trackConsoleErrors(secondWindow, consoleErrors);
    await secondWindow.waitForLoadState('domcontentloaded');
    const secondEditor = secondWindow.getByRole('textbox', { name: 'Note text' });
    await expect(secondEditor).toBeVisible();
    await secondEditor.click();
    await secondWindow.keyboard.type('Second Note To Trash');

    await expect.poll(() => secondWindow.evaluate(async () => {
      const api = window.stickyNotesAPI;
      return (await api.getNote(api.noteId!))?.content_plain;
    })).toContain('Second Note To Trash');

    const thirdWindowPromise = app.waitForEvent('window');
    await secondWindow.keyboard.press('Control+n');
    const thirdWindow = await thirdWindowPromise;
    const thirdEditor = thirdWindow.getByRole('textbox', { name: 'Note text' });
    await expect(thirdEditor).toBeVisible();
    await thirdEditor.fill('Permanently Remove Me');
    await expect.poll(() => thirdWindow.evaluate(async () => {
      const api = window.stickyNotesAPI;
      return (await api.getNote(api.noteId!))?.content_plain;
    })).toContain('Permanently Remove Me');

    // 4. Open Notes Manager from Note Options menu
    const managerPromise = app.waitForEvent('window');
    await secondWindow.getByRole('button', { name: 'Note options' }).click();
    await secondWindow.getByRole('button', { name: 'Notes list' }).click();
    const managerWindow = await managerPromise;
    trackConsoleErrors(managerWindow, consoleErrors);
    await managerWindow.waitForLoadState('domcontentloaded');
    await assertNoCspViolations(secondWindow, 'secondWindow');

    // 5. Search for the first note in Manager
    const searchInput = managerWindow.getByRole('textbox', { name: 'Search notes' });
    await searchInput.fill('Playwright E2E');
    await expect(
      managerWindow.getByRole('button', { name: /Open note: Playwright E2E Checklist Item/ })
    ).toBeVisible();

    const exportPath = path.join(envDirs.root, 'notes-export');
    await app.evaluate(({ dialog }, basePath) => {
      let calls = 0;
      dialog.showSaveDialog = (async () => ({
        canceled: false,
        filePath: `${basePath}.${calls++ === 0 ? 'json' : 'md'}`,
      })) as typeof dialog.showSaveDialog;
    }, exportPath);
    for (const [label, extension] of [['Export as JSON', 'json'], ['Export as Markdown', 'md']]) {
      await managerWindow.getByRole('button', { name: 'Settings and actions' }).click();
      await managerWindow.getByRole('button', { name: label }).click();
      await expect.poll(() => fs.existsSync(`${exportPath}.${extension}`)).toBe(true);
      expect(fs.readFileSync(`${exportPath}.${extension}`, 'utf8')).toContain('Playwright E2E Checklist Item');
    }

    // Clear search with Escape
    await searchInput.press('Escape');
    await expect(searchInput).toHaveValue('');

    await managerWindow.getByRole('button', { name: /Move note to Trash: Permanently Remove Me/ }).click();
    await managerWindow.getByRole('button', { name: 'Move to Trash' }).click();
    await managerWindow.getByRole('button', { name: 'Settings and actions' }).click();
    await managerWindow.getByRole('button', { name: 'Open Trash' }).click();
    await managerWindow.getByRole('button', { name: 'Delete forever' }).click();
    await managerWindow.getByRole('alertdialog').getByRole('button', { name: 'Delete permanently' }).click();
    await expect(managerWindow.getByText('Permanently Remove Me')).toHaveCount(0);
    await managerWindow.getByRole('button', { name: 'Back', exact: true }).click();

    // 6. Soft-delete the second note to Trash, then open unified Settings & actions menu -> Open Trash -> Restore
    await expect(managerWindow.getByRole('button', { name: /Open note: Second Note To Trash/ })).toBeVisible();
    await managerWindow
      .getByRole('button', { name: /Move note to Trash: Second Note To Trash/ })
      .click();
    await managerWindow.getByRole('button', { name: 'Move to Trash' }).click();
    await expect(
      managerWindow.getByRole('button', { name: /Open note: Second Note To Trash/ })
    ).toHaveCount(0);

    await managerWindow.getByRole('button', { name: 'Settings and actions' }).click();
    const darkModeSwitch = managerWindow.getByRole('switch', { name: 'Dark mode' });
    await expect(darkModeSwitch).toBeVisible();
    await darkModeSwitch.click();
    await expect(managerWindow.locator('.manager-container')).toHaveClass(/dark/);
    await expect(managerWindow.getByRole('switch', { name: 'Start at login' })).toBeVisible();
    await expect(managerWindow.getByRole('button', { name: 'Export as JSON' })).toBeVisible();
    await expect(managerWindow.getByRole('button', { name: 'Export as Markdown' })).toBeVisible();
    await managerWindow.getByRole('button', { name: 'Open Trash' }).click();
    await expect(managerWindow.getByText('Second Note To Trash')).toBeVisible();
    await managerWindow.getByRole('button', { name: 'Restore' }).click();
    await managerWindow.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(
      managerWindow.getByRole('button', { name: /Open note: Second Note To Trash/ })
    ).toBeVisible();

    await managerWindow
      .getByRole('button', { name: /Move note to Trash: Second Note To Trash/ })
      .click();
    await managerWindow.getByRole('button', { name: 'Move to Trash' }).click();
    await managerWindow.getByRole('button', { name: 'Settings and actions' }).click();
    await managerWindow.getByRole('button', { name: 'Open Trash' }).click();
    await managerWindow.getByRole('button', { name: 'Empty Trash' }).click();
    await managerWindow.getByRole('alertdialog').getByRole('button', { name: 'Empty Trash' }).click();
    await expect(managerWindow.getByText('Second Note To Trash')).toHaveCount(0);

    await assertNoCspViolations(noteWindow, 'noteWindow');
    await assertNoCspViolations(managerWindow, 'managerWindow');

    // 7. Quit cleanly and relaunch to verify persistence
    await app.close();
    app = await launchApp(envDirs);
    await attachCspMonitor(app);
    const restoredWindow = await app.firstWindow();
    trackConsoleErrors(restoredWindow, consoleErrors);
    await ensureFirstWindowCspMonitor(restoredWindow);
    await expect(restoredWindow.getByRole('textbox', { name: 'Note text' })).toContainText(
      'Playwright E2E Checklist Item'
    );
    await expect(restoredWindow.locator('.note-container')).toHaveAttribute('data-color', 'blue');
    const restoredManagerPromise = app.waitForEvent('window');
    await restoredWindow.getByRole('button', { name: 'Note options' }).click();
    await restoredWindow.getByRole('button', { name: 'Notes list' }).click();
    const restoredManager = await restoredManagerPromise;
    await expect(restoredManager.locator('.manager-container')).toHaveClass(/dark/);
    await assertNoCspViolations(restoredWindow, 'restoredWindow');
    expect(consoleErrors, 'Console errors during E2E run').toEqual([]);
  } finally {
    if (app) {
      await app.close().catch(() => {});
    }
    fs.rmSync(envDirs.root, { recursive: true, force: true });
  }
});
