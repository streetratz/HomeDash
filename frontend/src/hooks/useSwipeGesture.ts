/**
 * useSwipeGesture — Pointer-event-based horizontal swipe detection.
 *
 * Returns handlers to attach to a swipeable element. Fires onSwipeLeft /
 * onSwipeRight when the pointer travels beyond `threshold` px horizontally
 * with less vertical deviation (prevents conflict with scrolling).
 */

import { useCallback, useRef } from 'react';

export interface UseSwipeGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  /** Minimum horizontal distance in px (default 50) */
  threshold?: number;
}

export interface SwipeHandlers {
  onPointerDown: React.PointerEventHandler;
  onPointerMove: React.PointerEventHandler;
  onPointerUp: React.PointerEventHandler;
  onPointerCancel: React.PointerEventHandler;
}

export function useSwipeGesture({
  onSwipeLeft,
  onSwipeRight,
  threshold = 50,
}: UseSwipeGestureOptions): SwipeHandlers {
  const startX = useRef(0);
  const startY = useRef(0);
  const currentX = useRef(0);
  const tracking = useRef(false);

  const onPointerDown = useCallback<React.PointerEventHandler>((e) => {
    // Only track primary pointer (left button / single finger)
    if (e.button !== 0) return;
    startX.current = e.clientX;
    startY.current = e.clientY;
    currentX.current = 0;
    tracking.current = true;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, []);

  const onPointerMove = useCallback<React.PointerEventHandler>((e) => {
    if (!tracking.current) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    // If vertical movement exceeds horizontal, abort (user is scrolling)
    if (Math.abs(dy) > Math.abs(dx) + 10) {
      tracking.current = false;
      currentX.current = 0;
      return;
    }
    currentX.current = dx;
  }, []);

  const onPointerUp = useCallback<React.PointerEventHandler>(() => {
    if (!tracking.current) return;
    tracking.current = false;
    const dx = currentX.current;
    currentX.current = 0;
    if (dx < -threshold) onSwipeLeft?.();
    else if (dx > threshold) onSwipeRight?.();
  }, [onSwipeLeft, onSwipeRight, threshold]);

  const onPointerCancel = useCallback<React.PointerEventHandler>(() => {
    tracking.current = false;
    currentX.current = 0;
  }, []);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  };
}
