/**
 * Generic widget loading skeleton — content-shaped placeholder
 * instead of a single centered spinner.
 *
 * Variants mirror common widget layouts:
 * - 'stat': large number + small label (Pi-hole, UniFi)
 * - 'media': album art + text rows (Spotify, Sonos)
 * - 'list': repeating rows (Docker, Calendar, Stocks)
 * - 'default': generic card-like placeholder
 */

import { Skeleton } from '../ui/skeleton.js';

export type WidgetSkeletonVariant = 'stat' | 'media' | 'list' | 'default';

interface WidgetSkeletonProps {
  variant?: WidgetSkeletonVariant;
  rows?: number;
}

export function WidgetSkeleton({ variant = 'default', rows = 3 }: WidgetSkeletonProps) {
  switch (variant) {
    case 'stat':
      return (
        <div className="flex flex-col gap-3 p-4">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-3 w-32" />
          <div className="flex gap-4 mt-2">
            <Skeleton className="h-12 w-16" />
            <Skeleton className="h-12 w-16" />
            <Skeleton className="h-12 w-16" />
          </div>
        </div>
      );

    case 'media':
      return (
        <div className="flex items-center gap-3 p-4">
          <Skeleton className="h-14 w-14 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-2 w-full mt-1" />
          </div>
        </div>
      );

    case 'list':
      return (
        <div className="flex flex-col gap-2 p-4">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-3 w-3 rounded-full shrink-0" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-3 w-10 shrink-0" />
            </div>
          ))}
        </div>
      );

    default:
      return (
        <div className="flex flex-col gap-3 p-4">
          <Skeleton className="h-5 w-2/5" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      );
  }
}
