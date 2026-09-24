import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled error in Warlock UI:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div role="alert" className="min-h-screen w-full flex items-center justify-center p-4 bg-[#07090e] text-white">
          <div className="w-full max-w-md rounded-2xl border border-rose-900/40 bg-[#0e1320] p-6 shadow-2xl space-y-4 text-center">
            <div className="mx-auto w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-white">Something went wrong</h1>
              <p className="text-xs text-slate-400 mt-1">
                The interface hit an unexpected error and can't continue. Reloading usually fixes this.
              </p>
            </div>
            <pre className="text-left text-[11px] text-rose-300 bg-black/40 border border-rose-900/30 rounded-xl p-3 overflow-x-auto whitespace-pre-wrap break-words">
              {this.state.error.message}
            </pre>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reload</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
