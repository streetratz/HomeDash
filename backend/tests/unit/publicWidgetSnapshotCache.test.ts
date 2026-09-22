import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearPublicWidgetSnapshotCache,
  getOrRefreshPublicSnapshot,
  PublicWidgetUnavailableError,
} from '../../src/services/publicWidgetSnapshotCache.js';

const policy = { freshMs: 1_000, staleMs: 2_000, failureBackoffMs: 500 };

describe('public widget snapshot cache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearPublicWidgetSnapshotCache();
  });

  it('coalesces concurrent initial loads', async () => {
    let resolveLoader!: (value: {
      widgetId: string;
      type: 'pihole';
      data: { ok: boolean };
      refreshedAt: string;
    }) => void;
    const loader = vi.fn(
      () =>
        new Promise<{
          widgetId: string;
          type: 'pihole';
          data: { ok: boolean };
          refreshedAt: string;
        }>((resolve) => {
          resolveLoader = resolve;
        }),
    );

    const requests = Array.from({ length: 10 }, () =>
      getOrRefreshPublicSnapshot('pihole:one:snapshot', policy, loader),
    );
    expect(loader).toHaveBeenCalledTimes(1);
    resolveLoader({
      widgetId: 'one',
      type: 'pihole',
      data: { ok: true },
      refreshedAt: new Date().toISOString(),
    });
    const values = await Promise.all(requests);
    expect(values.every((value) => (value.data as { ok: boolean }).ok)).toBe(true);
  });

  it('serves stale data while one refresh runs', async () => {
    const loader = vi
      .fn()
      .mockResolvedValueOnce({
        widgetId: 'one',
        type: 'stocks',
        data: { version: 1 },
        refreshedAt: new Date().toISOString(),
      })
      .mockResolvedValueOnce({
        widgetId: 'one',
        type: 'stocks',
        data: { version: 2 },
        refreshedAt: new Date().toISOString(),
      });

    await getOrRefreshPublicSnapshot('stocks:one:snapshot', policy, loader);
    await vi.advanceTimersByTimeAsync(1_001);
    const stale = await getOrRefreshPublicSnapshot('stocks:one:snapshot', policy, loader);
    expect(stale.data).toEqual({ version: 1 });
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('backs off failed initial loads', async () => {
    const loader = vi.fn().mockRejectedValue(new Error('provider secret detail'));
    await expect(
      getOrRefreshPublicSnapshot('unifi:one:snapshot', policy, loader),
    ).rejects.toBeInstanceOf(PublicWidgetUnavailableError);
    await expect(
      getOrRefreshPublicSnapshot('unifi:one:snapshot', policy, loader),
    ).rejects.toBeInstanceOf(PublicWidgetUnavailableError);
    expect(loader).toHaveBeenCalledTimes(1);
  });
});
