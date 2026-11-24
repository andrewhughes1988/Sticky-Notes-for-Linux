import { Note } from '../shared/types';

type ExportNote = Pick<
  Note,
  | 'id'
  | 'title'
  | 'color'
  | 'is_pinned'
  | 'created_at'
  | 'updated_at'
  | 'content_plain'
  | 'content_html'
>;

export function formatNoteExport(
  notes: ExportNote[],
  format: 'json' | 'markdown',
  version: string,
  exportedAt: string
): string {
  if (format === 'json') {
    return JSON.stringify(
      {
        exportedAt,
        version,
        notes: notes.map((n) => ({
          id: n.id,
          title: n.title,
          color: n.color,
          is_pinned: Boolean(n.is_pinned),
          created_at: n.created_at,
          updated_at: n.updated_at,
          content_plain: n.content_plain,
          content_html: n.content_html,
        })),
      },
      null,
      2
    );
  }
  return notes
    .map((n) => {
      const heading = n.title || 'Untitled Note';
      const updated = new Date(n.updated_at).toISOString();
      return `# ${heading}\n\n_Color: ${n.color} | Updated: ${updated}_\n\n${n.content_plain}\n`;
    })
    .join('\n---\n\n');
}
