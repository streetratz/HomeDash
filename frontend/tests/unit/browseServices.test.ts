import { describe, expect, it } from 'vitest';
import { buildBrowseServices, getDefaultService } from '../../src/components/sonos/BrowsePanel.js';
import type { SonosMusicService } from '../../src/hooks/useSonos.js';

const discoveredServices: SonosMusicService[] = [
  {
    id: 'sid:12',
    name: 'Spotify',
    serviceId: 12,
    serviceType: 3079,
    sources: ['favorite', 'playback'],
    accounts: [
      {
        serialNumber: 5,
        label: "Dad's Spotify",
        sources: ['favorite', 'playback'],
      },
    ],
  },
  {
    id: 'sid:284',
    name: 'YouTube Music',
    serviceId: 284,
    serviceType: 72711,
    sources: ['favorite'],
    accounts: [
      {
        serialNumber: 4,
        nickname: 'Family YouTube',
        sources: ['favorite'],
      },
    ],
  },
];

describe('buildBrowseServices()', () => {
  it('keeps native Spotify search when the HomeDash integration is connected', () => {
    const result = buildBrowseServices({ spotifyConnected: true, discoveredServices });
    expect(result[0]).toMatchObject({
      id: 'spotify',
      label: 'Spotify',
      kind: 'spotify',
      browsable: true,
    });
  });

  it('does not offer native Spotify search when the integration is disconnected', () => {
    const result = buildBrowseServices({ spotifyConnected: false, discoveredServices });
    expect(result.some((service) => service.id === 'spotify')).toBe(false);
    expect(result.some((service) => service.label === "Dad's Spotify")).toBe(true);
  });

  it('creates account-specific favorites surfaces from discovered Sonos accounts', () => {
    const result = buildBrowseServices({ spotifyConnected: true, discoveredServices });

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'favorites:sid:12:sn:5',
          label: "Dad's Spotify",
          kind: 'favorites',
          serviceName: 'Spotify',
          accountSerial: 5,
        }),
        expect.objectContaining({
          id: 'favorites:sid:284:sn:4',
          label: 'Family YouTube',
          kind: 'favorites',
          serviceName: 'YouTube Music',
          accountSerial: 4,
        }),
      ]),
    );
  });

  it('does not invent providers that Sonos has not observed', () => {
    const result = buildBrowseServices({
      spotifyConnected: false,
      discoveredServices: discoveredServices.slice(0, 1),
    });

    expect(result.some((service) => service.serviceName === 'YouTube Music')).toBe(false);
  });

  it('always keeps Radio and Library as usable local surfaces', () => {
    const result = buildBrowseServices({ spotifyConnected: false, discoveredServices: [] });

    expect(result).toEqual([
      { id: 'radio', label: 'Radio', browsable: true, kind: 'radio' },
      { id: 'library', label: 'Library', browsable: true, kind: 'library' },
    ]);
  });

  it('omits local-only Radio and Library surfaces in cloud mode', () => {
    const result = buildBrowseServices({
      spotifyConnected: false,
      discoveredServices,
      localMode: false,
    });

    expect(result.every((service) => service.kind === 'favorites')).toBe(true);
  });
});

describe('getDefaultService()', () => {
  const allServices = buildBrowseServices({ spotifyConnected: true, discoveredServices });

  it('selects the currently playing provider account before its generic provider', () => {
    expect(getDefaultService(allServices, 'Spotify', 5)).toBe('favorites:sid:12:sn:5');
  });

  it('selects the matching provider when no account match exists', () => {
    expect(getDefaultService(allServices, 'Spotify', 99)).toBe('spotify');
    expect(getDefaultService(allServices, 'YouTube Music')).toBe('favorites:sid:284:sn:4');
  });

  it('falls back to the first usable service', () => {
    expect(getDefaultService(allServices)).toBe('spotify');

    const localOnly = buildBrowseServices({ spotifyConnected: false, discoveredServices: [] });
    expect(getDefaultService(localOnly)).toBe('radio');
  });

  it('handles an empty service list defensively', () => {
    expect(getDefaultService([])).toBe('library');
  });
});
