import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in YT Music:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#030303] text-white p-6 text-center select-none font-sans">
          <div className="w-16 h-16 rounded-2xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-500 mb-4 shadow-xl">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold tracking-tight mb-2">
            Etwas ist schiefgelaufen
          </h1>
          <p className="text-xs text-zinc-400 max-w-xs mb-6">
            Die App konnte nicht geladen werden. Bitte versuche, die Seite neu zu laden.
          </p>

          {this.state.error && (
            <div className="w-full max-w-sm p-3 bg-white/5 border border-white/10 rounded-xl text-left text-[11px] font-mono text-red-400 mb-6 overflow-x-auto">
              {this.state.error.toString()}
            </div>
          )}

          <button
            onClick={() => window.location.reload()}
            className="flex items-center space-x-2 px-6 py-3 rounded-full bg-red-600 hover:bg-red-500 active:scale-95 text-white font-semibold text-sm shadow-lg shadow-red-600/30 transition"
          >
            <RefreshCw className="w-4 h-4" />
            <span>App neu laden</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
