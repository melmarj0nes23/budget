import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message || 'An unexpected application error occurred.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Application ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      let friendlyDetail = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message);
        if (parsed && typeof parsed.error === 'string') {
          friendlyDetail = `${parsed.error}${parsed.path ? ` (${parsed.path})` : ''}`;
        }
      } catch {
        // Not structured JSON; display clean message
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
          <div className="max-w-lg w-full bg-white border border-black/10 rounded-xl p-6 shadow-sm">
            <h1 className="text-xl font-bold text-[#0032a0] mb-2">Something went wrong</h1>
            <p className="text-sm text-slate-600 mb-4">
              BetterAlcala encountered an unexpected error while loading or updating civic data.
            </p>
            <div className="rounded-lg bg-slate-100 p-3 text-xs text-slate-700 mb-4 break-words">
              {friendlyDetail}
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn btn-primary btn-sm"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
