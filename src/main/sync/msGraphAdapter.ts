import { ISyncAdapter, SyncStatus } from './syncAdapter';
import { Note } from '../../shared/types';

/**
 * Microsoft Graph Sync Adapter (Phase 2 Provider Stub)
 * 
 * Integration Blueprint:
 * 1. Auth: MSAL Node (OAuth2 PKCE flow with scopes: 'Mail.ReadWrite', 'Notes.ReadWrite', 'offline_access')
 * 2. Sync Pathway A (Native Sticky Notes):
 *    - Endpoint: https://graph.microsoft.com/v1.0/me/mailFolders/notes/messages
 *    - Message Class: IPM.StickyNote
 * 3. Sync Pathway B (OneNote Notebook):
 *    - Endpoint: https://graph.microsoft.com/v1.0/me/onenote/pages
 */
export class MSGraphSyncAdapter implements ISyncAdapter {
  public readonly providerName = 'msgraph_exchange';
  private accessToken: string | null = null;
  private userEmail: string | null = null;

  public isConfigured(): boolean {
    return this.accessToken !== null;
  }

  public async authenticate(): Promise<boolean> {
    // Phase 2: Launch MSAL Node loopback auth
    return false;
  }

  public async logout(): Promise<void> {
    this.accessToken = null;
    this.userEmail = null;
  }

  public async getStatus(): Promise<SyncStatus> {
    return {
      isConfigured: this.isConfigured(),
      provider: 'msgraph_exchange',
      accountEmail: this.userEmail,
      lastSyncTime: null,
      isSyncing: false,
      error: this.isConfigured() ? null : 'Not signed in',
    };
  }

  public async pullChanges(_lastSyncTimestamp: number | null): Promise<Note[]> {
    if (!this.accessToken) return [];
    // Implementation when MS auth is activated
    return [];
  }

  public async pushChanges(_pendingNotes: Note[]): Promise<{ syncedIds: string[]; errors: Record<string, string> }> {
    return {
      syncedIds: [],
      errors: {},
    };
  }
}
