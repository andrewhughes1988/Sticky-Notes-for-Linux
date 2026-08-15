import React from 'react';
import { Plus, MoreHorizontal, X, Pin } from 'lucide-react';

interface NoteHeaderProps {
  isPinned: boolean;
  onNewNote: () => void;
  onTogglePin: () => void;
  onToggleMenu: () => void;
  onCloseNote: () => void;
}

export const NoteHeader: React.FC<NoteHeaderProps> = ({
  isPinned,
  onNewNote,
  onTogglePin,
  onToggleMenu,
  onCloseNote,
}) => {
  return (
    <div className="note-header app-drag-region">
      {/* Left: New Note (+) Button */}
      <div className="header-left app-no-drag">
        <button
          type="button"
          className="header-btn"
          title="New note (Ctrl+N)"
          onClick={onNewNote}
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Center Drag Region Spacer */}
      <div className="header-title-spacer app-drag-region" />

      {/* Right Controls: Pin, Menu (...), Close (X) */}
      <div className="header-right app-no-drag">
        <button
          type="button"
          className={`header-btn ${isPinned ? 'active' : ''}`}
          title={isPinned ? 'Unpin from top' : 'Always on top'}
          style={{ opacity: isPinned ? 1 : 0.7 }}
          onClick={onTogglePin}
        >
          <Pin size={14} style={{ transform: isPinned ? 'rotate(45deg)' : 'none' }} />
        </button>

        <button
          type="button"
          className="header-btn"
          title="Menu"
          onClick={onToggleMenu}
        >
          <MoreHorizontal size={16} />
        </button>

        <button
          type="button"
          className="header-btn close-btn"
          title="Close note"
          onClick={onCloseNote}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
