import React from 'react';
import { Bold, Italic, Underline, Strikethrough, List, CheckSquare } from 'lucide-react';

export interface ActiveFormatFlags {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  list: boolean;
  checklist: boolean;
}

interface EditorToolbarProps {
  onFormat: (command: string) => void;
  activeFormats: ActiveFormatFlags;
  onInsertChecklist: () => void;
}

const preventFocusSteal = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.preventDefault();
};

const EditorToolbarComponent: React.FC<EditorToolbarProps> = ({
  onFormat,
  activeFormats,
  onInsertChecklist,
}) => {
  return (
    <div className="note-toolbar app-no-drag" role="toolbar" aria-label="Text formatting">
      <button
        type="button"
        className={`toolbar-btn ${activeFormats.bold ? 'active' : ''}`}
        aria-label="Bold"
        aria-pressed={activeFormats.bold}
        title="Bold (Ctrl+B)"
        onMouseDown={preventFocusSteal}
        onClick={() => onFormat('bold')}
      >
        <Bold size={15} aria-hidden="true" />
      </button>

      <button
        type="button"
        className={`toolbar-btn ${activeFormats.italic ? 'active' : ''}`}
        aria-label="Italic"
        aria-pressed={activeFormats.italic}
        title="Italic (Ctrl+I)"
        onMouseDown={preventFocusSteal}
        onClick={() => onFormat('italic')}
      >
        <Italic size={15} aria-hidden="true" />
      </button>

      <button
        type="button"
        className={`toolbar-btn ${activeFormats.underline ? 'active' : ''}`}
        aria-label="Underline"
        aria-pressed={activeFormats.underline}
        title="Underline (Ctrl+U)"
        onMouseDown={preventFocusSteal}
        onClick={() => onFormat('underline')}
      >
        <Underline size={15} aria-hidden="true" />
      </button>

      <button
        type="button"
        className={`toolbar-btn ${activeFormats.strike ? 'active' : ''}`}
        aria-label="Strikethrough"
        aria-pressed={activeFormats.strike}
        title="Strikethrough (Ctrl+T)"
        onMouseDown={preventFocusSteal}
        onClick={() => onFormat('strikeThrough')}
      >
        <Strikethrough size={15} aria-hidden="true" />
      </button>

      <button
        type="button"
        className={`toolbar-btn ${activeFormats.list ? 'active' : ''}`}
        aria-label="Bulleted list"
        aria-pressed={activeFormats.list}
        title="Bulleted list (Ctrl+Shift+L)"
        onMouseDown={preventFocusSteal}
        onClick={() => onFormat('insertUnorderedList')}
      >
        <List size={15} aria-hidden="true" />
      </button>

      <button
        type="button"
        className={`toolbar-btn ${activeFormats.checklist ? 'active' : ''}`}
        aria-label="Checklist"
        aria-pressed={activeFormats.checklist}
        title="Task list / Checklist"
        onMouseDown={preventFocusSteal}
        onClick={onInsertChecklist}
      >
        <CheckSquare size={15} aria-hidden="true" />
      </button>
    </div>
  );
};

export const EditorToolbar = React.memo(EditorToolbarComponent);
