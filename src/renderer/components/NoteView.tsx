import React, { useEffect, useState, useRef, useCallback } from 'react';
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

  const setEditorApi = useCallback((api: any) => {
    editorApiRef.current = api;
  }, []);

  // Load note data on mount
  useEffect(() => {
    let isMounted = true;
    window.stickyNotesAPI.getNote(noteId).then((data) => {
      if (!isMounted) return;
      if (data) {
        setNote(data);
      } else {
        // If note is missing from DB, create a default note record
        window.stickyNotesAPI.createNote({ id: noteId, color: 'yellow' }).then((created) => {
          if (isMounted && created) setNote(created);
        });
      }
    });

    const unsubscribe = window.stickyNotesAPI.onNoteUpdated((updatedNote) => {
      if (isMounted && updatedNote.id === noteId) {
        setNote((prev) => (prev ? { ...prev, ...updatedNote } : updatedNote));
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [noteId]);

  const activeColor = note?.color || 'yellow';
  const themeDef = NOTE_COLORS[activeColor] || NOTE_COLORS.yellow;
  const isDark = activeColor === 'charcoal';
  const currentTheme = isDark ? themeDef.dark : themeDef.light;

  const handleColorChange = useCallback((newColor: NoteColor) => {
    if (!note) return;
    editorApiRef.current?.flush();
    setNote((prev) => (prev ? { ...prev, color: newColor } : null));
    window.stickyNotesAPI.updateNote(note.id, { color: newColor });
  }, [note]);

  const handleContentChange = useCallback((html: string, plain: string) => {
    window.stickyNotesAPI.updateNote(noteId, {
      content_html: html,
      content_plain: plain,
    });
  }, [noteId]);

  const handleTogglePin = useCallback(async () => {
    if (!note) return;
    const newPinned = await window.stickyNotesAPI.togglePin(note.id);
    setNote((prev) => (prev ? { ...prev, is_pinned: newPinned ? 1 : 0 } : null));
  }, [note]);

  const handleNewNote = useCallback(() => {
    editorApiRef.current?.flush();
    window.stickyNotesAPI.createNote({ color: note?.color || 'yellow' });
  }, [note?.color]);

  const handleCloseNote = useCallback(() => {
    editorApiRef.current?.flush();
    window.stickyNotesAPI.closeNoteWindow(noteId);
  }, [noteId]);

  const handleConfirmDelete = useCallback(() => {
    setIsDeleteModalOpen(false);
    window.stickyNotesAPI.deleteNote(noteId);
  }, [noteId]);

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
          isPinned={Boolean(note?.is_pinned)}
          onNewNote={handleNewNote}
          onTogglePin={handleTogglePin}
          onToggleMenu={() => setIsMenuOpen(!isMenuOpen)}
          onCloseNote={handleCloseNote}
        />
      </div>

      {/* Color & Actions Menu Popover */}
      {isMenuOpen && (
        <ColorPicker
          currentColor={activeColor}
          onSelectColor={handleColorChange}
          onOpenManager={() => window.stickyNotesAPI.showManagerWindow()}
          onDeleteNote={() => setIsDeleteModalOpen(true)}
          onClose={() => setIsMenuOpen(false)}
        />
      )}

      {/* Rich Editor */}
      <RichEditor
        initialHtml={note?.content_html || ''}
        placeholder="Take a note..."
        onChange={handleContentChange}
        onFormatChange={setActiveFormats}
        editorRefExpose={setEditorApi}
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
