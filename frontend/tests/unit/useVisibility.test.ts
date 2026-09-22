/**
 * T006 — Unit tests for useWidgetVisibility hook.
 *
 * Tests:
 * - Returns false when tab is hidden
 * - Returns true when tab is visible AND element is in viewport
 * - Returns false when tab is visible but element is out of viewport
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWidgetVisibility } from '../../src/hooks/useWidgetVisibility.js';

// ─── Mock IntersectionObserver ──────────────────────────────────────────────

let intersectionCallback: IntersectionObserverCallback;
const mockObserve = vi.fn();
const mockDisconnect = vi.fn();

class MockIntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
    intersectionCallback = callback;
  }
  observe = mockObserve;
  disconnect = mockDisconnect;
  unobserve = vi.fn();
  root = null;
  rootMargin = '';
  thresholds = [0];
  takeRecords = () => [] as IntersectionObserverEntry[];
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('useWidgetVisibility', () => {
  let originalVisibilityState: PropertyDescriptor | undefined;

  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
    originalVisibilityState = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    mockObserve.mockClear();
    mockDisconnect.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalVisibilityState) {
      Object.defineProperty(document, 'visibilityState', originalVisibilityState);
    } else {
      // Reset to default
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      });
    }
  });

  function setVisibilityState(state: 'visible' | 'hidden') {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => state,
    });
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => state === 'hidden',
    });
  }

  function triggerVisibilityChange() {
    document.dispatchEvent(new Event('visibilitychange'));
  }

  function triggerIntersection(isIntersecting: boolean) {
    act(() => {
      intersectionCallback(
        [{ isIntersecting } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });
  }

  it('should return true when tab visible and element in viewport', () => {
    setVisibilityState('visible');
    const ref = { current: document.createElement('div') };

    const { result } = renderHook(() => useWidgetVisibility(ref));

    // Default intersection state is true (assume in viewport until observer fires)
    expect(result.current).toBe(true);
  });

  it('should return false when tab is hidden', () => {
    setVisibilityState('hidden');
    const ref = { current: document.createElement('div') };

    const { result } = renderHook(() => useWidgetVisibility(ref));

    expect(result.current).toBe(false);
  });

  it('should return false when tab becomes hidden', () => {
    setVisibilityState('visible');
    const ref = { current: document.createElement('div') };

    const { result } = renderHook(() => useWidgetVisibility(ref));
    expect(result.current).toBe(true);

    // Tab goes hidden
    act(() => {
      setVisibilityState('hidden');
      triggerVisibilityChange();
    });

    expect(result.current).toBe(false);
  });

  it('should return false when element is out of viewport', () => {
    setVisibilityState('visible');
    const ref = { current: document.createElement('div') };

    const { result } = renderHook(() => useWidgetVisibility(ref));

    // Simulate element scrolled out of viewport
    triggerIntersection(false);

    expect(result.current).toBe(false);
  });

  it('should return true when tab visible AND element re-enters viewport', () => {
    setVisibilityState('visible');
    const ref = { current: document.createElement('div') };

    const { result } = renderHook(() => useWidgetVisibility(ref));

    // Out of viewport
    triggerIntersection(false);
    expect(result.current).toBe(false);

    // Back in viewport
    triggerIntersection(true);
    expect(result.current).toBe(true);
  });
});
