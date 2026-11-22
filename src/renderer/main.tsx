import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles/index.css';

const NoteView = lazy(() => import('./components/NoteView'));
const ManagerView = lazy(() => import('./components/ManagerView'));

function App() {
  if (!window.stickyNotesAPI) {
    return (
      <div className="error-boundary" role="alert">
        <h2 className="error-boundary-title">Desktop environment required</h2>
        <p className="error-boundary-body">
          Sticky Notes must be launched inside the Electron desktop application.
        </p>
      </div>
    );
  }

  const { isNoteWindow: isNote, noteId } = window.stickyNotesAPI;

  return (
    <Suspense fallback={null}>
      {isNote && noteId ? <NoteView noteId={noteId} /> : <ManagerView />}
    </Suspense>
  );
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
