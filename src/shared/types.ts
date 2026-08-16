export type NoteColor = 'yellow' | 'green' | 'pink' | 'purple' | 'blue' | 'charcoal' | 'white';

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

export interface ColorThemeDef {
  id: NoteColor;
  name: string;
  dotColor: string;
  light: {
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
  };
  dark: {
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
  };
}

export const NOTE_COLORS: Record<NoteColor, ColorThemeDef> = {
  yellow: {
    id: 'yellow',
    name: 'Yellow',
    dotColor: '#FFDE59',
    light: {
      header: '#FFF176',
      headerText: '#202020',
      headerBorder: '#E6D05E',
      headerBtnHover: 'rgba(0, 0, 0, 0.08)',
      headerBtnActive: 'rgba(0, 0, 0, 0.16)',
      border: '#E6D05E',
      body: '#FFF7D1',
      text: '#202020',
      placeholder: '#8C8235',
      toolbarBg: 'transparent',
      buttonHover: 'rgba(0, 0, 0, 0.08)',
      buttonActive: 'rgba(0, 0, 0, 0.16)',
    },
    dark: {
      header: '#3B351B',
      headerText: '#F5F5F5',
      headerBorder: '#554C21',
      headerBtnHover: 'rgba(255, 255, 255, 0.14)',
      headerBtnActive: 'rgba(255, 255, 255, 0.24)',
      border: '#554C21',
      body: '#2D2816',
      text: '#F5F5F5',
      placeholder: '#9E9465',
      toolbarBg: 'transparent',
      buttonHover: 'rgba(255, 255, 255, 0.12)',
      buttonActive: 'rgba(255, 255, 255, 0.22)',
    },
  },
  green: {
    id: 'green',
    name: 'Green',
    dotColor: '#81C784',
    light: {
      header: '#B8F2A6',
      headerText: '#202020',
      headerBorder: '#99E284',
      headerBtnHover: 'rgba(0, 0, 0, 0.08)',
      headerBtnActive: 'rgba(0, 0, 0, 0.16)',
      border: '#99E284',
      body: '#E4F9E0',
      text: '#202020',
      placeholder: '#4E7B44',
      toolbarBg: 'transparent',
      buttonHover: 'rgba(0, 0, 0, 0.08)',
      buttonActive: 'rgba(0, 0, 0, 0.16)',
    },
    dark: {
      header: '#1E3622',
      headerText: '#F5F5F5',
      headerBorder: '#2E5A35',
      headerBtnHover: 'rgba(255, 255, 255, 0.14)',
      headerBtnActive: 'rgba(255, 255, 255, 0.24)',
      border: '#2E5A35',
      body: '#172A1B',
      text: '#F5F5F5',
      placeholder: '#729876',
      toolbarBg: 'transparent',
      buttonHover: 'rgba(255, 255, 255, 0.12)',
      buttonActive: 'rgba(255, 255, 255, 0.22)',
    },
  },
  pink: {
    id: 'pink',
    name: 'Pink',
    dotColor: '#F06292',
    light: {
      header: '#FFB7D5',
      headerText: '#202020',
      headerBorder: '#F094BC',
      headerBtnHover: 'rgba(0, 0, 0, 0.08)',
      headerBtnActive: 'rgba(0, 0, 0, 0.16)',
      border: '#F094BC',
      body: '#FFD6E8',
      text: '#202020',
      placeholder: '#8E3E64',
      toolbarBg: 'transparent',
      buttonHover: 'rgba(0, 0, 0, 0.08)',
      buttonActive: 'rgba(0, 0, 0, 0.16)',
    },
    dark: {
      header: '#3D1F2D',
      headerText: '#F5F5F5',
      headerBorder: '#5E2E45',
      headerBtnHover: 'rgba(255, 255, 255, 0.14)',
      headerBtnActive: 'rgba(255, 255, 255, 0.24)',
      border: '#5E2E45',
      body: '#2E1722',
      text: '#F5F5F5',
      placeholder: '#A86C86',
      toolbarBg: 'transparent',
      buttonHover: 'rgba(255, 255, 255, 0.12)',
      buttonActive: 'rgba(255, 255, 255, 0.22)',
    },
  },
  purple: {
    id: 'purple',
    name: 'Purple',
    dotColor: '#BA68C8',
    light: {
      header: '#D8B4E2',
      headerText: '#202020',
      headerBorder: '#BF90CC',
      headerBtnHover: 'rgba(0, 0, 0, 0.08)',
      headerBtnActive: 'rgba(0, 0, 0, 0.16)',
      border: '#BF90CC',
      body: '#ECD7FC',
      text: '#202020',
      placeholder: '#6E3980',
      toolbarBg: 'transparent',
      buttonHover: 'rgba(0, 0, 0, 0.08)',
      buttonActive: 'rgba(0, 0, 0, 0.16)',
    },
    dark: {
      header: '#331E3D',
      headerText: '#F5F5F5',
      headerBorder: '#522E62',
      headerBtnHover: 'rgba(255, 255, 255, 0.14)',
      headerBtnActive: 'rgba(255, 255, 255, 0.24)',
      border: '#522E62',
      body: '#26162E',
      text: '#F5F5F5',
      placeholder: '#9973A4',
      toolbarBg: 'transparent',
      buttonHover: 'rgba(255, 255, 255, 0.12)',
      buttonActive: 'rgba(255, 255, 255, 0.22)',
    },
  },
  blue: {
    id: 'blue',
    name: 'Blue',
    dotColor: '#4FC3F7',
    light: {
      header: '#99E0FC',
      headerText: '#202020',
      headerBorder: '#72C5E8',
      headerBtnHover: 'rgba(0, 0, 0, 0.08)',
      headerBtnActive: 'rgba(0, 0, 0, 0.16)',
      border: '#72C5E8',
      body: '#D1F0FD',
      text: '#202020',
      placeholder: '#246F94',
      toolbarBg: 'transparent',
      buttonHover: 'rgba(0, 0, 0, 0.08)',
      buttonActive: 'rgba(0, 0, 0, 0.16)',
    },
    dark: {
      header: '#1C2E3D',
      headerText: '#F5F5F5',
      headerBorder: '#284D67',
      headerBtnHover: 'rgba(255, 255, 255, 0.14)',
      headerBtnActive: 'rgba(255, 255, 255, 0.24)',
      border: '#284D67',
      body: '#162430',
      text: '#F5F5F5',
      placeholder: '#6E92AD',
      toolbarBg: 'transparent',
      buttonHover: 'rgba(255, 255, 255, 0.12)',
      buttonActive: 'rgba(255, 255, 255, 0.22)',
    },
  },
  charcoal: {
    id: 'charcoal',
    name: 'Charcoal',
    dotColor: '#607D8B',
    light: {
      header: '#383838',
      headerText: '#F5F5F5',
      headerBorder: '#4A4A4A',
      headerBtnHover: 'rgba(255, 255, 255, 0.12)',
      headerBtnActive: 'rgba(255, 255, 255, 0.22)',
      border: '#4A4A4A',
      body: '#2B2B2B',
      text: '#F5F5F5',
      placeholder: '#888888',
      toolbarBg: 'transparent',
      buttonHover: 'rgba(255, 255, 255, 0.12)',
      buttonActive: 'rgba(255, 255, 255, 0.22)',
    },
    dark: {
      header: '#303030',
      headerText: '#F4F4F5',
      headerBorder: '#444444',
      headerBtnHover: 'rgba(255, 255, 255, 0.14)',
      headerBtnActive: 'rgba(255, 255, 255, 0.24)',
      border: '#444444',
      body: '#222222',
      text: '#F4F4F5',
      placeholder: '#71717A',
      toolbarBg: 'transparent',
      buttonHover: 'rgba(255, 255, 255, 0.12)',
      buttonActive: 'rgba(255, 255, 255, 0.22)',
    },
  },
  white: {
    id: 'white',
    name: 'White',
    dotColor: '#E0E0E0',
    light: {
      header: '#EAEAEA',
      headerText: '#202020',
      headerBorder: '#D0D0D0',
      headerBtnHover: 'rgba(0, 0, 0, 0.08)',
      headerBtnActive: 'rgba(0, 0, 0, 0.16)',
      border: '#D0D0D0',
      body: '#FAFAFA',
      text: '#202020',
      placeholder: '#777777',
      toolbarBg: 'transparent',
      buttonHover: 'rgba(0, 0, 0, 0.08)',
      buttonActive: 'rgba(0, 0, 0, 0.16)',
    },
    dark: {
      header: '#3F3F46',
      headerText: '#FAFAFA',
      headerBorder: '#52525B',
      headerBtnHover: 'rgba(255, 255, 255, 0.14)',
      headerBtnActive: 'rgba(255, 255, 255, 0.24)',
      border: '#52525B',
      body: '#27272A',
      text: '#FAFAFA',
      placeholder: '#A1A1AA',
      toolbarBg: 'transparent',
      buttonHover: 'rgba(255, 255, 255, 0.12)',
      buttonActive: 'rgba(255, 255, 255, 0.22)',
    },
  },
};

