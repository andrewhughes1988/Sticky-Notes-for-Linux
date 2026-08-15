import React, { useState } from 'react';
import { Note, NOTE_COLORS } from '../../shared/types';
import { formatFriendlyDate } from '../utils/date';
import { Trash2 } from 'lucide-react';

interface NoteCardProps {
  note: Note;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({ note, onOpen, onDelete }) => {
  const [isHovered, setIsHovered] = useState(false);
  const themeDef = NOTE_COLORS[note.color] || NOTE_COLORS.yellow;
  const isDark = note.color === 'charcoal';
  const theme = isDark ? themeDef.dark : themeDef.light;

  const rawText = (note.content_plain || '').trim();
  const previewText = rawText || 'Empty note';

  // Subtly darken header and border on hover without shifting position
  const activeHeaderColor = isHovered ? theme.headerBorder : theme.header;
  const activeBorderColor = isHovered ? theme.headerBorder : theme.border;

  const handleCardClick = () => {
    onOpen(note.id);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(note.id);
  };

  return (
    <div
      className={`note-card ${isDark ? 'dark' : ''} ${isHovered ? 'hovered' : ''}`}
      style={{
        backgroundColor: theme.body,
        color: theme.text,
        borderColor: activeBorderColor,
        borderWidth: '1.5px',
        borderTopWidth: '5px',
        borderTopColor: activeHeaderColor,
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
      }}
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="note-card-header">
        <span className="note-card-date">
          {formatFriendlyDate(note.updated_at)}
        </span>
        <div className="note-card-header-right">
          <span className={`note-card-badge ${note.is_open ? 'badge-open' : 'badge-closed'}`}>
            {note.is_open ? 'Open' : 'Closed'}
          </span>
          <button
            type="button"
            className="card-delete-icon-btn app-no-drag"
            title="Delete note"
            onClick={handleDeleteClick}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div className="note-card-preview">{previewText}</div>
    </div>
  );
};
