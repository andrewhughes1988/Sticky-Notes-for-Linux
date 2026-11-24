export type NoteColor = 'yellow' | 'green' | 'pink' | 'purple' | 'blue' | 'charcoal' | 'white';

export type AppTheme = 'system' | 'light' | 'dark';

export interface Note {
  id: string;
  title: string;
  content_html: string;
  content_plain: string;
  color: NoteColor;
  is_open: number; // 1 = open on desktop, 0 = closed
  is_pinned: number; // 1 = always on top, 0 = normal
  pos_x: number | null;
  pos_y: number | null;
  width: number;
  height: number;
  z_order: number;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  remote_id: string | null;
  sync_status: 'synced' | 'pending_create' | 'pending_update' | 'pending_delete';
  change_key: string | null;
  last_synced_at: number | null;
}

export type NotePreview = Pick<Note, 'id' | 'color' | 'updated_at' | 'is_open' | 'is_pinned'> & {
  preview: string;
};

export type DeletedNotePreview = Pick<Note, 'id' | 'color' | 'updated_at'> & {
  deleted_at: number;
  preview: string;
};

export interface NotePreviewQuery {
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ExportResult {
  exported: boolean;
  count: number;
  filePath?: string;
}

export interface EncryptionStatus {
  enabled: boolean;
  available: boolean;
  backend: string;
}

export interface ColorThemeDef {
  id: NoteColor;
  name: string;
  dotColor: string;
  isDark: boolean;
  header: string;
  headerText: string;
  headerBorder: string;
  headerBtnHover: string;
  headerBtnActive: string;
  border: string;
  body: string;
  text: string;
  placeholder: string;
  toolbarBg: string;
  buttonHover: string;
  buttonActive: string;
}

export const NOTE_COLORS: Record<NoteColor, ColorThemeDef> = {
  yellow: {
    id: 'yellow',
    name: 'Yellow',
    dotColor: '#FFDE59',
    isDark: false,
    header: '#FFF176',
    headerText: '#202020',
    headerBorder: '#E6D05E',
    headerBtnHover: 'rgba(0, 0, 0, 0.08)',
    headerBtnActive: 'rgba(0, 0, 0, 0.16)',
    border: '#E6D05E',
    body: '#FFF7D1',
    text: '#202020',
    placeholder: '#6B6323',
    toolbarBg: 'transparent',
    buttonHover: 'rgba(0, 0, 0, 0.08)',
    buttonActive: 'rgba(0, 0, 0, 0.16)',
  },
  green: {
    id: 'green',
    name: 'Green',
    dotColor: '#81C784',
    isDark: false,
    header: '#B8F2A6',
    headerText: '#202020',
    headerBorder: '#99E284',
    headerBtnHover: 'rgba(0, 0, 0, 0.08)',
    headerBtnActive: 'rgba(0, 0, 0, 0.16)',
    border: '#99E284',
    body: '#E4F9E0',
    text: '#202020',
    placeholder: '#3B6632',
    toolbarBg: 'transparent',
    buttonHover: 'rgba(0, 0, 0, 0.08)',
    buttonActive: 'rgba(0, 0, 0, 0.16)',
  },
  pink: {
    id: 'pink',
    name: 'Pink',
    dotColor: '#F06292',
    isDark: false,
    header: '#FFB7D5',
    headerText: '#202020',
    headerBorder: '#F094BC',
    headerBtnHover: 'rgba(0, 0, 0, 0.08)',
    headerBtnActive: 'rgba(0, 0, 0, 0.16)',
    border: '#F094BC',
    body: '#FFD6E8',
    text: '#202020',
    placeholder: '#7A3154',
    toolbarBg: 'transparent',
    buttonHover: 'rgba(0, 0, 0, 0.08)',
    buttonActive: 'rgba(0, 0, 0, 0.16)',
  },
  purple: {
    id: 'purple',
    name: 'Purple',
    dotColor: '#BA68C8',
    isDark: false,
    header: '#D8B4E2',
    headerText: '#202020',
    headerBorder: '#BF90CC',
    headerBtnHover: 'rgba(0, 0, 0, 0.08)',
    headerBtnActive: 'rgba(0, 0, 0, 0.16)',
    border: '#BF90CC',
    body: '#ECD7FC',
    text: '#202020',
    placeholder: '#5F2E70',
    toolbarBg: 'transparent',
    buttonHover: 'rgba(0, 0, 0, 0.08)',
    buttonActive: 'rgba(0, 0, 0, 0.16)',
  },
  blue: {
    id: 'blue',
    name: 'Blue',
    dotColor: '#4FC3F7',
    isDark: false,
    header: '#99E0FC',
    headerText: '#202020',
    headerBorder: '#72C5E8',
    headerBtnHover: 'rgba(0, 0, 0, 0.08)',
    headerBtnActive: 'rgba(0, 0, 0, 0.16)',
    border: '#72C5E8',
    body: '#D1F0FD',
    text: '#202020',
    placeholder: '#1F6080',
    toolbarBg: 'transparent',
    buttonHover: 'rgba(0, 0, 0, 0.08)',
    buttonActive: 'rgba(0, 0, 0, 0.16)',
  },
  charcoal: {
    id: 'charcoal',
    name: 'Charcoal',
    dotColor: '#607D8B',
    isDark: true,
    header: '#303030',
    headerText: '#F4F4F5',
    headerBorder: '#444444',
    headerBtnHover: 'rgba(255, 255, 255, 0.14)',
    headerBtnActive: 'rgba(255, 255, 255, 0.24)',
    border: '#444444',
    body: '#222222',
    text: '#F4F4F5',
    placeholder: '#9E9EA8',
    toolbarBg: 'transparent',
    buttonHover: 'rgba(255, 255, 255, 0.12)',
    buttonActive: 'rgba(255, 255, 255, 0.22)',
  },
  white: {
    id: 'white',
    name: 'White',
    dotColor: '#E0E0E0',
    isDark: false,
    header: '#EAEAEA',
    headerText: '#202020',
    headerBorder: '#D0D0D0',
    headerBtnHover: 'rgba(0, 0, 0, 0.08)',
    headerBtnActive: 'rgba(0, 0, 0, 0.16)',
    border: '#D0D0D0',
    body: '#FAFAFA',
    text: '#202020',
    placeholder: '#666666',
    toolbarBg: 'transparent',
    buttonHover: 'rgba(0, 0, 0, 0.08)',
    buttonActive: 'rgba(0, 0, 0, 0.16)',
  },
};

export interface AppConfig {
  theme: AppTheme;
  autostart: boolean;
  spellcheck: boolean;
}

export type SettingChangeListener = (
  key: keyof AppConfig,
  value: AppConfig[keyof AppConfig]
) => void;

export interface StickyNotesAPI {
  // Note Operations
  createNote: (initial?: Pick<Partial<Note>, 'color'>) => Promise<Note>;
  getNote: (id: string) => Promise<Note | null>;
  getNotePreviews: (query?: NotePreviewQuery) => Promise<NotePreview[]>;
  updateNote: (
    id: string,
    updates: Partial<Pick<Note, 'color' | 'content_html' | 'content_plain'>>
  ) => Promise<Note>;
  closeNoteWindow: (id: string) => Promise<void>;
  openNoteWindow: (id: string) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  togglePin: (id: string) => Promise<boolean>;

