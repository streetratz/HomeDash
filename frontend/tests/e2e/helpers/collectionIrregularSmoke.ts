import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { expectApiOk } from '../support/admin.js';

export async function collectionIrregularSmoke(page: Page, csrf: string, mobile: boolean) {
  const headers = { 'x-csrf-token': csrf };
  const config = (await (await page.request.get('/api/admin/calendar/collections')).json()) as {
    revision: number;
    runtimeEpoch: string;
    streams: { id: string }[];
  };
  const empty = {
    expectedRevision: config.revision,
    runtimeEpoch: config.runtimeEpoch,
    timezone: 'Australia/Sydney',
    providerLabel: null,
    streams: [],
    range: { from: '2026-10-10', to: '2026-11-10' },
    confirmations: {
      timezoneConfirmed: true,
      deletedStreamIds: config.streams.map((s) => s.id),
      removedExceptionIds: [],
      clearedExplicitStreamIds: [],
    },
  };
  const preview = await page.request.post('/api/admin/calendar/collections/preview', {
    headers,
    data: empty,
  });
  await expectApiOk(preview, 'Reset isolated collection fixture');
  const result = (await preview.json()) as { previewDigest: string };
  await expectApiOk(
    await page.request.put('/api/admin/calendar/collections', {
      headers,
      data: { ...empty, previewDigest: result.previewDigest },
    }),
    'Save empty synthetic fixture',
  );
  await page.goto('/settings?tab=integrations');
  if (mobile) {
    const integrationNav = page.getByRole('navigation', { name: 'Integration sections' });
    await integrationNav.getByRole('button', { expanded: false }).click();
    await integrationNav.getByRole('button', { name: 'Calendars', exact: true }).click();
  } else await page.getByRole('button', { name: 'Calendars', exact: true }).click();
  await page.getByRole('button', { name: 'Custom Events' }).click();
  const manager = page.getByRole('region', { name: 'Custom events' });
  await manager.getByRole('button', { name: 'Manage custom events' }).click();
  await manager.getByRole('button', { name: 'Add event', exact: true }).click();
  const editor = manager.getByRole('listitem', { name: /Custom event 1/ });
  await editor.getByLabel('Event title', { exact: true }).fill('Synthetic holiday service');
  await editor.getByLabel('Date', { exact: true }).fill('2026-10-12');
  await editor.getByRole('combobox', { name: 'Repeat', exact: true }).selectOption('weekly');
  await editor.getByRole('button', { name: 'Confirm repeat change' }).click();
  await editor.getByRole('button', { name: 'Single-occurrence changes (advanced)' }).click();
  await editor.getByRole('button', { name: 'Move collection', exact: true }).click();
  await editor.getByLabel('Original scheduled date').fill('2026-10-12');
  await editor.getByLabel('Actual collection date').fill('2026-10-13');
  await manager.getByLabel('Preview from').fill('2026-10-10');
  await manager.getByLabel('Preview to').fill('2026-11-10');
  await manager.getByRole('button', { name: 'Preview dates' }).click();
  await expect(manager.getByRole('button', { name: 'Save events' })).toBeEnabled();
  await manager.getByRole('button', { name: 'Save events' }).click();
  await manager.getByRole('button', { name: 'Manage custom events' }).click();
  await editor.getByRole('button', { name: 'Edit', exact: true }).click();
  await editor.getByRole('combobox', { name: 'Repeat', exact: true }).selectOption('off');
  await editor.getByRole('button', { name: 'Confirm repeat change' }).click();
  await editor.getByLabel('Date', { exact: true }).fill('2026-12-14');
  await editor.getByRole('button', { name: 'Add more dates (advanced)' }).click();
  await editor.getByRole('button', { name: 'Add collection date' }).click();
  await editor.getByLabel('Collection date 2', { exact: true }).fill('2027-01-18');
  await manager.getByLabel('Preview from').fill('2026-12-01');
  await manager.getByLabel('Preview to').fill('2027-02-28');
  await manager.getByRole('button', { name: 'Preview dates' }).click();
  await expect(manager.getByRole('button', { name: 'Save events' })).toBeEnabled();
  await manager.getByRole('button', { name: 'Save events' }).click();
  const saved = (await (await page.request.get('/api/admin/calendar/collections')).json()) as {
    streams: { schedule: { mode: string; dates: string[] } }[];
  };
  expect(saved.streams[0]?.schedule).toEqual({
    mode: 'explicit',
    dates: ['2026-12-14', '2027-01-18'],
  });
}
