import { test, expect } from './support/admin.js';
import { resetCollectionsToEmpty } from './helpers/collections.js';

test('custom event supports weekly multiweekday repeat, disable and deliberate deletion', async ({
  page,
  csrfToken,
}, testInfo) => {
  await resetCollectionsToEmpty(page.request, csrfToken);
  await page.goto('/settings?tab=integrations');
  await page.getByRole('button', { name: 'Calendars', exact: true }).click();
  await page.getByRole('button', { name: 'Custom Events' }).click();
  const manager = page.getByRole('region', { name: 'Custom events' });
  await manager.getByRole('button', { name: 'Manage custom events' }).click();
  await manager.getByRole('button', { name: 'Add event', exact: true }).click();
  const editor = manager.getByRole('listitem', { name: /Custom event 1/ });
  await editor.getByLabel('Event title', { exact: true }).fill('Synthetic custom Rubbish');
  await editor.getByLabel('Date', { exact: true }).fill('2026-10-15');
  await editor.getByRole('combobox', { name: 'Repeat', exact: true }).selectOption('weekly');
  await editor.getByRole('button', { name: 'Confirm repeat change' }).click();
  const anchorBox = await editor
    .getByLabel('Normal date (cycle anchor)', { exact: true })
    .boundingBox();
  const firstBox = await editor.getByLabel('First date (optional)', { exact: true }).boundingBox();
  expect(anchorBox).not.toBeNull();
  expect(firstBox).not.toBeNull();
  expect(anchorBox!.y).toBe(firstBox!.y);
  const weekdayStrip = await editor
    .getByLabel('Monday', { exact: true })
    .locator('../..')
    .boundingBox();
  expect(weekdayStrip!.width).toBeLessThanOrEqual(384);
  expect(weekdayStrip!.width).toBeLessThan(anchorBox!.width * 3);
  await editor.screenshot({ path: testInfo.outputPath('compact-event-editor.png') });
  await editor.getByLabel('Tuesday', { exact: true }).focus();
  await page.keyboard.press('Space');
  await expect(editor.getByLabel('Tuesday', { exact: true })).toBeChecked();
  await editor.getByRole('button', { name: 'Change colour for Synthetic custom Rubbish' }).click();
  await page.getByRole('textbox', { name: 'Custom hex colour' }).fill('#123456');
  await page.keyboard.press('Escape');
  await editor.getByLabel('Enabled').uncheck();
  await editor.getByLabel('Enabled').check();
  await manager.getByRole('button', { name: 'Preview dates' }).click();
  await expect(manager.getByRole('button', { name: 'Save events' })).toBeEnabled();
  await manager.getByRole('button', { name: 'Save events' }).click();
  await manager.getByRole('button', { name: 'Manage custom events' }).click();
  const saved = manager.getByRole('listitem', { name: /Synthetic custom Rubbish/ });
  await saved.getByRole('button', { name: 'Delete Synthetic custom Rubbish' }).click();
  await expect(saved.getByRole('button', { name: 'Confirm delete event' })).toBeVisible();
  await saved.getByRole('button', { name: 'Confirm delete event' }).click();
  await expect(saved).toHaveCount(0);
  await manager.getByRole('button', { name: 'Preview dates' }).click();
  await expect(manager.getByRole('button', { name: 'Save events' })).toBeEnabled();
  await manager.getByRole('button', { name: 'Save events' }).click();
});
