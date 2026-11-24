import type { WebContents } from 'electron';

export class EditorFlush {
  private readyEditors = new Set<WebContents>();
  private requests = new Map<
    WebContents,
    { id: number; finish: (saved: boolean) => void; promise: Promise<void> }
  >();
  private nextId = 0;

  constructor(private readonly onStalled: (contents: WebContents) => void) {}

  markReady(contents: WebContents): void {
    this.readyEditors.add(contents);
  }

  isReady(contents: WebContents): boolean {
    return this.readyEditors.has(contents);
  }

  detach(contents: WebContents): void {
    this.readyEditors.delete(contents);
    this.requests.get(contents)?.finish(false);
  }

  acknowledge(contents: WebContents, id: number, saved: boolean): void {
    const request = this.requests.get(contents);
    if (request?.id === id) request.finish(saved);
  }

  flush(contents: WebContents): Promise<void> {
    if (!this.readyEditors.has(contents)) return Promise.resolve();
    const existing = this.requests.get(contents);
    if (existing) return existing.promise;

    const id = ++this.nextId;
    let finish!: (saved: boolean) => void;
    const promise = new Promise<void>((resolve, reject) => {
      finish = (saved) => {
        clearTimeout(timeout);
        this.requests.delete(contents);
        if (saved) resolve();
        else reject(new Error('The note did not acknowledge its save.'));
      };
      const timeout = setTimeout(() => {
        finish(false);
        this.onStalled(contents);
      }, 5000);
    });
    this.requests.set(contents, { id, finish, promise });
    try {
      contents.send('editor:flush', id);
    } catch {
      finish(false);
    }
    return promise;
  }

  resumeAll(): void {
    for (const contents of this.readyEditors) {
      if (!contents.isDestroyed()) contents.send('editor:resume');
    }
  }
}
