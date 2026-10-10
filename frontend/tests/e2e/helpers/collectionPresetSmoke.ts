import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { expectApiOk } from '../support/admin.js';

export async function collectionPresetSmoke(page: Page, csrf: string, mobile: boolean) {
  await page.goto('/settings?tab=integrations');
  if (mobile) {
    await page.getByRole('combobox', { name: 'Integration' }).click();
    await page.getByRole('option', { name: 'Calendars', exact: true }).click();
  } else {
    await page.getByRole('button', { name: 'Calendars', exact: true }).click();
  }
  const manager = page.getByRole('region', { name: 'Household collections' });
  await expect(manager).toBeVisible();
  const configResponse = await page.request.get('/api/admin/calendar/collections');
  await expectApiOk(configResponse, 'Read synthetic collection state');
  const config = await configResponse.json() as { configured: boolean; streams: { id: string }[] };
  if (!config.configured) {
    await manager.getByRole('textbox', { name: 'Household timezone', exact: true }).fill('Australia/Sydney');
    await manager.getByLabel('Normal Recycling collection date').fill('2026-10-14');
    await manager.getByLabel('I confirm the household timezone and normal provider date').check();
    await manager.getByRole('button', { name: 'Use weekly / alternating preset' }).click();
    await manager.getByRole('button', { name: 'Preview dates' }).click();
    await expect(manager.getByText('General waste', { exact: true }).first()).toBeVisible();
    await expect(manager.getByRole('button', { name: 'Save collections' })).toBeEnabled();
    await manager.getByRole('button', { name: 'Save collections' }).click();
  }
  await expect(manager.getByRole('button', { name: 'Edit collection configuration' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Use weekly / alternating preset' })).toHaveCount(0);
  const savedResponse = await page.request.get('/api/admin/calendar/collections');
  const saved = await savedResponse.json() as { streams: { id: string }[] };
  const headers = { 'x-csrf-token': csrf };
  const create = await page.request.post('/api/admin/dashboards', { headers, data: { name: `Synthetic Collections ${mobile ? 'mobile' : 'desktop'}` } });
  await expectApiOk(create, 'Create synthetic dashboard');
  const dashboard = await create.json() as { id: string };
  const layout = await page.request.put(`/api/admin/dashboards/${dashboard.id}/layout`, { headers, data: {
    placeholders: [{ stableKey: crypto.randomUUID(), x: 0, y: 0, w: 6, h: 6, widgets: [{
      type: 'calendar', orderIndex: 0, configJson: JSON.stringify({ sourceIds: [], collectionStreamIds: saved.streams.map(s => s.id), publicCollectionStreamIds: [], daysAhead: 28 }),
    }] }],
  } });
  await expectApiOk(layout, 'Select collection streams in existing Calendar');
  await expectApiOk(await page.request.put('/api/user/preferences', { headers, data: { webDashboardId: dashboard.id, mobileDashboardId: dashboard.id } }), 'Select synthetic dashboard');
  try {
    await page.goto('/');
    await expect(page.getByText('General waste', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Recycling', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Open month view' }).click();
    const dialog = page.getByRole('dialog', { name: 'Calendar month view' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /2026-10-14: 0 provider events, 2 collection streams/ }).click();
    await expect(dialog.getByRole('list', { name: 'Next collection' }).getByText('General waste', { exact: true })).toBeVisible();
    await expect(dialog.getByRole('list', { name: 'Next collection' }).getByText('Recycling', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await page.reload();
    await expect(page.getByText('General waste', { exact: true }).first()).toBeVisible();
    if (mobile) {
      for (const colorScheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      }
    }
  } finally {
    await page.request.put('/api/user/preferences', { headers, data: { webDashboardId: null, mobileDashboardId: null } });
    await page.request.delete(`/api/admin/dashboards/${dashboard.id}`, { headers });
  }
}
