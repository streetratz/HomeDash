import { describe, expect, it } from 'vitest';
import type { SonosGroup } from '../../../hooks/useSonos.js';
import { selectPreferredSonosGroup } from '../selectPreferredSonosGroup.js';

function group(
  id: string,
  name: string,
  playbackState: string,
  playerIds: string[] = [id],
): SonosGroup {
  return {
    id,
    name,
    coordinatorId: id,
    playbackState,
    playerIds,
  };
}

describe('selectPreferredSonosGroup', () => {
  it('preserves an explicit selection while the group still exists', () => {
    const groups = [
      group('playing', 'Kitchen', 'PLAYBACK_STATE_PLAYING'),
      group('selected', 'Office', 'PLAYBACK_STATE_STOPPED'),
    ];

    expect(selectPreferredSonosGroup(groups, 'selected')?.id).toBe('selected');
  });

  it('prefers a playing group over paused and stopped groups', () => {
    const groups = [
      group('stopped', 'Office', 'PLAYBACK_STATE_STOPPED'),
      group('paused', 'Bedroom', 'PLAYBACK_STATE_PAUSED'),
      group('playing', 'Kitchen', 'PLAYBACK_STATE_PLAYING'),
    ];

    expect(selectPreferredSonosGroup(groups)?.id).toBe('playing');
  });

  it('prefers a paused group when nothing is playing', () => {
    const groups = [
      group('stopped', 'Office', 'PLAYBACK_STATE_STOPPED'),
      group('paused', 'Bedroom', 'PLAYBACK_STATE_PAUSED'),
    ];

    expect(selectPreferredSonosGroup(groups)?.id).toBe('paused');
  });

  it('uses a stable available fallback and ignores unavailable groups', () => {
    const groups = [
      group('unavailable', 'Attic', 'PLAYBACK_STATE_UNAVAILABLE'),
      group('empty', 'Basement', 'PLAYBACK_STATE_IDLE', []),
      group('z-room', 'Z Room', 'PLAYBACK_STATE_STOPPED'),
      group('a-room', 'A Room', 'PLAYBACK_STATE_IDLE'),
    ];

    expect(selectPreferredSonosGroup(groups)?.id).toBe('a-room');
    expect(selectPreferredSonosGroup([...groups].reverse())?.id).toBe('a-room');
  });

  it('returns no group when every discovered group is unavailable', () => {
    const groups = [
      group('unavailable', 'Attic', 'PLAYBACK_STATE_UNAVAILABLE'),
      group('empty', 'Basement', 'PLAYBACK_STATE_IDLE', []),
    ];

    expect(selectPreferredSonosGroup(groups)).toBeUndefined();
  });
});
