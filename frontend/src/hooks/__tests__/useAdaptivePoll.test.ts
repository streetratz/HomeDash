/**
 * T017: Unit tests for useAdaptivePoll — state-to-interval mapping + view modes.
 */

import { describe, it, expect } from 'vitest';
import { useAdaptivePoll } from '../useAdaptivePoll.js';

describe('useAdaptivePoll', () => {
  // ── Default (expanded) mode ──────────────────────────────────────────────
  it('returns Tier 1 fast + Tier 2 slow for PLAYING in expanded mode', () => {
    const r = useAdaptivePoll('PLAYBACK_STATE_PLAYING', true, 'expanded');
    expect(r.metadataInterval).toBe(5_000);
    expect(r.playbackInterval).toBe(5_000);
    expect(r.groupsInterval).toBe(60_000);
    expect(r.volumeInterval).toBe(30_000);
    expect(r.playModeInterval).toBe(30_000);
    expect(r.queueInterval).toBe(30_000);
  });

  it('returns aggressive intervals for BUFFERING state', () => {
    const r = useAdaptivePoll('PLAYBACK_STATE_BUFFERING', true);
    expect(r.metadataInterval).toBe(5_000);
  });

  it('returns moderate Tier 1 for PAUSED state', () => {
    const r = useAdaptivePoll('PLAYBACK_STATE_PAUSED', true);
    expect(r.metadataInterval).toBe(15_000);
    expect(r.playbackInterval).toBe(15_000);
    expect(r.volumeInterval).toBe(30_000);
  });

  it('returns lazy intervals for IDLE state', () => {
    const r = useAdaptivePoll('PLAYBACK_STATE_IDLE', true);
    expect(r.metadataInterval).toBe(30_000);
    expect(r.groupsInterval).toBe(120_000);
    expect(r.volumeInterval).toBe(60_000);
  });

  it('returns IDLE intervals for undefined playback state', () => {
    const r = useAdaptivePoll(undefined, true);
    expect(r.metadataInterval).toBe(30_000);
  });

  // ── Compact mode ─────────────────────────────────────────────────────────
  it('compact mode disables volume, playMode, and queue', () => {
    const r = useAdaptivePoll('PLAYBACK_STATE_PLAYING', true, 'compact');
    expect(r.metadataInterval).toBe(5_000);
    expect(r.playbackInterval).toBe(5_000);
    expect(r.volumeInterval).toBe(false);
    expect(r.playModeInterval).toBe(false);
    expect(r.queueInterval).toBe(false);
    expect(r.groupsInterval).toBe(60_000);
  });

  // ── Fullscreen mode ──────────────────────────────────────────────────────
  it('fullscreen gets same intervals as expanded', () => {
    const r = useAdaptivePoll('PLAYBACK_STATE_PLAYING', true, 'fullscreen');
    expect(r.metadataInterval).toBe(5_000);
    expect(r.volumeInterval).toBe(30_000);
    expect(r.groupsInterval).toBe(60_000);
  });

  // ── Visibility ───────────────────────────────────────────────────────────
  it('returns false for all intervals when not visible', () => {
    const r = useAdaptivePoll('PLAYBACK_STATE_PLAYING', false);
    expect(r.metadataInterval).toBe(false);
    expect(r.playbackInterval).toBe(false);
    expect(r.groupsInterval).toBe(false);
    expect(r.volumeInterval).toBe(false);
    expect(r.playModeInterval).toBe(false);
    expect(r.queueInterval).toBe(false);
  });

  it('returns false when hidden with undefined state', () => {
    const r = useAdaptivePoll(undefined, false);
    expect(r.metadataInterval).toBe(false);
    expect(r.playbackInterval).toBe(false);
  });
});
