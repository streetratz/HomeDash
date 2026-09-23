/**
 * SonosWidget — Standalone Sonos music controller.
 *
 * Uses the Sonos Cloud Control API as the sole control surface.
 * Styled to match SpotifyWidget: ambient album-art background, compact/expanded modes.
 * Service-aware accent colours via shared sonos-theme.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { createPortal } from 'react-dom';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Speaker,
  Loader2,
  ChevronDown,
  Plus,
  Minus,
  Users,
  Expand,
} from 'lucide-react';
import { Button } from '../ui/button.js';
import { Slider } from '../ui/slider.js';
import type { WidgetDisplayProps } from './registry.js';
import {
  useSonosStatus,
  useSonosHouseholds,
  useSonosGroups,
  useSonosPlaybackState,
  useSonosMetadata,
  useSonosGroupVolume,
  useSonosControls,
  useSonosModifyGroup,
  sonosKeys,
  type SonosGroup,
  type SonosPlayer,
} from '../../hooks/useSonos.js';
import { useQueryClient } from '@tanstack/react-query';
import { FullScreenSonos } from '../sonos/FullScreenSonos.js';
import { useDocumentVisibility } from '../../hooks/useDocumentVisibility.js';
import { useAdaptivePoll } from '../../hooks/useAdaptivePoll.js';
import type { SonosViewMode } from '../../hooks/useAdaptivePoll.js';
import { usePositionTimer } from '../../hooks/usePositionTimer.js';
import { getServiceAccent, DEFAULT_ACCENT, type ServiceAccent } from '../sonos/sonos-theme.js';
import { useScreensaverActive } from '../../hooks/useScreensaverActive.js';
import { MarqueeText } from '../sonos/MarqueeText.js';
import { SonosArtworkFrame } from '../sonos/SonosArtworkFrame.js';
import { useIsPublicView } from '../../state/publicView.js';
import { usePublicWidgetSnapshot } from '../../state/publicWidgets.js';
import { selectPreferredSonosGroup } from '../../lib/sonosGroupSelection.js';

// ─── Config type ────────────────────────────────────────────────────────────

interface SonosConfig {
  householdId?: string;
  defaultGroupId?: string;
  showGrouping?: boolean;
  compactMode?: boolean;
}

interface PublicSonosSnapshot {
  groups: Array<{ id: string; name: string; playbackState: string }>;
  activeGroupId: string | null;
  playback: {
    playbackState?: string;
    positionMillis?: number;
  } | null;
  metadata: {
    currentItem?: {
      track?: {
        name?: string;
        artist?: { name?: string };
        album?: { name?: string };
        imageUrl?: string;
        durationMillis?: number;
        service?: { name?: string };
      };
    };
  } | null;
  volume: { volume?: number; muted?: boolean } | null;
}

function PublicSonosView({
  data,
  isLoading,
  isError,
}: {
  data: PublicSonosSnapshot | undefined;
  isLoading: boolean;
  isError: boolean;
}) {
  if (isLoading && !data) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-gradient-to-b from-zinc-900/80 to-zinc-950/95 p-4">
        <SonosArtworkFrame state="loading" className="h-20 w-20" />
        <span className="text-xs text-white/40">Loading Sonos</span>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-gradient-to-b from-zinc-900/80 to-zinc-950/95 p-4 text-white/40">
        <SonosArtworkFrame state="unavailable" className="h-20 w-20" />
        <span className="text-xs">Sonos is unavailable</span>
      </div>
    );
  }

  const track = data.metadata?.currentItem?.track;
  const imageUrl = track?.imageUrl;
  const activeGroup = data.groups.find((group) => group.id === data.activeGroupId);
  const serviceName = track?.service?.name ?? '';
  const accent = getServiceAccent(serviceName);
  const isPlaying = data.playback?.playbackState === 'PLAYBACK_STATE_PLAYING';

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      {imageUrl ? (
        <>
          <div
            className="absolute inset-0 scale-[2] bg-cover bg-center opacity-50 blur-3xl"
            style={{ backgroundImage: `url(${imageUrl})` }}
          />
          <div className="absolute inset-0 bg-black/45" />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-900/80 to-zinc-950/95" />
      )}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
        <SonosArtworkFrame
          imageUrl={imageUrl}
          alt={track?.album?.name ?? ''}
          state="idle"
          className="h-24 w-24 max-h-[65%] max-w-full shadow-2xl"
        />
        <div className="min-w-0 max-w-full">
          <div className="truncate text-sm font-semibold text-white">
            {track?.name ?? 'Nothing playing'}
          </div>
          <div className="truncate text-xs text-white/50">
            {track?.artist?.name ?? activeGroup?.name ?? 'Sonos'}
          </div>
        </div>
        <div className={`flex items-center gap-1.5 text-[10px] ${accent.dim}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${isPlaying ? accent.dot : 'bg-white/30'}`} />
          <span>{activeGroup?.name ?? 'No room selected'}</span>
          {typeof data.volume?.volume === 'number' && <span>· {data.volume.volume}%</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function SonosWidget({ widget }: WidgetDisplayProps) {
  const isPublicView = useIsPublicView();
  const config = (widget.config ?? {}) as SonosConfig;
  const qc = useQueryClient();
  const publicQuery = usePublicWidgetSnapshot<PublicSonosSnapshot>(
    widget.id,
    widget.type,
    isPublicView,
  );

  // ── Connection + discovery ────────────────────────────────────────────────
  const { data: status, isLoading: statusLoading } = useSonosStatus(!isPublicView);
  const connected = status?.connected ?? false;
  const { data: householdsData } = useSonosHouseholds(connected);
  const householdId = config.householdId ?? householdsData?.households?.[0]?.id;

  // ── Adaptive polling + visibility ─────────────────────────────────────────
  const screensaverActive = useScreensaverActive();
  const { isVisible } = useDocumentVisibility({
    onVisible: useCallback(() => {
      void qc.invalidateQueries({ queryKey: ['sonos-playback'] });
      void qc.invalidateQueries({ queryKey: ['sonos-metadata'] });
      void qc.invalidateQueries({ queryKey: ['sonos-groups'] });
      void qc.invalidateQueries({ queryKey: ['sonos-group-volume'] });
    }, [qc]),
  });

  // We need playback state to determine poll intervals, but playback state
  // itself needs an interval. Bootstrap with a fixed 5s, then use adaptive.
  const [lastPlaybackState, setLastPlaybackState] = useState<string | undefined>();
  const [expanded, setExpanded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  // Pause widget polling when fullscreen or screensaver is active
  const shouldPoll = isVisible && !fullscreen && !screensaverActive;
  const viewMode: SonosViewMode = expanded ? 'expanded' : 'compact';
  const intervals = useAdaptivePoll(lastPlaybackState, shouldPoll, viewMode);

  const { data: groupsData } = useSonosGroups(householdId, connected, intervals.groupsInterval);
  const groups = useMemo(() => groupsData?.groups ?? [], [groupsData]);
  const players = useMemo(() => groupsData?.players ?? [], [groupsData]);

  // ── Selected group ────────────────────────────────────────────────────────
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  // T014: Auto-reset when selected group disappears from topology
  const groupGone =
    selectedGroup !== null && groups.length > 0 && !groups.some((g) => g.id === selectedGroup);

  useEffect(() => {
    if (groupGone) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reset stale group on topology change
      setSelectedGroup(null);
      toast.info('Speaker group changed — switched to another room');
    }
  }, [groupGone]);

  const activeGroupId =
    (groupGone ? null : selectedGroup) ??
    selectPreferredSonosGroup(groups, config.defaultGroupId)?.id ??
    null;
  const activeGroup = groups.find((g) => g.id === activeGroupId);

  // ── Playback data (adaptive intervals) ────────────────────────────────────
  const { data: playbackState } = useSonosPlaybackState(
    activeGroupId ?? undefined,
    connected,
    intervals.playbackInterval,
  );
  const { data: metadata } = useSonosMetadata(
    activeGroupId ?? undefined,
    connected,
    intervals.metadataInterval,
  );
  const { data: volumeData } = useSonosGroupVolume(
    activeGroupId ?? undefined,
    connected,
    intervals.volumeInterval,
  );
  const controls = useSonosControls();

  // Sync playback state for adaptive polling
  const currentPlaybackState = playbackState?.playbackState;
  if (currentPlaybackState !== lastPlaybackState) {
    setLastPlaybackState(currentPlaybackState);
  }

  const isPlaying = playbackState?.playbackState === 'PLAYBACK_STATE_PLAYING';
  const isBuffering = playbackState?.playbackState === 'PLAYBACK_STATE_BUFFERING';
  const hasTrack = !!metadata?.currentItem?.track?.name;

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

  // ── Position timer (client-side interpolation) ────────────────────────────
  const { progress } = usePositionTimer({
    positionMillis: playbackState?.positionMillis,
    durationMillis: track?.durationMillis,
    isPlaying,
  });

  // ── UI state ──────────────────────────────────────────────────────────────
  const [showVolume, setShowVolume] = useState(false);
  const [showGrouping, setShowGrouping] = useState(false);

  const controlsLoading = controls.play.isPending || controls.pause.isPending;

  if (isPublicView) {
    return (
      <PublicSonosView
        data={publicQuery.data?.data}
        isLoading={publicQuery.isLoading}
        isError={publicQuery.isError}
      />
    );
  }

  // ── Not connected ─────────────────────────────────────────────────────────
  if (statusLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-gradient-to-b from-zinc-900/80 to-zinc-950/95">
        <SonosArtworkFrame state="loading" className="h-20 w-20" />
        <span className="text-xs text-white/40">Loading Sonos</span>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-4">
        <Speaker className={`h-8 w-8 ${DEFAULT_ACCENT.dim}`} />
        <p className="text-xs text-white/60 text-center">
          Connect your Sonos account in Settings → Integrations
        </p>
        <a
          href="/settings?tab=integrations"
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full ${DEFAULT_ACCENT.btnBg} ${DEFAULT_ACCENT.btnHover} text-white text-xs font-medium transition-colors`}
        >
          Open Settings
        </a>
      </div>
    );
  }

  // ── Transport handlers ────────────────────────────────────────────────────
  const handlePlayPause = () => {
    if (!activeGroupId) return;
    if (isPlaying) {
      controls.pause.mutate({ groupId: activeGroupId });
    } else {
      controls.play.mutate({ groupId: activeGroupId });
    }
  };

  const handleNext = () => {
    if (activeGroupId) controls.next.mutate({ groupId: activeGroupId });
  };

  const handlePrev = () => {
    if (activeGroupId) controls.previous.mutate({ groupId: activeGroupId });
  };

  const handleVolume = (value: number) => {
    if (activeGroupId) controls.setGroupVolume.mutate({ groupId: activeGroupId, volume: value });
  };

  const handleMuteToggle = () => {
    if (activeGroupId) controls.setGroupMute.mutate({ groupId: activeGroupId, muted: !isMuted });
  };

  const marqueeText = hasTrack ? `${trackName}  ·  ${artistName}` : '';

  // ── Compact mode (default — matches SpotifyWidget compact) ────────────────
  if (!expanded) {
    return (
      <div
        className="relative flex flex-col h-full overflow-hidden cursor-pointer"
        onClick={() => setExpanded(true)}
      >
        {/* Ambient background from album art */}
        {imageUrl ? (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center blur-3xl scale-[2] opacity-50"
              style={{ backgroundImage: `url(${imageUrl})` }}
            />
            <div className="absolute inset-0 bg-black/40" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-900/80 to-zinc-950/95" />
        )}

        {/* Centered album art with play/pause overlay */}
        <div className="relative z-10 flex-1 flex items-center justify-center min-h-0 pt-4 px-5 pb-2">
          {hasTrack && imageUrl ? (
            <div className="relative h-full aspect-square">
              <img
                src={imageUrl}
                alt={albumName}
                className="h-full w-full rounded-lg shadow-2xl object-cover"
              />
              <button
                className={`absolute bottom-1.5 right-1.5 h-9 w-9 rounded-full flex items-center justify-center shadow-lg transition-colors disabled:opacity-30 ${accent.btnBg}/90 ${accent.btnHover} ${accent.btnText}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handlePlayPause();
                }}
                disabled={controlsLoading}
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
            <SonosArtworkFrame state="idle" className="h-20 w-20 max-h-full max-w-full" />
          )}
        </div>

        {/* Track info — scrolling marquee when playing, static when paused */}
        {hasTrack ? (
          <div className="relative z-10 shrink-0 px-2 pb-1.5">
            <MarqueeText
              key={marqueeText}
              text={marqueeText}
              isPlaying={isPlaying}
              className="text-[11px] text-white/80 font-medium"
            />
          </div>
        ) : (
          <div className="relative z-10 shrink-0 px-2 pb-1.5 text-center">
            <span className="text-[11px] text-white/30">Tap to open player</span>
          </div>
        )}

        {isBuffering && (
          <div
            className={`absolute top-0 left-0 right-0 z-20 flex items-center justify-center ${accent.btnBg}/15 px-2 py-0.5`}
          >
            <span className={`text-[9px] ${accent.dim} flex items-center gap-1`}>
              <Loader2 className="h-2.5 w-2.5 animate-spin" /> Buffering…
            </span>
          </div>
        )}
      </div>
    );
  }

  // ── Expanded mode (matches SpotifyWidget expanded) ────────────────────────
  return (
    <>
      <div className="relative flex flex-col h-full overflow-hidden">
        {/* Ambient background from album art */}
        {imageUrl ? (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center blur-3xl scale-[2] opacity-50"
              style={{ backgroundImage: `url(${imageUrl})` }}
            />
            <div className="absolute inset-0 bg-black/40" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-900/90 to-zinc-950/95" />
        )}

        <div className="relative z-10 flex flex-col h-full">
          {/* Top bar: fullscreen + collapse */}
          <div className="flex justify-between px-2 pt-1">
            <button
              className="h-8 w-8 flex items-center justify-center text-white/40 hover:text-white/70"
              onClick={() => setFullscreen(true)}
              title="Open fullscreen controller"
            >
              <Expand className="h-3.5 w-3.5" />
            </button>
            <button
              className="h-8 w-8 flex items-center justify-center text-white/40 hover:text-white/70"
              onClick={() => {
                setExpanded(false);
                setShowVolume(false);
                setShowGrouping(false);
              }}
              title="Collapse player"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          {/* Album art (centered, takes available space) */}
          <div className="flex-1 flex items-center justify-center px-6 pt-4 pb-2 min-h-0">
            {hasTrack && imageUrl ? (
              <img
                src={imageUrl}
                alt={albumName}
                className="max-h-full max-w-full aspect-square rounded-lg shadow-2xl object-cover"
              />
            ) : (
              <SonosArtworkFrame state="idle" className="h-24 w-24 max-h-full max-w-full" />
            )}
          </div>

          {/* Bottom controls */}
          <div className="shrink-0 px-4 pb-3 space-y-2">
            {/* Track info */}
            {hasTrack ? (
              <div className="text-center">
                <div className="text-sm font-semibold text-white truncate">{trackName}</div>
                <div className="text-xs text-white/50 truncate">{artistName}</div>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-sm text-white/30">Nothing playing</div>
              </div>
            )}

            {/* Progress bar (expanded) */}
            {hasTrack && (
              <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={`h-full rounded-full ${accent.dot} transition-[width] duration-1000 ease-linear`}
                  style={{ width: `${(progress * 100).toFixed(1)}%` }}
                />
              </div>
            )}

            {/* Transport controls */}
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 min-w-[2.75rem] min-h-[2.75rem] text-white/50 hover:text-white hover:bg-white/10"
                onClick={() => setShowVolume(!showVolume)}
              >
                <Volume2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 min-w-[2.75rem] min-h-[2.75rem] text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30"
                onClick={handlePrev}
                disabled={!hasTrack}
              >
                <SkipBack className="h-4 w-4" />
              </Button>
              <button
                className={`h-11 w-11 rounded-full ${accent.btnBg} ${accent.btnHover} ${accent.btnText} flex items-center justify-center shadow-lg transition-colors disabled:opacity-30`}
                onClick={handlePlayPause}
                disabled={controlsLoading}
              >
                {controlsLoading ? (
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
                className="h-8 w-8 min-w-[2.75rem] min-h-[2.75rem] text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30"
                onClick={handleNext}
                disabled={!hasTrack}
              >
                <SkipForward className="h-4 w-4" />
              </Button>
              {config.showGrouping !== false && activeGroup && (
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 min-w-[2.75rem] min-h-[2.75rem] hover:bg-white/10 ${showGrouping ? accent.text : 'text-white/50 hover:text-white'}`}
                  onClick={() => setShowGrouping(!showGrouping)}
                  title="Room grouping"
                >
                  <Users className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Volume (toggleable) */}
            {showVolume && (
              <div className="px-1">
                <div className="flex items-center gap-1.5">
                  <button onClick={handleMuteToggle} className="shrink-0">
                    {isMuted ? (
                      <VolumeX className={`h-3 w-3 ${accent.dim}`} />
                    ) : (
                      <Volume2 className={`h-3 w-3 ${accent.dim}`} />
                    )}
                  </button>
                  <Slider
                    min={0}
                    max={100}
                    value={[vol]}
                    onValueChange={([v = 0]) => handleVolume(v)}
                    trackSize="xs"
                    thumbSize="xs"
                    accentColor={accent.range}
                    className="flex-1"
                  />
                  <span className="text-[10px] text-white/40 w-7 text-right tabular-nums">
                    {vol}%
                  </span>
                </div>
              </div>
            )}

            {/* Room grouping panel */}
            {showGrouping && activeGroup && (
              <GroupingPanel
                accent={accent}
                group={activeGroup}
                allPlayers={players}
                allGroups={groups}
                onDone={() => {
                  setShowGrouping(false);
                  void qc.invalidateQueries({ queryKey: sonosKeys.groups(householdId ?? '') });
                }}
              />
            )}

            {/* Room / service row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] text-white/40 min-w-0">
                {activeGroup && (
                  <span className={`h-1.5 w-1.5 rounded-full ${accent.dot} shrink-0`} />
                )}
                <span className="truncate">{activeGroup?.name ?? 'No room'}</span>
                {serviceName && (
                  <span
                    className={`${accent.text} text-[9px] font-medium opacity-70 ml-1 px-1.5 py-0.5 rounded-full ${accent.bg}`}
                  >
                    {accountLabel ?? accent.label}
                  </span>
                )}
              </div>
              <RoomPicker
                accent={accent}
                groups={groups}
                activeGroupId={activeGroupId}
                onSelect={setSelectedGroup}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen controller — portalled to body */}
      {fullscreen &&
        householdId &&
        createPortal(
          <FullScreenSonos
            householdId={householdId}
            initialGroupId={activeGroupId ?? undefined}
            onClose={() => setFullscreen(false)}
          />,
          document.body,
        )}
    </>
  );
}

