/**
 * @vitest-environment jsdom
 *
 * #100: the widget-side reads must not sit behind an admin route.
 *
 * `useShortcuts` feeds the App Shortcuts widget, and it used to call
 * `/api/admin/app-shortcuts/...`, which is admin-only — so every standard
 * user got a 403 and an empty widget. The read now has its own non-admin
 * route; the mutations stay under /api/admin.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MockInstance } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import * as apiClientModule from '../../lib/apiClient.js';
import { useShortcuts } from '../appShortcutHooks.js';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return React.createElement(QueryClientProvider, { client }, children);
}

describe('useShortcuts — request shape (#100)', () => {
  type ApiGet = typeof apiClientModule.apiClient.get;
  let getSpy: MockInstance<Parameters<ApiGet>, ReturnType<ApiGet>>;

  beforeEach(() => {
    getSpy = vi
      .spyOn(apiClientModule.apiClient, 'get')
      .mockResolvedValue({ groups: [], shortcuts: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads from the non-admin route', async () => {
    renderHook(() => useShortcuts('widget-1'), { wrapper });
    await waitFor(() => expect(getSpy).toHaveBeenCalled());

    const path = getSpy.mock.calls[0]![0];
    expect(path).toBe('/api/app-shortcuts/widget-1/shortcuts');
    expect(path).not.toContain('/api/admin/');
  });
});
