import type { SonosGroup } from '../../hooks/useSonos.js';

const PLAYING = 'PLAYBACK_STATE_PLAYING';
const PAUSED = 'PLAYBACK_STATE_PAUSED';
const UNAVAILABLE = 'PLAYBACK_STATE_UNAVAILABLE';

function compareGroups(left: SonosGroup, right: SonosGroup): number {
  const leftKey = `${left.name}\u0000${left.id}`;
  const rightKey = `${right.name}\u0000${right.id}`;
  return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
}

function isAvailable(group: SonosGroup): boolean {
  return group.playerIds.length > 0 && group.playbackState !== UNAVAILABLE;
}

export function selectPreferredSonosGroup(
  groups: readonly SonosGroup[],
  selectedGroupId?: string | null,
): SonosGroup | undefined {
  const explicitGroup = selectedGroupId
    ? groups.find((group) => group.id === selectedGroupId)
    : undefined;
  if (explicitGroup) return explicitGroup;

  const availableGroups = groups.filter(isAvailable).sort(compareGroups);
  return (
    availableGroups.find((group) => group.playbackState === PLAYING) ??
    availableGroups.find((group) => group.playbackState === PAUSED) ??
    availableGroups[0]
  );
}
