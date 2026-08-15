import { Note } from '../../shared/types';

export interface SyncStatus {
  isConfigured: boolean;
  provider: 'local' | 'msgraph_exchange' | 'msgraph_onenote';
  accountEmail: string | null;
  lastSyncTime: number | null;
  isSyncing: boolean;
  error: string | null;
}

export interface ISyncAdapter {
  readonly providerName: string;
  isConfigured(): boolean;
  authenticate?(): Promise<boolean>;
  logout?(): Promise<void>;
  getStatus(): Promise<SyncStatus>;
  pullChanges(lastSyncTimestamp: number | null): Promise<Note[]>;
  pushChanges(pendingNotes: Note[]): Promise<{ syncedIds: string[]; errors: Record<string, string> }>;
}
