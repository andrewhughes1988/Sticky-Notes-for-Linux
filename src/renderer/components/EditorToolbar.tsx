import React from 'react';
import { Bold, Italic, Underline, Strikethrough, List, CheckSquare } from 'lucide-react';

interface EditorToolbarProps {
  onFormat: (command: string, value?: string) => void;
  activeFormats: {
    bold: boolean;
    italic: boolean;
    underline: boolean;
    strike: boolean;
    list: boolean;
    checklist: boolean;
  };
  onInsertChecklist: () => void;
}

const EditorToolbarComponent: React.FC<EditorToolbarProps> = ({
  onFormat,
  activeFormats,
  onInsertChecklist,
}) => {
  return (
    <div className="note-toolbar app-no-drag">
      <button
        type="button"
        className={`toolbar-btn ${activeFormats.bold ? 'active' : ''}`}
        title="Bold (Ctrl+B)"
        onMouseDown={(e) => {
          e.preventDefault();
          onFormat('bold');
        }}
      >
        <Bold size={15} />
      </button>

      <button
        type="button"
        className={`toolbar-btn ${activeFormats.italic ? 'active' : ''}`}
        title="Italic (Ctrl+I)"
        onMouseDown={(e) => {
          e.preventDefault();
          onFormat('italic');
        }}
      >
        <Italic size={15} />
      </button>

      <button
        type="button"
        className={`toolbar-btn ${activeFormats.underline ? 'active' : ''}`}
        title="Underline (Ctrl+U)"
        onMouseDown={(e) => {
          e.preventDefault();
          onFormat('underline');
        }}
      >
        <Underline size={15} />
      </button>

      <button
        type="button"
        className={`toolbar-btn ${activeFormats.strike ? 'active' : ''}`}
        title="Strikethrough (Ctrl+T)"
        onMouseDown={(e) => {
          e.preventDefault();
          onFormat('strikeThrough');
        }}
      >
        <Strikethrough size={15} />
      </button>

      <button
        type="button"
        className={`toolbar-btn ${activeFormats.list ? 'active' : ''}`}
        title="Bulleted List"
        onMouseDown={(e) => {
          e.preventDefault();
          onFormat('insertUnorderedList');
        }}
      >
        <List size={15} />
      </button>

      <button
        type="button"
        className={`toolbar-btn ${activeFormats.checklist ? 'active' : ''}`}
        title="Task List / Checklist"
        onMouseDown={(e) => {
          e.preventDefault();
          onInsertChecklist();
        }}
      >
        <CheckSquare size={15} />
      </button>
    </div>
  );
};

export const EditorToolbar = React.memo(EditorToolbarComponent);