export interface AppConfig {
  theme: 'system' | 'light' | 'dark';
  fontFamily?: string;
  autostart: boolean;
  alwaysOnTopDefault: boolean;
  confirmDelete: boolean;
}

export interface StickyNotesAPI {
  // Note Operations
  createNote: (initial?: Partial<Note>) => Promise<Note>;
  getNote: (id: string) => Promise<Note | null>;
  getAllNotes: (query?: { search?: string; includeClosed?: boolean; limit?: number; offset?: number }) => Promise<Note[]>;
  updateNote: (id: string, updates: Partial<Note>) => Promise<Note>;
  closeNoteWindow: (id: string) => Promise<void>;
  openNoteWindow: (id: string) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  togglePin: (id: string) => Promise<boolean>;
  updateNoteBounds: (id: string, bounds: { x: number; y: number; width: number; height: number }) => Promise<void>;
  
  // Manager Operations
  toggleManagerWindow: () => Promise<void>;
  showManagerWindow: () => Promise<void>;
  closeManagerWindow: () => Promise<void>;
  
  // System Events
  onNoteUpdated: (callback: (note: Note) => void) => () => void;
  onNoteDeleted: (callback: (id: string) => void) => () => void;
  onNotesChanged: (callback: () => void) => () => void;
  onSettingsChanged: (callback: (key: string, value: any) => void) => () => void;

  // Settings
  getConfig: () => Promise<AppConfig>;
  setConfig: (key: keyof AppConfig, value: any) => Promise<void>;

  // Window utilities
  isNoteWindow: boolean;
  noteId: string | null;
}

declare global {
  interface Window {
    stickyNotesAPI: StickyNotesAPI;
  }
}
