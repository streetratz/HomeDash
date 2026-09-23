import { describe, expect, it } from 'vitest';
import { selectPreferredSonosGroup } from '../sonosGroupSelection.js';

const group = (id: string, playbackState: string) => ({ id, playbackState });

describe('selectPreferredSonosGroup', () => {
  it('prefers playing and buffering groups over paused and idle groups', () => {
    expect(
      selectPreferredSonosGroup([
        group('idle', 'PLAYBACK_STATE_IDLE'),
        group('paused', 'PLAYBACK_STATE_PAUSED'),
        group('playing', 'PLAYBACK_STATE_PLAYING'),
      ])?.id,
    ).toBe('playing');

    expect(
      selectPreferredSonosGroup([
        group('paused', 'PLAYBACK_STATE_PAUSED'),
        group('buffering', 'PLAYBACK_STATE_BUFFERING'),
      ])?.id,
    ).toBe('buffering');
  });

  it('prefers a paused group when no group is actively playing', () => {
    expect(
      selectPreferredSonosGroup([
        group('stopped', 'PLAYBACK_STATE_IDLE'),
        group('paused', 'PLAYBACK_STATE_PAUSED'),
      ])?.id,
    ).toBe('paused');
  });

  it('prefers a stable stopped group over an unavailable group', () => {
    expect(
      selectPreferredSonosGroup([
        group('unavailable', 'PLAYBACK_STATE_UNAVAILABLE'),
        group('stopped', 'PLAYBACK_STATE_IDLE'),
      ])?.id,
    ).toBe('stopped');
  });

  it('preserves source order and uses the configured room only as a same-state tie-breaker', () => {
    const groups = [
      group('kitchen', 'PLAYBACK_STATE_IDLE'),
      group('office', 'PLAYBACK_STATE_IDLE'),
    ];

    expect(selectPreferredSonosGroup(groups)?.id).toBe('kitchen');
    expect(selectPreferredSonosGroup(groups, 'office')?.id).toBe('office');
    expect(
      selectPreferredSonosGroup(
        [group('office', 'PLAYBACK_STATE_PAUSED'), group('kitchen', 'PLAYBACK_STATE_PLAYING')],
        'office',
      )?.id,
    ).toBe('kitchen');
  });
});
