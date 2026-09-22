// T027: IframeWidget display — sandboxed iframe with configurable aspect ratio

import { useState, useCallback } from 'react';
import type { WidgetDisplayProps } from './registry.js';
import type { IframeConfig } from '../../state/dashboards.js';

const ASPECT_RATIO_MAP: Record<string, string> = {
  '16:9': '16 / 9',
  '4:3': '4 / 3',
  '1:1': '1 / 1',
};

export function IframeWidget({ widget }: WidgetDisplayProps) {
  const config = (widget.config ?? {}) as Partial<IframeConfig>;
  const url = config.url ?? '';
  const aspectRatio = config.aspectRatio ?? 'auto';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const handleLoad = useCallback(() => setLoading(false), []);
  const handleError = useCallback(() => {
    setLoading(false);
    setError(true);
  }, []);

  if (!url.trim()) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm" data-testid="iframe-widget-empty">
        Configure a URL to embed
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-destructive text-sm" data-testid="iframe-widget-error">
        Failed to load embedded content
      </div>
    );
  }

  const style: React.CSSProperties = aspectRatio === 'auto'
    ? { width: '100%', height: '100%' }
    : { width: '100%', aspectRatio: ASPECT_RATIO_MAP[aspectRatio] };

  return (
    <div className="relative h-full w-full overflow-hidden" data-testid="iframe-widget">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50 animate-pulse" data-testid="iframe-loading">
          <span className="text-muted-foreground text-sm">Loading…</span>
        </div>
      )}
      <iframe
        src={url}
        sandbox="allow-scripts allow-same-origin allow-forms"
        referrerPolicy="no-referrer"
        style={style}
        className="border-0"
        onLoad={handleLoad}
        onError={handleError}
        title="Embedded content"
      />
    </div>
  );
}
