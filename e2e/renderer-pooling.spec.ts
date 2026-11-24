import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('pooled notes keep isolation, pinning, and grouped crash recovery', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sticky-pool-probe-'));
  const app = await electron.launch({
    args: [
      ...(process.env.CI ? ['--no-sandbox'] : []),
      ...(process.env.DISPLAY ? ['--ozone-platform=x11'] : []),
      '.',
    ],
    env: {
      ...process.env,
      XDG_DATA_HOME: path.join(root, 'data'),
      XDG_CONFIG_HOME: path.join(root, 'config'),
      XDG_STATE_HOME: path.join(root, 'state'),
    },
  });
  try {
    let note = await app.firstWindow();
    await expect(note.getByRole('textbox', { name: 'Note text' })).toBeVisible();
    const pages = [note];
    for (let i = 1; i < 5; i++) {
      const next = app.waitForEvent('window');
      await note.keyboard.press('Control+n');
      note = await next;
      await expect(note.getByRole('textbox', { name: 'Note text' })).toBeVisible();
      pages.push(note);
    }
    const ids = await Promise.all(pages.map((p) => p.evaluate(() => window.stickyNotesAPI.noteId)));
    expect(new Set(ids).size).toBe(5);
    for (let i = 0; i < pages.length; i++) {
      const editor = pages[i].getByRole('textbox', { name: 'Note text' });
      await editor.fill(`Saved pooled note ${i}`);
      await expect
        .poll(() =>
          pages[i].evaluate(
            async (id) => (await window.stickyNotesAPI.getNote(id!))?.content_plain,
            ids[i]
          )
        )
        .toContain(`Saved pooled note ${i}`);
    }
    expect(
      await pages[0].evaluate(async (id) => {
        try {
          await window.stickyNotesAPI.getNote(id!);
          return false;
        } catch {
          return true;
        }
      }, ids[1])
    ).toBe(true);
    await pages[0].getByRole('button', { name: 'Pin always on top' }).click();
    await expect(pages[0].getByRole('button', { name: 'Unpin from top' })).toBeVisible();
    const manager = app.waitForEvent('window');
    await note.getByRole('button', { name: 'Note options' }).click();
    await note.getByRole('button', { name: 'Notes list' }).click();
    const managerPage = await manager;
    await managerPage.waitForLoadState('domcontentloaded');
    const result = await app.evaluate(({ BrowserWindow, session }) =>
      BrowserWindow.getAllWindows().map((w) => ({
        id: w.id,
        pid: w.webContents.getOSProcessId(),
        manager: w.webContents.session === session.fromPartition('inmemory:manager'),
        pinned: w.isAlwaysOnTop(),
      }))
    );
    const notes = result.filter((w) => !w.manager),
      managers = result.filter((w) => w.manager);
    expect(notes.length).toBe(5);
    expect(managers.length).toBe(1);
    expect(new Set(notes.map((w) => w.pid)).size).toBe(1);
    expect(managers[0].pid).not.toBe(notes[0].pid);
    expect(notes.filter((w) => w.pinned).length).toBe(1);
    await app.evaluate(({ BrowserWindow, dialog, session }) => {
      (globalThis as unknown as { __poolPrompts: number }).__poolPrompts = 0;
      Object.defineProperty(dialog, 'showMessageBox', {
        value: async () => {
          (globalThis as unknown as { __poolPrompts: number }).__poolPrompts++;
          await new Promise((r) => setTimeout(r, 500));
          return { response: 0, checkboxChecked: false };
        },
        configurable: true,
      });
      setTimeout(
        () =>
          BrowserWindow.getAllWindows()
            .find((w) => w.webContents.session !== session.fromPartition('inmemory:manager'))!
            .webContents.forcefullyCrashRenderer(),
        500
      );
    });
    await expect
      .poll(
        () =>
          app.evaluate(() => (globalThis as unknown as { __poolPrompts: number }).__poolPrompts),
        { timeout: 10000 }
      )
      .toBe(1);
    await expect
      .poll(
        () =>
          app.evaluate(
            ({ BrowserWindow, session }) =>
              BrowserWindow.getAllWindows().filter(
                (w) =>
                  w.webContents.session !== session.fromPartition('inmemory:manager') &&
                  !w.webContents.isCrashed()
              ).length
          ),
        { timeout: 15000 }
      )
      .toBe(5);
    expect(
      await app.evaluate(() => (globalThis as unknown as { __poolPrompts: number }).__poolPrompts)
    ).toBe(1);
    const after = await app.evaluate(({ BrowserWindow, session }) =>
      BrowserWindow.getAllWindows()
        .filter((w) => w.webContents.session !== session.fromPartition('inmemory:manager'))
        .map((w) => w.isAlwaysOnTop())
    );
    expect(after.filter(Boolean).length).toBe(1);
    await expect(managerPage.getByRole('textbox', { name: 'Search notes' })).toBeVisible();
    await expect
      .poll(
        () =>
          app.evaluate(async ({ BrowserWindow, session }) => {
            const windows = BrowserWindow.getAllWindows().filter(
              (w) => w.webContents.session !== session.fromPartition('inmemory:manager')
            );
            return Promise.all(
              windows.map((w) =>
                w.webContents.executeJavaScript('window.stickyNotesAPI?.noteId').catch(() => null)
              )
            );
          }),
        { timeout: 10000 }
      )
      .toEqual(expect.arrayContaining(ids));
    await expect
      .poll(
        () =>
          app.evaluate(async ({ BrowserWindow, session }) => {
            const windows = BrowserWindow.getAllWindows().filter(
              (w) => w.webContents.session !== session.fromPartition('inmemory:manager')
            );
            return Promise.all(
              windows.map((w) =>
                w.webContents
                  .executeJavaScript("document.querySelector('[role=textbox]')?.textContent")
                  .catch(() => '')
              )
            );
          }),
        { timeout: 10000 }
      )
      .toEqual(expect.arrayContaining(ids.map((_, i) => `Saved pooled note ${i}`)));
  } finally {
    await app.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
