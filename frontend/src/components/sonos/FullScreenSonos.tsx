/**
 * Full-screen Sonos controller overlay.
 *
 * Portalled to <body> from SonosWidget. Shows now-playing hero, transport,
 * room cards with per-group volume, favorites, queue, and browse panels.
 * Inspired by sonos-web/sonos-web.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Speaker,
  Loader2,
  Music,
  Users,
  Plus,
  Minus,
  Settings2,
  Shuffle,
  Repeat,
  Repeat1,
  ListMusic,
  Heart,
  Library,
  RefreshCw,
  Unlink,
  TriangleAlert,
} from 'lucide-react';
import {
  useSonosGroups,
  useSonosPlaybackState,
  useSonosMetadata,
  useSonosGroupVolume,
  useSonosPlayerVolume,
  useSonosControls,
  useSonosFavorites,
  useLoadFavorite,
  useSonosModifyGroup,
  useResetSonosGroup,
  useSonosPlayMode,
  useSetPlayMode,
  useServiceLabels,
} from '../../hooks/useSonos.js';
import type { SonosGroup, SonosPlayer as SonosPlayerType } from '../../hooks/useSonos.js';
import { QueuePanel } from './QueuePanel.js';
import { BrowsePanel } from './BrowsePanel.js';
import { useDocumentVisibility } from '../../hooks/useDocumentVisibility.js';
import { useAdaptivePoll } from '../../hooks/useAdaptivePoll.js';
import { usePositionTimer } from '../../hooks/usePositionTimer.js';
import { getServiceAccent, DEFAULT_ACCENT, type ServiceAccent } from './sonos-theme.js';
import { useSwipeGesture } from '../../hooks/useSwipeGesture.js';
import { Slider } from '../ui/slider.js';
import { MarqueeText } from './MarqueeText.js';
import { SonosArtworkFrame } from './SonosArtworkFrame.js';
import { useBootstrap } from '../../state/bootstrap.js';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../ui/alert-dialog.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ─── Props ──────────────────────────────────────────────────────────────────

export interface FullScreenSonosProps {
  householdId: string;
  initialGroupId?: string | undefined;
  onClose: () => void;
}

// ─── Per-player volume row (needs own hooks) ───────────────────────────────

interface PlayerVolumeRowProps {
  player: SonosPlayerType;
  groupId: string;
  coordinatorId: string | undefined;
  accent: ServiceAccent;
  onRemove: () => void;
  removeDisabled: boolean;
}

function PlayerVolumeRow({
  player,
  groupId,
  coordinatorId,
  accent,
  onRemove,
  removeDisabled,
}: PlayerVolumeRowProps) {
  const { data: pvol } = useSonosPlayerVolume(player.id, true);
  const controls = useSonosControls();
  const isCoordinator = player.id === coordinatorId;
  // Only show per-player volume when the group has multiple members
  // (single-player groups use the group volume slider)
  void groupId; // used for future per-group context if needed

  return (
    <div className="py-0.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Speaker className={`h-3.5 w-3.5 ${accent.text}`} />
          <span className="text-sm text-white/80">{player.name}</span>
          {isCoordinator && (
            <span className={`text-[8px] ${accent.text} opacity-60 px-1 rounded bg-white/5`}>
              coordinator
            </span>
          )}
        </div>
        {!isCoordinator && (
          <button
            type="button"
            onClick={onRemove}
            disabled={removeDisabled}
            className="flex h-10 w-10 items-center justify-center rounded-full text-white/30 transition-[background-color,color,transform] can-hover:hover:bg-white/[0.06] can-hover:hover:text-red-400 active:scale-[0.97]"
            title="Remove from group"
          >
            <Minus className="h-3 w-3" />
          </button>
        )}
      </div>
      {pvol != null && (
        <div className="flex items-center gap-1.5 ml-4.5 mt-0.5">
          <Volume2 className="h-3 w-3 text-white/20 shrink-0" />
          <Slider
            min={0}
            max={100}
            value={[pvol.volume ?? 50]}
            onValueChange={([v = 0]) =>
              controls.setPlayerVolume.mutate({ playerId: player.id, volume: v })
            }
            trackSize="xs"
            thumbSize="xs"
            accentColor={accent.range}
            className="flex-1"
          />
          <span className="text-[10px] text-white/30 w-5 text-right tabular-nums">
            {pvol.volume ?? '–'}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Room card sub-component ────────────────────────────────────────────────

interface RoomCardProps {
  group: SonosGroup;
  isActive: boolean;
  players: SonosPlayerType[];
  accent: ServiceAccent;
  onSelect: () => void;
  canReset: boolean;
}

function RoomCard({ group, isActive, players, accent, onSelect, canReset }: RoomCardProps) {
  // Non-active rooms poll at IDLE rate (30s) to stay current without hammering
  const { data: meta } = useSonosMetadata(group.id, true, 30_000);
  const { data: vol } = useSonosGroupVolume(group.id, true, 15_000);
  const { data: pb } = useSonosPlaybackState(group.id, true, 30_000);
  const controls = useSonosControls();
  const modify = useSonosModifyGroup();
  const reset = useResetSonosGroup();
  const [showGrouping, setShowGrouping] = useState(false);

  const isPlaying = pb?.playbackState === 'PLAYBACK_STATE_PLAYING';
  const track = meta?.currentItem?.track;
  const roomPlayers = players.filter((p) => group.playerIds?.includes(p.id));
  const roomAccent = track?.service?.name ? getServiceAccent(track.service.name) : DEFAULT_ACCENT;

  const inGroup = players.filter((p) => group.playerIds?.includes(p.id));
  const available = players.filter((p) => !group.playerIds?.includes(p.id));

  return (
    <div
      className={`w-full text-left p-3 transition-[background-color] duration-150 ease-out cursor-pointer ${
        isActive ? `${accent.bg} bg-white/[0.06]` : 'can-hover:hover:bg-white/[0.06]'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`h-2 w-2 rounded-full shrink-0 ${isPlaying ? roomAccent.dot : 'bg-white/20'}`}
          />
          <span className="text-base font-medium text-white truncate">{group.name}</span>
          {roomPlayers.length > 1 && (
            <span className="text-xs text-white/40 shrink-0">
              <Users className="h-3 w-3 inline -mt-0.5" /> {roomPlayers.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowGrouping(!showGrouping);
            }}
            className={`flex h-10 w-10 items-center justify-center rounded-full transition-[background-color,color,transform] active:scale-[0.97] ${
              showGrouping
                ? accent.text + ' bg-white/10'
                : 'text-white/40 hover:text-white/60 hover:bg-white/10'
            }`}
            title="Edit group speakers"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (isPlaying) {
                controls.pause.mutate({ groupId: group.id });
              } else {
                controls.play.mutate({ groupId: group.id });
              }
            }}
            className="flex h-10 w-10 items-center justify-center rounded-full transition-[background-color,transform] can-hover:hover:bg-white/10 active:scale-[0.97]"
          >
            {isPlaying ? (
              <Pause className="h-3.5 w-3.5 text-white/60" />
            ) : (
              <Play className="h-3.5 w-3.5 text-white/60 ml-0.5" />
            )}
          </button>
        </div>
      </div>

      {track ? (
        <div className="flex items-center gap-2 min-w-0">
          {track.imageUrl && (
            <img src={track.imageUrl} alt="" className="h-10 w-10 rounded shrink-0 object-cover" />
          )}
          <div className="min-w-0">
            <p className="text-sm text-white/80 truncate">{track.name}</p>
            <p className="text-xs text-white/40 truncate">{track.artist?.name}</p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-white/30 italic">Nothing playing</p>
      )}

      {/* Inline volume */}
      <div className="flex items-center gap-1.5 mt-2">
        <Volume2 className="h-3 w-3 text-white/30 shrink-0" />
        <Slider
          min={0}
          max={100}
          value={[vol?.volume ?? 50]}
          onValueChange={([v = 0]) => {
            controls.setGroupVolume.mutate({ groupId: group.id, volume: v });
          }}
          onClick={(e) => e.stopPropagation()}
          trackSize="sm"
          thumbSize="sm"
          accentColor={roomAccent.range}
          className="flex-1"
        />
        <span className="text-xs text-white/30 w-6 text-right">{vol?.volume ?? '–'}%</span>
      </div>

      {/* Grouping panel */}
      {showGrouping && (
        <div
          className="mt-3 pt-3 border-t border-white/10 space-y-2 text-xs"
          onClick={(e) => e.stopPropagation()}
        >
          {/* In group */}
          <div className="space-y-1">
            <span className="text-xs text-white/40 uppercase tracking-wider">In group</span>
            {inGroup.map((p) => (
              <PlayerVolumeRow
                key={p.id}
                player={p}
                groupId={group.id}
                coordinatorId={group.coordinatorId}
                accent={accent}
                onRemove={() => modify.mutate({ groupId: group.id, playerIdsToRemove: [p.id] })}
                removeDisabled={modify.isPending}
              />
            ))}
          </div>

          {/* Available speakers */}
          {available.length > 0 && (
            <div className="space-y-1 pt-1 border-t border-white/5">
              <span className="text-xs text-white/40 uppercase tracking-wider">Available</span>
              {available.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-0.5">
                  <div className="flex items-center gap-1.5">
                    <Speaker className="h-3 w-3 text-white/30" />
                    <span className="text-white/50">{p.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => modify.mutate({ groupId: group.id, playerIdsToAdd: [p.id] })}
                    disabled={modify.isPending}
                    className="flex h-10 w-10 items-center justify-center rounded-full text-white/30 transition-[background-color,color,transform] can-hover:hover:bg-white/[0.06] can-hover:hover:text-green-400 active:scale-[0.97]"
                    title="Add to group"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {modify.isPending && (
            <div className="flex items-center gap-1 text-[10px] text-white/40">
              <Loader2 className="h-3 w-3 animate-spin" /> Updating…
            </div>
          )}

          {canReset && inGroup.length > 1 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  disabled={reset.isPending}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-red-400/20 bg-red-500/[0.06] px-3 text-xs font-medium text-red-200 transition-[background-color,border-color,transform] duration-150 ease-out can-hover:hover:border-red-400/40 can-hover:hover:bg-red-500/10 active:scale-[0.98]"
                >
                  {reset.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Unlink className="h-4 w-4" />
                  )}
                  Separate group
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Separate {group.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Every room except the coordinator will leave this group. Bonded stereo pairs
                    stay together.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep group</AlertDialogCancel>
                  <AlertDialogAction
                    type="button"
                    onClick={() => reset.mutate({ groupId: group.id })}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Separate rooms
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main fullscreen component ──────────────────────────────────────────────

export function FullScreenSonos({ householdId, initialGroupId, onClose }: FullScreenSonosProps) {
  const { user } = useBootstrap();
  // ── Adaptive polling + visibility ─────────────────────────────────────────
  const { isVisible } = useDocumentVisibility();
  const [lastPlaybackState, setLastPlaybackState] = useState<string | undefined>();
  const intervals = useAdaptivePoll(lastPlaybackState, isVisible, 'fullscreen');

  const {
    data: groupsData,
    refetch: refetchGroups,
    isFetching: groupsFetching,
  } = useSonosGroups(householdId, true, intervals.groupsInterval);
  const groups = useMemo(() => groupsData?.groups ?? [], [groupsData]);
  const players = useMemo(() => groupsData?.players ?? [], [groupsData]);

  // Derive initial active group
  const defaultGroupId = groups[0]?.id ?? null;
  const [activeGroupId, setActiveGroupId] = useState<string | null>(
    initialGroupId && groups.some((g) => g.id === initialGroupId) ? initialGroupId : defaultGroupId,
  );

  // Derive effective group: user selection if still valid, else match by
  // coordinator prefix (group IDs change on regroup), else fall back to first
  const effectiveGroupId = useMemo(() => {
    if (!groups.length) return null;
    // Current selection still exists
    if (activeGroupId && groups.some((g) => g.id === activeGroupId)) return activeGroupId;
    // Match by RINCON prefix (group IDs are like RINCON_xxxx:nnn)
    if (activeGroupId) {
      const prefix = activeGroupId.split(':')[0];
      if (prefix) {
        const match = groups.find((g) => g.id.startsWith(prefix));
        if (match) return match.id;
      }
    }
    return defaultGroupId;
  }, [groups, activeGroupId, defaultGroupId]);

  // Escape to close
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Active group data (adaptive intervals)
  const { data: playbackState } = useSonosPlaybackState(
    effectiveGroupId ?? undefined,
    true,
    intervals.playbackInterval,
  );
  const { data: metadata } = useSonosMetadata(
    effectiveGroupId ?? undefined,
    true,
    intervals.metadataInterval,
  );
  const { data: volumeData } = useSonosGroupVolume(
    effectiveGroupId ?? undefined,
    true,
    intervals.volumeInterval,
  );
  const controls = useSonosControls();
  const modifyGroup = useSonosModifyGroup();

  // Sync playback state for adaptive polling
  const currentPlaybackState = playbackState?.playbackState;
  if (currentPlaybackState !== lastPlaybackState) {
    setLastPlaybackState(currentPlaybackState);
  }

  // Play mode
  const { data: playMode } = useSonosPlayMode(
    effectiveGroupId ?? undefined,
    true,
    intervals.playModeInterval,
  );
  const setPlayModeMut = useSetPlayMode();

  const isPlaying = playbackState?.playbackState === 'PLAYBACK_STATE_PLAYING';
  const track = metadata?.currentItem?.track;
  const trackName = track?.name ?? 'Nothing playing';
  const artistName = track?.artist?.name ?? '';
  const albumName = track?.album?.name ?? '';
  const imageUrl = track?.imageUrl ?? metadata?.container?.imageUrl ?? null;
  const serviceName = track?.service?.name ?? metadata?.container?.service?.name ?? '';
  const accountLabel = track?.service?.accountLabel;
  const accent = getServiceAccent(serviceName);

  const vol = volumeData?.volume ?? 50;
  const isMuted = volumeData?.muted ?? false;

  // Position timer (client-side interpolation)
  const { displayPosition, progress } = usePositionTimer({
    positionMillis: playbackState?.positionMillis,
    durationMillis: track?.durationMillis,
    isPlaying,
  });

  // Favorites
  const {
    data: favorites,
    isLoading: favsLoading,
    refetch: refetchFavorites,
    isFetching: favsFetching,
    isError: favsError,
  } = useSonosFavorites(householdId);
  const loadFav = useLoadFavorite();
  const { data: serviceLabelsData } = useServiceLabels();
  const serviceLabels = serviceLabelsData?.labels ?? {};

  // Right panel tab
  const [rightTab, setRightTab] = useState<'rooms' | 'queue' | 'browse' | 'favorites'>('rooms');
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false);

  // Party mode: group all players into one group
  const handlePartyMode = useCallback(() => {
    if (!groups.length || !effectiveGroupId) return;
    const allPlayerIds = players.map((p) => p.id);
    const activeGroup = groups.find((g) => g.id === effectiveGroupId);
    const coordPlayers = activeGroup?.playerIds ?? [];
    const toAdd = allPlayerIds.filter((id) => !coordPlayers.includes(id));
    if (toAdd.length === 0) return;
    modifyGroup.mutate({ groupId: effectiveGroupId, playerIdsToAdd: toAdd });
  }, [groups, players, effectiveGroupId, modifyGroup]);

  // Transport handlers
  const handlePlayPause = () => {
    if (!effectiveGroupId) return;
    if (isPlaying) controls.pause.mutate({ groupId: effectiveGroupId });
    else controls.play.mutate({ groupId: effectiveGroupId });
  };

  const handleNext = () => {
    if (effectiveGroupId) controls.next.mutate({ groupId: effectiveGroupId });
  };

  const handlePrev = () => {
    if (effectiveGroupId) controls.previous.mutate({ groupId: effectiveGroupId });
  };

  const handleVolume = (value: number) => {
    if (effectiveGroupId)
      controls.setGroupVolume.mutate({ groupId: effectiveGroupId, volume: value });
  };

  const handleMute = () => {
    if (effectiveGroupId)
      controls.setGroupMute.mutate({ groupId: effectiveGroupId, muted: !isMuted });
  };

  const swipe = useSwipeGesture({
    onSwipeLeft: handleNext,
    onSwipeRight: handlePrev,
  });

  // Play mode handlers
  const toggleShuffle = () => {
    if (!effectiveGroupId || !playMode) return;
    setPlayModeMut.mutate({
      groupId: effectiveGroupId,
      state: { ...playMode, shuffle: !playMode.shuffle },
    });
  };

  const cycleRepeat = () => {
    if (!effectiveGroupId || !playMode) return;
    // OFF → REPEAT_ALL → REPEAT_ONE → OFF
    let nextRepeat = false;
    let nextRepeatOne = false;
    if (!playMode.repeat && !playMode.repeatOne) {
      nextRepeat = true;
    } else if (playMode.repeat && !playMode.repeatOne) {
      nextRepeatOne = true;
    }
    // else: repeatOne → OFF (both false)
    setPlayModeMut.mutate({
      groupId: effectiveGroupId,
      state: { ...playMode, repeat: nextRepeat, repeatOne: nextRepeatOne },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="dark relative flex h-[100dvh] w-full max-w-[1400px] flex-col overflow-hidden border-0 bg-zinc-950 shadow-2xl animate-in fade-in duration-200 ease-out sm:h-[85vh] sm:w-[85vw] sm:rounded-xl sm:border sm:border-white/10 sm:bg-zinc-950/95 sm:backdrop-blur sm:zoom-in-[0.97]">
        {/* Ambient background */}
        {imageUrl && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden sm:rounded-xl">
            <img
              src={imageUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover blur-[80px] opacity-20 scale-150"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80" />
          </div>
        )}

        {/* Header */}
        <div className="relative flex items-center justify-between px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 sm:pb-3 sm:pt-5">
          <button
            type="button"
            onClick={handlePartyMode}
            disabled={modifyGroup.isPending}
            aria-label="Group all rooms"
            title="Party Mode"
            className={`flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-medium text-white transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] ${accent.btnBg} ${accent.btnHover}`}
          >
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Party Mode</span>
          </button>
          <h2 className="text-sm font-semibold tracking-wide text-white/80">Sonos</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Sonos"
            className="flex h-11 min-w-11 items-center justify-center gap-2 rounded-full px-2 text-white/60 transition-[background-color,color,transform] duration-150 ease-out can-hover:hover:bg-white/[0.06] can-hover:hover:text-white active:scale-[0.97]"
          >
            <span className="hidden text-sm font-medium sm:inline">Close</span>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content area */}
        <div className="relative flex min-h-0 flex-1 flex-col gap-2 overflow-hidden px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:gap-6 sm:px-6 sm:pb-6 lg:flex-row">
          {/* Left column: Now Playing + Transport */}
          {/* --- MOBILE compact player (< sm) --- */}
          <div className="sm:hidden shrink-0">
            {/* Active group indicator (mobile) */}
            {(() => {
              const ag = groups.find((g) => g.id === effectiveGroupId);
              return ag ? (
                <button
                  type="button"
                  onClick={() => setMobileControlsOpen((open) => !open)}
                  aria-expanded={mobileControlsOpen}
                  aria-label={
                    mobileControlsOpen ? 'Hide playback controls' : 'Show playback controls'
                  }
                  className="mb-2 flex min-h-11 max-w-full items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.06] px-3 text-white/70 transition-[background-color,transform] duration-150 ease-out active:scale-[0.97]"
                >
                  <Speaker className="h-3 w-3 text-white/50" />
                  <span className="min-w-0 truncate text-xs font-medium">{ag.name}</span>
                  <Settings2 className="h-3.5 w-3.5 shrink-0 text-white/40" />
                </button>
              ) : null;
            })()}
            <div className="flex items-center gap-3 rounded-xl bg-white/[0.04] border border-white/[0.08] p-3">
              {/* Tiny album art */}
              <div
                className="relative w-14 h-14 rounded-lg overflow-hidden shrink-0 shadow-lg touch-pan-y"
                {...swipe}
              >
                <SonosArtworkFrame
                  imageUrl={imageUrl}
                  alt={albumName}
                  className="h-full w-full rounded-none"
                  iconClassName="h-6 w-6"
                />
              </div>
              {/* Track info + controls */}
              <div className="flex-1 min-w-0">
                <MarqueeText
                  key={trackName}
                  text={trackName}
                  isPlaying={isPlaying}
                  className="text-sm font-semibold text-white"
                />
                <p className="text-xs text-white/50 truncate">
                  {artistName}
                  {albumName ? ` · ${albumName}` : ''}
                </p>
              </div>
              {/* Inline transport */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handlePrev}
                  aria-label="Previous track"
                  className="flex h-11 w-11 items-center justify-center rounded-full text-white/60 transition-[background-color,color,transform] duration-150 ease-out can-hover:hover:bg-white/[0.06] can-hover:hover:text-white active:scale-[0.97]"
                >
                  <SkipBack className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handlePlayPause}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                  className={`flex h-12 w-12 items-center justify-center rounded-full ${accent.btnBg} ${accent.btnHover} text-white shadow-lg transition-[background-color,transform] duration-150 ease-out active:scale-[0.97]`}
                >
                  {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  aria-label="Next track"
                  className="flex h-11 w-11 items-center justify-center rounded-full text-white/60 transition-[background-color,color,transform] duration-150 ease-out can-hover:hover:bg-white/[0.06] can-hover:hover:text-white active:scale-[0.97]"
                >
                  <SkipForward className="h-4 w-4" />
                </button>
              </div>
            </div>
            {/* Progress bar (mobile) */}
            {progress > 0 && (
              <div className="mt-1.5 flex items-center gap-2 px-1">
                <span className="text-[10px] tabular-nums text-white/40 w-8">
                  {formatMs(displayPosition)}
                </span>
                <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden cursor-pointer">
                  <div
                    className="h-full rounded-full transition-[width] duration-1000 ease-linear"
                    style={{ width: `${progress * 100}%`, backgroundColor: accent.dot }}
                  />
                </div>
                <span className="text-[10px] tabular-nums text-white/40 w-8 text-right">
                  {formatMs(track?.durationMillis ?? 0)}
                </span>
              </div>
            )}
            {/* Secondary controls stay collapsed on phones until requested. */}
            {mobileControlsOpen && (
              <div
                data-testid="sonos-mobile-secondary-controls"
                className="mt-2 flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-1 py-1"
              >
                <button
                  type="button"
                  onClick={handleMute}
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/40 transition-[background-color,color,transform] duration-150 ease-out can-hover:hover:bg-white/[0.06] can-hover:hover:text-white active:scale-[0.97]"
                >
                  {isMuted ? (
                    <VolumeX className="h-3.5 w-3.5" />
                  ) : (
                    <Volume2 className="h-3.5 w-3.5" />
                  )}
                </button>
                <Slider
                  min={0}
                  max={100}
                  value={[vol]}
                  onValueChange={([v = 0]) => handleVolume(v)}
                  trackSize="sm"
                  thumbSize="sm"
                  accentColor={accent.range}
                  className="flex-1"
                />
                <span className="w-7 text-right text-[10px] text-white/40">{vol}%</span>
                <button
                  type="button"
                  onClick={toggleShuffle}
                  aria-label={playMode?.shuffle ? 'Disable shuffle' : 'Enable shuffle'}
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.97] ${
                    playMode?.shuffle
                      ? `${accent.text} bg-white/10`
                      : 'text-white/30 can-hover:hover:text-white/50'
                  }`}
                >
                  <Shuffle className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={cycleRepeat}
                  aria-label={
                    playMode?.repeatOne
                      ? 'Disable repeat'
                      : playMode?.repeat
                        ? 'Enable repeat one'
                        : 'Enable repeat'
                  }
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.97] ${
                    playMode?.repeat || playMode?.repeatOne
                      ? `${accent.text} bg-white/10`
                      : 'text-white/30 can-hover:hover:text-white/50'
                  }`}
                >
                  {playMode?.repeatOne ? (
                    <Repeat1 className="h-3.5 w-3.5" />
                  ) : (
                    <Repeat className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            )}
          </div>

          {/* --- DESKTOP/TABLET full player (≥ sm) --- */}
          <div className="hidden sm:flex flex-col items-center lg:w-2/5 shrink-0">
            {/* Active group indicator */}
            {(() => {
              const ag = groups.find((g) => g.id === effectiveGroupId);
              return ag ? (
                <div className="flex items-center gap-1.5 mb-4 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08]">
                  <Speaker className="h-3.5 w-3.5 text-white/50" />
                  <span className="text-sm font-medium text-white/70">{ag.name}</span>
                  {ag.playerIds.length > 1 && (
                    <span className="text-xs text-white/40">· {ag.playerIds.length} speakers</span>
                  )}
                </div>
              ) : null;
            })()}
            {/* Album art */}
            <div
              className="relative w-56 h-56 lg:w-72 lg:h-72 rounded-2xl overflow-hidden shadow-2xl mb-5 shrink-0 touch-pan-y"
              {...swipe}
            >
              <SonosArtworkFrame
                imageUrl={imageUrl}
                alt={albumName}
                className="h-full w-full rounded-none"
                iconClassName="h-16 w-16"
              />
            </div>

            {/* Track info */}
            <div className="text-center mb-3 w-full max-w-md">
              <MarqueeText
                key={trackName}
                text={trackName}
                isPlaying={isPlaying}
                className="text-lg lg:text-xl font-semibold text-white"
              />
              <MarqueeText
                key={`${artistName}-${albumName}`}
                text={artistName + (albumName ? ` · ${albumName}` : '')}
                isPlaying={isPlaying}
                className="text-sm text-white/50"
              />
              {serviceName && (
                <span
                  className={`inline-flex items-center gap-1.5 mt-2 px-2.5 py-0.5 rounded-full text-xs font-semibold ${accent.bg} ${accent.text} uppercase tracking-wider`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${accent.dot}`} />
                  {accountLabel ?? accent.label}
                </span>
              )}
            </div>

            {/* Progress bar */}
            {track && (
              <div className="w-full max-w-md mb-3">
                <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${accent.dot} transition-[width] duration-1000 ease-linear`}
                    style={{ width: `${(progress * 100).toFixed(1)}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1 text-xs text-white/40">
                  <span>{formatMs(displayPosition)}</span>
                  <span>{formatMs(track.durationMillis ?? 0)}</span>
                </div>
              </div>
            )}

            {/* Transport controls with shuffle/repeat */}
            <div className="flex items-center gap-4 mb-3">
              <button
                onClick={toggleShuffle}
                className={`p-1.5 rounded-full transition-colors ${
                  playMode?.shuffle
                    ? `${accent.text} bg-white/10`
                    : 'text-white/30 hover:text-white/50'
                }`}
                title="Shuffle"
              >
                <Shuffle className="h-5 w-5" />
              </button>
              <button
                onClick={handlePrev}
                className="p-2.5 text-white/60 hover:text-white transition-colors"
              >
                <SkipBack className="h-6 w-6" />
              </button>
              <button
                onClick={handlePlayPause}
                className={`p-4 rounded-full ${accent.btnBg} ${accent.btnHover} text-white shadow-lg transition-[background-color,transform] duration-150 ease-out active:scale-95`}
              >
                {isPlaying ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7 ml-0.5" />}
              </button>
              <button
                onClick={handleNext}
                className="p-2.5 text-white/60 hover:text-white transition-colors"
              >
                <SkipForward className="h-6 w-6" />
              </button>
              <button
                onClick={cycleRepeat}
                className={`p-1.5 rounded-full transition-colors ${
                  playMode?.repeat || playMode?.repeatOne
                    ? `${accent.text} bg-white/10`
                    : 'text-white/30 hover:text-white/50'
                }`}
                title={
                  playMode?.repeatOne
                    ? 'Repeat One'
                    : playMode?.repeat
                      ? 'Repeat All'
                      : 'Repeat Off'
                }
              >
                {playMode?.repeatOne ? (
                  <Repeat1 className="h-5 w-5" />
                ) : (
                  <Repeat className="h-5 w-5" />
                )}
              </button>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-3 w-full max-w-xs">
              <button
                onClick={handleMute}
                className="p-2 text-white/40 hover:text-white transition-colors"
              >
                {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
              <Slider
                min={0}
                max={100}
                value={[vol]}
                onValueChange={([v = 0]) => handleVolume(v)}
                trackSize="md"
                thumbSize="md"
                accentColor={accent.range}
                className="flex-1"
              />
              <span className="text-sm text-white/40 w-8 text-right">{vol}%</span>
            </div>

            {/* Service legend — visible on all tabs */}
            {favorites &&
              (() => {
                // Dedupe by service+sn to show per-account entries
                const seen = new Set<string>();
                const entries: { name: string; label: string }[] = [];
                for (const f of favorites) {
                  const svc = f.service;
                  if (!svc?.name || svc.name === 'Sonos') continue;
                  const key = svc.sn != null ? `${svc.name}:${svc.sn}` : svc.name;
                  if (seen.has(key)) continue;
                  seen.add(key);
                  const acctLabel = svc.sn != null ? serviceLabels[`sn:${svc.sn}`] : undefined;
                  entries.push({
                    name: svc.name,
                    label: acctLabel ?? getServiceAccent(svc.name).label,
                  });
                }
                if (!entries.length) return null;
                return (
                  <div className="flex flex-wrap items-center gap-3 mt-auto pt-4">
                    <span className="text-[10px] text-white/30 font-medium uppercase tracking-wider">
                      Services
                    </span>
                    {entries.map((e) => (
                      <div key={e.label} className="flex items-center gap-1.5">
                        <span
                          className={`h-2 w-2 rounded-full ${getServiceAccent(e.name).btnBg}`}
                        />
                        <span className="text-[10px] text-white/40">{e.label}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
          </div>

          {/* Right column: Tabbed panel */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            {/* Tab bar */}
            <nav
              aria-label="Sonos sections"
              className="mb-2 grid grid-cols-4 gap-1 sm:mb-3 sm:flex sm:items-center"
            >
              {[
                { id: 'rooms' as const, label: 'Rooms', icon: Speaker },
                { id: 'queue' as const, label: 'Queue', icon: ListMusic },
                { id: 'browse' as const, label: 'Browse', icon: Library },
                { id: 'favorites' as const, label: 'Favorites', icon: Heart },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = rightTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setRightTab(tab.id)}
                    aria-pressed={isActive}
                    className={`flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-lg px-1 text-[10px] font-medium transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.97] sm:min-h-0 sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-xs ${
                      isActive
                        ? `${accent.text} bg-white/[0.08]`
                        : 'text-white/40 can-hover:hover:bg-white/[0.04] can-hover:hover:text-white/60'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {tab.label}
                    {tab.id === 'rooms' && (
                      <span className="rounded-full bg-white/[0.06] px-1.5 text-[9px] leading-4 text-white/40">
                        {groups.length}
                      </span>
                    )}
                  </button>
                );
              })}
              {/* Refresh button for rooms/favorites */}
              {(rightTab === 'rooms' || rightTab === 'favorites') && (
                <button
                  type="button"
                  onClick={() => {
                    if (rightTab === 'rooms') void refetchGroups();
                    else void refetchFavorites();
                  }}
                  className="ml-auto hidden min-h-8 min-w-8 items-center justify-center rounded-lg text-white/30 transition-colors can-hover:hover:bg-white/[0.04] can-hover:hover:text-white/60 sm:flex"
                  title={`Refresh ${rightTab}`}
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${
                      (rightTab === 'rooms' && groupsFetching) ||
                      (rightTab === 'favorites' && favsFetching)
                        ? 'animate-spin'
                        : ''
                    }`}
                  />
                </button>
              )}
            </nav>

            {/* Tab content */}
            <div className="flex-1 overflow-hidden min-h-0">
              {(rightTab === 'rooms' || rightTab === 'favorites') && (
                <div className="mb-1 flex justify-end sm:hidden">
                  <button
                    type="button"
                    onClick={() => {
                      if (rightTab === 'rooms') void refetchGroups();
                      else void refetchFavorites();
                    }}
                    className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs font-medium text-white/50 transition-[background-color,color,transform] duration-150 ease-out can-hover:hover:bg-white/[0.06] can-hover:hover:text-white/70 active:scale-[0.97]"
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${
                        (rightTab === 'rooms' && groupsFetching) ||
                        (rightTab === 'favorites' && favsFetching)
                          ? 'animate-spin'
                          : ''
                      }`}
                    />
                    Refresh
                  </button>
                </div>
              )}
              {rightTab === 'rooms' && (
                <div className="h-full overflow-y-auto scrollbar-hide">
                  <div className="space-y-3">
                    {groups.map((g) => (
                      <div key={g.id} className="rounded-xl bg-white/[0.04] overflow-hidden">
                        <RoomCard
                          key={g.id}
                          group={g}
                          isActive={g.id === effectiveGroupId}
                          players={players}
                          accent={accent}
                          onSelect={() => setActiveGroupId(g.id)}
                          canReset={user?.isAdmin ?? false}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {rightTab === 'queue' && <QueuePanel groupId={effectiveGroupId} accent={accent} />}

              {rightTab === 'browse' && (
                <BrowsePanel
                  groupId={effectiveGroupId}
                  householdId={householdId}
                  currentService={metadata?.currentItem?.track?.service?.name}
                  currentAccountSerial={metadata?.currentItem?.track?.service?.sn}
                  accent={accent}
                />
              )}

              {rightTab === 'favorites' && (
                <div className="h-full overflow-y-auto scrollbar-hide">
                  {favsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-white/30" />
                    </div>
                  ) : favsError ? (
                    <div className="flex flex-col items-center gap-3 py-8 text-center">
                      <TriangleAlert className="h-6 w-6 text-amber-300/70" />
                      <p className="text-sm text-white/60">Could not load Sonos favorites.</p>
                      <button
                        type="button"
                        onClick={() => void refetchFavorites()}
                        disabled={favsFetching}
                        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-4 text-sm font-medium text-white/70 transition-[background-color,transform] duration-150 ease-out can-hover:hover:bg-white/[0.1] active:scale-[0.97] disabled:opacity-50"
                      >
                        <RefreshCw className={`h-4 w-4 ${favsFetching ? 'animate-spin' : ''}`} />
                        Retry
                      </button>
                    </div>
                  ) : !favorites?.length ? (
                    <p className="text-xs text-white/30 italic text-center py-8">
                      No favorites found. Add favorites in the Sonos app.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                      {favorites.map((fav) => (
                        <button
                          key={fav.id}
                          onClick={() => {
                            if (effectiveGroupId) {
                              loadFav.mutate({ groupId: effectiveGroupId, favoriteId: fav.id });
                            }
                          }}
                          disabled={!effectiveGroupId || loadFav.isPending}
                          className="group flex flex-col items-center gap-1.5 p-2 rounded-xl bg-white/[0.04] can-hover:hover:bg-white/[0.08] transition-colors duration-150 ease-out text-center"
                        >
                          <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-white/[0.06]">
                            {fav.imageUrl ? (
                              <img
                                src={fav.imageUrl}
                                alt=""
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Music className="h-6 w-6 text-white/10" />
                              </div>
                            )}
                            {/* Service color dot with account label tooltip */}
                            {fav.service?.name &&
                              fav.service.name !== 'Sonos' &&
                              (() => {
                                const svc = fav.service;
                                const label =
                                  svc.sn != null ? serviceLabels[String(svc.sn)] : undefined;
                                return (
                                  <span
                                    className={`absolute bottom-1 right-1 h-3 w-3 rounded-full ${getServiceAccent(svc.name).btnBg} shadow-md ring-1 ring-black/30`}
                                    title={label ?? getServiceAccent(svc.name).label}
                                  />
                                );
                              })()}
                          </div>
                          <span className="text-[10px] text-white/60 truncate w-full leading-tight">
                            {fav.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
