/**
 * useSpotify — TanStack Query hooks for Spotify playback, devices, and search.
 * Polls now-playing at 5s interval. Controls invalidate on success.
 */

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient, ApiRequestError } from '../lib/apiClient.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SpotifyStatus {
  connected: boolean;
  displayName?: string;
  email?: string;
}

export interface NowPlaying {
  isPlaying: boolean;
  trackName?: string;
  artistName?: string;
  albumName?: string;
  albumArtUrl?: string | null;
  progressMs?: number;
  durationMs?: number;
  deviceName?: string | null;
  activeDevice?: SpotifyDevice | null;
}

export interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  isRestricted: boolean;
  volumePercent: number | null;
  supportsVolume: boolean;
}

export interface SpotifyTrackResult {
  uri: string;
  name: string;
  artist: string;
  album: string;
  albumArtUrl: string | null;
  durationMs: number;
}

export interface SpotifyPlaylist {
  id: string;
  uri: string;
  name: string;
  owner: string;
  imageUrl: string | null;
  trackCount: number;
}

export type SpotifyLibraryType = 'playlists' | 'albums' | 'artists' | 'tracks';

export interface SpotifyLibraryItem {
  id: string;
  uri: string;
  name: string;
  subtitle?: string;
  detail?: string;
  imageUrl: string | null;
  itemCount?: number;
  durationMs?: number;
}

export interface SpotifyLibraryPage {
  items: SpotifyLibraryItem[];
  total: number;
  nextOffset?: number;
  nextCursor?: string | null;
}

export interface SpotifySearchResults {
  tracks: SpotifyTrackResult[];
  albums: Array<{
    uri: string;
    name: string;
    artist: string;
    imageUrl: string | null;
  }>;
  playlists: Array<{
    uri: string;
    name: string;
    owner: string;
    imageUrl: string | null;
    trackCount: number;
  }>;
}

// ─── Query keys ─────────────────────────────────────────────────────────────

export const spotifyKeys = {
  status: ['spotify-status'] as const,
  nowPlaying: ['spotify-now-playing'] as const,
  devices: ['spotify-devices'] as const,
  playlists: ['spotify-playlists'] as const,
  library: (type: SpotifyLibraryType) => ['spotify-library', type] as const,
  search: (q: string) => ['spotify-search', q] as const,
};

// ─── Connection status ──────────────────────────────────────────────────────

export function useSpotifyStatus() {
  return useQuery<SpotifyStatus>({
    queryKey: spotifyKeys.status,
    queryFn: () => apiClient.get<SpotifyStatus>('/api/spotify/status'),
    staleTime: 30_000,
    retry: 1,
  });
}

// ─── Now playing (adaptive polling based on visibility & playback state) ────

export function useNowPlaying(enabled = true, isActive = true) {
  const qc = useQueryClient();
  const previousData = qc.getQueryData<NowPlaying>(spotifyKeys.nowPlaying);
  const isPlaying = previousData?.isPlaying ?? false;

  // Adaptive interval: active+playing=5s, active+paused=30s, inactive=disabled
  const refetchInterval = !enabled ? false : isActive ? (isPlaying ? 5_000 : 30_000) : false;

  return useQuery<NowPlaying>({
    queryKey: spotifyKeys.nowPlaying,
    queryFn: () => apiClient.get<NowPlaying>('/api/spotify/now-playing'),
    refetchInterval,
    enabled,
    staleTime: 3_000,
    retry: 1,
  });
}

// ─── Device list ────────────────────────────────────────────────────────────

export function useSpotifyDevices(enabled = true, isActive = true) {
  const qc = useQueryClient();
  const previousData = qc.getQueryData<NowPlaying>(spotifyKeys.nowPlaying);
  const isPlaying = previousData?.isPlaying ?? false;

  // Adaptive interval: active+playing=15s, active+paused=30s, inactive=disabled
  const refetchInterval = !enabled ? false : isActive ? (isPlaying ? 15_000 : 30_000) : false;

  return useQuery<{ devices: SpotifyDevice[] }>({
    queryKey: spotifyKeys.devices,
    queryFn: () => apiClient.get<{ devices: SpotifyDevice[] }>('/api/spotify/devices'),
    enabled,
    staleTime: 10_000,
    refetchInterval,
    retry: 1,
  });
}

// ─── Playlists ──────────────────────────────────────────────────────────────

