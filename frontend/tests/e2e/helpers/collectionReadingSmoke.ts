import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { expectApiOk } from '../support/admin.js';
export async function collectionReadingSmoke(page: Page, csrf: string) {
  const headers = { 'x-csrf-token': csrf };
  const previous = (await (await page.request.get('/api/admin/calendar/collections')).json()) as {
    revision: number;
    runtimeEpoch: string;
    streams: { id: string }[];
  };
  const streams = Array.from({ length: 32 }, (_, i) => ({
    id: crypto.randomUUID(),
    name: `${String(i + 1).padStart(2, '0')} ${'same colour collection '.repeat(4)}`.slice(0, 80),
    color: '#123456',
    enabled: true,
    schedule: { mode: 'regular', weekdays: [3], intervalWeeks: 1, anchorDate: '2026-10-14' },
    exceptions: [],
  }));
  const draft = {
    expectedRevision: previous.revision,
    runtimeEpoch: previous.runtimeEpoch,
    timezone: 'Australia/Sydney',
    providerLabel: 'Private synthetic label',
    streams,
    range: { from: '2026-10-14', to: '2026-11-11' },
    confirmations: {
      timezoneConfirmed: true,
      deletedStreamIds: previous.streams.map((s) => s.id),
      removedExceptionIds: [],
      clearedExplicitStreamIds: [],
    },
  };
  const preview = await page.request.post('/api/admin/calendar/collections/preview', {
    headers,
    data: draft,
  });
  await expectApiOk(preview, 'Preview crowded synthetic streams');
  const result = (await preview.json()) as { previewDigest: string; canSave: boolean };
  expect(result.canSave).toBe(true);
  await expectApiOk(
    await page.request.put('/api/admin/calendar/collections', {
      headers,
      data: { ...draft, previewDigest: result.previewDigest },
    }),
    'Save crowded synthetic streams',
  );
  const dashboardResponse = await page.request.post('/api/admin/dashboards', {
    headers,
    data: { name: 'Synthetic reading' },
  });
  await expectApiOk(dashboardResponse, 'Create synthetic reading dashboard');
  const dashboard = (await dashboardResponse.json()) as { id: string };
  await expectApiOk(
    await page.request.put(`/api/admin/dashboards/${dashboard.id}/layout`, {
      headers,
      data: {
        placeholders: [
          {
            stableKey: crypto.randomUUID(),
            x: 0,
            y: 0,
            w: 6,
            h: 6,
            widgets: [
              {
                type: 'calendar',
                orderIndex: 0,
                configJson: JSON.stringify({
                  sourceIds: [],
                  collectionStreamIds: streams.map((s) => s.id),
                  publicCollectionStreamIds: [],
                  daysAhead: 28,
                  maxEvents: 5,
                }),
              },
            ],
          },
        ],
      },
    }),
    'Save crowded Calendar',
  );
  await page.request.put('/api/user/preferences', {
    headers,
    data: { webDashboardId: dashboard.id, mobileDashboardId: dashboard.id },
  });
  try {
    await page.goto('/');
    await expect(
      page.getByRole('list', { name: 'Next collection' }).getByRole('listitem'),
    ).toHaveCount(32);
    await page.getByRole('button', { name: 'Open month view' }).focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('button', { name: 'Previous month' })).toBeFocused();
    const date = dialog.locator('[data-date="2026-10-14"]');
    await expect(date).toContainText('+30 more collections');
    await date.click();
    await expect(
      dialog.getByRole('list', { name: 'Next collection' }).getByRole('listitem'),
    ).toHaveCount(32);
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    await dialog.getByRole('button', { name: 'Previous month' }).focus();
    await page.keyboard.press('Shift+Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(
      true,
    );
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Open month view' })).toBeFocused();
  } finally {
    await page.request.put('/api/user/preferences', {
      headers,
      data: { webDashboardId: null, mobileDashboardId: null },
    });
    await page.request.delete(`/api/admin/dashboards/${dashboard.id}`, { headers });
  }
}
