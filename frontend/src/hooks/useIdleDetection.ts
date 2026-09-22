/**
 * useIdleDetection — detects user inactivity across mouse, keyboard, touch,
 * and visibility events.
 *
 * Handles edge cases:
 * - Pauses timer when tab is hidden (visibilitychange)
 * - Resets on focus/blur events
 * - Works with iframe-heavy dashboards (listens on window level)
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
  'wheel',
] as const;

export function useIdleDetection(
  timeoutMinutes: number,
  onIdle?: () => void,
  enabled = true,
): { isIdle: boolean; resetIdle: () => void } {
  const [idleState, setIdleState] = useState({ enabled, isIdle: false });
  if (idleState.enabled !== enabled) {
    setIdleState({ enabled, isIdle: false });
  }
  const isIdle = idleState.enabled === enabled && idleState.isIdle;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onIdleRef = useRef(onIdle);
  useEffect(() => { onIdleRef.current = onIdle; });
  const timeoutMs = timeoutMinutes * 60 * 1000;

  const resetTimer = useCallback(() => {
    if (!enabled) return;
    setIdleState({ enabled, isIdle: false });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setIdleState({ enabled, isIdle: true });
      onIdleRef.current?.();
    }, timeoutMs);
  }, [enabled, timeoutMs]);

  const resetIdle = useCallback(() => {
    setIdleState({ enabled, isIdle: false });
    if (timerRef.current) clearTimeout(timerRef.current);
    if (enabled) {
      timerRef.current = setTimeout(() => {
        setIdleState({ enabled, isIdle: true });
        onIdleRef.current?.();
      }, timeoutMs);
    }
  }, [enabled, timeoutMs]);

  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    // Start initial timer
    timerRef.current = setTimeout(() => {
      setIdleState({ enabled, isIdle: true });
      onIdleRef.current?.();
    }, timeoutMs);

    // Activity listeners on window (catches iframe bubble-up)
    const handleActivity = () => resetTimer();
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, handleActivity, { passive: true });
    }

    // Visibility change: pause when hidden, reset when visible
    const handleVisibility = () => {
      if (document.hidden) {
        // Tab hidden — clear timer (don't trigger screensaver while away)
        if (timerRef.current) clearTimeout(timerRef.current);
      } else {
        // Tab visible again — restart timer
        resetTimer();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Focus/blur events
    const handleFocus = () => resetTimer();
    window.addEventListener('focus', handleFocus);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, handleActivity);
      }
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, [enabled, timeoutMs, resetTimer]);

  return { isIdle, resetIdle };
}
