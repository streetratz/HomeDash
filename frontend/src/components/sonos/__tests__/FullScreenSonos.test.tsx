/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { FullScreenSonos } from '../FullScreenSonos.js';

const mutate = vi.fn();

vi.mock('../../../state/bootstrap.js', () => ({
  useBootstrap: () => ({ user: { isAdmin: true } }),
}));

vi.mock('../../../hooks/useDocumentVisibility.js', () => ({
  useDocumentVisibility: () => ({ isVisible: true }),
}));

vi.mock('../../../hooks/useAdaptivePoll.js', () => ({
  useAdaptivePoll: () => ({
    groupsInterval: false,
    playbackInterval: false,
    metadataInterval: false,
    volumeInterval: false,
    playModeInterval: false,
  }),
}));

vi.mock('../../../hooks/usePositionTimer.js', () => ({
  usePositionTimer: () => ({ displayPosition: 30_000, progress: 0.25 }),
}));

vi.mock('../../../hooks/useSwipeGesture.js', () => ({
  useSwipeGesture: () => ({}),
}));

vi.mock('../../../hooks/useSonos.js', () => ({
  useSonosGroups: () => ({
    data: {
      groups: [
        {
          id: 'RINCON_LIVING:1',
          name: 'Living Room',
          coordinatorId: 'RINCON_LIVING',
          playerIds: ['RINCON_LIVING'],
        },
      ],
      players: [{ id: 'RINCON_LIVING', name: 'Living Room' }],
    },
    refetch: vi.fn(),
    isFetching: false,
  }),
  useSonosPlaybackState: () => ({
    data: { playbackState: 'PLAYBACK_STATE_PLAYING', positionMillis: 30_000 },
  }),
  useSonosMetadata: () => ({
    data: {
      currentItem: {
        track: {
          name: 'A Real Track Name',
          artist: { name: 'Artist' },
          album: { name: 'Album' },
          durationMillis: 120_000,
          service: { name: 'Spotify' },
        },
      },
    },
  }),
  useSonosGroupVolume: () => ({ data: { volume: 42, muted: false } }),
  useSonosPlayerVolume: () => ({ data: { volume: 42 } }),
  useSonosControls: () => ({
    play: { mutate },
    pause: { mutate },
    next: { mutate },
    previous: { mutate },
    setGroupVolume: { mutate },
    setGroupMute: { mutate },
    setPlayerVolume: { mutate },
  }),
  useSonosFavorites: () => ({
    data: [],
    isLoading: false,
    refetch: vi.fn(),
    isFetching: false,
  }),
  useLoadFavorite: () => ({ mutate, isPending: false }),
  useSonosModifyGroup: () => ({ mutate, isPending: false }),
  useResetSonosGroup: () => ({ mutate, isPending: false }),
  useSonosPlayMode: () => ({ data: { shuffle: false, repeat: false, repeatOne: false } }),
  useSetPlayMode: () => ({ mutate }),
  useServiceLabels: () => ({ data: { labels: {} } }),
}));

vi.mock('../BrowsePanel.js', () => ({
  BrowsePanel: () => <div>Browse content</div>,
}));

vi.mock('../QueuePanel.js', () => ({
  QueuePanel: () => <div>Queue content</div>,
}));

describe('FullScreenSonos mobile composition', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  afterEach(cleanup);

  it('keeps primary navigation on one four-column row', () => {
    render(<FullScreenSonos householdId="local" onClose={vi.fn()} />);

    const navigation = screen.getByRole('navigation', { name: 'Sonos sections' });
    expect(navigation.className).toContain('grid-cols-4');
    expect(navigation.className).not.toContain('flex-wrap');
    expect(screen.getAllByRole('button', { name: /Rooms|Queue|Browse|Favorites/ })).toHaveLength(4);
    expect(screen.getByRole('button', { name: /Rooms/ }).className).not.toContain('flex-col');
  });

  it('gives the mobile room list only the remaining tab height', () => {
    render(<FullScreenSonos householdId="local" onClose={vi.fn()} />);

    const tabContent = screen.getByTestId('sonos-tab-content');
    const roomList = screen.getByTestId('sonos-room-list');

    expect(tabContent.className).toContain('flex-col');
    expect(tabContent.className).toContain('min-h-0');
    expect(roomList.className).toContain('flex-1');
    expect(roomList.className).toContain('min-h-0');
    expect(roomList.className).not.toContain('h-full');
  });

  it('keeps secondary playback controls collapsed until requested', () => {
    render(<FullScreenSonos householdId="local" onClose={vi.fn()} />);

    const toggle = screen.getByRole('button', { name: 'Show playback controls' });
    expect(screen.getByTestId('sonos-mobile-now-playing').contains(toggle)).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByTestId('sonos-mobile-secondary-controls')).toBeNull();

    fireEvent.click(toggle);

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByTestId('sonos-mobile-secondary-controls')).not.toBeNull();
  });
});
