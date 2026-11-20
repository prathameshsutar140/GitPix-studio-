import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message || 'An unexpected rendering error occurred.' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h2 className="text-lg font-semibold text-slate-100">Studio Recovery</h2>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              Something interrupted the current view. Your saved projects remain intact.
            </p>
            <div className="bg-[#0B0F17] border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-400 break-words max-h-32 overflow-auto">
              {this.state.message}
            </div>
            <button
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                window.location.hash = '';
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Reload Studio
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
