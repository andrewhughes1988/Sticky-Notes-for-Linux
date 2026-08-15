import React, { useEffect, useState, useCallback } from 'react';
import { Note } from '../../shared/types';
import { NoteCard } from './NoteCard';
import { DeleteModal } from './DeleteModal';
import { Plus, Search, X, FileText } from 'lucide-react';

export const ManagerView: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);

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
    <div className="manager-container">
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

      {/* Delete Confirmation Modal */}
      <DeleteModal
        isOpen={noteToDelete !== null}
        onConfirm={handleConfirmDelete}
        onCancel={() => setNoteToDelete(null)}
      />
    </div>
  );
};
