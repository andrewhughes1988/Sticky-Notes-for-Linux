import { Component, ErrorInfo, ReactNode } from 'react';
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

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Uncaught error in React render tree:', error, errorInfo);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          padding: '24px',
          backgroundColor: '#202020',
          color: '#F5F5F5',
          textAlign: 'center',
          boxSizing: 'border-box',
          userSelect: 'none',
        }}>
          <AlertTriangle size={36} color="#F59E0B" style={{ marginBottom: '12px' }} />
          <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 8px 0' }}>
            Something went wrong
          </h2>
          <p style={{ fontSize: '12px', color: '#A0A0A0', margin: '0 0 16px 0', maxWidth: '280px', lineHeight: 1.4 }}>
            An unexpected error occurred while rendering this window.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 500,
              color: '#FFFFFF',
              backgroundColor: '#3B82F6',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={13} />
            Reload Window
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
