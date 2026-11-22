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
  const [error, setError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [isDeleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const container = useRef<HTMLDivElement>(null);
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
    flush: () => Promise<void>;
  } | null>(null);

  const setEditorApi = useCallback((api: NonNullable<typeof editorApiRef.current>) => {
    editorApiRef.current = api;
  }, []);

  // Load note data on mount
  useEffect(() => {
    let isMounted = true;
    setError('');
    window.stickyNotesAPI.getNote(noteId).then((data) => {
      if (!isMounted) return;
      if (!data) throw new Error('Missing note');
      setNote(data);
    }).catch(() => {
      if (isMounted) setError('Could not load this note.');
    });
    return () => { isMounted = false; };
  }, [noteId, loadAttempt]);

  useEffect(() => {
    const unsubscribe = window.stickyNotesAPI.onFlushRequested(async () => {
      if (container.current) container.current.inert = true;
      await editorApiRef.current?.flush();
    });
    const resume = window.stickyNotesAPI.onFlushCancelled(() => {
      if (container.current) container.current.inert = false;
    });
    return () => { unsubscribe(); resume(); };
  }, []);

  const activeColor = note?.color || 'yellow';
  const themeDef = NOTE_COLORS[activeColor] || NOTE_COLORS.yellow;
  const isDark = activeColor === 'charcoal';
  const currentTheme = isDark ? themeDef.dark : themeDef.light;

  const handleColorChange = useCallback(async (color: NoteColor) => {
    try {
      const saved = await window.stickyNotesAPI.updateNote(noteId, { color });
      setNote((prev) => prev && { ...prev, color: saved.color });
      setError('');
    } catch { setError('Could not change the note color.'); }
  }, [noteId]);

  const handleContentChange = useCallback(async (html: string, plain: string) => {
    const saved = await window.stickyNotesAPI.updateNote(noteId, {
      content_html: html,
      content_plain: plain,
    });
    if (!saved) throw new Error('The note could not be saved.');
  }, [noteId]);

  const handleTogglePin = useCallback(async () => {
    try {
      const pinned = await window.stickyNotesAPI.togglePin(noteId);
      setNote((prev) => prev && { ...prev, is_pinned: pinned ? 1 : 0 });
      setError('');
    } catch { setError('Could not change the pin.'); }
  }, [noteId]);

  const handleNewNote = useCallback(() => {
    window.stickyNotesAPI.createNote({ color: note?.color || 'yellow' })
      .catch(() => setError('Could not create a note.'));
  }, [note?.color]);

  const handleCloseNote = useCallback(() => {
    window.stickyNotesAPI.closeNoteWindow(noteId)
      .catch(() => setError('Could not close this note.'));
  }, [noteId]);

  const handleConfirmDelete = async () => {
    setDeleteError('');
    setDeleting(true);
    try {
      await window.stickyNotesAPI.deleteNote(noteId);
    } catch {
      setDeleteError('Could not delete this note. Try again.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      ref={container}
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
          isMenuOpen={isMenuOpen}
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
          onOpenManager={() => window.stickyNotesAPI.showManagerWindow().catch(() => setError('Could not open the notes list.'))}
          onDeleteNote={() => { setDeleteError(''); setIsDeleteModalOpen(true); }}
          onClose={() => setIsMenuOpen(false)}
        />
      )}

      {/* Rich Editor */}
      {error && <div role="alert">{error} {!note && <button onClick={() => setLoadAttempt(n => n + 1)}>Retry</button>}</div>}
      {note && <RichEditor
        key={note.id}
        initialHtml={note.content_html}
        placeholder="Take a note..."
        onChange={handleContentChange}
        onFormatChange={setActiveFormats}
        editorRefExpose={setEditorApi}
      />}

      {/* Bottom Formatting Toolbar */}
      <EditorToolbar
        activeFormats={activeFormats}
        onFormat={(cmd, val) => editorApiRef.current?.format(cmd, val)}
        onInsertChecklist={() => editorApiRef.current?.insertChecklist()}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteModal
        isOpen={isDeleteModalOpen}
        error={deleteError}
        isDeleting={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setIsDeleteModalOpen(false)}
      />
    </div>
  );
};
