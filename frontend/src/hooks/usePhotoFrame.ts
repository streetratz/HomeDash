/**
 * usePhotoFrame — manages photo manifest fetching, image preloading, and rotation.
 *
 * - Fetches manifest from backend by sourceId
 * - Preloads next image for smooth transitions
 * - Supports shuffle and sequential modes
 * - Returns current/next image URLs and rotation controls
 */

import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

export interface PhotoManifest {
  sourceId: string;
  images: string[];
  total: number;
  scannedAt: string;
}

export interface PhotoSource {
  id: string;
  name: string;
  type: 'folder' | 'url_list';
  config: { path?: string; recursive?: boolean; urls?: string[] };
  imageCount: number;
  lastScannedAt: string | null;
  createdAt: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildImageUrl(sourceId: string, imageKey: string, sourceType: string): string {
  if (sourceType === 'url_list') {
    // URL list images are direct URLs
    return imageKey;
  }
  // Folder images served via backend
  return `/api/photos/serve?sourceId=${encodeURIComponent(sourceId)}&key=${encodeURIComponent(imageKey)}`;
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
}

// ── Hooks ────────────────────────────────────────────────────────────────────

export function usePhotoManifest(sourceId: string | undefined, enabled = true) {
  return useQuery<PhotoManifest>({
    queryKey: ['photo-manifest', sourceId],
    queryFn: async () => {
      const res = await fetch(`/api/photos/manifest?sourceId=${encodeURIComponent(sourceId!)}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({ error: `HTTP ${res.status}` }))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      return (await res.json()) as PhotoManifest;
    },
    enabled: enabled && !!sourceId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
}

export function usePhotoSources() {
  return useQuery<{ sources: PhotoSource[] }>({
    queryKey: ['photo-sources'],
    queryFn: async () => {
      const res = await fetch('/api/admin/photos/sources');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as { sources: PhotoSource[] };
    },
    staleTime: 30_000,
  });
}

/**
 * Core rotation hook: manages current/next image, preloading, and auto-advance.
 */
export function usePhotoRotation(options: {
  sourceId: string | undefined;
  sourceType?: string;
  intervalSeconds?: number;
  shuffle?: boolean;
  paused?: boolean;
}) {
  const { sourceId, sourceType = 'folder', intervalSeconds = 30, shuffle = true, paused = false } = options;

  const { data: manifest } = usePhotoManifest(sourceId);
  const preloadedRef = useRef<HTMLImageElement | null>(null);

  // Generate a stable identity for the manifest to detect changes
  const manifestKey = manifest?.images.length ? manifest.images.join(',') : '';

  // Derive image order from manifest
  const imageOrder = useMemo(() => {
    if (!manifest?.images.length) return [] as string[];
    return shuffle ? shuffleArray(manifest.images) : [...manifest.images];
    // eslint-disable-next-line react-hooks/exhaustive-deps -- manifestKey tracks manifest identity
  }, [manifestKey, shuffle]);

  // Use reducer pattern to avoid setState-in-effect for index reset
  const [rawIndex, setCurrentIndex] = useState(0);
  // Clamp index to valid range — effectively resets when manifest shrinks or changes
  const currentIndex = imageOrder.length > 0 ? rawIndex % imageOrder.length : 0;

  // Auto-advance timer
  useEffect(() => {
    if (paused || imageOrder.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % imageOrder.length);
    }, intervalSeconds * 1000);
    return () => clearInterval(timer);
  }, [imageOrder.length, intervalSeconds, paused]);

  // Preload next image
  useEffect(() => {
    if (imageOrder.length <= 1 || !sourceId) return;
    const nextIdx = (currentIndex + 1) % imageOrder.length;
    const nextUrl = buildImageUrl(sourceId, imageOrder[nextIdx]!, sourceType);
    const img = new Image();
    img.src = nextUrl;
    preloadedRef.current = img;
  }, [currentIndex, imageOrder, sourceId, sourceType]);

  const currentKey = imageOrder[currentIndex];
  const currentUrl = sourceId && currentKey ? buildImageUrl(sourceId, currentKey, sourceType) : null;

  const nextIndex = imageOrder.length > 1 ? (currentIndex + 1) % imageOrder.length : currentIndex;
  const nextKey = imageOrder[nextIndex];
  const nextUrl = sourceId && nextKey ? buildImageUrl(sourceId, nextKey, sourceType) : null;

  const goNext = useCallback(() => {
    if (imageOrder.length > 1) {
      setCurrentIndex((prev) => (prev + 1) % imageOrder.length);
    }
  }, [imageOrder.length]);

  const goPrev = useCallback(() => {
    if (imageOrder.length > 1) {
      setCurrentIndex((prev) => (prev - 1 + imageOrder.length) % imageOrder.length);
    }
  }, [imageOrder.length]);

  // Extract caption from key (filename without extension)
  const caption = currentKey
    ? decodeURIComponent(currentKey.split('/').pop() ?? '').replace(/\.[^.]+$/, '')
    : null;

  return {
    currentUrl,
    nextUrl,
    caption,
    imageCount: imageOrder.length,
    totalImages: manifest?.total ?? 0,
    currentIndex,
    goNext,
    goPrev,
    isLoading: !manifest,
  };
}
