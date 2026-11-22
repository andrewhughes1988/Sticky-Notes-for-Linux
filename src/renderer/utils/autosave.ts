// Serialize writes and acknowledge only the revision each write captured.
export class Autosave {
  private revision = 0;
  private savedRevision = 0;
  private active: Promise<void> | null = null;

  edited() {
    this.revision++;
  }

  flush(write: () => Promise<void>): Promise<void> {
    if (!this.active && this.savedRevision !== this.revision) {
      const writeSnapshot = async () => write();
      const drain = async () => {
        try {
          while (this.savedRevision !== this.revision) {
            const revision = this.revision;
            await writeSnapshot();
            this.savedRevision = revision;
          }
        } finally {
          this.active = null;
        }
      };
      this.active = drain();
    }
    return this.active ?? Promise.resolve();
  }
}

const AUTOSAVE_IDLE_MS = 300;
const AUTOSAVE_MAX_WAIT_MS = 2000;

export class AutosaveTimer {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private deadline: number | undefined;

  constructor(private readonly now = () => performance.now()) {}

  schedule(save: () => void): void {
    this.pause();
    const now = this.now();
    this.deadline ??= now + AUTOSAVE_MAX_WAIT_MS;
    const delay = Math.max(0, Math.min(AUTOSAVE_IDLE_MS, this.deadline - now));
    this.timer = setTimeout(() => {
      this.reset();
      save();
    }, delay);
  }

  // An IME session pauses writes while retaining the deadline for committed edits.
  pause(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  reset(): void {
    this.pause();
    this.deadline = undefined;
  }
}
