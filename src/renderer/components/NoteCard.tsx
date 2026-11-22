import React from 'react';
import { NotePreview, NOTE_COLORS } from '../../shared/types';
import { formatFriendlyDate } from '../utils/date';
import { Trash2 } from 'lucide-react';

interface NoteCardProps {
  note: NotePreview;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

const NoteCardComponent: React.FC<NoteCardProps> = ({ note, onOpen, onDelete }) => {
  const themeDef = NOTE_COLORS[note.color] || NOTE_COLORS.yellow;
  const isDark = note.color === 'charcoal';
  const theme = isDark ? themeDef.dark : themeDef.light;
  const previewText = note.preview.trim() || 'Empty note';
  const label = previewText.length > 80 ? `${previewText.slice(0, 80)}…` : previewText;
  const date = formatFriendlyDate(note.updated_at);
  const status = note.is_open ? 'Open' : 'Closed';

  return (
    <article
      className={`note-card ${isDark ? 'dark' : ''}`}
      style={{
        backgroundColor: theme.body,
        color: theme.text,
        borderColor: theme.border,
        borderTopColor: theme.header,
      }}
    >
      <button
        type="button"
        className="note-card-open"
        aria-label={`Open note: ${label}`}
        aria-description={`${status}. Updated ${date}.`}
        onClick={() => onOpen(note.id)}
      >
        <span className="note-card-header">
          <span className="note-card-date">{date}</span>
          <span className={`note-card-badge ${note.is_open ? 'badge-open' : 'badge-closed'}`}>
            {status}
          </span>
        </span>
        <span className="note-card-preview">{previewText}</span>
      </button>
      <button
        type="button"
        className="card-delete-icon-btn app-no-drag"
        title="Delete note"
        aria-label={`Delete note: ${label}`}
        onClick={() => onDelete(note.id)}
      >
        <Trash2 size={16} />
      </button>
    </article>
  );
};

export const NoteCard = React.memo(NoteCardComponent);
