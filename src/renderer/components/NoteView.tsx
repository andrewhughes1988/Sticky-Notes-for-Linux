import React, { useEffect, useState, useRef } from 'react';
import { Note, NoteColor, NOTE_COLORS } from '../../shared/types';
import { NoteHeader } from './NoteHeader';
import { ColorPicker } from './ColorPicker';
import { RichEditor } from './RichEditor';
import { EditorToolbar } from './EditorToolbar';
import { DeleteModal } from './DeleteModal';

interface NoteViewProps {
  noteId: string;
}

export const NoteView: React.FC<NoteViewProps> = ({ noteId }) => {
  const [note, setNote] = useState<Note | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    list: false,
    checklist: false,
  });

  const editorApiRef = useRef<{
    format: (cmd: string, val?: string) => void;
    insertChecklist: () => void;
    flush: () => void;
  } | null>(null);

  // Load note data on mount
  useEffect(() => {
    window.stickyNotesAPI.getNote(noteId).then((data) => {
      if (data) {
        setNote(data);
      }
    });

    const unsubscribe = window.stickyNotesAPI.onNoteUpdated((updatedNote) => {
      if (updatedNote.id === noteId) {
        setNote((prev) => (prev ? { ...prev, ...updatedNote } : updatedNote));
      }
    });

    return () => {
      unsubscribe();
    };
  }, [noteId]);

  if (!note) {
    return <div style={{ height: '100%', background: '#FFF9C4' }} />;
  }

  const themeDef = NOTE_COLORS[note.color] || NOTE_COLORS.yellow;
  const isDark = note.color === 'charcoal'; // or match system theme
  const currentTheme = isDark ? themeDef.dark : themeDef.light;

  const handleColorChange = (newColor: NoteColor) => {
    editorApiRef.current?.flush();
    setNote((prev) => (prev ? { ...prev, color: newColor } : null));
    window.stickyNotesAPI.updateNote(note.id, { color: newColor });
  };

  const handleContentChange = (html: string, plain: string) => {
    window.stickyNotesAPI.updateNote(note.id, {
      content_html: html,
      content_plain: plain,
    });
  };

  const handleTogglePin = async () => {
    const newPinned = await window.stickyNotesAPI.togglePin(note.id);
    setNote((prev) => (prev ? { ...prev, is_pinned: newPinned ? 1 : 0 } : null));
  };

  const handleNewNote = () => {
    editorApiRef.current?.flush();
    window.stickyNotesAPI.createNote({ color: note.color });
  };

  const handleCloseNote = () => {
    editorApiRef.current?.flush();
    window.stickyNotesAPI.closeNoteWindow(note.id);
  };

  const handleConfirmDelete = () => {
    setIsDeleteModalOpen(false);
    window.stickyNotesAPI.deleteNote(note.id);
  };

  return (
    <div
      className={`note-container ${isDark ? 'dark' : ''}`}
      style={
        {
          backgroundColor: currentTheme.body,
          color: currentTheme.text,
          borderColor: currentTheme.border,
          '--theme-border': currentTheme.border,
          '--theme-header-border': currentTheme.headerBorder,
          '--theme-btn-hover': currentTheme.buttonHover,
          '--theme-btn-active': currentTheme.buttonActive,
          '--theme-toolbar-bg': currentTheme.toolbarBg,
          '--theme-placeholder': currentTheme.placeholder,
        } as React.CSSProperties
      }
    >
      {/* Header Bar */}
      <div
        style={
          {
            backgroundColor: currentTheme.header,
            color: currentTheme.headerText,
            borderBottom: `1px solid ${currentTheme.headerBorder}`,
            '--header-btn-hover': currentTheme.headerBtnHover,
            '--header-btn-active': currentTheme.headerBtnActive,
          } as React.CSSProperties
        }
      >
        <NoteHeader
          isPinned={note.is_pinned === 1}
          onNewNote={handleNewNote}
          onTogglePin={handleTogglePin}
          onToggleMenu={() => setIsMenuOpen(!isMenuOpen)}
          onCloseNote={handleCloseNote}
        />
      </div>

      {/* Color & Actions Menu Popover */}
      {isMenuOpen && (
        <ColorPicker
          currentColor={note.color}
          onSelectColor={handleColorChange}
          onOpenManager={() => window.stickyNotesAPI.showManagerWindow()}
          onDeleteNote={() => setIsDeleteModalOpen(true)}
          onClose={() => setIsMenuOpen(false)}
        />
      )}

      {/* Rich Editor */}
      <RichEditor
        initialHtml={note.content_html}
        placeholder="Take a note..."
        onChange={handleContentChange}
        onFormatChange={setActiveFormats}
        editorRefExpose={(api) => {
          editorApiRef.current = api;
        }}
      />

      {/* Bottom Formatting Toolbar */}
      <EditorToolbar
        activeFormats={activeFormats}
        onFormat={(cmd, val) => editorApiRef.current?.format(cmd, val)}
        onInsertChecklist={() => editorApiRef.current?.insertChecklist()}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteModal
        isOpen={isDeleteModalOpen}
        onConfirm={handleConfirmDelete}
        onCancel={() => setIsDeleteModalOpen(false)}
      />
    </div>
  );
};
