// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { collectionKeys, useCollectionDisplay, useCollectionConfig } from '../../src/state/collectionHooks.js';
import { ApiRequestError } from '../../src/lib/apiClient.js';
import type * as ApiClientModule from '../../src/lib/apiClient.js';
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  auth: { isLoading: false, isSuccess: true, dataUpdatedAt: 1, data: { user: { id: 'admin', isAdmin: true } } },
}));
vi.mock('../../src/lib/apiClient.js', async importOriginal => ({
  ...await importOriginal<typeof ApiClientModule>(),
  apiClient: { get: mocks.get },
}));
vi.mock('../../src/state/bootstrap.js', () => ({ useAuthMe: () => mocks.auth }));
afterEach(() => { cleanup(); vi.clearAllMocks(); mocks.auth.data.user = { id: 'admin', isAdmin: true }; mocks.auth.dataUpdatedAt = 1; });
function harness() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}
describe('collection query separation', () => {
  it('separates public/auth/session/widget/window and shares the agreed restore prefix', () => {
    const auth = collectionKeys.display('auth:one', 'widget', { daysAhead: 7 });
    expect(auth[0]).toBe('collections');
    expect(auth).not.toEqual(collectionKeys.display('public', 'widget', { daysAhead: 7 }));
    expect(auth).not.toEqual(collectionKeys.display('auth:two', 'widget', { daysAhead: 7 }));
    expect(auth).not.toEqual(collectionKeys.display('auth:one', 'other', { daysAhead: 7 }));
    expect(auth).not.toEqual(collectionKeys.display('auth:one', 'widget', { from: '2026-10-01', to: '2026-10-31' }));
  });
  it('does not fetch private catalogue for a non-administrator', () => {
    mocks.auth.data.user.isAdmin = false;
    const { wrapper } = harness();
    const hook = renderHook(() => useCollectionConfig(), { wrapper });
    expect(hook.result.current.fetchStatus).toBe('idle');
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it('isolates account caches and never renders denied previously fetched data', async () => {
    const payload = { groups: [{ date: '2026-10-14', streams: [] }], serverNow: '2026-10-10T00:00:00Z' };
    mocks.get.mockResolvedValue(payload);
    const { wrapper } = harness();
    const hook = renderHook(() => useCollectionDisplay('widget', { daysAhead: 28 }, true), { wrapper });
    await waitFor(() => expect(hook.result.current.data).toEqual(payload));
    mocks.auth.data.user.id = 'resident';
    mocks.auth.dataUpdatedAt = 2;
    mocks.get.mockRejectedValue(new ApiRequestError(403, { error: 'FORBIDDEN', message: 'Denied' }));
    hook.rerender();
    expect(hook.result.current.data).toBeUndefined();
    await waitFor(() => expect(hook.result.current.denied).toBe(true));
    expect(hook.result.current.data).toBeUndefined();
  });
  it('does not fetch offscreen and resumes immediately on visibility', async () => {
    mocks.get.mockResolvedValue({ groups: [] });
    const { wrapper } = harness();
    const hook = renderHook(({ active }) => useCollectionDisplay('widget', { daysAhead: 28 }, active), { wrapper, initialProps: { active: false } });
    expect(mocks.get).not.toHaveBeenCalled();
    hook.rerender({ active: true });
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(1));
    document.dispatchEvent(new Event('visibilitychange'));
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2));
  });
  it('rolls household date and range over on the single foreground 30-second query poll', async () => {
    const before = { householdToday: '2026-10-14', range: { from: '2026-10-14', to: '2026-11-11' }, groups: [] };
    const after = { householdToday: '2026-10-15', range: { from: '2026-10-15', to: '2026-11-12' }, groups: [] };
    mocks.get.mockResolvedValueOnce(before).mockResolvedValue(after);
    vi.useFakeTimers();
    try {
      const { wrapper } = harness();
      const hook = renderHook(() => useCollectionDisplay('widget', { daysAhead: 28 }, true), { wrapper });
      await act(async () => { await vi.advanceTimersByTimeAsync(100); });
      expect(hook.result.current.data).toEqual(before);
      await act(async () => { await vi.advanceTimersByTimeAsync(30_100); });
      expect(hook.result.current.data).toEqual(after);
      expect(mocks.get).toHaveBeenCalledTimes(2);
    } finally { vi.useRealTimers(); }
  });
});
