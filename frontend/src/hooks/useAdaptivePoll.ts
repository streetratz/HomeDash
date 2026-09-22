/**
 * useAdaptivePoll — Returns polling intervals based on playback state and view mode.
 *
 * View modes:
 *   compact    — only metadata + playback (no volume/queue/playMode shown)
 *   expanded   — all endpoints, Tier 2 slowed to 30s fallback
 *   fullscreen — all endpoints, groups slowed to 60s
 *
 * Playback tiers:
 *   PLAYING  → aggressive metadata/playback (5s)
 *   PAUSED   → moderate   (15s)
 *   IDLE     → lazy       (30s)
 *
 * When `isVisible` is false all intervals return `false` (polling disabled).
 */

export type SonosViewMode = 'compact' | 'expanded' | 'fullscreen';

export interface AdaptiveIntervals {
  metadataInterval: number | false;
  playbackInterval: number | false;
  groupsInterval: number | false;
  volumeInterval: number | false;
  playModeInterval: number | false;
  queueInterval: number | false;
}

type PlaybackStateString = string | undefined;

const DISABLED: AdaptiveIntervals = {
  metadataInterval: false,
  playbackInterval: false,
  groupsInterval: false,
  volumeInterval: false,
  playModeInterval: false,
  queueInterval: false,
};

// Tier 1: metadata + playback — always fast, these change constantly
const TIER1 = {
  PLAYING: { metadata: 5_000, playback: 5_000 },
  PAUSED:  { metadata: 15_000, playback: 15_000 },
  IDLE:    { metadata: 30_000, playback: 30_000 },
} as const;

// Tier 2: volume, playMode, queue — only change on user action (30s fallback)
const TIER2 = {
  PLAYING: { volume: 30_000, playMode: 30_000, queue: 30_000 },
  PAUSED:  { volume: 30_000, playMode: 30_000, queue: 30_000 },
  IDLE:    { volume: 60_000, playMode: 60_000, queue: 60_000 },
} as const;

// Tier 3: groups/rooms — rarely changes (60s fallback + manual refresh)
const TIER3 = {
  PLAYING: { groups: 60_000 },
  PAUSED:  { groups: 60_000 },
  IDLE:    { groups: 120_000 },
} as const;

function resolveState(playbackState: PlaybackStateString): 'PLAYING' | 'PAUSED' | 'IDLE' {
  if (!playbackState) return 'IDLE';
  if (playbackState.includes('PLAYING') || playbackState.includes('BUFFERING')) return 'PLAYING';
  if (playbackState.includes('PAUSED')) return 'PAUSED';
  return 'IDLE';
}

export function useAdaptivePoll(
  playbackState: PlaybackStateString,
  isVisible: boolean,
  mode: SonosViewMode = 'expanded',
): AdaptiveIntervals {
  if (!isVisible) return DISABLED;

  const state = resolveState(playbackState);
  const t1 = TIER1[state];
  const t2 = TIER2[state];
  const t3 = TIER3[state];

  if (mode === 'compact') {
    // Compact: only metadata + playback (no volume/queue/playMode shown)
    return {
      metadataInterval: t1.metadata,
      playbackInterval: t1.playback,
      groupsInterval: t3.groups,
      volumeInterval: false,
      playModeInterval: false,
      queueInterval: false,
    };
  }

  // Expanded and fullscreen get all tiers
  return {
    metadataInterval: t1.metadata,
    playbackInterval: t1.playback,
    groupsInterval: t3.groups,
    volumeInterval: t2.volume,
    playModeInterval: t2.playMode,
    queueInterval: t2.queue,
  };
}
