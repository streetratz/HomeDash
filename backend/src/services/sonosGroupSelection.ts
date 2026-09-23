export interface SonosGroupCandidate {
  id: string;
  playbackState?: string | null;
}

function playbackPriority(playbackState: string | null | undefined): number {
  switch (playbackState) {
    case 'PLAYBACK_STATE_PLAYING':
    case 'PLAYBACK_STATE_BUFFERING':
      return 0;
    case 'PLAYBACK_STATE_PAUSED':
      return 1;
    case 'PLAYBACK_STATE_IDLE':
    case 'PLAYBACK_STATE_STOPPED':
      return 2;
    default:
      return 3;
  }
}

export function selectPreferredSonosGroup<T extends SonosGroupCandidate>(
  groups: readonly T[],
  preferredGroupId?: string,
): T | undefined {
  let selected: T | undefined;
  let selectedPriority = Number.POSITIVE_INFINITY;

  for (const group of groups) {
    const priority = playbackPriority(group.playbackState);
    if (
      priority < selectedPriority ||
      (priority === selectedPriority &&
        group.id === preferredGroupId &&
        selected?.id !== preferredGroupId)
    ) {
      selected = group;
      selectedPriority = priority;
    }
  }

  return selected;
}
