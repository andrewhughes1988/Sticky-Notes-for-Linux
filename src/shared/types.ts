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
      header: '#FBC02D',
      headerText: '#202020',
      headerBorder: '#F57F17',
      headerBtnHover: 'rgba(0, 0, 0, 0.12)',
      headerBtnActive: 'rgba(0, 0, 0, 0.22)',
      border: '#FBC02D',
      body: '#FFFEF2',
      text: '#202020',
      placeholder: '#9E8B2C',
      toolbarBg: 'transparent',
      buttonHover: 'rgba(0, 0, 0, 0.08)',
      buttonActive: 'rgba(0, 0, 0, 0.16)',
    },
    dark: {
      header: '#554C21',
      headerText: '#F5F5F5',
      headerBorder: '#736526',
      headerBtnHover: 'rgba(255, 255, 255, 0.14)',
      headerBtnActive: 'rgba(255, 255, 255, 0.24)',
      border: '#736526',
      body: '#221E0E',
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
    dotColor: '#4CAF50',
    light: {
      header: '#43A047',
      headerText: '#FFFFFF',
      headerBorder: '#2E7D32',
      headerBtnHover: 'rgba(255, 255, 255, 0.2)',
      headerBtnActive: 'rgba(255, 255, 255, 0.32)',
      border: '#388E3C',
      body: '#F3FBF4',
      text: '#202020',
      placeholder: '#3E7B44',
      toolbarBg: 'transparent',
      buttonHover: 'rgba(0, 0, 0, 0.08)',
      buttonActive: 'rgba(0, 0, 0, 0.16)',
    },
    dark: {
      header: '#284E2E',
      headerText: '#F5F5F5',
      headerBorder: '#387342',
      headerBtnHover: 'rgba(255, 255, 255, 0.14)',
      headerBtnActive: 'rgba(255, 255, 255, 0.24)',
      border: '#387342',
      body: '#101F12',
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
    dotColor: '#E91E63',
    light: {
      header: '#D81B60',
      headerText: '#FFFFFF',
      headerBorder: '#AD1457',
      headerBtnHover: 'rgba(255, 255, 255, 0.2)',
      headerBtnActive: 'rgba(255, 255, 255, 0.32)',
      border: '#C2185B',
      body: '#FFF3F8',
      text: '#202020',
      placeholder: '#9C385C',
      toolbarBg: 'transparent',
      buttonHover: 'rgba(0, 0, 0, 0.08)',
      buttonActive: 'rgba(0, 0, 0, 0.16)',
    },
    dark: {
      header: '#58243E',
      headerText: '#F5F5F5',
      headerBorder: '#7C3154',
      headerBtnHover: 'rgba(255, 255, 255, 0.14)',
      headerBtnActive: 'rgba(255, 255, 255, 0.24)',
      border: '#7C3154',
      body: '#221019',
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
    dotColor: '#9C27B0',
    light: {
      header: '#8E24AA',
      headerText: '#FFFFFF',
      headerBorder: '#6A1B9A',
      headerBtnHover: 'rgba(255, 255, 255, 0.2)',
      headerBtnActive: 'rgba(255, 255, 255, 0.32)',
      border: '#7B1FA2',
      body: '#FAF2FC',
      text: '#202020',
      placeholder: '#772C8E',
      toolbarBg: 'transparent',
      buttonHover: 'rgba(0, 0, 0, 0.08)',
      buttonActive: 'rgba(0, 0, 0, 0.16)',
    },
    dark: {
      header: '#4A255A',
      headerText: '#F5F5F5',
      headerBorder: '#6B3484',
      headerBtnHover: 'rgba(255, 255, 255, 0.14)',
      headerBtnActive: 'rgba(255, 255, 255, 0.24)',
      border: '#6B3484',
      body: '#1C0E23',
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
    dotColor: '#03A9F4',
    light: {
      header: '#0288D1',
      headerText: '#FFFFFF',
      headerBorder: '#01579B',
      headerBtnHover: 'rgba(255, 255, 255, 0.2)',
      headerBtnActive: 'rgba(255, 255, 255, 0.32)',
      border: '#0277BD',
      body: '#F0F9FF',
      text: '#202020',
      placeholder: '#1A6E9C',
      toolbarBg: 'transparent',
      buttonHover: 'rgba(0, 0, 0, 0.08)',
      buttonActive: 'rgba(0, 0, 0, 0.16)',
    },
    dark: {
      header: '#203F5A',
      headerText: '#F5F5F5',
      headerBorder: '#2E638D',
      headerBtnHover: 'rgba(255, 255, 255, 0.14)',
      headerBtnActive: 'rgba(255, 255, 255, 0.24)',
      border: '#2E638D',
      body: '#0E1A24',
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
    dotColor: '#455A64',
    light: {
      header: '#1F2937',
      headerText: '#F9FAFB',
      headerBorder: '#111827',
      headerBtnHover: 'rgba(255, 255, 255, 0.14)',
      headerBtnActive: 'rgba(255, 255, 255, 0.24)',
      border: '#111827',
      body: '#1F2937',
      text: '#F9FAFB',
      placeholder: '#9CA3AF',
      toolbarBg: 'transparent',
      buttonHover: 'rgba(255, 255, 255, 0.12)',
      buttonActive: 'rgba(255, 255, 255, 0.22)',
    },
    dark: {
      header: '#27272A',
      headerText: '#F4F4F5',
      headerBorder: '#52525B',
      headerBtnHover: 'rgba(255, 255, 255, 0.14)',
      headerBtnActive: 'rgba(255, 255, 255, 0.24)',
      border: '#52525B',
      body: '#18181B',
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
    dotColor: '#D1D5DB',
    light: {
      header: '#D1D5DB',
      headerText: '#1F2937',
      headerBorder: '#9CA3AF',
      headerBtnHover: 'rgba(0, 0, 0, 0.1)',
      headerBtnActive: 'rgba(0, 0, 0, 0.2)',
      border: '#9CA3AF',
      body: '#FFFFFF',
      text: '#1F2937',
      placeholder: '#6B7280',
      toolbarBg: 'transparent',
      buttonHover: 'rgba(0, 0, 0, 0.08)',
      buttonActive: 'rgba(0, 0, 0, 0.16)',
    },
    dark: {
      header: '#52525B',
      headerText: '#FAFAFA',
      headerBorder: '#71717A',
      headerBtnHover: 'rgba(255, 255, 255, 0.14)',
      headerBtnActive: 'rgba(255, 255, 255, 0.24)',
      border: '#71717A',
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
  autostart: boolean;
  alwaysOnTopDefault: boolean;
  confirmDelete: boolean;
}

export interface StickyNotesAPI {
  // Note Operations
  createNote: (initial?: Partial<Note>) => Promise<Note>;
  getNote: (id: string) => Promise<Note | null>;
  getAllNotes: (query?: { search?: string; includeClosed?: boolean }) => Promise<Note[]>;
  updateNote: (id: string, updates: Partial<Note>) => Promise<Note>;
  closeNoteWindow: (id: string) => Promise<void>;
  openNoteWindow: (id: string) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  togglePin: (id: string) => Promise<boolean>;
  updateNoteBounds: (id: string, bounds: { x: number; y: number; width: number; height: number }) => Promise<void>;
  
  // Manager Operations
  toggleManagerWindow: () => Promise<void>;
  
  // System Events
  onNoteUpdated: (callback: (note: Note) => void) => () => void;
  onNoteDeleted: (callback: (id: string) => void) => () => void;
  onNotesChanged: (callback: () => void) => () => void;

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
