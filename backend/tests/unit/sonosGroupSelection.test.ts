import { describe, expect, it } from 'vitest';
import { selectPreferredSonosGroup } from '../../src/services/sonosGroupSelection.js';

const group = (id: string, playbackState: string) => ({ id, playbackState });

describe('selectPreferredSonosGroup', () => {
  it('ranks active, paused, stopped, and unavailable groups deterministically', () => {
    expect(
      selectPreferredSonosGroup([
        group('unavailable', 'PLAYBACK_STATE_UNAVAILABLE'),
        group('stopped', 'PLAYBACK_STATE_IDLE'),
        group('paused', 'PLAYBACK_STATE_PAUSED'),
        group('playing', 'PLAYBACK_STATE_PLAYING'),
      ])?.id,
    ).toBe('playing');

    expect(
      selectPreferredSonosGroup([
        group('unavailable', 'PLAYBACK_STATE_UNAVAILABLE'),
        group('stopped', 'PLAYBACK_STATE_IDLE'),
        group('paused', 'PLAYBACK_STATE_PAUSED'),
      ])?.id,
    ).toBe('paused');

    expect(
      selectPreferredSonosGroup([
        group('unavailable', 'PLAYBACK_STATE_UNAVAILABLE'),
        group('stopped', 'PLAYBACK_STATE_IDLE'),
      ])?.id,
    ).toBe('stopped');
  });

  it('uses the configured room only as a tie-breaker within the best playback state', () => {
    expect(
      selectPreferredSonosGroup(
        [group('configured', 'PLAYBACK_STATE_PAUSED'), group('playing', 'PLAYBACK_STATE_PLAYING')],
        'configured',
      )?.id,
    ).toBe('playing');

    expect(
      selectPreferredSonosGroup(
        [group('first', 'PLAYBACK_STATE_IDLE'), group('configured', 'PLAYBACK_STATE_IDLE')],
        'configured',
      )?.id,
    ).toBe('configured');
  });
});
