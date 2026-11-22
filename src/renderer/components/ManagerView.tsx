import React, { useEffect, useState, useCallback, useRef } from 'react';
import { NotePreview } from '../../shared/types';
import { NoteCard } from './NoteCard';
import { DeleteModal } from './DeleteModal';
import { StickyNoteIcon } from './StickyNoteIcon';
import { Plus, Search, X, Sun, Moon } from 'lucide-react';

const PAGE_SIZE = 40;

export const ManagerView: React.FC = () => {
  const [notes, setNotes] = useState<NotePreview[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [autostart, setAutostart] = useState<boolean | null>(null);
  const [isUpdatingAutostart, setIsUpdatingAutostart] = useState(false);
  const [autostartError, setAutostartError] = useState<string | null>(null);
  const [settingsRetry, setSettingsRetry] = useState(0);
  const [revision, setRevision] = useState(0);
  const requestId = useRef(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const restoreSearchFocus = useRef(false);

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('manager_theme');
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return Boolean(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  useEffect(() => {
    if (window.matchMedia) {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = (event: MediaQueryListEvent) => {
        if (!localStorage.getItem('manager_theme')) setIsDarkMode(event.matches);
      };
      mql.addEventListener('change', listener);
      return () => mql.removeEventListener('change', listener);
    }
  }, []);

  const toggleTheme = () => {
    const next = !isDarkMode;
    localStorage.setItem('manager_theme', next ? 'dark' : 'light');
    setIsDarkMode(next);
  };

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

  useEffect(() => {
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      try {
        const result = await window.stickyNotesAPI.getNotePreviews({
          search: searchQuery,
          limit: PAGE_SIZE + 1,
          offset: page * PAGE_SIZE,
        });
        if (requestId.current !== id) return;
        if (page > 0 && result.length === 0) {
          requestId.current++;
          setIsLoading(true);
          setPage(page - 1);
          return;
        }
        setNotes(result.slice(0, PAGE_SIZE));
        setHasMore(result.length > PAGE_SIZE);
        setLoadError(false);
      } catch {
        if (requestId.current === id) setLoadError(true);
      } finally {
        if (requestId.current === id) setIsLoading(false);
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      requestId.current++;
    };
  }, [page, revision, searchQuery]);

  useEffect(() => {
    let active = true;
    let receivedUpdate = false;
    const unsubscribe = window.stickyNotesAPI.onSettingsChanged((key, value) => {
      if (key === 'autostart' && typeof value === 'boolean') {
        receivedUpdate = true;
        setAutostart(value);
        setAutostartError(null);
      }
    });
    window.stickyNotesAPI.getConfig().then(
      (config) => {
        if (active && !receivedUpdate) {
          setAutostart(config.autostart);
          setAutostartError(null);
        }
      },
      () => {
        if (active && !receivedUpdate) setAutostartError('Could not load the startup setting.');
      },
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [settingsRetry]);

  const handleAutostartChange = async (enabled: boolean) => {
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
  };

  const changeSearch = (value: string) => {
    if (value === searchQuery) return;
    refreshNotes();
    setIsLoading(true);
    setLoadError(false);
    setNotes([]);
    setHasMore(false);
    setPage(0);
    setSearchQuery(value);
  };

  const changePage = (nextPage: number) => {
    refreshNotes();
    setIsLoading(true);
    setLoadError(false);
    setNotes([]);
    setPage(nextPage);
  };

  const runAction = useCallback(async (action: () => Promise<unknown>, errorMessage: string) => {
    setActionError(null);
    try {
      await action();
    } catch {
      setActionError(errorMessage);
    }
  }, []);

  const handleOpenNote = useCallback((id: string) => {
    void runAction(() => window.stickyNotesAPI.openNoteWindow(id), 'Could not open the note. Try again.');
  }, [runAction]);

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
      setDeleteError('Could not delete the note. Try again.');
    } finally {
      setIsDeleting(false);
    }
  };

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
            type="button"
            className="header-btn"
            aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={toggleTheme}
          >
            {isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          <button
            type="button"
            className="header-btn close-btn"
            aria-label="Close notes list"
            title="Close notes list"
            onClick={() => void runAction(() => window.stickyNotesAPI.closeManagerWindow(), 'Could not close the notes list. Try again.')}
          >
            <X size={16} />
          </button>
        </div>
      </header>

      <div className="manager-search-bar app-no-drag">
        <div className="search-input-wrapper">
          <Search size={15} color={isDarkMode ? '#AAAAAA' : '#666666'} />
          <input
            ref={searchInputRef}
            type="text"
            className="search-input"
            aria-label="Search notes"
            placeholder="Search notes…"
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
              title="Clear search"
              onClick={() => {
                changeSearch('');
                searchInputRef.current?.focus();
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <button
          type="button"
          className="add-note-btn"
          aria-label="Create note"
          title="Create note"
          onClick={() => void runAction(() => window.stickyNotesAPI.createNote(), 'Could not create a note. Try again.')}
        >
          <Plus size={18} />
        </button>
      </div>

      {actionError && <p className="manager-status" role="alert">{actionError}</p>}
      <main className="manager-notes-list app-no-drag" aria-label="Notes">
        {loadError && (
          <div className="manager-status">
            <span role="alert">Could not load notes.</span>
            <button type="button" className="modal-btn" onClick={() => {
              setLoadError(false);
              setIsLoading(true);
              refreshNotes();
            }}>Retry</button>
          </div>
        )}
        {isLoading && <p className="manager-status" role="status">Loading notes…</p>}
        {!isLoading && !loadError && notes.length === 0 && (
          <div className="manager-empty-state" role="status">
            <StickyNoteIcon size={40} />
            <div>{searchQuery ? 'No matching notes found.' : 'No sticky notes yet.'}</div>
          </div>
        )}
        {notes.map((note) => (
          <NoteCard key={note.id} note={note} onOpen={handleOpenNote} onDelete={handleRequestDelete} />
        ))}
      </main>

      <footer className="manager-footer app-no-drag">
        <label className="manager-autostart">
          <input
            type="checkbox"
            checked={autostart ?? false}
            disabled={autostart === null || isUpdatingAutostart}
            onChange={(event) => void handleAutostartChange(event.target.checked)}
          />
          Start at login
        </label>
        {autostartError && (
          <div className="manager-status">
            <span role="alert">{autostartError}</span>
            {autostart === null && (
              <button type="button" className="modal-btn" onClick={() => setSettingsRetry((value) => value + 1)}>
                Retry
              </button>
            )}
          </div>
        )}
        {(page > 0 || hasMore) && (
          <nav className="manager-pagination" aria-label="Notes pages">
            <button type="button" className="modal-btn" aria-disabled={page === 0 || isLoading} onClick={() => {
              if (page > 0 && !isLoading) changePage(page - 1);
            }}>Previous</button>
            <span role="status">Page {page + 1}</span>
            <button type="button" className="modal-btn" aria-disabled={!hasMore || isLoading} onClick={() => {
              if (hasMore && !isLoading) changePage(page + 1);
            }}>Next</button>
          </nav>
        )}
      </footer>

      <DeleteModal
        isOpen={noteToDelete !== null}
        isDeleting={isDeleting}
        error={deleteError}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setNoteToDelete(null)}
      />
    </div>
  );
};
