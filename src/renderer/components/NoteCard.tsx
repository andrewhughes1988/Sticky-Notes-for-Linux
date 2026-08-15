import React from 'react';
import { Note, NOTE_COLORS } from '../../shared/types';
import { formatFriendlyDate } from '../utils/date';
import { Trash2, ExternalLink } from 'lucide-react';

interface NoteCardProps {
  note: Note;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({ note, onOpen, onDelete }) => {
  const themeDef = NOTE_COLORS[note.color] || NOTE_COLORS.yellow;
  const isDark = note.color === 'charcoal';
  const theme = isDark ? themeDef.dark : themeDef.light;

  const previewText = note.content_plain.trim() || 'Empty note';
  const displayTitle = note.title || previewText.split('\n')[0] || 'Note';

  return (
    <div
      className={`note-card ${isDark ? 'dark' : ''}`}
      style={{
        backgroundColor: theme.body,
        color: theme.text,
        borderColor: theme.border,
        borderWidth: '1.5px',
        borderTopWidth: '5px',
        borderTopColor: theme.header,
      }}
      onClick={() => onOpen(note.id)}
    >
      <div className="note-card-header">
        <span className="note-card-date">
          {formatFriendlyDate(note.updated_at)}
        </span>
        <span className={`note-card-badge ${note.is_open ? 'badge-open' : 'badge-closed'}`}>
          {note.is_open ? 'Open' : 'Closed'}
        </span>
      </div>

      <div className="note-card-title">{displayTitle}</div>

      <div className="note-card-preview">{previewText}</div>

      <div className="note-card-actions app-no-drag" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="card-action-btn"
          title="Open note on desktop"
          onClick={() => onOpen(note.id)}
        >
          <ExternalLink size={12} />
          <span>Open</span>
        </button>

        <button
          type="button"
          className="card-action-btn delete"
          title="Delete note"
          onClick={() => onDelete(note.id)}
        >
          <Trash2 size={12} />
          <span>Delete</span>
        </button>
      </div>
    </div>
  );
};
