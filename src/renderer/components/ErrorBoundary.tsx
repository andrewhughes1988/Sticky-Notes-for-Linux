import { Component, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error): void {
    void window.stickyNotesAPI.logRendererError(error instanceof Error ? error.name : 'Error').catch(() => {});
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="error-boundary" role="alert">
          <AlertTriangle size={36} color="#F59E0B" aria-hidden="true" />
          <h2 className="error-boundary-title">Something went wrong</h2>
          <p className="error-boundary-body">
            An unexpected error occurred while rendering this window.
          </p>
          <button type="button" className="error-boundary-btn" onClick={this.handleReload}>
            <RotateCcw size={13} aria-hidden="true" />
            Reload Window
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
