import { sanitizeNoteHtmlMain } from './htmlSanitizer';
import { Note, NOTE_COLORS, NoteColor } from '../shared/types';

export type ImportedNote = Pick<
  Note,
  'title' | 'color' | 'is_pinned' | 'created_at' | 'updated_at' | 'content_plain' | 'content_html'
>;

export function parseBackup(input: unknown): ImportedNote[] {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Invalid backup.');
  const notes = (input as Record<string, unknown>).notes;
  if (!Array.isArray(notes) || notes.length > 10000) throw new Error('Invalid backup notes.');
  return notes.map((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error('Invalid note.');
    const note = value as Record<string, unknown>;
    const text = (key: string, limit: number): string => {
      const field = note[key];
      if (typeof field !== 'string' || field.length > limit) throw new Error('Invalid note text.');
      return field;
    };
    if (
      typeof note.color !== 'string' ||
      !Object.hasOwn(NOTE_COLORS, note.color) ||
      typeof note.is_pinned !== 'boolean' ||
      !Number.isSafeInteger(note.created_at) ||
      (note.created_at as number) <= 0 ||
      !Number.isSafeInteger(note.updated_at) ||
      (note.updated_at as number) <= 0
    ) {
      throw new Error('Invalid note metadata.');
    }
    return {
      title: text('title', 1000),
      color: note.color as NoteColor,
      is_pinned: note.is_pinned ? 1 : 0,
      created_at: note.created_at as number,
      updated_at: note.updated_at as number,
      content_plain: text('content_plain', 1_000_000),
      content_html: sanitizeNoteHtmlMain(text('content_html', 2_000_000)),
    };
  });
}

export async function snapshotAfterFlush<T>(
  flush: () => Promise<void>,
  read: () => T,
  resume: () => void
): Promise<T> {
  try {
    await flush();
    return read();
  } finally {
    resume();
  }
}
