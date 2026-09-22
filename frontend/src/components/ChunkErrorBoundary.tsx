/**
 * ChunkErrorBoundary — Catches ChunkLoadError from lazy-loaded route chunks
 * and renders a retry UI with page reload.
 *
 * Per research.md R6: When a deployment changes chunk hashes, stale tabs
 * get ChunkLoadError on navigation. A page reload fetches fresh index.html.
 */

import React, { type ReactNode } from 'react';

interface ChunkErrorBoundaryProps {
  children: ReactNode;
}

interface ChunkErrorBoundaryState {
  hasError: boolean;
}

function isChunkLoadError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.name === 'ChunkLoadError' ||
      error.message.includes('Loading chunk') ||
      error.message.includes('Failed to fetch dynamically imported module') ||
      error.message.includes('Importing a module script failed')
    );
  }
  return false;
}

export class ChunkErrorBoundary extends React.Component<
  ChunkErrorBoundaryProps,
  ChunkErrorBoundaryState
> {
  constructor(props: ChunkErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: unknown): ChunkErrorBoundaryState | null {
    if (isChunkLoadError(error)) {
      return { hasError: true };
    }
    // Re-throw non-chunk errors to bubble up to the next error boundary
    return null;
  }

  override componentDidCatch(error: unknown) {
    if (!isChunkLoadError(error)) {
      throw error;
    }
  }

  handleRetry = () => {
    window.location.reload();
  };

  override render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8">
          <div className="text-center">
            <h2 className="mb-2 text-lg font-semibold text-foreground">
              Update Available
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              A new version has been deployed. Please reload to continue.
            </p>
            <button
              onClick={this.handleRetry}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
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
