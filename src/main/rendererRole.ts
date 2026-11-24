import type { BrowserWindow, IpcMainEvent, IpcMainInvokeEvent } from 'electron';

export function resolveRendererRole(
  event: IpcMainEvent | IpcMainInvokeEvent,
  rendererUrl: URL,
  managerWindow: BrowserWindow | null,
  noteWindows: ReadonlyMap<string, BrowserWindow>
): { noteId: string | null } {
  const frame = event.senderFrame;
  if (frame && frame === event.sender.mainFrame && frame.url) {
    let url: URL;
    try {
      url = new URL(frame.url);
    } catch {
      throw new Error('Unrecognized renderer.');
    }
    if (
      url.protocol === rendererUrl.protocol &&
      url.host === rendererUrl.host &&
      url.pathname === rendererUrl.pathname &&
      url.username === '' &&
      url.password === ''
    ) {
      if (managerWindow?.webContents === event.sender) return { noteId: null };
      for (const [noteId, win] of noteWindows) {
        if (win.webContents === event.sender) return { noteId };
      }
    }
  }
  throw new Error('Unrecognized renderer.');
}
