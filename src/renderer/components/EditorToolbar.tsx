import React, { useState } from 'react';
import { Bold, Italic, Underline, Strikethrough, List, CheckSquare } from 'lucide-react';
import { strings } from '../strings';

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
  const [focusedIndex, setFocusedIndex] = useState(0);
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
    const current = buttons.indexOf(event.target as HTMLButtonElement);
    if (current < 0) return;
    let next = current;
    if (event.key === 'ArrowRight') next = (current + 1) % buttons.length;
    else if (event.key === 'ArrowLeft') next = (current - 1 + buttons.length) % buttons.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = buttons.length - 1;
    else return;
    event.preventDefault();
    setFocusedIndex(next);
    buttons[next].focus();
  };

  return (
    <div className="note-toolbar app-no-drag" role="toolbar" aria-label={strings.editor.toolbar} onKeyDown={onKeyDown}>
      <button
        type="button"
        className={`toolbar-btn ${activeFormats.bold ? 'active' : ''}`}
        aria-label={strings.editor.bold}
        tabIndex={focusedIndex === 0 ? 0 : -1}
        onFocus={() => setFocusedIndex(0)}
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
        aria-label={strings.editor.italic}
        tabIndex={focusedIndex === 1 ? 0 : -1}
        onFocus={() => setFocusedIndex(1)}
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
        aria-label={strings.editor.underline}
        tabIndex={focusedIndex === 2 ? 0 : -1}
        onFocus={() => setFocusedIndex(2)}
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
        aria-label={strings.editor.strike}
        tabIndex={focusedIndex === 3 ? 0 : -1}
        onFocus={() => setFocusedIndex(3)}
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
        aria-label={strings.editor.bulletList}
        tabIndex={focusedIndex === 4 ? 0 : -1}
        onFocus={() => setFocusedIndex(4)}
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
        aria-label={strings.editor.checklist}
        tabIndex={focusedIndex === 5 ? 0 : -1}
        onFocus={() => setFocusedIndex(5)}
        aria-pressed={activeFormats.checklist}
        title="Task list / Checklist (Ctrl+Shift+7)"
        onMouseDown={preventFocusSteal}
        onClick={onInsertChecklist}
      >
        <CheckSquare size={15} aria-hidden="true" />
      </button>
    </div>
  );
};

export const EditorToolbar = React.memo(EditorToolbarComponent);
