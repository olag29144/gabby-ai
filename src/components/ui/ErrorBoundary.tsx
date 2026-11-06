import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[Gabby AI] Render error:', error.message);
    console.error('[Gabby AI] Component stack:', info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          height: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: '#1e1f20', color: '#e3e3e3', fontFamily: 'monospace', padding: '2rem',
          gap: '1rem'
        }}>
          <h1 style={{ fontSize: '1.2rem', color: '#f87171' }}>Gabby AI failed to start</h1>
          <pre style={{
            background: '#282a2c', padding: '1rem', borderRadius: '8px',
            fontSize: '0.8rem', maxWidth: '600px', overflow: 'auto', whiteSpace: 'pre-wrap',
            border: '1px solid rgba(255,255,255,0.1)', color: '#fca5a5'
          }}>
            {this.state.error.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '0.5rem 1.5rem', background: '#4f8ef7', color: 'white',
              border: 'none', borderRadius: '999px', cursor: 'pointer', fontSize: '0.85rem'
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
