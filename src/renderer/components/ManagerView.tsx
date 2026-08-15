import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Note } from '../../shared/types';
import { NoteCard } from './NoteCard';
import { DeleteModal } from './DeleteModal';
import { StickyNoteIcon } from './StickyNoteIcon';
import { Plus, Search, X, Sun, Moon } from 'lucide-react';

export const ManagerView: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const searchQueryRef = useRef(searchQuery);
  searchQueryRef.current = searchQuery;
  const lastQueryIdRef = useRef(0);

  // Initialize theme from localStorage, or fallback to desktop system default
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('manager_theme');
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return Boolean(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  // Sync dark class on html root and listen to OS changes if user hasn't explicitly set a preference
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const saved = localStorage.getItem('manager_theme');
    if (!saved && window.matchMedia) {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = (e: MediaQueryListEvent) => {
        setIsDarkMode(e.matches);
      };
      mql.addEventListener('change', listener);
      return () => mql.removeEventListener('change', listener);
    }
  }, []);

  const toggleTheme = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem('manager_theme', next ? 'dark' : 'light');
      return next;
    });
  };

  const fetchNotes = useCallback(async (query: string = '') => {
    const queryId = ++lastQueryIdRef.current;
    try {
      const data = await window.stickyNotesAPI.getAllNotes({
        search: query,
        includeClosed: true,
      });
      if (queryId === lastQueryIdRef.current) {
        setNotes(data);
      }
    } catch (err) {
      console.error('Failed to load notes in manager:', err);
    }
  }, []);

  // Debounced search query trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchNotes(searchQuery);
    }, 150);
    return () => clearTimeout(timer);
  }, [fetchNotes, searchQuery]);

  // IPC Event subscriptions
  useEffect(() => {
    let refreshTimeout: NodeJS.Timeout | null = null;
    const debouncedRefresh = () => {
      if (refreshTimeout) clearTimeout(refreshTimeout);
      refreshTimeout = setTimeout(() => {
        fetchNotes(searchQueryRef.current);
      }, 150);
    };

    const unsubChanged = window.stickyNotesAPI.onNotesChanged(debouncedRefresh);
    const unsubDeleted = window.stickyNotesAPI.onNoteDeleted(debouncedRefresh);

    return () => {
      if (refreshTimeout) clearTimeout(refreshTimeout);
      unsubChanged();
      unsubDeleted();
    };
  }, [fetchNotes]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleCreateNote = useCallback(async () => {
    await window.stickyNotesAPI.createNote();
  }, []);

  const handleOpenNote = useCallback((id: string) => {
    window.stickyNotesAPI.openNoteWindow(id);
  }, []);

  const handleRequestDelete = useCallback((id: string) => {
    setNoteToDelete(id);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (noteToDelete) {
      window.stickyNotesAPI.deleteNote(noteToDelete);
      setNoteToDelete(null);
    }
  }, [noteToDelete]);

  const handleCloseManager = () => {
    window.stickyNotesAPI.toggleManagerWindow();
  };

  return (
    <div className={`manager-container ${isDarkMode ? 'dark' : 'light'}`}>
      {/* Top Header Bar */}
      <div className="manager-header app-drag-region">
        <div className="manager-title">
          <StickyNoteIcon size={18} />
          <span>Sticky Notes</span>
        </div>

        <div className="manager-controls app-no-drag">
          <button
            type="button"
            className="header-btn"
            title={isDarkMode ? 'Switch to Light mode' : 'Switch to Dark mode'}
            onClick={toggleTheme}
          >
            {isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          <button
            type="button"
            className="header-btn close-btn"
            title="Close notes list"
            onClick={handleCloseManager}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="manager-search-bar app-no-drag">
        <div className="search-input-wrapper">
          <Search size={15} color={isDarkMode ? '#AAAAAA' : '#666666'} />
          <input
            type="text"
            className="search-input"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={handleSearchChange}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              title="Clear search"
              onClick={() => {
                setSearchQuery('');
                fetchNotes('');
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <button
          type="button"
          className="add-note-btn"
          title="Create note"
          onClick={handleCreateNote}
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Notes List */}
      <div className="manager-notes-list app-no-drag">
        {notes.length === 0 ? (
          <div className="manager-empty-state">
            <StickyNoteIcon size={40} />
            <div>
              {searchQuery
                ? 'No matching notes found.'
                : 'No sticky notes yet. Click "+" to create your first note!'}
            </div>
          </div>
        ) : (
          notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onOpen={handleOpenNote}
              onDelete={handleRequestDelete}
            />
          ))
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteModal
        isOpen={noteToDelete !== null}
        onConfirm={handleConfirmDelete}
        onCancel={() => setNoteToDelete(null)}
      />
    </div>
  );
};
