/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BrowsePanel,
  buildBrowseServices,
  sonosServiceNamesMatch,
  splitMobileBrowseServices,
} from '../BrowsePanel.js';

const loadFavorite = vi.fn();
const playUri = vi.fn();
const fetchNextPage = vi.fn();
const addContainerToQueue = vi.fn();
const replaceQueueAndPlay = vi.fn();
let spotifyConnected = false;
let spotifySearchError: unknown;
let musicLibraryData: unknown;
let musicLibraryError: unknown;
const refetchMusicLibrary = vi.fn();
const refetchSpotifySearch = vi.fn();

vi.mock('../../../hooks/useSonos.js', () => ({
  useSonosMode: () => ({ data: { mode: 'local' } }),
  useSonosServices: () => ({
    data: {
      completeness: 'observed',
      warnings: ['firmware_account_inventory_unavailable'],
      services: [
        {
          id: 'sid:284',
          name: 'YouTube Music',
          serviceId: 284,
          serviceType: 72711,
          sources: ['favorite'],
          accounts: [
            {
              serialNumber: 4,
              label: 'Family YouTube',
              sources: ['favorite'],
            },
          ],
        },
      ],
    },
  }),
  useSonosFavorites: () => ({
    data: [
      {
        id: 'yt-favorite',
        name: 'Family mix',
        imageUrl: '',
        service: { name: 'YouTube Music', id: 'youtube_music', sn: 4 },
      },
      {
        id: 'other-favorite',
        name: 'Other account mix',
        imageUrl: '',
        service: { name: 'YouTube Music', id: 'youtube_music', sn: 9 },
      },
    ],
    isLoading: false,
  }),
  useLoadFavorite: () => ({ mutate: loadFavorite, isPending: false }),
  useRadioStations: () => ({
    data: {
      items: [{ title: 'Local Radio', uri: 'x-rincon-mp3radio://station', imageUrl: '' }],
      total: 1,
    },
    isLoading: false,
  }),
  usePlayUri: () => ({ mutate: playUri }),
  useAddToQueue: () => ({ mutate: vi.fn() }),
  usePlayNext: () => ({ mutate: vi.fn() }),
  useMusicLibrary: () => ({
    data: musicLibraryData,
    isLoading: false,
    isError: musicLibraryError !== undefined,
    error: musicLibraryError,
    refetch: refetchMusicLibrary,
    isFetching: false,
  }),
  useBrowseContainer: () => ({ data: undefined, isLoading: false }),
  useSearchLibrary: () => ({ data: undefined, isLoading: false }),
  useAddContainerToQueue: () => ({ mutate: addContainerToQueue, isPending: false }),
  useReplaceQueueAndPlay: () => ({ mutate: replaceQueueAndPlay, isPending: false }),
}));

vi.mock('../../../hooks/useSpotify.js', () => ({
  useSpotifyStatus: () => ({ data: { connected: spotifyConnected } }),
  useSpotifySearch: () => ({
    data: undefined,
    isLoading: false,
    isError: spotifySearchError !== undefined,
    isFetching: false,
    refetch: refetchSpotifySearch,
  }),
  useSpotifyLibrary: (type: string) => ({
    data:
      type === 'albums'
        ? {
            pages: [
              {
                items: [
                  {
                    id: 'album-1',
                    uri: 'spotify:album:1',
                    name: 'Saved Album',
                    subtitle: 'Album Artist',
                    imageUrl: null,
                    itemCount: 10,
                  },
                ],
                total: 30,
                nextOffset: 24,
              },
            ],
          }
        : undefined,
    isLoading: false,
    isError: false,
    hasNextPage: type === 'albums',
    isFetchingNextPage: false,
    fetchNextPage,
  }),
}));

const accent = {
  text: 'text-orange-400',
  btnBg: 'bg-orange-500',
  dot: 'bg-orange-500',
  bg: 'bg-orange-500/10',
};

