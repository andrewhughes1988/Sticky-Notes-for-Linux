import React from 'react';
import { Plus, MoreHorizontal, X } from 'lucide-react';
import { PinIcon } from './PinIcon';

interface NoteHeaderProps {
  isMenuOpen: boolean;
  isPinned: boolean;
  menuButtonRef: React.RefObject<HTMLButtonElement>;
  onNewNote: () => void;
  onTogglePin: () => void;
  onToggleMenu: () => void;
  onCloseNote: () => void;
}

const NoteHeaderComponent: React.FC<NoteHeaderProps> = ({
  isMenuOpen,
  isPinned,
  menuButtonRef,
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
          aria-label="New note"
          title="New note (Ctrl+N)"
          onClick={onNewNote}
        >
          <Plus size={16} aria-hidden="true" />
        </button>
      </div>

      {/* Center Drag Region Spacer */}
      <div className="header-title-spacer app-drag-region" />

      {/* Right Controls: Pin, Menu (...), Close (X) */}
      <div className="header-right app-no-drag">
        <button
          type="button"
          className={`header-btn ${isPinned ? 'active' : ''}`}
          aria-label={isPinned ? 'Unpin from top' : 'Pin always on top'}
          title={isPinned ? 'Unpin from top' : 'Always on top'}
          style={{ opacity: isPinned ? 1 : 0.7 }}
          aria-pressed={isPinned}
          onClick={onTogglePin}
        >
          <PinIcon isPinned={isPinned} size={16} />
        </button>

        <button
          ref={menuButtonRef}
          type="button"
          className="header-btn"
          aria-label="Note options"
          aria-expanded={isMenuOpen}
          aria-haspopup="dialog"
          title="Menu"
          onClick={onToggleMenu}
        >
          <MoreHorizontal size={16} aria-hidden="true" />
        </button>

        <button
          type="button"
          className="header-btn close-btn"
          aria-label="Close note"
          title="Close note"
          onClick={onCloseNote}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

export const NoteHeader = React.memo(NoteHeaderComponent);
