import React from 'react';
import { NotePreview, NOTE_COLORS } from '../../shared/types';
import { formatFriendlyDate } from '../utils/date';
import { Trash2 } from 'lucide-react';
import { PinIcon } from './PinIcon';

interface NoteCardProps {
  note: NotePreview;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

const NoteCardComponent: React.FC<NoteCardProps> = ({ note, onOpen, onDelete }) => {
  const theme = NOTE_COLORS[note.color] || NOTE_COLORS.yellow;
  const previewText = note.preview.trim() || 'Empty note';
  const label = previewText.length > 80 ? `${previewText.slice(0, 80)}…` : previewText;
  const date = formatFriendlyDate(note.updated_at);
  const status = note.is_open ? 'Open' : 'Closed';

  return (
    <article className={`note-card ${theme.isDark ? 'dark' : ''}`} data-color={theme.id}>
      <button
        type="button"
        className="note-card-open"
        aria-label={`Open note: ${label} (${status}${note.is_pinned ? ', pinned' : ''}, updated ${date})`}
        onClick={() => onOpen(note.id)}
      >
        <span className="note-card-header">
          <span className="note-card-date">{date}</span>
          <span className="note-card-meta">
            {Boolean(note.is_pinned) && (
              <span className="note-card-pin" title="Pinned always on top" aria-hidden="true">
                <PinIcon isPinned={true} size={12} />
              </span>
            )}
            <span className={`note-card-badge ${note.is_open ? 'badge-open' : 'badge-closed'}`}>
              {status}
            </span>
          </span>
        </span>
        <span className="note-card-preview">{previewText}</span>
      </button>
      <button
        type="button"
        className="card-delete-icon-btn app-no-drag"
        title="Move note to Trash"
        aria-label={`Move note to Trash: ${label}`}
        onClick={() => onDelete(note.id)}
      >
        <Trash2 size={16} aria-hidden="true" />
      </button>
    </article>
  );
};

export const NoteCard = React.memo(NoteCardComponent);
