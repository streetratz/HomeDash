import { describe, expect, it } from 'vitest';
import { mapSpotifySearchPlaylists } from '../../src/api/spotify.js';

describe('Spotify search result mapping', () => {
  it('ignores unavailable null playlist entries returned by Spotify', () => {
    expect(
      mapSpotifySearchPlaylists([
        null,
        {
          uri: 'spotify:playlist:available',
          name: 'Available playlist',
          owner: { display_name: 'Owner' },
          images: [],
          tracks: { total: 12 },
        },
        null,
      ]),
    ).toEqual([
      {
        uri: 'spotify:playlist:available',
        name: 'Available playlist',
        owner: 'Owner',
        imageUrl: null,
        trackCount: 12,
      },
    ]);
  });
});
