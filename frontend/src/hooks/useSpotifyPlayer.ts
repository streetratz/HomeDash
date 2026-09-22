/**
 * useSpotifyPlayer — Spotify Web Playback SDK integration.
 *
 * Registers the browser as a Spotify Connect device ("HomeDash") so the
 * dashboard can act as a remote controller and other devices become visible
 * in the Spotify API's device list.
 *
 * Requires Spotify Premium and the `streaming` OAuth scope.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { apiClient } from '../lib/apiClient.js';
import { spotifyKeys } from './useSpotify.js';
import { queryClient } from '../state/queryClient.js';

// ─── Spotify SDK global types ───────────────────────────────────────────────

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void;
    Spotify?: {
      Player: new (options: SpotifyPlayerOptions) => SpotifyPlayerInstance;
    };
  }
}

interface SpotifyPlayerOptions {
  name: string;
  getOAuthToken: (cb: (token: string) => void) => void;
  volume?: number;
}

interface SpotifyPlayerInstance {
  connect(): Promise<boolean>;
  disconnect(): void;
  addListener(event: string, cb: (data: unknown) => void): void;
  removeListener(event: string): void;
  getCurrentState(): Promise<unknown>;
}

interface SpotifyReadyEvent {
  device_id: string;
}

// ─── Script loader ──────────────────────────────────────────────────────────

let sdkScriptLoaded = false;
let sdkScriptLoading = false;
const sdkReadyCallbacks: Array<() => void> = [];

function loadSpotifySdk(): Promise<void> {
  if (sdkScriptLoaded && window.Spotify) return Promise.resolve();
  return new Promise((resolve) => {
    if (sdkScriptLoading) {
      sdkReadyCallbacks.push(resolve);
      return;
    }
    sdkScriptLoading = true;
    sdkReadyCallbacks.push(resolve);

    window.onSpotifyWebPlaybackSDKReady = () => {
      sdkScriptLoaded = true;
      sdkScriptLoading = false;
      for (const cb of sdkReadyCallbacks) cb();
      sdkReadyCallbacks.length = 0;
    };

    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;
    document.head.appendChild(script);
  });
}

// ─── Token fetcher ──────────────────────────────────────────────────────────

async function fetchAccessToken(): Promise<string> {
  const data = await apiClient.post<{ accessToken: string }>(
    '/api/spotify/token',
  );
  return data.accessToken;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export interface SpotifyPlayerState {
  /** The SDK-assigned device ID (use for transfer/play targeting). */
  deviceId: string | null;
  /** Whether the SDK player is connected and ready. */
  ready: boolean;
  /** Connection error message, if any. */
  error: string | null;
}

export function useSpotifyPlayer(enabled: boolean): SpotifyPlayerState {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const playerRef = useRef<SpotifyPlayerInstance | null>(null);
  const mountedRef = useRef(true);

  const refreshDevices = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: spotifyKeys.devices });
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) return;

    let cancelled = false;

    void (async () => {
      try {
        await loadSpotifySdk();
        if (cancelled || !mountedRef.current) return;

        if (!window.Spotify) {
          setError('Spotify SDK failed to load');
          return;
        }

        const player = new window.Spotify.Player({
          name: 'HomeDash',
          getOAuthToken: (cb) => {
            void fetchAccessToken().then(cb);
          },
          volume: 0.01, // near-silent — this is a controller, not a speaker
        });

        playerRef.current = player;

        player.addListener('ready', (data: unknown) => {
          if (cancelled) return;
          const { device_id } = data as SpotifyReadyEvent;
          setDeviceId(device_id);
          setReady(true);
          setError(null);
          // Refresh device list so other devices show up
          refreshDevices();
        });

        player.addListener('not_ready', () => {
          if (cancelled) return;
          setReady(false);
          setDeviceId(null);
        });

        player.addListener('initialization_error', (data: unknown) => {
          if (cancelled) return;
          const msg = (data as { message?: string }).message ?? 'SDK init error';
          setError(msg);
        });

        player.addListener('authentication_error', (data: unknown) => {
          if (cancelled) return;
          const msg =
            (data as { message?: string }).message ?? 'SDK auth error';
          setError(msg);
        });

        player.addListener('account_error', (_data: unknown) => {
          if (cancelled) return;
          setError('Spotify Premium required for Web Playback');
        });

        const success = await player.connect();
        if (!success && !cancelled) {
          setError('Failed to connect to Spotify');
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'SDK initialization failed',
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      if (playerRef.current) {
        playerRef.current.disconnect();
        playerRef.current = null;
      }
      setReady(false);
      setDeviceId(null);
    };
  }, [enabled, refreshDevices]);

  return { deviceId, ready, error };
}
