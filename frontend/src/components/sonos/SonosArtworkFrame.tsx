import { Loader2, Music, Speaker } from 'lucide-react';
import { cn } from '../../lib/utils.js';

interface SonosArtworkFrameProps {
  imageUrl?: string | null | undefined;
  alt?: string;
  state?: 'idle' | 'loading' | 'unavailable';
  className?: string;
  iconClassName?: string;
}

export function SonosArtworkFrame({
  imageUrl,
  alt = '',
  state = 'idle',
  className,
  iconClassName,
}: SonosArtworkFrameProps) {
  return (
    <div className={cn('relative shrink-0 overflow-hidden rounded-lg bg-white/[0.06]', className)}>
      {imageUrl ? (
        <img src={imageUrl} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          {state === 'loading' ? (
            <Loader2
              className={cn('h-6 w-6 animate-spin text-white/30', iconClassName)}
              aria-label="Loading Sonos"
            />
          ) : state === 'unavailable' ? (
            <Speaker className={cn('h-8 w-8 text-white/20', iconClassName)} aria-hidden="true" />
          ) : (
            <Music className={cn('h-8 w-8 text-white/15', iconClassName)} aria-hidden="true" />
          )}
        </div>
      )}
    </div>
  );
}