describe('BrowsePanel', () => {
  afterEach(cleanup);

  beforeEach(() => {
    loadFavorite.mockReset();
    playUri.mockReset();
    fetchNextPage.mockReset();
    addContainerToQueue.mockReset();
    replaceQueueAndPlay.mockReset();
    refetchMusicLibrary.mockReset();
    refetchSpotifySearch.mockReset();
    spotifyConnected = false;
    spotifySearchError = undefined;
    musicLibraryData = undefined;
    musicLibraryError = undefined;
  });

  it('collapses unlabeled provider accounts and omits duplicate discovered Spotify', () => {
    const services = buildBrowseServices({
      spotifyConnected: true,
      localMode: true,
      discoveredServices: [
        {
          id: 'sid:9',
          name: 'Spotify',
          sources: ['favorite', 'playback'],
          accounts: [
            { serialNumber: 2, sources: ['playback'] },
            { serialNumber: 5, sources: ['favorite'] },
          ],
        },
        {
          id: 'sid:65031',
          name: 'Sonos Radio',
          sources: ['favorite'],
          accounts: [{ serialNumber: 1, sources: ['favorite'] }],
        },
      ],
    });

    expect(services.map((service) => service.label)).toEqual([
      'Spotify',
      'Library',
      'Sonos Radio',
      'Saved Stations',
    ]);
    expect(services.some((service) => service.label.includes('Account'))).toBe(false);
  });

  it('matches Sonos favorites to the discovered Sonos Radio provider name', () => {
    expect(sonosServiceNamesMatch('Sonos', 'Sonos Radio')).toBe(true);
    expect(sonosServiceNamesMatch('TuneIn', 'Sonos Radio')).toBe(false);
  });

  it('preserves explicitly named provider accounts', () => {
    const services = buildBrowseServices({
      spotifyConnected: false,
      discoveredServices: [
        {
          id: 'sid:284',
          name: 'YouTube Music',
          sources: ['favorite'],
          accounts: [
            { serialNumber: 4, label: 'Family YouTube', sources: ['favorite'] },
            { serialNumber: 9, nickname: 'Guest YouTube', sources: ['favorite'] },
          ],
        },
      ],
    });

    expect(services.map((service) => service.label)).toContain('Family YouTube');
    expect(services.map((service) => service.label)).toContain('Guest YouTube');
  });

  it('promotes a discovered provider when Spotify is unavailable', () => {
    render(<BrowsePanel groupId="group-1" householdId="household-1" accent={accent} />);

    expect(screen.getByRole('button', { name: 'Family YouTube' })).not.toBeNull();
    expect(screen.queryByRole('combobox', { name: 'More Sonos services' })).toBeNull();
  });

  it('keeps only lower-priority services in the mobile overflow picker', () => {
    const services = buildBrowseServices({
      spotifyConnected: true,
      localMode: true,
      discoveredServices: [
        {
          id: 'sid:65031',
          name: 'Sonos Radio',
          sources: ['favorite'],
          accounts: [],
        },
        {
          id: 'sid:284',
          name: 'YouTube Music',
          sources: ['favorite'],
          accounts: [],
        },
      ],
    });

    const mobile = splitMobileBrowseServices(services);

    expect(mobile.primary.map((service) => service.label)).toEqual([
      'Spotify',
      'Library',
      'Sonos Radio',
    ]);
    expect(mobile.overflow.map((service) => service.label)).toEqual([
      'YouTube Music',
      'Saved Stations',
    ]);
  });

  it('defaults to the currently playing account and filters its favorites', () => {
    render(
      <BrowsePanel
        groupId="group-1"
        householdId="household-1"
        currentService="YouTube Music"
        currentAccountSerial={4}
        accent={accent}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Family YouTube' }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(screen.getByText('Family mix')).not.toBeNull();
    expect(screen.queryByText('Other account mix')).toBeNull();

    fireEvent.click(screen.getByTitle('Play now'));
    expect(loadFavorite).toHaveBeenCalledWith({
      groupId: 'group-1',
      favoriteId: 'yt-favorite',
    });
  });

  it('offers and plays favorite radio stations in local mode', () => {
    render(<BrowsePanel groupId="group-1" householdId="household-1" accent={accent} />);

    fireEvent.click(screen.getByRole('button', { name: 'Saved Stations' }));
    expect(screen.getByText('Local Radio')).not.toBeNull();

    fireEvent.click(screen.getByTitle('Play now'));
    expect(playUri).toHaveBeenCalledWith({
      groupId: 'group-1',
      uri: 'x-rincon-mp3radio://station',
      title: 'Local Radio',
    });
  });

  it('browses saved Spotify albums and loads the next page', () => {
    spotifyConnected = true;

    render(<BrowsePanel groupId="group-1" householdId="household-1" accent={accent} />);

    fireEvent.click(screen.getByRole('button', { name: 'Albums' }));
    expect(screen.getByText('Saved Album')).not.toBeNull();
    expect(screen.getByText('10 tracks')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it('shows a retry action when Spotify search fails', () => {
    spotifyConnected = true;
    spotifySearchError = new Error('search failed');

    render(<BrowsePanel groupId="group-1" householdId="household-1" accent={accent} />);

    fireEvent.change(screen.getByPlaceholderText('Search Spotify…'), {
      target: { value: 'queen' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(screen.getByText('Could not search Spotify. Try again.')).not.toBeNull();
    expect(refetchSpotifySearch).toHaveBeenCalledTimes(1);
  });

  it('queues Sonos library containers with the object ID only', () => {
    musicLibraryData = {
      items: [
        {
          title: 'Family Albums',
          uri: 'x-rincon-playlist:RINCON_TEST#A:ALBUM/Family',
          type: 'container',
        },
      ],
      total: 1,
      returned: 1,
    };

    render(<BrowsePanel groupId="group-1" householdId="household-1" accent={accent} />);

    fireEvent.click(screen.getByRole('button', { name: 'Library' }));
    fireEvent.click(screen.getByTitle('Play options'));
    fireEvent.click(screen.getByRole('button', { name: 'Add to End' }));

    expect(addContainerToQueue).toHaveBeenCalledWith({
      groupId: 'group-1',
      objectId: 'A:ALBUM/Family',
    });
    expect(replaceQueueAndPlay).not.toHaveBeenCalled();
  });

  it('normalizes CIFS folder URIs before queueing them', () => {
    musicLibraryData = {
      items: [
        {
          title: 'Family Music',
          uri: 'x-file-cifs://media.home.arpa/music/Family',
          type: 'container',
        },
      ],
      total: 1,
      returned: 1,
    };

    render(<BrowsePanel groupId="group-1" householdId="household-1" accent={accent} />);

    fireEvent.click(screen.getByRole('button', { name: 'Library' }));
    fireEvent.click(screen.getByTitle('Play options'));
    fireEvent.click(screen.getByRole('button', { name: 'Add to End' }));

    expect(addContainerToQueue).toHaveBeenCalledWith({
      groupId: 'group-1',
      objectId: 'S://media.home.arpa/music/Family',
    });
  });

  it('shows a retryable error instead of an empty library state', () => {
    musicLibraryError = new Error('upstream failure');

    render(<BrowsePanel groupId="group-1" householdId="household-1" accent={accent} />);

    fireEvent.click(screen.getByRole('button', { name: 'Library' }));
    expect(screen.getByText('Could not load Folders from Sonos.')).not.toBeNull();
    expect(screen.queryByText('No folders found')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetchMusicLibrary).toHaveBeenCalledTimes(1);
  });
});
