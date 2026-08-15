import React from 'react';
import ReactDOM from 'react-dom/client';
import { NoteView } from './components/NoteView';
import { ManagerView } from './components/ManagerView';
import '@fontsource-variable/inter';
import './styles/index.css';

function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const typeParam = urlParams.get('type');
  const noteIdParam = urlParams.get('noteId');

  const isNote = typeParam === 'note' || (window.stickyNotesAPI && window.stickyNotesAPI.isNoteWindow);
  const noteId = noteIdParam || (window.stickyNotesAPI && window.stickyNotesAPI.noteId);

  if (isNote && noteId) {
    return <NoteView noteId={noteId} />;
  }

  return <ManagerView />;
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
