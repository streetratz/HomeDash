import { test, expect } from './support/admin.js';
test('custom-first regular stream supports multiweekday, disable and deliberate removal', async ({ page }) => {
  await page.goto('/settings?tab=integrations');
  await page.getByRole('button', { name: 'Calendars', exact: true }).click();
  const manager = page.getByRole('region', { name: 'Household collections' });
  if (await manager.getByRole('button', { name: 'Edit collection configuration' }).count()) {
    await manager.getByRole('button', { name: 'Edit collection configuration' }).click();
  } else {
    await manager.getByRole('textbox', { name: 'Household timezone', exact: true }).fill('Australia/Sydney');
    await manager.getByRole('checkbox', { name: /I confirm/ }).check();
    await manager.getByRole('button', { name: 'Start custom without preset' }).click();
  }
  await manager.getByRole('button', { name: 'Add regular stream' }).click();
  const editor = manager.getByRole('group', { name: /Collection stream/ }).last();
  await editor.getByLabel('Stream name', { exact: true }).fill('Synthetic custom Rubbish');
  await editor.getByLabel('Thursday', { exact: true }).check();
  await editor.getByLabel('Normal collection date').fill('2026-10-12');
  await editor.getByLabel('Hex colour').fill('#123456');
  await editor.getByLabel('Interval (weeks)').fill('1');
  await editor.getByLabel('Enabled').uncheck();
  await editor.getByLabel('Enabled').check();
  await manager.getByRole('button', { name: 'Preview dates' }).click();
  await expect(manager.getByRole('button', { name: 'Save collections' })).toBeEnabled();
  await manager.getByRole('button', { name: 'Save collections' }).click();
  await manager.getByRole('button', { name: 'Edit collection configuration' }).click();
  const saved = manager.getByRole('group', { name: /Synthetic custom Rubbish/ });
  await saved.getByRole('button', { name: 'Remove stream' }).click();
  await expect(saved.getByRole('button', { name: 'Confirm remove stream' })).toBeVisible();
  await saved.getByRole('button', { name: 'Confirm remove stream' }).click();
  await expect(saved).toHaveCount(0);
  await manager.getByRole('button', { name: 'Preview dates' }).click();
  await expect(manager.getByRole('button', { name: 'Save collections' })).toBeEnabled();
  await manager.getByRole('button', { name: 'Save collections' }).click();
});