export function useSpotifyPlaylists(enabled = true) {
  return useQuery<{ playlists: SpotifyPlaylist[]; total: number }>({
    queryKey: spotifyKeys.playlists,
    queryFn: () =>
      apiClient.get<{ playlists: SpotifyPlaylist[]; total: number }>(
        '/api/spotify/playlists?limit=50',
      ),
    enabled,
    staleTime: 60_000,
    retry: 1,
  });
}

export function useSpotifyLibrary(type: SpotifyLibraryType, enabled = true) {
  return useInfiniteQuery<SpotifyLibraryPage>({
    queryKey: spotifyKeys.library(type),
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '24' });
      if (type === 'artists') {
        if (typeof pageParam === 'string' && pageParam) params.set('after', pageParam);
      } else {
        params.set('offset', String(typeof pageParam === 'number' ? pageParam : 0));
      }
      return apiClient.get<SpotifyLibraryPage>(`/api/spotify/library/${type}?${params.toString()}`);
    },
    initialPageParam: type === 'artists' ? '' : 0,
    getNextPageParam: (lastPage) => {
      if (type === 'artists') return lastPage.nextCursor || undefined;
      if (lastPage.items.length === 0) return undefined;
      const nextOffset = lastPage.nextOffset ?? lastPage.items.length;
      return nextOffset < lastPage.total ? nextOffset : undefined;
    },
    enabled,
    staleTime: 60_000,
    retry: 1,
  });
}

// ─── Playback controls ─────────────────────────────────────────────────────

export function useSpotifyControls() {
  const qc = useQueryClient();

  const invalidatePlayback = () => {
    void qc.invalidateQueries({ queryKey: spotifyKeys.nowPlaying });
  };

  const handleError = (err: unknown) => {
    const message = err instanceof ApiRequestError ? err.body.message : 'Spotify command failed';
    if (message.includes('PREMIUM_REQUIRED')) {
      toast.error('Spotify Premium required for playback control');
    } else if (message.includes('NO_ACTIVE_DEVICE')) {
      toast.error('No active device — open Spotify on a device first');
    } else if (message.includes('RESTRICTED_DEVICE')) {
      toast.error(
        "This device can't be controlled from the web — transfer playback to a different device first",
      );
    } else if (message.includes('RATE_LIMITED')) {
      toast.warning('Rate limited — please wait a moment');
    } else {
      toast.error(message);
    }
  };

  const play = useMutation({
    mutationFn: (params?: { uri?: string; context_uri?: string; device_id?: string }) =>
      apiClient.put('/api/spotify/play', params ?? {}),
    onSuccess: invalidatePlayback,
    onError: handleError,
  });

  const pause = useMutation({
    mutationFn: (params?: { device_id?: string }) =>
      apiClient.put('/api/spotify/pause', params ?? {}),
    onSuccess: invalidatePlayback,
    onError: handleError,
  });

  const next = useMutation({
    mutationFn: (params?: { device_id?: string }) =>
      apiClient.post('/api/spotify/next', params ?? {}),
    onSuccess: invalidatePlayback,
    onError: handleError,
  });

  const previous = useMutation({
    mutationFn: (params?: { device_id?: string }) =>
      apiClient.post('/api/spotify/previous', params ?? {}),
    onSuccess: invalidatePlayback,
    onError: handleError,
  });

  const volume = useMutation({
    mutationFn: (params: { volume_percent: number; device_id?: string }) =>
      apiClient.put('/api/spotify/volume', params),
    onSuccess: invalidatePlayback,
    onError: handleError,
  });

  const transfer = useMutation({
    mutationFn: (params: { device_id: string; play?: boolean }) =>
      apiClient.put('/api/spotify/transfer', params),
    onSuccess: () => {
      invalidatePlayback();
      void qc.invalidateQueries({ queryKey: spotifyKeys.devices });
    },
    onError: handleError,
  });

  return { play, pause, next, previous, volume, transfer };
}

// ─── Search ─────────────────────────────────────────────────────────────────

export function useSpotifySearch(query: string, types = 'track', limit = 10, enabled = true) {
  return useQuery<SpotifySearchResults>({
    queryKey: [...spotifyKeys.search(query), types, limit],
    queryFn: () =>
      apiClient.get<SpotifySearchResults>(
        `/api/spotify/search?q=${encodeURIComponent(query)}&type=${encodeURIComponent(types)}&limit=${limit}`,
      ),
    enabled: enabled && query.length >= 2,
    staleTime: 30_000,
    retry: 1,
  });
}

// ─── Disconnect ─────────────────────────────────────────────────────────────

export function useSpotifyDisconnect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post('/api/spotify/disconnect'),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: spotifyKeys.status });
    },
  });
}
