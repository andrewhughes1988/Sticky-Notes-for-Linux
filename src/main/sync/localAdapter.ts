import { ISyncAdapter, SyncStatus } from './syncAdapter';
import { Note } from '../../shared/types';

/**
 * Local-only offline adapter.
 * Used for MVP; strictly operates on the local machine with zero network activity.
 */
export class LocalSyncAdapter implements ISyncAdapter {
  public readonly providerName = 'local';

  public isConfigured(): boolean {
    return true;
  }

  public async getStatus(): Promise<SyncStatus> {
    return {
      isConfigured: true,
      provider: 'local',
      accountEmail: null,
      lastSyncTime: Date.now(),
      isSyncing: false,
      error: null,
    };
  }

  public async pullChanges(): Promise<Note[]> {
    return [];
  }

  public async pushChanges(pendingNotes: Note[]): Promise<{ syncedIds: string[]; errors: Record<string, string> }> {
    return {
      syncedIds: pendingNotes.map((n) => n.id),
      errors: {},
    };
  }
}
