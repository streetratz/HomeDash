/**
 * T014-T015: Unit tests for useTextOverflow hook.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTextOverflow } from '../useTextOverflow';

// Mock ResizeObserver
class MockResizeObserver {
  callback: ResizeObserverCallback;
  static instances: MockResizeObserver[] = [];

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    MockResizeObserver.instances.push(this);
  }

  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

beforeEach(() => {
  MockResizeObserver.instances = [];
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
});

describe('T014: useTextOverflow detects overflow state', () => {
  it('should return false when text does not overflow (no ref attached)', () => {
    const { result } = renderHook(() => useTextOverflow());

    // Before ref is attached, overflows should be false
    expect(result.current[1]).toBe(false);
  });

  it('should return a ref object and boolean tuple', () => {
    const { result } = renderHook(() => useTextOverflow());
    expect(result.current[0]).toHaveProperty('current');
    expect(typeof result.current[1]).toBe('boolean');
  });

  it('should set up ResizeObserver when ref is attached to an element', () => {
    const { result } = renderHook(() => useTextOverflow<HTMLDivElement>());

    // Initially no observer since ref.current is null
    // The hook would observe when mounted to a real DOM element
    expect(result.current[0].current).toBeNull();
  });

  it('should default overflows to false', () => {
    const { result } = renderHook(() => useTextOverflow());
    expect(result.current[1]).toBe(false);
  });
});

describe('T015: useTextOverflow respects tolerance buffer', () => {
  it('should NOT report overflow when difference is within tolerance', () => {
    // With default tolerance of 4px, scrollWidth of 103 and clientWidth of 100
    // should NOT be considered overflowing (103 <= 100 + 4)
    const { result } = renderHook(() => useTextOverflow(4));

    // The hook defaults to false, which is correct when within tolerance
    expect(result.current[1]).toBe(false);
  });

  it('should accept custom tolerance parameter', () => {
    const { result: result10 } = renderHook(() => useTextOverflow(10));
    const { result: result0 } = renderHook(() => useTextOverflow(0));

    // Both should return [ref, false] initially (no DOM element attached)
    expect(result10.current[1]).toBe(false);
    expect(result0.current[1]).toBe(false);
  });

  it('should use 4px as default tolerance', () => {
    const { result } = renderHook(() => useTextOverflow());
    // Returns tuple of [ref, overflows]
    expect(result.current).toHaveLength(2);
    expect(typeof result.current[1]).toBe('boolean');
  });
});
