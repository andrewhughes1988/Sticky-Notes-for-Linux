import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Note, NoteColor, NOTE_COLORS } from '../../shared/types';
import { NoteHeader } from './NoteHeader';
import { ColorPicker } from './ColorPicker';
import { RichEditor, RichEditorHandle } from './RichEditor';
import { ActiveFormatFlags, EditorToolbar } from './EditorToolbar';
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
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const [activeFormats, setActiveFormats] = useState<ActiveFormatFlags>({
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    list: false,
    checklist: false,
  });

  const editorApiRef = useRef<RichEditorHandle | null>(null);

  const setEditorApi = useCallback((api: RichEditorHandle) => {
    editorApiRef.current = api;
  }, []);

  // Load note data on mount
  useEffect(() => {
    let isMounted = true;
    window.stickyNotesAPI
      .getNote(noteId)
      .then((data) => {
        if (!isMounted) return;
        if (!data) throw new Error('Missing note');
        setError('');
        setNote(data);
      })
      .catch(() => {
        if (isMounted) setError('Could not load this note.');
      });
    return () => {
      isMounted = false;
    };
  }, [noteId, loadAttempt]);

  const activeColor = note?.color || 'yellow';
  const currentTheme = NOTE_COLORS[activeColor] || NOTE_COLORS.yellow;
  const isDark = currentTheme.isDark;

  const handleColorChange = useCallback(
    async (color: NoteColor) => {
      try {
        const saved = await window.stickyNotesAPI.updateNote(noteId, { color });
        setNote((prev) => prev && { ...prev, color: saved.color });
        setError('');
      } catch {
        setError('Could not change the note color.');
      }
    },
    [noteId]
  );

  const handleContentChange = useCallback(
    async (html: string, plain: string) => {
      const saved = await window.stickyNotesAPI.updateNote(noteId, {
        content_html: html,
        content_plain: plain,
      });
      if (!saved) throw new Error('The note could not be saved.');
    },
    [noteId]
  );

  const handleTogglePin = useCallback(async () => {
    try {
      const pinned = await window.stickyNotesAPI.togglePin(noteId);
      setNote((prev) => prev && { ...prev, is_pinned: pinned ? 1 : 0 });
      setError('');
    } catch {
      setError('Could not change the pin.');
    }
  }, [noteId]);

  const handleNewNote = useCallback(() => {
    window.stickyNotesAPI
      .createNote({ color: note?.color || 'yellow' })
      .catch(() => setError('Could not create a note.'));
  }, [note?.color]);

  const handleCloseNote = useCallback(() => {
    window.stickyNotesAPI
      .closeNoteWindow(noteId)
      .catch(() => setError('Could not close this note.'));
  }, [noteId]);

  const handleToggleMenu = useCallback(() => {
    setIsMenuOpen((open) => !open);
  }, []);

  const handleCloseMenu = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  const handleOpenManager = useCallback(() => {
    window.stickyNotesAPI
      .showManagerWindow()
      .catch(() => setError('Could not open the notes list.'));
  }, []);

  const handleRequestDelete = useCallback(() => {
    setDeleteError('');
    setIsDeleteModalOpen(true);
  }, []);

  const handleCancelDelete = useCallback(() => {
    setIsDeleteModalOpen(false);
  }, []);

  const handleFormat = useCallback((cmd: string) => {
    editorApiRef.current?.format(cmd);
  }, []);

  const handleInsertChecklist = useCallback(() => {
    editorApiRef.current?.insertChecklist();
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    setDeleteError('');
    setDeleting(true);
    try {
      await window.stickyNotesAPI.deleteNote(noteId);
    } catch {
      setDeleteError('Could not move this note to Trash. Try again.');
    } finally {
      setDeleting(false);
    }
  }, [noteId]);

  // Global window keyboard shortcuts: Ctrl+N (new note) and Ctrl+Q (quit app)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === 'n' && !event.shiftKey) {
        event.preventDefault();
        handleNewNote();
      } else if (key === 'q' && !event.shiftKey) {
        event.preventDefault();
        void window.stickyNotesAPI.quitApp().catch(() => {
          setError('Could not quit Sticky Notes. Try again.');
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleNewNote]);

  return (
    <div
      ref={container}
      className={`note-container ${isDark ? 'dark' : ''}`}
      data-color={currentTheme.id}
    >
      {/* Header Bar */}
      <div className="note-header-wrapper">
        <NoteHeader
          isMenuOpen={isMenuOpen}
          isPinned={Boolean(note?.is_pinned)}
          menuButtonRef={menuButtonRef}
          onNewNote={handleNewNote}
          onTogglePin={handleTogglePin}
          onToggleMenu={handleToggleMenu}
          onCloseNote={handleCloseNote}
        />
      </div>

      {/* Color & Actions Menu Popover */}
      {isMenuOpen && (
        <ColorPicker
          currentColor={activeColor}
          triggerRef={menuButtonRef}
          onSelectColor={handleColorChange}
          onOpenManager={handleOpenManager}
          onDeleteNote={handleRequestDelete}
          onClose={handleCloseMenu}
        />
      )}

      {/* Error Banner */}
      {error && (
        <div role="alert" className="note-error-banner app-no-drag">
          <span>{error}</span>
          {!note && (
            <button
              type="button"
              className="inline-retry-btn"
              onClick={() => {
                setError('');
                setLoadAttempt((n) => n + 1);
              }}
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Rich Editor */}
      {note && (
        <RichEditor
          key={note.id}
          initialHtml={note.content_html}
          placeholder="Take a note..."
          containerRef={container}
          onChange={handleContentChange}
          onFormatChange={setActiveFormats}
          editorRefExpose={setEditorApi}
        />
      )}

      {/* Bottom Formatting Toolbar */}
      <EditorToolbar
        activeFormats={activeFormats}
        onFormat={handleFormat}
        onInsertChecklist={handleInsertChecklist}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteModal
        isOpen={isDeleteModalOpen}
        error={deleteError}
        isDeleting={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
};

export default NoteView;
