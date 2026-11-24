import { useCallback, useEffect, useRef, useState } from 'react';
import { DeletedNotePreview, NotePreview } from '../../shared/types';

const PAGE_SIZE = 40;
type ManagerTab = 'notes' | 'trash';

export function useNotesList() {
  const [activeTab, setActiveTab] = useState<ManagerTab>('notes');
  const [notes, setNotes] = useState<NotePreview[]>([]);
  const [deletedNotes, setDeletedNotes] = useState<DeletedNotePreview[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [revision, setRevision] = useState(0);
  const requestId = useRef(0);
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

  return {
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
  };
}
