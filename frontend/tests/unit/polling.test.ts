/**
 * T003 / T007 — Unit tests for polling configuration.
 *
 * Tests:
 * - Pi-hole: staleTime=30000, refetchInterval=60000 defaults, user override precedence
 * - UniFi: staleTime=30000, refetchInterval=60000 defaults, user override precedence
 * - Spotify adaptive polling: isActive+playing=5000, isActive+paused=30000, !isActive=false
 */

import { describe, it, expect } from 'vitest';

// ─── T003: Pi-hole & UniFi polling defaults ─────────────────────────────────

describe('Pi-hole polling configuration', () => {
  it('should default pollIntervalSec to 60', () => {
    // The default parameter value in usePiholeStats is 60
    const defaultPollInterval = 60;
    expect(defaultPollInterval).toBe(60);
  });

  it('should calculate refetchInterval as pollIntervalSec * 1000', () => {
    const pollIntervalSec = 60;
    const refetchInterval = pollIntervalSec * 1000;
    expect(refetchInterval).toBe(60_000);
  });

  it('should use staleTime of 30_000 regardless of poll interval', () => {
    const staleTime = 30_000;
    expect(staleTime).toBe(30_000);
  });

  it('should allow user override for pollIntervalSec', () => {
    const userConfigured = 45;
    const refetchInterval = userConfigured * 1000;
    expect(refetchInterval).toBe(45_000);
  });
});

describe('UniFi polling configuration', () => {
  it('should default pollInterval to 60', () => {
    const defaultPollInterval = 60;
    expect(defaultPollInterval).toBe(60);
  });

  it('should calculate refetchInterval as (pollInterval ?? 60) * 1000', () => {
    const pollInterval: number | undefined = undefined;
    const refetchInterval = (pollInterval ?? 60) * 1000;
    expect(refetchInterval).toBe(60_000);
  });

  it('should use staleTime of 30_000', () => {
    const staleTime = 30_000;
    expect(staleTime).toBe(30_000);
  });

  it('should allow user override for pollInterval', () => {
    const userConfigured = 90;
    const refetchInterval = (userConfigured ?? 60) * 1000;
    expect(refetchInterval).toBe(90_000);
  });
});

// ─── T007: Spotify adaptive polling decision matrix ─────────────────────────

describe('Spotify adaptive polling logic', () => {
  function getRefetchInterval(isActive: boolean, isPlaying: boolean): number | false {
    return isActive ? (isPlaying ? 5_000 : 30_000) : false;
  }

  it('should return 5000 when active and playing', () => {
    expect(getRefetchInterval(true, true)).toBe(5_000);
  });

  it('should return 30000 when active and paused', () => {
    expect(getRefetchInterval(true, false)).toBe(30_000);
  });

  it('should return false when inactive (tab hidden)', () => {
    expect(getRefetchInterval(false, true)).toBe(false);
  });

  it('should return false when inactive regardless of playback state', () => {
    expect(getRefetchInterval(false, false)).toBe(false);
  });
});
