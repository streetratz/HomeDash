/**
 * SpotifyWidget — Now-playing display with transport controls, volume, device picker,
 * playlist browsing, and search.
 *
 * States: not connected → connected/idle → now playing
 */

import { useState, useCallback, useRef } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Speaker,
  Music,
  Search,
  Loader2,
  ExternalLink,
  ListMusic,
  RefreshCw,
  Wifi,
  Lock,
  ChevronDown,
} from 'lucide-react';
import { Button } from '../ui/button.js';
import { Slider } from '../ui/slider.js';
import type { WidgetDisplayProps } from './registry.js';
import {
  useSpotifyStatus,
  useNowPlaying,
  useSpotifyDevices,
  useSpotifyPlaylists,
  useSpotifyControls,
  useSpotifySearch,
  spotifyKeys,
  type SpotifyDevice,
  type SpotifyTrackResult,
  type SpotifyPlaylist,
} from '../../hooks/useSpotify.js';
import { useSpotifyPlayer } from '../../hooks/useSpotifyPlayer.js';
import { useWidgetVisibility } from '../../hooks/useWidgetVisibility.js';
import { queryClient } from '../../state/queryClient.js';
import { WidgetSkeleton } from './WidgetSkeleton.js';

// ─── Config type ────────────────────────────────────────────────────────────

