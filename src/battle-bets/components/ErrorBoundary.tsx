import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary for catching and displaying game errors
 * Prevents complete app crashes and provides recovery options
 */
export class GameErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🚨 Game Error Caught by Boundary:', error);
    console.error('Component Stack:', errorInfo.componentStack);

    this.setState({
      error,
      errorInfo,
    });

    // Send to error tracking service (Sentry, LogRocket, etc.)
    // if (window.Sentry) {
    //   window.Sentry.captureException(error, {
    //     contexts: {
    //       react: {
    //         componentStack: errorInfo.componentStack,
    //       },
    //     },
    //   });
    // }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    
    // Full page reload to reset all state
    window.location.reload();
  };

  handleCopyError = () => {
    const errorText = `
Error: ${this.state.error?.message}

Stack:
${this.state.error?.stack}

Component Stack:
${this.state.errorInfo?.componentStack}
    `.trim();

    navigator.clipboard.writeText(errorText).then(() => {
      alert('Error details copied to clipboard!');
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            color: 'white',
            fontFamily: 'Arial, sans-serif',
            padding: '20px',
          }}
        >
          <div
            style={{
              maxWidth: '800px',
              width: '100%',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '16px',
              padding: '40px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <div style={{ fontSize: '64px', marginBottom: '16px' }}>⚠️</div>
              <h1 style={{ margin: '0 0 16px 0', fontSize: '32px', color: '#FF6B35' }}>
                Game Error
              </h1>
              <p style={{ margin: 0, fontSize: '16px', color: '#aaa' }}>
                Something went wrong with the battle simulation
              </p>
            </div>

            <div
              style={{
                background: 'rgba(0, 0, 0, 0.3)',
                padding: '20px',
                borderRadius: '8px',
                marginBottom: '24px',
                border: '1px solid rgba(255, 107, 53, 0.3)',
              }}
            >
              <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#FF6B35' }}>
                Error Message:
              </div>
              <div style={{ fontSize: '14px', color: '#fff', marginBottom: '16px' }}>
                {this.state.error?.message || 'Unknown error'}
              </div>

              {import.meta.env.DEV && (
                <>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#4ECDC4' }}>
                    Stack Trace:
                  </div>
                  <pre
                    style={{
                      fontSize: '11px',
                      color: '#ccc',
                      overflow: 'auto',
                      maxHeight: '200px',
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {this.state.error?.stack}
                  </pre>
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={this.handleReset}
                style={{
                  padding: '14px 28px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  background: 'linear-gradient(135deg, #4ECDC4 0%, #44A08D 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'transform 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                🔄 Restart Game
              </button>

              {import.meta.env.DEV && (
                <button
                  onClick={this.handleCopyError}
                  style={{
                    padding: '14px 28px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    background: 'rgba(255, 255, 255, 0.1)',
                    color: 'white',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'transform 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  📋 Copy Error Details
                </button>
              )}
            </div>

            <div
              style={{
                marginTop: '32px',
                padding: '16px',
                background: 'rgba(78, 205, 196, 0.1)',
                borderRadius: '8px',
                border: '1px solid rgba(78, 205, 196, 0.3)',
                fontSize: '14px',
                color: '#4ECDC4',
              }}
            >
              <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>💡 Troubleshooting Tips:</div>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                <li>Try refreshing the page</li>
                <li>Clear your browser cache</li>
                <li>Check the browser console for more details (F12)</li>
                {import.meta.env.DEV && (
                  <li>Check if all dependencies are installed (npm install)</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

