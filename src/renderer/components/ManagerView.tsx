import React, { useEffect, useState, useCallback, useRef } from 'react';
import { NoteCard } from './NoteCard';
import { DeleteModal } from './DeleteModal';
import { ManagerMenu } from './ManagerMenu';
import { StickyNoteIcon } from './StickyNoteIcon';
import { TrashCard } from './TrashCard';
import { useNotesList } from './useNotesList';
import { useManagerSettings } from './useManagerSettings';
import { Plus, Search, X, Settings, Trash2 } from 'lucide-react';

export const ManagerView: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    notes,
    setNotes,
    deletedNotes,
    setDeletedNotes,
    searchQuery,
    setSearchQuery,
    page,
    setPage,
    hasMore,
    isLoading,
    setIsLoading,
    loadError,
    setLoadError,
    refreshNotes,
    changeSearch,
    changePage,
  } = useNotesList();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const {
    isDarkMode,
    autostart,
    isUpdatingAutostart,
    autostartError,
    encryption,
    isUpdatingEncryption,
    backupCount,
    toggleTheme,
    handleAutostartChange,
    handleEncryptionChange,
    handlePurgeBackups,
    handleRetrySettings,
  } = useManagerSettings(setActionError, setActionStatus);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [permanentDeleteId, setPermanentDeleteId] = useState<string | null>(null);
  const [confirmEmptyTrash, setConfirmEmptyTrash] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const restoreSearchFocus = useRef(false);

  // Keyboard shortcuts: Ctrl+N (new note), Ctrl+F (focus search), Ctrl+Q (quit), Escape (clear search)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey) {
        const key = event.key.toLowerCase();
        if (key === 'n' && !event.shiftKey) {
          event.preventDefault();
          void window.stickyNotesAPI.createNote().catch(() => {
            setActionError('Could not create a note. Try again.');
          });
        } else if (key === 'f' && !event.shiftKey) {
          event.preventDefault();
          setIsMenuOpen(false);
          setActiveTab('notes');
          setTimeout(() => searchInputRef.current?.focus(), 0);
        } else if (key === 'q' && !event.shiftKey) {
          event.preventDefault();
          void window.stickyNotesAPI.quitApp().catch(() => {});
        }
      } else if (
        event.key === 'Escape' &&
        document.activeElement === searchInputRef.current &&
        searchQuery
      ) {
        event.preventDefault();
        setSearchQuery('');
        setPage(0);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [searchQuery, setActiveTab, setPage, setSearchQuery]);

  const runAction = useCallback(
    async (action: () => Promise<unknown>, errorMessage: string, successMessage?: string) => {
      setActionError(null);
      setActionStatus(null);
      try {
        await action();
        if (successMessage) setActionStatus(successMessage);
      } catch {
        setActionError(errorMessage);
      }
    },
    []
  );

  const handleOpenNote = useCallback(
    (id: string) => {
      void runAction(
        () => window.stickyNotesAPI.openNoteWindow(id),
        'Could not open the note. Try again.'
      );
    },
    [runAction]
  );

  const handleRequestDelete = useCallback((id: string) => {
    setDeleteError(null);
    setNoteToDelete(id);
  }, []);

  const handleConfirmDelete = async () => {
    if (!noteToDelete || isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await window.stickyNotesAPI.deleteNote(noteToDelete);
      restoreSearchFocus.current = true;
      setNoteToDelete(null);
      setNotes((previous) => previous.filter((note) => note.id !== noteToDelete));
      refreshNotes();
    } catch {
      setDeleteError('Could not move the note to Trash. Try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmPermanentDelete = async () => {
    if (!permanentDeleteId || isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await window.stickyNotesAPI.permanentlyDeleteNote(permanentDeleteId);
      setPermanentDeleteId(null);
      setDeletedNotes((prev) => prev.filter((n) => n.id !== permanentDeleteId));
      refreshNotes();
    } catch {
      setDeleteError('Could not permanently delete the note. Try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmEmptyTrash = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await window.stickyNotesAPI.emptyTrash();
      setConfirmEmptyTrash(false);
      setDeletedNotes([]);
      refreshNotes();
    } catch {
      setDeleteError('Could not empty Trash. Try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExport = useCallback(async (format: 'json' | 'markdown') => {
    setActionError(null);
    setActionStatus(null);
    try {
      const result = await window.stickyNotesAPI.exportNotes(format);
      if (result.exported) {
        setActionStatus(`Exported ${result.count} note${result.count === 1 ? '' : 's'}.`);
      }
    } catch {
      setActionError('Could not export notes.');
    }
  }, []);

  const handleToggleTrashView = useCallback(() => {
    setIsLoading(true);
    setActiveTab((tab) => (tab === 'notes' ? 'trash' : 'notes'));
  }, [setActiveTab, setIsLoading]);

  const handleCloseMenu = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  const handleExportJson = useCallback(() => {
    void handleExport('json');
  }, [handleExport]);

  const handleExportMarkdown = useCallback(() => {
    void handleExport('markdown');
  }, [handleExport]);

  const handleToggleThemeSync = useCallback(() => {
    void toggleTheme();
  }, [toggleTheme]);

  const handleToggleAutostartSync = useCallback(
    (enabled: boolean) => {
      void handleAutostartChange(enabled);
    },
    [handleAutostartChange]
  );

  const handleToggleEncryptionSync = useCallback(
    (enabled: boolean) => {
      void handleEncryptionChange(enabled);
    },
    [handleEncryptionChange]
  );

  const handlePurgeBackupsSync = useCallback(() => {
    void handlePurgeBackups();
  }, [handlePurgeBackups]);

  useEffect(() => {
    if (noteToDelete === null && restoreSearchFocus.current) {
      restoreSearchFocus.current = false;
      searchInputRef.current?.focus();
    }
  }, [noteToDelete]);

  return (
    <div className={`manager-container ${isDarkMode ? 'dark' : 'light'}`}>
      <header className="manager-header app-drag-region">
        <div className="manager-title">
          <StickyNoteIcon size={18} />
          <span>Sticky Notes</span>
        </div>

        <div className="manager-controls app-no-drag">
          <button
            ref={menuButtonRef}
            type="button"
            className={`header-btn ${isMenuOpen ? 'active' : ''}`}
            aria-label="Settings and actions"
            aria-expanded={isMenuOpen}
            aria-haspopup="dialog"
            title="Settings &amp; menu"
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            <Settings size={15} aria-hidden="true" />
          </button>

          <button
            type="button"
            className="header-btn close-btn"
            aria-label="Close notes list"
            title="Close notes list"
            onClick={() =>
              void runAction(
                () => window.stickyNotesAPI.closeManagerWindow(),
                'Could not close the notes list. Try again.'
              )
            }
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      </header>

      {isMenuOpen && (
        <ManagerMenu
          isDarkMode={isDarkMode}
          isTrashView={activeTab === 'trash'}
          autostart={autostart}
          isUpdatingAutostart={isUpdatingAutostart}
          autostartError={autostartError}
          encryption={encryption}
          isUpdatingEncryption={isUpdatingEncryption}
          backupCount={backupCount}
          triggerRef={menuButtonRef}
          onToggleTheme={handleToggleThemeSync}
          onToggleAutostart={handleToggleAutostartSync}
          onRetrySettings={handleRetrySettings}
          onToggleEncryption={handleToggleEncryptionSync}
          onToggleTrashView={handleToggleTrashView}
          onExportJson={handleExportJson}
          onExportMarkdown={handleExportMarkdown}
          onPurgeBackups={handlePurgeBackupsSync}
          onClose={handleCloseMenu}
        />
      )}

      {activeTab === 'notes' ? (
        <div className="manager-search-bar app-no-drag">
          <div className="search-input-wrapper">
            <Search size={15} color={isDarkMode ? '#AAAAAA' : '#666666'} aria-hidden="true" />
            <input
              ref={searchInputRef}
              type="text"
              className="search-input"
              aria-label="Search notes"
              placeholder="Search notes… (Ctrl+F)"
              value={searchQuery}
              onChange={(event) => changeSearch(event.target.value)}
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear-btn"
                aria-label="Clear search"
                title="Clear search (Esc)"
                onClick={() => {
                  changeSearch('');
                  searchInputRef.current?.focus();
                }}
              >
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </div>

          <button
            type="button"
            className="add-note-btn"
            aria-label="Create note"
            title="Create note (Ctrl+N)"
            onClick={() =>
              void runAction(
                () => window.stickyNotesAPI.createNote(),
                'Could not create a note. Try again.'
              )
            }
          >
            <Plus size={18} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div className="manager-trash-bar app-no-drag">
          <span className="manager-trash-title">Trash ({deletedNotes.length})</span>
          <div className="manager-trash-actions">
            <button
              type="button"
              className="modal-btn"
              onClick={() => {
                setIsLoading(true);
                setActiveTab('notes');
              }}
            >
              Back
            </button>
            {deletedNotes.length > 0 && (
              <button
                type="button"
                className="modal-btn danger"
                onClick={() => {
                  setDeleteError(null);
                  setConfirmEmptyTrash(true);
                }}
              >
                Empty Trash
              </button>
            )}
          </div>
        </div>
      )}

      {actionError && (
        <p className="manager-status manager-status-error" role="alert">
          {actionError}
        </p>
      )}
      {actionStatus && (
        <p className="manager-status" role="status">
          {actionStatus}
        </p>
      )}

      <main
        className="manager-notes-list app-no-drag"
        aria-label={activeTab === 'notes' ? 'Notes' : 'Trash'}
      >
        {loadError && (
          <div className="manager-status">
            <span role="alert">Could not load notes.</span>
            <button
              type="button"
              className="modal-btn"
              onClick={() => {
                setLoadError(false);
                setIsLoading(true);
                refreshNotes();
              }}
            >
              Retry
            </button>
          </div>
        )}
        {isLoading && notes.length === 0 && activeTab === 'notes' && (
          <p className="manager-status" role="status">
            Loading notes…
          </p>
        )}

        {activeTab === 'notes' && !isLoading && !loadError && notes.length === 0 && (
          <div className="manager-empty-state" role="status">
            <StickyNoteIcon size={40} />
            <div>{searchQuery ? 'No matching notes found.' : 'No sticky notes yet.'}</div>
          </div>
        )}

        {activeTab === 'notes' &&
          notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onOpen={handleOpenNote}
              onDelete={handleRequestDelete}
            />
          ))}

        {activeTab === 'trash' && !isLoading && !loadError && deletedNotes.length === 0 && (
          <div className="manager-empty-state" role="status">
            <Trash2 size={36} aria-hidden="true" />
            <div>Trash is empty.</div>
          </div>
        )}

        {activeTab === 'trash' &&
          deletedNotes.map((note) => (
            <TrashCard
              key={note.id}
              note={note}
              onRestore={(id) =>
                void runAction(
                  () => window.stickyNotesAPI.restoreNote(id),
                  'Could not restore the note.',
                  'Note restored.'
                )
              }
              onDelete={(id) => {
                setDeleteError(null);
                setPermanentDeleteId(id);
              }}
            />
          ))}
      </main>

      {activeTab === 'notes' && (page > 0 || hasMore) && (
        <footer className="manager-footer app-no-drag">
          <nav className="manager-pagination" aria-label="Notes pages">
            <button
              type="button"
              className="modal-btn"
              aria-disabled={page === 0 || isLoading}
              onClick={() => {
                if (page > 0 && !isLoading) changePage(page - 1);
              }}
            >
              Previous
            </button>
            <span role="status">Page {page + 1}</span>
            <button
              type="button"
              className="modal-btn"
              aria-disabled={!hasMore || isLoading}
              onClick={() => {
                if (hasMore && !isLoading) changePage(page + 1);
              }}
            >
              Next
            </button>
          </nav>
        </footer>
      )}

      <DeleteModal
        isOpen={noteToDelete !== null}
        isDeleting={isDeleting}
        error={deleteError}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setNoteToDelete(null)}
      />

      <DeleteModal
        isOpen={permanentDeleteId !== null}
        isDeleting={isDeleting}
        error={deleteError}
        title="Delete note permanently?"
        description="This note will be permanently removed and cannot be recovered."
        confirmLabel="Delete permanently"
        onConfirm={() => void handleConfirmPermanentDelete()}
        onCancel={() => setPermanentDeleteId(null)}
      />

      <DeleteModal
        isOpen={confirmEmptyTrash}
        isDeleting={isDeleting}
        error={deleteError}
        title="Empty Trash?"
        description="All notes in Trash will be permanently deleted and cannot be recovered."
        confirmLabel="Empty Trash"
        onConfirm={() => void handleConfirmEmptyTrash()}
        onCancel={() => setConfirmEmptyTrash(false)}
      />
    </div>
  );
};

export default ManagerView;