// ─── Room Picker ────────────────────────────────────────────────────────────

function RoomPicker({
  accent,
  groups,
  activeGroupId,
  onSelect,
}: {
  accent: ServiceAccent;
  groups: SonosGroup[];
  activeGroupId: string | null;
  onSelect: (groupId: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        className={`flex items-center gap-1 text-[10px] ${accent.dim} hover:${accent.text} transition-colors min-h-[44px] min-w-[44px] justify-center`}
        onClick={() => setOpen(!open)}
        title="Switch room"
      >
        <Speaker className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div className="absolute bottom-full right-0 mb-1 w-52 rounded-md bg-zinc-800/95 border border-white/10 shadow-lg py-1 z-10">
          <div className="px-3 py-1.5 border-b border-white/10">
            <span className="text-[10px] font-medium text-white/60 uppercase tracking-wider">
              Sonos Rooms ({groups.length})
            </span>
          </div>
          {groups.map((g) => (
            <button
              key={g.id}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 transition-colors flex items-center gap-2 ${
                g.id === activeGroupId ? accent.text : 'text-white/80'
              }`}
              onClick={() => {
                onSelect(g.id);
                setOpen(false);
              }}
            >
              <Speaker className="h-3 w-3 shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="truncate block">{g.name}</span>
                <span className="text-[9px] text-white/40">
                  {g.playerIds.length} speaker{g.playerIds.length !== 1 ? 's' : ''}
                  {g.playbackState === 'PLAYBACK_STATE_PLAYING' && ' · ▶'}
                  {g.playbackState === 'PLAYBACK_STATE_PAUSED' && ' · ⏸'}
                </span>
              </div>
              {g.id === activeGroupId && (
                <span className={`text-[9px] ${accent.text} shrink-0`}>●</span>
              )}
            </button>
          ))}
          {groups.length === 0 && (
            <div className="px-3 py-2 text-xs text-white/40">No rooms found</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Room Grouping Panel ────────────────────────────────────────────────────

function GroupingPanel({
  accent,
  group,
  allPlayers,
  allGroups: _allGroups,
  onDone,
}: {
  accent: ServiceAccent;
  group: SonosGroup;
  allPlayers: SonosPlayer[];
  allGroups: SonosGroup[];
  onDone: () => void;
}) {
  const modify = useSonosModifyGroup();

  const groupPlayerIds = new Set(group.playerIds);
  const inGroup = allPlayers.filter((p) => groupPlayerIds.has(p.id));
  const available = allPlayers.filter((p) => !groupPlayerIds.has(p.id));

  const addPlayer = (playerId: string) => {
    modify.mutate({
      groupId: group.id,
      playerIdsToAdd: [playerId],
    });
  };

  const removePlayer = (playerId: string) => {
    if (group.playerIds.length <= 1) return;
    modify.mutate({
      groupId: group.id,
      playerIdsToRemove: [playerId],
    });
  };

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-xs space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-white/60 font-medium">Group: {group.name}</span>
        <button onClick={onDone} className={`text-[10px] ${accent.text} hover:opacity-80`}>
          Done
        </button>
      </div>

      {/* Current group members */}
      <div className="space-y-1">
        <span className="text-[10px] text-white/40 uppercase tracking-wider">In group</span>
        {inGroup.map((p) => (
          <div key={p.id} className="flex items-center justify-between py-0.5">
            <div className="flex items-center gap-1.5">
              <Speaker className={`h-3 w-3 ${accent.dim}`} />
              <span className="text-white/80">{p.name}</span>
              {p.id === group.coordinatorId && (
                <span className={`text-[8px] ${accent.dim} ${accent.btnBg}/10 px-1 rounded`}>
                  coordinator
                </span>
              )}
            </div>
            {p.id !== group.coordinatorId && (
              <button
                onClick={() => removePlayer(p.id)}
                disabled={modify.isPending}
                className="p-0.5 text-white/30 hover:text-red-400 transition-colors"
                title="Remove from group"
              >
                <Minus className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Available speakers */}
      {available.length > 0 && (
        <div className="space-y-1 pt-1 border-t border-white/5">
          <span className="text-[10px] text-white/40 uppercase tracking-wider">Available</span>
          {available.map((p) => (
            <div key={p.id} className="flex items-center justify-between py-0.5">
              <div className="flex items-center gap-1.5">
                <Speaker className="h-3 w-3 text-white/30" />
                <span className="text-white/50">{p.name}</span>
              </div>
              <button
                onClick={() => addPlayer(p.id)}
                disabled={modify.isPending}
                className="p-0.5 text-white/30 hover:text-green-400 transition-colors"
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
          <Loader2 className="h-3 w-3 animate-spin" />
          Updating group…
        </div>
      )}
    </div>
  );
}
