/**
 * PhotoFrameWidget — rotating photo slideshow with crossfade transitions.
 *
 * Features:
 * - Smooth crossfade between two layered images
 * - Configurable fit mode (cover/contain/fill)
 * - Optional filename caption overlay
 * - Pause-on-hover support
 * - Pre-loads next image for seamless transitions
 */

import { useState } from 'react';
import { ImageOff, Loader2 } from 'lucide-react';
import type { WidgetDisplayProps } from './registry.js';
import type { PhotoFrameConfig } from '../../state/dashboards.js';
import { usePhotoRotation } from '../../hooks/usePhotoFrame.js';

const FIT_CLASSES: Record<string, string> = {
  cover: 'object-cover',
  contain: 'object-contain',
  fill: 'object-fill',
};

export function PhotoFrameWidget({ widget }: WidgetDisplayProps) {
  const config = (widget.config ?? {}) as Partial<PhotoFrameConfig>;
  const [isPaused, setIsPaused] = useState(false);

  const {
    currentUrl,
    nextUrl,
    caption,
    imageCount,
    isLoading,
  } = usePhotoRotation({
    sourceId: config.sourceId,
    intervalSeconds: config.intervalSeconds ?? 30,
    shuffle: config.shuffle ?? true,
    paused: isPaused,
  });

  const fitClass = FIT_CLASSES[config.fitMode ?? 'cover'] ?? 'object-cover';
  const showCaption = config.showCaption ?? false;
  const useCrossfade = (config.transition ?? 'crossfade') === 'crossfade';

  if (!config.sourceId) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
        Configure a photo source in widget settings
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading photos…
      </div>
    );
  }

  if (imageCount === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
        <ImageOff className="h-8 w-8 opacity-50" />
        No images found in source
      </div>
    );
  }

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-black/20"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Current image */}
      {currentUrl && (
        <img
          key={currentUrl}
          src={currentUrl}
          alt={caption ?? 'Photo'}
          className={`absolute inset-0 h-full w-full ${fitClass} ${useCrossfade ? 'animate-fade-in' : ''}`}
          loading="eager"
        />
      )}

      {/* Preload next image (hidden) */}
      {nextUrl && nextUrl !== currentUrl && (
        <img
          src={nextUrl}
          alt=""
          className="hidden"
          loading="eager"
        />
      )}

      {/* Caption overlay */}
      {showCaption && caption && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2">
          <p className="truncate text-xs text-white/90">{caption}</p>
        </div>
      )}
    </div>
  );
}
