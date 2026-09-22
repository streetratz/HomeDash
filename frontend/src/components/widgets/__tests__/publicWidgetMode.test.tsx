/**
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClientModule from '../../../lib/apiClient.js';
import type { WidgetView } from '../../../state/dashboards.js';
import { PublicViewProvider } from '../../../state/publicView.js';
import { AppShortcutsWidget } from '../AppShortcutsWidget.js';
import { PiholeWidget } from '../PiholeWidget.js';
import { SonosWidget } from '../SonosWidget.js';
import { StocksWidget } from '../StocksWidget.js';
import { UnifiWidget } from '../UnifiWidget.js';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function widget(type: string, config: unknown = {}): WidgetView {
  return {
    id: `00000000-0000-4000-8000-${type.padEnd(12, '0').slice(0, 12)}`,
    type,
    orderIndex: 0,
    config,
    links: [],
  };
}

function renderPublic(element: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <PublicViewProvider isPublic>{element}</PublicViewProvider>
    </QueryClientProvider>,
  );
}

describe('public widget mode', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('uses only the public snapshot namespace for supported integration widgets', async () => {
    const getSpy = vi.spyOn(apiClientModule.apiClient, 'get').mockImplementation((path) => {
      if (path.includes('pihole')) {
        return Promise.resolve({
          widgetId: 'pihole',
          type: 'pihole',
          refreshedAt: new Date().toISOString(),
          data: {
            stats: {
              totalQueries: 10,
              blockedQueries: 2,
              percentBlocked: 20,
              domainsOnBlocklist: 100,
              uniqueClients: 3,
              blocking: 'enabled',
              timer: null,
            },
            system: { cpu: 10, memory: 20, load: [0.1, 0.2, 0.3], temp: 40, uptime: 60 },
          },
        });
      }
      if (path.includes('unifi')) {
        return Promise.resolve({
          widgetId: 'unifi',
          type: 'unifi',
          refreshedAt: new Date().toISOString(),
          data: {
            clients: { total: 0, wired: 0, wireless: 0 },
            gateway: null,
            devices: [],
            wan: null,
            wifi: [],
            ips: { enabled: false, totalBlocked: 0 },
            health: { cpu: null, mem: null, temp: null, uptime: null, version: null },
          },
        });
      }
      if (path.includes('sonos_music')) {
        return Promise.resolve({
          widgetId: 'sonos',
          type: 'sonos_music',
          refreshedAt: new Date().toISOString(),
          data: {
            groups: [{ id: 'group-1', name: 'Living Room', playbackState: 'PLAYBACK_STATE_PLAYING' }],
            players: [],
            activeGroupId: 'group-1',
            playback: { playbackState: 'PLAYBACK_STATE_PLAYING' },
            metadata: { currentItem: { track: { name: 'Track', artist: { name: 'Artist' } } } },
            volume: { volume: 25, muted: false },
          },
        });
      }
      if (path.includes('stocks')) {
        return Promise.resolve({
          widgetId: 'stocks',
          type: 'stocks',
          refreshedAt: new Date().toISOString(),
          data: { quotes: [], fxRates: {}, displayCurrency: 'USD', timestamp: 0 },
        });
      }
      return Promise.resolve({
        widgetId: 'shortcuts',
        type: 'app_shortcuts',
        refreshedAt: new Date().toISOString(),
        data: { shortcuts: [] },
      });
    });

    const widgets: ReactElement[] = [
      <PiholeWidget key="pihole" widget={widget('pihole')} />,
      <UnifiWidget key="unifi" widget={widget('unifi')} />,
      <SonosWidget key="sonos" widget={widget('sonos_music')} />,
      <StocksWidget
        key="stocks"
        widget={widget('stocks', {
          groups: [],
          displayCurrency: 'USD',
          refreshInterval: 60,
          displayMode: 'compact',
          showSparkline: false,
          reduceOffHours: false,
          hideZeroUnits: false,
        })}
      />,
      <AppShortcutsWidget
        key="shortcuts"
        widget={widget('app_shortcuts', { columns: 4, iconSize: 'md', showLabels: true })}
      />,
    ];

    renderPublic(<>{widgets}</>);

    await waitFor(() => {
      const paths = getSpy.mock.calls.map(([path]) => path);
      expect(paths.filter((path) => path.startsWith('/api/public/widgets/'))).toHaveLength(5);
    });

    const paths = getSpy.mock.calls.map(([path]) => path);
    expect(paths).not.toContain('/api/sonos/status');
    expect(paths.some((path) => /^\/api\/(pihole|unifi|stocks|app-shortcuts)\//.test(path))).toBe(false);
  });

  it('does not render anonymous Pi-hole or Sonos controls', async () => {
    vi.spyOn(apiClientModule.apiClient, 'get').mockImplementation((path) => {
      if (path.includes('pihole')) {
        return Promise.resolve({
          widgetId: 'pihole',
          type: 'pihole',
          refreshedAt: new Date().toISOString(),
          data: {
            stats: {
              totalQueries: 10,
              blockedQueries: 2,
              percentBlocked: 20,
              domainsOnBlocklist: 100,
              uniqueClients: 3,
              blocking: 'enabled',
              timer: null,
            },
            system: { cpu: 10, memory: 20, load: [0.1, 0.2, 0.3], temp: 40, uptime: 60 },
          },
        });
      }
      return Promise.resolve({
        widgetId: 'sonos',
        type: 'sonos_music',
        refreshedAt: new Date().toISOString(),
        data: {
          groups: [{ id: 'group-1', name: 'Living Room', playbackState: 'PLAYBACK_STATE_PLAYING' }],
          players: [],
          activeGroupId: 'group-1',
          playback: { playbackState: 'PLAYBACK_STATE_PLAYING' },
          metadata: { currentItem: { track: { name: 'Track', artist: { name: 'Artist' } } } },
          volume: { volume: 25, muted: false },
        },
      });
    });

    const pihole = renderPublic(
      <PiholeWidget widget={widget('pihole', { sections: ['controls', 'queries'] })} />,
    );
    await waitFor(() => expect(pihole.getByText('Total Queries')).toBeTruthy());
    expect(pihole.queryByRole('button', { name: /disable|enable/i })).toBeNull();
    pihole.unmount();

    const sonos = renderPublic(<SonosWidget widget={widget('sonos_music')} />);
    await waitFor(() => expect(sonos.getByText('Track')).toBeTruthy());
    expect(sonos.queryByTitle('Open fullscreen controller')).toBeNull();
    expect(sonos.queryByTitle('Switch room')).toBeNull();
  });
});
