/** @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScreensaverOverlay } from '../ScreensaverOverlay.js';

const sonosMocks = vi.hoisted(() => ({
  groups: [] as Array<{
    id: string;
    name: string;
    coordinatorId: string;
    playbackState: string;
    playerIds: string[];
  }>,
  playbackState: 'PLAYBACK_STATE_PLAYING',
  playbackGroupIds: [] as Array<string | undefined>,
  metadataGroupIds: [] as Array<string | undefined>,
}));

vi.mock('../../hooks/usePhotoFrame.js', () => ({
  usePhotoRotation: () => ({ currentUrl: null, nextUrl: null }),
}));

vi.mock('../../hooks/useWeather.js', () => ({
  useWeather: () => ({ data: undefined }),
}));

vi.mock('../../hooks/useSpotify.js', () => ({
  useSpotifyStatus: () => ({ data: { connected: false } }),
  useNowPlaying: () => ({ data: undefined }),
}));

vi.mock('../../hooks/useSonos.js', () => ({
  useSonosStatus: () => ({ data: { connected: true } }),
  useSonosHouseholds: () => ({ data: { households: [{ id: 'household-1' }] } }),
  useSonosGroups: () => ({ data: { groups: sonosMocks.groups, players: [] } }),
  useSonosPlaybackState: (groupId: string | undefined) => {
    sonosMocks.playbackGroupIds.push(groupId);
    return { data: { playbackState: sonosMocks.playbackState } };
  },
  useSonosMetadata: (groupId: string | undefined) => {
    sonosMocks.metadataGroupIds.push(groupId);
    return {
      data: {
        currentItem: {
          track: {
            name: 'Selected track',
            artist: { name: 'Artist' },
            album: { name: 'Album' },
          },
        },
      },
    };
  },
}));

vi.mock('../../state/calendarHooks.js', () => ({
  useCalendarSources: () => ({ data: [] }),
  useCalendarEvents: () => ({ data: [] }),
}));

const group = (id: string, playbackState: string) => ({
  id,
  name: id,
  coordinatorId: id,
  playbackState,
  playerIds: [id],
});

describe('ScreensaverOverlay Sonos selection', () => {
  beforeEach(() => {
    sonosMocks.groups = [];
    sonosMocks.playbackState = 'PLAYBACK_STATE_PLAYING';
    sonosMocks.playbackGroupIds.length = 0;
    sonosMocks.metadataGroupIds.length = 0;
  });

  afterEach(cleanup);

  it('requests now-playing data from the actively playing group', () => {
    sonosMocks.groups = [
      group('unavailable', 'PLAYBACK_STATE_UNAVAILABLE'),
      group('paused', 'PLAYBACK_STATE_PAUSED'),
      group('playing', 'PLAYBACK_STATE_PLAYING'),
    ];

    render(<ScreensaverOverlay sourceId={null} onDismiss={vi.fn()} />);

    expect(sonosMocks.playbackGroupIds.at(-1)).toBe('playing');
    expect(sonosMocks.metadataGroupIds.at(-1)).toBe('playing');
  });

  it('shows paused metadata when no group is actively playing', () => {
    sonosMocks.groups = [
      group('unavailable', 'PLAYBACK_STATE_UNAVAILABLE'),
      group('paused', 'PLAYBACK_STATE_PAUSED'),
      group('stopped', 'PLAYBACK_STATE_IDLE'),
    ];
    sonosMocks.playbackState = 'PLAYBACK_STATE_PAUSED';

    render(<ScreensaverOverlay sourceId={null} onDismiss={vi.fn()} />);

    expect(sonosMocks.playbackGroupIds.at(-1)).toBe('paused');
    expect(screen.getByText('Selected track')).not.toBeNull();
    expect(screen.getByText('Paused')).not.toBeNull();
  });
});
