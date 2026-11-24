import React from 'react';
import { RotateCcw } from 'lucide-react';
import { DeletedNotePreview, NOTE_COLORS } from '../../shared/types';
import { formatFriendlyDate } from '../utils/date';

interface TrashCardProps {
  note: DeletedNotePreview;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
}

export const TrashCard: React.FC<TrashCardProps> = ({ note, onRestore, onDelete }) => {
  const theme = NOTE_COLORS[note.color] || NOTE_COLORS.yellow;
  const previewText = note.preview.trim() || 'Empty note';
  return (
    <article
      className={`note-card note-card-trash ${theme.isDark ? 'dark' : ''}`}
      data-color={theme.id}
    >
      <div className="note-card-trash-body">
        <div className="note-card-header">
          <span className="note-card-date">Deleted {formatFriendlyDate(note.deleted_at)}</span>
        </div>
        <div className="note-card-preview">{previewText}</div>
        <div className="note-card-trash-actions">
          <button type="button" className="modal-btn" onClick={() => onRestore(note.id)}>
            <RotateCcw size={13} aria-hidden="true" /> Restore
          </button>
          <button type="button" className="modal-btn danger" onClick={() => onDelete(note.id)}>
            Delete forever
          </button>
        </div>
      </div>
    </article>
  );
};
