/**
 * Unit tests for useIdleDetection — timer cleanup and state transitions.
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIdleDetection } from '../useIdleDetection.js';

describe('useIdleDetection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sets isIdle to true after timeout', () => {
    const { result } = renderHook(() => useIdleDetection(1));

    expect(result.current.isIdle).toBe(false);

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(result.current.isIdle).toBe(true);
  });

  it('resets idle state when enabled flips to false', () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => useIdleDetection(1, undefined, enabled),
      { initialProps: { enabled: true } },
    );

    // Become idle
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.isIdle).toBe(true);

    // Disable — should reset
    rerender({ enabled: false });
    expect(result.current.isIdle).toBe(false);
  });

  it('does not restore stale idle state when re-enabled', () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => useIdleDetection(1, undefined, enabled),
      { initialProps: { enabled: true } },
    );

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.isIdle).toBe(true);

    rerender({ enabled: false });
    rerender({ enabled: true });
    expect(result.current.isIdle).toBe(false);

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.isIdle).toBe(true);
  });

  it('clears timer on unmount (no state update after unmount)', () => {
    const onIdle = vi.fn();
    const { unmount } = renderHook(() => useIdleDetection(1, onIdle));

    unmount();

    act(() => {
      vi.advanceTimersByTime(120_000);
    });

    expect(onIdle).not.toHaveBeenCalled();
  });

  it('calls onIdle callback when idle fires', () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleDetection(1, onIdle));

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(onIdle).toHaveBeenCalledOnce();
  });

  it('does not fire timer when disabled', () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleDetection(1, onIdle, false));

    act(() => {
      vi.advanceTimersByTime(120_000);
    });

    expect(onIdle).not.toHaveBeenCalled();
  });
});