interface SpotifyConfig {
  showAlbumArt?: boolean;
  compactMode?: boolean;
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function ProgressBar({
  progressMs,
  durationMs,
  accentColor = 'green',
}: {
  progressMs: number;
  durationMs: number;
  accentColor?: 'green' | 'orange';
}) {
  const pct = durationMs > 0 ? (progressMs / durationMs) * 100 : 0;
  const barColor = accentColor === 'orange' ? 'bg-orange-400' : 'bg-green-400';
  const textColor = accentColor === 'orange' ? 'text-orange-400/60' : 'text-white/60';
  return (
    <div className={`flex items-center gap-2 text-[10px] ${textColor}`}>
      <span className="w-8 text-right tabular-nums">{formatMs(progressMs)}</span>
      <div className="relative h-1 flex-1 rounded-full bg-white/20">
        <div
          className={`absolute left-0 top-0 h-full rounded-full ${barColor} transition-[width] duration-1000 ease-linear`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className="w-8 tabular-nums">{formatMs(durationMs)}</span>
    </div>
  );
}

/** Merge the active device from player state into the device list.
 *  The /me/player endpoint reliably returns the active device even when
 *  /me/player/devices doesn't include it (common with Spotify Connect speakers). */
function mergeActiveDevice(
  apiDevices: SpotifyDevice[],
  playerDevice: SpotifyDevice | null,
): SpotifyDevice[] {
  if (!playerDevice) return apiDevices;
  // If the active device is already in the list, return as-is
  if (apiDevices.some((d) => d.id === playerDevice.id)) return apiDevices;
  // Prepend the active device from player state
  return [playerDevice, ...apiDevices];
}

function TransportControls({
  isPlaying,
  onPlay,
  onPause,
  onNext,
  onPrev,
  loading,
  disabled,
  accentColor = 'green',
  onVolumeClick,
  onBrowseClick,
}: {
  isPlaying: boolean;
  onPlay: () => void | Promise<void>;
  onPause: () => void | Promise<void>;
  onNext: () => void | Promise<void>;
  onPrev: () => void | Promise<void>;
  loading: boolean;
  disabled?: boolean;
  accentColor?: 'green' | 'orange';
  onVolumeClick?: () => void;
  onBrowseClick?: () => void;
}) {
  const playBtnBg = accentColor === 'orange'
    ? 'bg-orange-500 hover:bg-orange-400'
    : 'bg-white hover:bg-white/90';
  const playBtnText = accentColor === 'orange' ? 'text-white' : 'text-black';

  return (
    <div className="flex items-center justify-center gap-3">
      {onVolumeClick && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-white/50 hover:text-white hover:bg-white/10"
          onClick={onVolumeClick}
        >
          <Volume2 className="h-4 w-4" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30"
        onClick={() => void onPrev()}
        disabled={disabled}
      >
        <SkipBack className="h-4 w-4" />
      </Button>
      <button
        className={`h-11 w-11 rounded-full ${playBtnBg} ${playBtnText} flex items-center justify-center shadow-lg transition-colors disabled:opacity-30`}
        onClick={() => void (isPlaying ? onPause : onPlay)()}
        disabled={loading || disabled}
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : isPlaying ? (
          <Pause className="h-5 w-5 fill-current" />
        ) : (
          <Play className="h-5 w-5 fill-current ml-0.5" />
        )}
      </button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30"
        onClick={() => void onNext()}
        disabled={disabled}
      >
        <SkipForward className="h-4 w-4" />
      </Button>
      {onBrowseClick && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-white/50 hover:text-white hover:bg-white/10"
          onClick={onBrowseClick}
        >
          <ListMusic className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

function VolumeSlider({
  volume,
  onVolumeChange,
}: {
  volume: number | null;
  onVolumeChange: (v: number) => void;
}) {
  const vol = volume ?? 50;
  return (
    <div className="flex items-center gap-1.5">
      {vol === 0 ? (
        <VolumeX className="h-3 w-3 text-white/60 shrink-0" />
      ) : (
        <Volume2 className="h-3 w-3 text-white/60 shrink-0" />
      )}
      <Slider
        min={0}
        max={100}
        value={[vol]}
        onValueChange={([v = 0]) => onVolumeChange(v)}
        trackSize="xs"
        thumbSize="xs"
        accentColor="#4ade80"
        className="flex-1"
      />
    </div>
  );
}

function DevicePicker({
  devices,
  onTransfer,
  onRefresh,
  refreshing,
  sdkReady,
  sdkDeviceId,
  sdkError,
}: {
  devices: SpotifyDevice[];
  onTransfer: (deviceId: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
  sdkReady: boolean;
  sdkDeviceId: string | null;
  sdkError: string | null;
}) {
  const [open, setOpen] = useState(false);
  const activeDevice = devices.find((d) => d.isActive);

  // Show all API devices; label the SDK device so user understands it
  const displayDevices = devices.map((d) => ({
    ...d,
    isSdkDevice: sdkDeviceId != null && d.id === sdkDeviceId,
  }));

  return (
    <div className="relative">
      <button
        className="flex items-center gap-1 text-[10px] text-white/50 hover:text-white/80 transition-colors min-h-[44px] min-w-[44px] justify-center"
        onClick={() => setOpen(!open)}
        title={activeDevice ? activeDevice.name : 'Devices'}
      >
        <Speaker className="h-3.5 w-3.5" />
        {sdkReady && (
          <span title="SDK connected">
            <Wifi className="h-2 w-2 text-green-400" />
          </span>
        )}
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-56 rounded-md bg-zinc-800/95 border border-white/10 shadow-lg py-1 z-10">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10">
            <span className="text-[10px] font-medium text-white/60 uppercase tracking-wider">
              Devices ({devices.length})
            </span>
            <button
              className="text-white/40 hover:text-white/80 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onRefresh();
              }}
            >
              <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {displayDevices.map((d) => (
            <button
              key={d.id}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 transition-colors flex items-center gap-2 ${
                d.isActive ? 'text-green-400' : 'text-white/80'
              } ${d.isSdkDevice ? 'opacity-60' : ''}`}
              onClick={() => {
                onTransfer(d.id);
                setOpen(false);
              }}
            >
              {d.isRestricted ? (
                <Lock className="h-3 w-3 shrink-0 text-amber-400/60" />
              ) : (
                <Speaker className="h-3 w-3 shrink-0" />
              )}
              <span className="truncate">
                {d.name}
                {d.isSdkDevice && (
                  <span className="text-[9px] text-white/40 ml-1">(this dashboard)</span>
                )}
              </span>
              {d.isActive && (
                <span className="ml-auto text-[9px] text-green-400 shrink-0">●</span>
              )}
              {d.isRestricted && !d.isActive && (
                <span className="ml-auto text-[9px] text-amber-400/60 shrink-0">restricted</span>
              )}
            </button>
          ))}
          {devices.length === 0 && !sdkError && (
            <div className="px-3 py-2 text-xs text-white/40">
              {sdkReady
                ? 'No devices found yet — play something from a Spotify app to wake up speakers, then they\'ll appear here'
                : 'Connecting to Spotify…'}
            </div>
          )}
          {sdkError && (
            <div className="px-3 py-1.5 text-[10px] text-amber-400/80 border-t border-white/10">
              {sdkError.includes('Premium')
                ? '⚠ Premium required for device control'
                : `⚠ ${sdkError}`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Browse overlay (Search + Playlists tabs) ───────────────────────────────

type BrowseTab = 'search' | 'playlists';

function BrowsePanel({
  onPlayUri,
  onPlayContext,
  onClose,
}: {
  onPlayUri: (uri: string) => void;
  onPlayContext: (contextUri: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<BrowseTab>('playlists');

  return (
    <div className="flex flex-col h-full p-2 gap-2">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          <button
            className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
              tab === 'playlists'
                ? 'bg-green-500/20 text-green-400'
                : 'text-white/60 hover:text-white/80'
            }`}
            onClick={() => setTab('playlists')}
          >
            <ListMusic className="inline h-3 w-3 mr-1" />
            Playlists
          </button>
          <button
            className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
              tab === 'search'
                ? 'bg-green-500/20 text-green-400'
                : 'text-white/60 hover:text-white/80'
            }`}
            onClick={() => setTab('search')}
          >
            <Search className="inline h-3 w-3 mr-1" />
            Search
          </button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-white/60 hover:text-white hover:bg-white/10"
          onClick={onClose}
        >
          ✕
        </Button>
      </div>

      {tab === 'search' ? (
        <SearchPanel onPlay={onPlayUri} />
      ) : (
        <PlaylistsPanel onPlay={onPlayContext} />
      )}
    </div>
  );
}

function SearchPanel({
  onPlay,
}: {
  onPlay: (uri: string) => void;
}) {
  const [query, setQuery] = useState('');
  const { data, isLoading } = useSpotifySearch(query, 'track', 10, query.length >= 2);

  return (
    <div className="flex flex-col gap-2 flex-1 min-h-0">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-white/40" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Spotify…"
          autoFocus
          className="w-full bg-white/10 rounded-md pl-7 pr-3 py-1.5 text-xs text-white placeholder:text-white/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 space-y-0.5">
        {isLoading && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-white/40" />
          </div>
        )}
        {!isLoading &&
          data?.tracks.map((track: SpotifyTrackResult) => (
            <button
              key={track.uri}
              className="w-full text-left px-2 py-1.5 rounded hover:bg-white/10 transition-colors flex items-center gap-2"
              onClick={() => onPlay(track.uri)}
            >
              {track.albumArtUrl ? (
                <img
                  src={track.albumArtUrl}
                  alt=""
                  className="h-8 w-8 rounded shrink-0 object-cover"
                />
              ) : (
                <div className="h-8 w-8 rounded bg-white/10 shrink-0 flex items-center justify-center">
                  <Music className="h-3 w-3 text-white/40" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-xs text-white truncate">{track.name}</div>
                <div className="text-[10px] text-white/50 truncate">
                  {track.artist}
                </div>
              </div>
              <span className="text-[10px] text-white/40 tabular-nums shrink-0">
                {formatMs(track.durationMs)}
              </span>
            </button>
          ))}
        {!isLoading && query.length >= 2 && data?.tracks.length === 0 && (
          <div className="text-center py-4 text-xs text-white/40">
            No results found
          </div>
        )}
      </div>
    </div>
  );
}

function PlaylistsPanel({
  onPlay,
}: {
  onPlay: (contextUri: string) => void;
}) {
  const { data, isLoading } = useSpotifyPlaylists();

  return (
    <div className="flex-1 overflow-y-auto min-h-0 space-y-0.5">
      {isLoading && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-white/40" />
        </div>
      )}
      {data?.playlists.map((pl: SpotifyPlaylist) => (
        <button
          key={pl.id}
          className="w-full text-left px-2 py-1.5 rounded hover:bg-white/10 transition-colors flex items-center gap-2"
          onClick={() => onPlay(pl.uri)}
        >
          {pl.imageUrl ? (
            <img
              src={pl.imageUrl}
              alt=""
              className="h-8 w-8 rounded shrink-0 object-cover"
            />
          ) : (
            <div className="h-8 w-8 rounded bg-white/10 shrink-0 flex items-center justify-center">
              <ListMusic className="h-3 w-3 text-white/40" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-xs text-white truncate">{pl.name}</div>
            <div className="text-[10px] text-white/50 truncate">
              {pl.owner} · {pl.trackCount} tracks
            </div>
          </div>
        </button>
      ))}
      {!isLoading && (data?.playlists.length ?? 0) === 0 && (
        <div className="text-center py-4 text-xs text-white/40">
          No playlists found
        </div>
      )}
    </div>
  );
}

// ─── Main Widget ────────────────────────────────────────────────────────────

export function SpotifyWidget({ widget }: WidgetDisplayProps) {
  const config = (widget.config ?? {}) as SpotifyConfig;
  const showAlbumArt = config.showAlbumArt !== false;

  // Visibility-aware adaptive polling
  const containerRef = useRef<HTMLDivElement>(null);
  const isActive = useWidgetVisibility(containerRef);

  const { data: status, isLoading: statusLoading } = useSpotifyStatus();
  const connected = status?.connected ?? false;
  const { data: nowPlaying } = useNowPlaying(connected, isActive);
  const { data: devicesData, isFetching: devicesRefreshing } = useSpotifyDevices(connected, isActive);
  const controls = useSpotifyControls();
  const [showBrowse, setShowBrowse] = useState(false);

  // Web Playback SDK — registers dashboard as a Spotify Connect device
  const sdk = useSpotifyPlayer(connected);

  const refreshDevices = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: spotifyKeys.devices });
  }, []);

  // ── Derived state (must be before any returns — React hooks rule) ────────
  const isPlaying = nowPlaying?.isPlaying ?? false;
  const hasTrack = !!nowPlaying?.trackName;
  const apiDevices = devicesData?.devices ?? [];
  const playerDevice = nowPlaying?.activeDevice ?? null;
  const devices = mergeActiveDevice(apiDevices, playerDevice);
  const activeDevice = devices.find((d) => d.isActive);
  const activeIsRestricted = activeDevice?.isRestricted ?? false;
  const currentVolume = activeDevice?.volumePercent ?? null;

  const handlePlay = useCallback(() => {
    controls.play.mutate({});
  }, [controls.play]);

  const handlePause = useCallback(() => {
    controls.pause.mutate({});
  }, [controls.pause]);

  const handleNext = useCallback(() => {
    controls.next.mutate({});
  }, [controls.next]);

  const handlePrev = useCallback(() => {
    controls.previous.mutate({});
  }, [controls.previous]);

  // Volume panel toggle
  const [showVolume, setShowVolume] = useState(false);
  // Compact ↔ Expanded mode
  const [expanded, setExpanded] = useState(false);

  // ── Not connected state ──────────────────────────────────────────────────
  if (statusLoading) {
    return (
      <div ref={containerRef} className="h-full">
        <WidgetSkeleton variant="media" />
      </div>
    );
  }

  if (!connected) {
    return (
      <div ref={containerRef} className="flex flex-col items-center justify-center h-full gap-3 px-4">
        <Music className="h-8 w-8 text-green-400/60" />
        <p className="text-xs text-white/60 text-center">
          Connect your Spotify account in Settings → Integrations
        </p>
        <a
          href="/settings?tab=integrations"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500 hover:bg-green-400 text-black text-xs font-medium transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          Open Settings
        </a>
      </div>
    );
  }

  // ── Browse overlay (playlists + search) ─────────────────────────────────
  if (showBrowse) {
    return (
      <div ref={containerRef} className="h-full">
        <BrowsePanel
          onPlayUri={(uri) => {
            controls.play.mutate({ uri });
            setShowBrowse(false);
          }}
          onPlayContext={(contextUri) => {
            controls.play.mutate({ context_uri: contextUri });
            setShowBrowse(false);
          }}
          onClose={() => setShowBrowse(false)}
        />
      </div>
    );
  }

  const accentColor = 'green';
  const activeRoomName = activeDevice?.name;

  const controlsLoading =
    controls.play.isPending || controls.pause.isPending;
  const controlsDisabled = activeIsRestricted;

  // ── Compact mode (default) ──────────────────────────────────────────────
  if (!expanded) {
    const marqueeText = hasTrack
      ? `${nowPlaying.trackName}  ·  ${nowPlaying.artistName}`
      : '';

    return (
      <div
        ref={containerRef}
        className="relative flex flex-col h-full overflow-hidden cursor-pointer"
        onClick={() => setExpanded(true)}
      >
        {/* Ambient background from album art — prominent color wash */}
        {showAlbumArt && nowPlaying?.albumArtUrl ? (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center blur-3xl scale-[2] opacity-50"
              style={{ backgroundImage: `url(${nowPlaying.albumArtUrl})` }}
            />
            <div className="absolute inset-0 bg-black/40" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-900/80 to-zinc-950/95" />
        )}

        {/* Centered album art with play/pause overlay */}
        <div className="relative z-10 flex-1 flex items-center justify-center min-h-0 p-2">
          {hasTrack && showAlbumArt && nowPlaying?.albumArtUrl ? (
            <div className="relative h-full aspect-square">
              <img
                src={nowPlaying.albumArtUrl}
                alt={nowPlaying.albumName ?? ''}
                className="h-full w-full rounded-lg shadow-2xl object-cover"
              />
              {/* Play/pause overlay on art */}
              <button
                className="absolute bottom-1.5 right-1.5 h-9 w-9 rounded-full flex items-center justify-center shadow-lg transition-colors disabled:opacity-30 bg-white/90 hover:bg-white text-black"
                onClick={(e) => {
                  e.stopPropagation();
                  void (isPlaying ? handlePause : handlePlay)();
                }}
                disabled={controlsLoading || controlsDisabled}
              >
                {controlsLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="h-3.5 w-3.5 fill-current" />
                ) : (
                  <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                )}
              </button>
            </div>
          ) : (
            <div className="h-full aspect-square rounded-lg bg-white/5 flex items-center justify-center">
              <Music className="h-8 w-8 text-white/15" />
            </div>
          )}
        </div>

        {/* Track info — marquee only when playing, static when paused */}
        {hasTrack ? (
          <div className="relative z-10 shrink-0 overflow-hidden px-2 pb-1.5">
            {isPlaying ? (
              <div className="w-[200%] flex whitespace-nowrap animate-marquee">
                <span className="w-1/2 text-center text-[11px] text-white/80 font-medium">{marqueeText}</span>
                <span className="w-1/2 text-center text-[11px] text-white/80 font-medium">{marqueeText}</span>
              </div>
            ) : (
              <div className="text-[11px] text-white/80 font-medium truncate text-center">
                {marqueeText}
              </div>
            )}
          </div>
        ) : (
          <div className="relative z-10 shrink-0 px-2 pb-1.5 text-center">
            <span className="text-[11px] text-white/30">Tap to open player</span>
          </div>
        )}

        {/* Restricted banner */}
        {activeIsRestricted && activeDevice && (
          <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-center bg-amber-500/15 px-2 py-0.5">
            <span className="text-[9px] text-amber-300/80 truncate">
              ⚠ {activeDevice.name} restricted
            </span>
          </div>
        )}
      </div>
    );
  }

  // ── Expanded mode ───────────────────────────────────────────────────────
  return (
    <div ref={containerRef} className="relative flex flex-col h-full overflow-hidden">
      {/* Ambient background from album art */}
      {showAlbumArt && nowPlaying?.albumArtUrl ? (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center blur-3xl scale-[2] opacity-50"
            style={{ backgroundImage: `url(${nowPlaying.albumArtUrl})` }}
          />
          <div className="absolute inset-0 bg-black/40" />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-900/90 to-zinc-950/95" />
      )}

      <div className="relative z-10 flex flex-col h-full">
        {/* Collapse button */}
        <div className="flex justify-end px-2 pt-1">
          <button
            className="h-8 w-8 flex items-center justify-center text-white/40 hover:text-white/70"
            onClick={() => { setExpanded(false); setShowVolume(false); }}
            title="Collapse player"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>

        {/* Album art (centered, takes available space) */}
        <div className="flex-1 flex items-center justify-center px-4 min-h-0">
          {hasTrack && showAlbumArt && nowPlaying?.albumArtUrl ? (
            <img
              src={nowPlaying.albumArtUrl}
              alt={nowPlaying.albumName ?? ''}
              className="max-h-full max-w-full aspect-square rounded-lg shadow-2xl object-cover"
            />
          ) : hasTrack ? (
            <div className="h-24 w-24 rounded-lg bg-white/5 flex items-center justify-center">
              <Music className="h-10 w-10 text-white/20" />
            </div>
          ) : (
            <button
              onClick={() => setShowBrowse(true)}
              className="flex flex-col items-center gap-2"
            >
              <Music className="h-10 w-10 text-white/15" />
              <span className="text-xs text-white/30">Browse or search…</span>
            </button>
          )}
        </div>

        {/* Bottom controls */}
        <div className="shrink-0 px-4 pb-3 space-y-2">
          {/* Track info */}
          {hasTrack && (
            <div className="text-center">
              <div className="text-sm font-semibold text-white truncate">
                {nowPlaying.trackName}
              </div>
              <div className="text-xs text-white/50 truncate">
                {nowPlaying.artistName}
              </div>
            </div>
          )}

          {/* Progress */}
          {hasTrack && (
            <ProgressBar
              progressMs={nowPlaying.progressMs ?? 0}
              durationMs={nowPlaying.durationMs ?? 0}
              accentColor={accentColor}
            />
          )}

          {/* Transport */}
          <TransportControls
            isPlaying={isPlaying}
            onPlay={handlePlay}
            onPause={handlePause}
            onNext={handleNext}
            onPrev={handlePrev}
            loading={controlsLoading}
            disabled={controlsDisabled}
            accentColor={accentColor}
            onVolumeClick={() => setShowVolume(!showVolume)}
            onBrowseClick={() => setShowBrowse(true)}
          />

          {/* Volume (toggleable) */}
          {showVolume && (
            <div className="px-1">
              <VolumeSlider
                volume={currentVolume}
                onVolumeChange={(v) => controls.volume.mutate({ volume_percent: v })}
              />
            </div>
          )}

          {/* Device row */}
          <div className="flex items-center justify-between">
            {/* Status dot + name */}
            <div className="flex items-center gap-1.5 text-[11px] text-white/40 min-w-0">
              {activeDevice && (
                <span className="h-1.5 w-1.5 rounded-full bg-green-400 shrink-0" />
              )}
              <span className="truncate">{activeRoomName ?? 'No device'}</span>
            </div>

            {/* Icon-only pickers */}
            <div className="flex items-center">
              <DevicePicker
                devices={devices}
                onTransfer={(id) => controls.transfer.mutate({ device_id: id, play: true })}
                onRefresh={refreshDevices}
                refreshing={devicesRefreshing}
                sdkReady={sdk.ready}
                sdkDeviceId={sdk.deviceId}
                sdkError={sdk.error}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Restricted banner */}
      {activeIsRestricted && activeDevice && (
        <div className="absolute top-8 left-0 right-0 z-20 flex items-center justify-center bg-amber-500/10 border-b border-amber-500/20 px-3 py-1">
          <span className="text-[10px] text-amber-300/80 truncate">
            ⚠ {activeDevice.name} — restricted
          </span>
          {sdk.ready && sdk.deviceId ? (
            <button
              className="text-[10px] text-green-400 hover:text-green-300 whitespace-nowrap ml-2"
              onClick={() =>
                controls.transfer.mutate({ device_id: sdk.deviceId!, play: true })
              }
            >
              Play here
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
