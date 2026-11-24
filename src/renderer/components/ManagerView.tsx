import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  AppTheme,
  DeletedNotePreview,
  EncryptionStatus,
  NotePreview,
  NOTE_COLORS,
} from '../../shared/types';
import { NoteCard } from './NoteCard';
import { DeleteModal } from './DeleteModal';
import { ManagerMenu } from './ManagerMenu';
import { StickyNoteIcon } from './StickyNoteIcon';
import { formatFriendlyDate } from '../utils/date';
import { Plus, Search, X, Settings, Trash2, RotateCcw } from 'lucide-react';

const PAGE_SIZE = 40;

type ManagerTab = 'notes' | 'trash';

export const ManagerView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ManagerTab>('notes');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [notes, setNotes] = useState<NotePreview[]>([]);
  const [deletedNotes, setDeletedNotes] = useState<DeletedNotePreview[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [permanentDeleteId, setPermanentDeleteId] = useState<string | null>(null);
  const [confirmEmptyTrash, setConfirmEmptyTrash] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [autostart, setAutostart] = useState<boolean | null>(null);
  const [themePref, setThemePref] = useState<AppTheme>('system');
  const [systemDark, setSystemDark] = useState<boolean>(() =>
    Boolean(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
  );
  const [isUpdatingAutostart, setIsUpdatingAutostart] = useState(false);
  const [autostartError, setAutostartError] = useState<string | null>(null);
  const [encryption, setEncryption] = useState<EncryptionStatus | null>(null);
  const [isUpdatingEncryption, setIsUpdatingEncryption] = useState(false);
  const [backupCount, setBackupCount] = useState(0);
  const [settingsRetry, setSettingsRetry] = useState(0);
  const [revision, setRevision] = useState(0);
  const requestId = useRef(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const restoreSearchFocus = useRef(false);

  const isDarkMode = themePref === 'dark' || (themePref === 'system' && systemDark);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  useEffect(() => {
    if (!window.matchMedia) return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    mql.addEventListener('change', listener);
    return () => mql.removeEventListener('change', listener);
  }, []);

  const toggleTheme = useCallback(async () => {
    const next: AppTheme = isDarkMode ? 'light' : 'dark';
    setThemePref(next);
    try {
      await window.stickyNotesAPI.setConfig('theme', next);
    } catch {
      setActionError('Could not save theme preference.');
    }
  }, [isDarkMode]);

  const refreshNotes = useCallback(() => {
    requestId.current++;
    setRevision((previous) => previous + 1);
  }, []);

  useEffect(() => {
    const unsubChanged = window.stickyNotesAPI.onNotesChanged(refreshNotes);
    return () => {
      unsubChanged();
    };
  }, [refreshNotes]);

  // Load active notes or Trash depending on tab
  useEffect(() => {
    let cancelled = false;
    const id = ++requestId.current;
    const delay = activeTab === 'notes' ? 150 : 0;
    const timer = setTimeout(async () => {
      try {
        if (activeTab === 'notes') {
          const result = await window.stickyNotesAPI.getNotePreviews({
            search: searchQuery,
            limit: PAGE_SIZE + 1,
            offset: page * PAGE_SIZE,
          });
          if (cancelled || requestId.current !== id) return;
          if (page > 0 && result.length === 0) {
            setIsLoading(true);
            setPage(page - 1);
            return;
          }
          setNotes(result.slice(0, PAGE_SIZE));
          setHasMore(result.length > PAGE_SIZE);
          setLoadError(false);
        } else {
          const trash = await window.stickyNotesAPI.getDeletedNotes();
          if (cancelled || requestId.current !== id) return;
          setDeletedNotes(trash);
          setLoadError(false);
        }
      } catch {
        if (!cancelled && requestId.current === id) setLoadError(true);
      } finally {
        if (!cancelled && requestId.current === id) setIsLoading(false);
      }
    }, delay);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeTab, page, revision, searchQuery]);

  // Load settings from SQLite + migrate legacy localStorage('manager_theme') once
  useEffect(() => {
    let active = true;
    let receivedAutostart = false;
    let receivedTheme = false;

    const unsubscribe = window.stickyNotesAPI.onSettingsChanged((key, value) => {
      if (key === 'autostart' && typeof value === 'boolean') {
        receivedAutostart = true;
        setAutostart(value);
        setAutostartError(null);
      } else if (key === 'theme' && (value === 'system' || value === 'light' || value === 'dark')) {
        receivedTheme = true;
        setThemePref(value);
      }
    });

    window.stickyNotesAPI.getConfig().then(
      (config) => {
        if (!active) return;
        if (!receivedAutostart) {
          setAutostart(config.autostart);
          setAutostartError(null);
        }
        if (!receivedTheme) {
          let resolvedTheme: AppTheme = config.theme;
          try {
            const legacy = localStorage.getItem('manager_theme');
            if ((legacy === 'dark' || legacy === 'light') && config.theme === 'system') {
              resolvedTheme = legacy;
              void window.stickyNotesAPI.setConfig('theme', legacy).catch(() => {});
            }
            if (legacy !== null) localStorage.removeItem('manager_theme');
          } catch {
            // Ignore storage access errors
          }
          setThemePref(resolvedTheme);
        }
      },
      () => {
        if (active && !receivedAutostart) {
          setAutostartError('Could not load settings.');
        }
      }
    );

    window.stickyNotesAPI
      .getMigrationBackupCount()
      .then((count) => {
        if (active) setBackupCount(count);
      })
      .catch(() => {});

    window.stickyNotesAPI
      .getEncryptionStatus()
      .then((status) => {
        if (active) setEncryption(status);
      })
      .catch(() => {});

    return () => {
      active = false;
      unsubscribe();
    };
  }, [settingsRetry]);

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
  }, [searchQuery]);

  const handleAutostartChange = useCallback(async (enabled: boolean) => {
    setIsUpdatingAutostart(true);
    setAutostartError(null);
    try {
      await window.stickyNotesAPI.setConfig('autostart', enabled);
      setAutostart(enabled);
    } catch {
      setAutostartError('Could not change the startup setting. Try again.');
    } finally {
      setIsUpdatingAutostart(false);
    }
  }, []);

  const handleEncryptionChange = useCallback(async (enabled: boolean) => {
    setIsUpdatingEncryption(true);
    setActionError(null);
    setActionStatus(null);
    try {
      const updated = await window.stickyNotesAPI.setEncryptionEnabled(enabled);
      setEncryption(updated);
      setActionStatus(
        updated.enabled ? 'Notes are now encrypted at rest.' : 'Note encryption disabled.'
      );
    } catch {
      setActionError('Could not update encryption setting. Verify your OS keyring is unlocked.');
    } finally {
      setIsUpdatingEncryption(false);
    }
  }, []);

  const changeSearch = (value: string) => {
    if (value === searchQuery) return;
    setLoadError(false);
    setPage(0);
    setSearchQuery(value);
  };

  const changePage = (nextPage: number) => {
    refreshNotes();
    setIsLoading(true);
    setLoadError(false);
    setPage(nextPage);
  };

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

  const handlePurgeBackups = useCallback(async () => {
    setActionError(null);
    setActionStatus(null);
    try {
      const removed = await window.stickyNotesAPI.purgeMigrationBackups();
      setBackupCount(0);
      setActionStatus(`Removed ${removed} pre-upgrade backup file${removed === 1 ? '' : 's'}.`);
    } catch {
      setActionError('Could not remove pre-upgrade backups.');
    }
  }, []);

  const handleToggleTrashView = useCallback(() => {
    setIsLoading(true);
    setActiveTab((tab) => (tab === 'notes' ? 'trash' : 'notes'));
  }, []);

  const handleRetrySettings = useCallback(() => {
    setSettingsRetry((value) => value + 1);
  }, []);

  const handleCloseMenu = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  const handleImportJson = useCallback(async () => {
    setActionError(null);
    setActionStatus(null);
    try {
      const result = await window.stickyNotesAPI.importNotes();
      if (result.imported) {
        setActionStatus(`Imported ${result.count} note${result.count === 1 ? '' : 's'}.`);
        refreshNotes();
      }
    } catch {
      setActionError('Could not import the backup. Check that it is a valid Sticky Notes JSON file.');
    }
  }, [refreshNotes]);

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
          onImportJson={() => void handleImportJson()}
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
          deletedNotes.map((note) => {
            const theme = NOTE_COLORS[note.color] || NOTE_COLORS.yellow;
            const previewText = note.preview.trim() || 'Empty note';
            return (
              <article
                key={note.id}
                className={`note-card note-card-trash ${theme.isDark ? 'dark' : ''}`}
                data-color={theme.id}
              >
                <div className="note-card-trash-body">
                  <div className="note-card-header">
                    <span className="note-card-date">
                      Deleted {formatFriendlyDate(note.deleted_at)}
                    </span>
                  </div>
                  <div className="note-card-preview">{previewText}</div>
                  <div className="note-card-trash-actions">
                    <button
                      type="button"
                      className="modal-btn"
                      onClick={() =>
                        void runAction(
                          () => window.stickyNotesAPI.restoreNote(note.id),
                          'Could not restore the note.',
                          'Note restored.'
                        )
                      }
                    >
                      <RotateCcw size={13} aria-hidden="true" /> Restore
                    </button>
                    <button
                      type="button"
                      className="modal-btn danger"
                      onClick={() => {
                        setDeleteError(null);
                        setPermanentDeleteId(note.id);
                      }}
                    >
                      Delete forever
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
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
