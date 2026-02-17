import React, { Component, type ReactNode } from 'react';
import { Panel } from '../ui/Panel';
import { Button } from '../ui/Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * ErrorBoundary - Catches React errors and displays fallback UI
 * Prevents the entire app from crashing when a component throws
 */
export class ErrorBoundary extends Component<Props, State> {
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

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to console in development
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary] Caught error:', error);
      console.error('[ErrorBoundary] Error info:', errorInfo);
    }

    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-beige flex items-center justify-center p-8">
          <Panel className="max-w-2xl w-full">
            <div className="space-y-6">
              <div className="space-y-2">
                <h1 className="text-2xl font-display font-bold text-text-main">
                  Something went wrong
                </h1>
                <p className="text-sm text-text-secondary">
                  The application encountered an unexpected error. This has been logged and you can try reloading the page.
                </p>
              </div>

              {import.meta.env.DEV && this.state.error && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-text-main">Error details:</p>
                  <pre className="bg-gray-50 p-4 rounded-lg text-xs overflow-auto max-h-64 border border-black/5">
                    {this.state.error.toString()}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </div>
              )}

              <div className="flex gap-3">
                <Button onClick={this.handleReset}>
                  Try Again
                </Button>
                <Button variant="primary" onClick={() => window.location.reload()}>
                  Reload Page
                </Button>
              </div>
            </div>
          </Panel>
        </div>
      );
    }

    return this.props.children;
  }
}
