/**
 * usePositionTimer — Client-side track position interpolation.
 *
 * While playing, increments the displayed position every second without
 * server calls. Syncs from the last known server position whenever
 * playback state or positionMillis changes.
 *
 * Uses useSyncExternalStore with a cached snapshot that is only mutated
 * inside subscriber callbacks, satisfying React's snapshot stability contract.
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

export interface UsePositionTimerOptions {
  /** Current position from the server (millis) */
  positionMillis: number | undefined;
  /** Total track duration (millis) — used to clamp */
  durationMillis: number | undefined;
  /** Whether playback is currently active */
  isPlaying: boolean;
}

/**
 * Creates a tiny external store whose snapshot is updated inside interval
 * callbacks (not during render), avoiding both the infinite-loop bug and
 * the "cannot read refs during render" lint violation.
 */
function createPositionStore() {
  const listeners = new Set<() => void>();
  let snapshot = 0;
  return {
    getSnapshot: () => snapshot,
    setSnapshot: (v: number) => {
      snapshot = v;
      listeners.forEach((fn) => fn());
    },
    /** Replace snapshot without notifying (used for resets before subscribe) */
    replaceSnapshot: (v: number) => {
      snapshot = v;
    },
    subscribe: (cb: () => void) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
  };
}

export function usePositionTimer({
  positionMillis,
  durationMillis,
  isPlaying,
}: UsePositionTimerOptions) {
  const anchorPos = positionMillis ?? 0;
  const [store] = useState(createPositionStore);

  // Sync snapshot when server position or play state changes
  useEffect(() => {
    store.replaceSnapshot(anchorPos);
  }, [anchorPos, store]);

  // Tick every second while playing
  useEffect(() => {
    store.replaceSnapshot(anchorPos);
    if (!isPlaying) return;
    const start = performance.now();
    const base = anchorPos;
    const dur = durationMillis;
    const id = setInterval(() => {
      const elapsed = performance.now() - start;
      const next = base + elapsed;
      store.setSnapshot(dur ? Math.min(next, dur) : next);
    }, 1_000);
    return () => clearInterval(id);
  }, [isPlaying, anchorPos, durationMillis, store]);

  const subscribe = useCallback(
    (cb: () => void) => store.subscribe(cb),
    [store],
  );
  const displayPosition = useSyncExternalStore(
    subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );

  const progress =
    durationMillis && durationMillis > 0
      ? Math.min(displayPosition / durationMillis, 1)
      : 0;

  return { displayPosition, progress };
}
