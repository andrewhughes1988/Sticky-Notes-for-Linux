import React, { useEffect, useState, useCallback } from 'react';
import { Note } from '../../shared/types';
import { NoteCard } from './NoteCard';
import { DeleteModal } from './DeleteModal';
import { Plus, Search, X, FileText, Settings, ArrowLeft } from 'lucide-react';

export const ManagerView: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // User theme preference: 'system' | 'light' | 'dark'
  const [themeMode, setThemeMode] = useState<'system' | 'light' | 'dark'>(() => {
    return (localStorage.getItem('manager_theme_mode') as 'system' | 'light' | 'dark') || 'system';
  });
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  // Evaluate effective dark mode and listen for system changes
  useEffect(() => {
    const updateEffectiveTheme = () => {
      if (themeMode === 'dark') {
        setIsDarkMode(true);
      } else if (themeMode === 'light') {
        setIsDarkMode(false);
      } else {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        setIsDarkMode(Boolean(prefersDark));
      }
    };

    updateEffectiveTheme();

    if (themeMode === 'system' && window.matchMedia) {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = (e: MediaQueryListEvent) => {
        setIsDarkMode(e.matches);
      };
      mql.addEventListener('change', listener);
      return () => mql.removeEventListener('change', listener);
    }
  }, [themeMode]);

  const handleThemeChange = (newMode: 'system' | 'light' | 'dark') => {
    setThemeMode(newMode);
    localStorage.setItem('manager_theme_mode', newMode);
  };

  const fetchNotes = useCallback(async (query: string = '') => {
    try {
      const data = await window.stickyNotesAPI.getAllNotes({
        search: query,
        includeClosed: true,
      });
      setNotes(data);
    } catch (err) {
      console.error('Failed to load notes in manager:', err);
    }
  }, []);

  useEffect(() => {
    fetchNotes(searchQuery);

    const unsubChanged = window.stickyNotesAPI.onNotesChanged(() => {
      fetchNotes(searchQuery);
    });

    const unsubDeleted = window.stickyNotesAPI.onNoteDeleted(() => {
      fetchNotes(searchQuery);
    });

    return () => {
      unsubChanged();
      unsubDeleted();
    };
  }, [fetchNotes, searchQuery]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    fetchNotes(val);
  };

  const handleCreateNote = async () => {
    await window.stickyNotesAPI.createNote();
  };

  const handleOpenNote = (id: string) => {
    window.stickyNotesAPI.openNoteWindow(id);
  };

  const handleConfirmDelete = () => {
    if (noteToDelete) {
      window.stickyNotesAPI.deleteNote(noteToDelete);
      setNoteToDelete(null);
    }
  };

  const handleCloseManager = () => {
    window.stickyNotesAPI.toggleManagerWindow();
  };

  return (
    <div className={`manager-container ${isDarkMode ? 'dark' : ''}`}>
      {isSettingsOpen ? (
        /* Settings View */
        <div className="settings-container">
          <div className="settings-header app-drag-region">
            <div className="settings-header-left">
              <button
                type="button"
                className="header-btn app-no-drag"
                title="Back to notes list"
                onClick={() => setIsSettingsOpen(false)}
              >
                <ArrowLeft size={16} />
              </button>
              <span className="settings-title">Settings</span>
            </div>

            <div className="manager-controls app-no-drag">
              <button
                type="button"
                className="header-btn close-btn"
                title="Close settings"
                onClick={handleCloseManager}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="settings-body app-no-drag">
            {/* Color Mode Section */}
            <div className="settings-section">
              <div className="settings-section-title">Color</div>
              <div className="settings-section-subtitle">Choose your mode</div>
              <div className="settings-radio-group">
                <label className="settings-radio-item">
                  <input
                    type="radio"
                    name="theme"
                    value="light"
                    checked={themeMode === 'light'}
                    onChange={() => handleThemeChange('light')}
                  />
                  <span>Light</span>
                </label>

                <label className="settings-radio-item">
                  <input
                    type="radio"
                    name="theme"
                    value="dark"
                    checked={themeMode === 'dark'}
                    onChange={() => handleThemeChange('dark')}
                  />
                  <span>Dark</span>
                </label>

                <label className="settings-radio-item">
                  <input
                    type="radio"
                    name="theme"
                    value="system"
                    checked={themeMode === 'system'}
                    onChange={() => handleThemeChange('system')}
                  />
                  <span>Use system mode (Default)</span>
                </label>
              </div>
            </div>

            {/* About & Info Section */}
            <div className="settings-section">
              <div className="settings-section-title">About</div>
              <div className="settings-info-card">
                <div><strong>Sticky Notes for Linux</strong></div>
                <div>Version 1.0.0</div>
                <div>Storage: SQLite (Local & Air-Gapped)</div>
                <div>Autostart: XDG Freedesktop compatible</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Notes Manager Main View */
        <>
          {/* Top Header Bar */}
          <div className="manager-header app-drag-region">
            <div className="manager-title">
              <FileText size={16} color="#0078D4" />
              <span>Sticky Notes</span>
            </div>

            <div className="manager-controls app-no-drag">
              <button
                type="button"
                className="header-btn"
                title="New note"
                onClick={handleCreateNote}
              >
                <Plus size={16} />
              </button>

              <button
                type="button"
                className="header-btn"
                title="Settings"
                onClick={() => setIsSettingsOpen(true)}
              >
                <Settings size={15} />
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
              <Search size={15} color="#888888" />
              <input
                type="text"
                className="search-input"
                placeholder="Search notes..."
                value={searchQuery}
                onChange={handleSearchChange}
              />
              {searchQuery && (
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}
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
                <FileText size={36} opacity={0.4} />
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
                  onDelete={(id) => setNoteToDelete(id)}
                />
              ))
            )}
          </div>
        </>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteModal
        isOpen={noteToDelete !== null}
        onConfirm={handleConfirmDelete}
        onCancel={() => setNoteToDelete(null)}
      />
    </div>
  );
};
