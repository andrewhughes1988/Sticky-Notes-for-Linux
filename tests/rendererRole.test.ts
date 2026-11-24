import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { BrowserWindow, IpcMainEvent } from 'electron';
import { resolveRendererRole } from '../src/main/rendererRole';

const expectedUrl = new URL('file:///app/index.html');

function eventFor(url: string, mainFrame = true) {
  const frame = { url };
  const sender = { mainFrame: mainFrame ? frame : { url } };
  return { sender, senderFrame: frame } as unknown as IpcMainEvent;
}

function windowFor(event: IpcMainEvent) {
  return { webContents: event.sender } as BrowserWindow;
}

test('identifies manager and note windows only at the trusted main frame', () => {
  const manager = eventFor(expectedUrl.href);
  const note = eventFor(`${expectedUrl.href}?note=1`);
  const managerWindow = windowFor(manager);
  const noteWindows = new Map([['note-1', windowFor(note)]]);
  assert.deepEqual(resolveRendererRole(manager, expectedUrl, managerWindow, noteWindows), {
    noteId: null,
  });
  assert.deepEqual(resolveRendererRole(note, expectedUrl, managerWindow, noteWindows), {
    noteId: 'note-1',
  });

  for (const event of [
    eventFor('file:///app/other.html'),
    eventFor(expectedUrl.href, false),
    eventFor('invalid'),
  ]) {
    assert.throws(
      () => resolveRendererRole(event, expectedUrl, managerWindow, noteWindows),
      /Unrecognized renderer/
    );
  }
  assert.throws(
    () => resolveRendererRole(eventFor(expectedUrl.href), expectedUrl, managerWindow, noteWindows),
    /Unrecognized renderer/
  );
});
