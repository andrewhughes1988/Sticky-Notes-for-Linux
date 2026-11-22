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