  // Trash & Backup Operations
  getDeletedNotes: () => Promise<DeletedNotePreview[]>;
  restoreNote: (id: string) => Promise<void>;
  permanentlyDeleteNote: (id: string) => Promise<void>;
  emptyTrash: () => Promise<void>;
  exportNotes: (format: 'json' | 'markdown') => Promise<ExportResult>;
  getMigrationBackupCount: () => Promise<number>;
  purgeMigrationBackups: () => Promise<number>;

  // Security / Encryption-at-Rest
  getEncryptionStatus: () => Promise<EncryptionStatus>;
  setEncryptionEnabled: (enabled: boolean) => Promise<EncryptionStatus>;

  // Manager & App Operations
  showManagerWindow: () => Promise<void>;
  closeManagerWindow: () => Promise<void>;
  quitApp: () => Promise<void>;
  openExternalLink: (url: string) => Promise<void>;

  // System Events
  onNotesChanged: (callback: () => void) => () => void;
  onSettingsChanged: (callback: SettingChangeListener) => () => void;
  onFlushRequested: (callback: () => Promise<void>) => () => void;
  onFlushCancelled: (callback: () => void) => () => void;

  // Settings
  getSpellcheck: () => Promise<boolean>;
  getConfig: () => Promise<AppConfig>;
  setConfig: <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => Promise<void>;

  // Window utilities
  isNoteWindow: boolean;
  noteId: string | null;
}

declare global {
  interface Window {
    stickyNotesAPI: StickyNotesAPI;
  }
}
