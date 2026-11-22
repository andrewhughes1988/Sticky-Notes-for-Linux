import React from 'react';
import ReactDOM from 'react-dom/client';
import { NoteView } from './components/NoteView';
import { ManagerView } from './components/ManagerView';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles/index.css';

function App() {
  const { isNoteWindow: isNote, noteId } = window.stickyNotesAPI;

  if (isNote && noteId) {
    return <NoteView noteId={noteId} />;
  }

  return <ManagerView />;
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
