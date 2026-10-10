import { expect, test } from '@playwright/test';

test.describe('Settings navigation', () => {
  test('mobile drawer flattens appearance panels into direct destinations', async ({ page }) => {
    await page.goto('/settings');

    const trigger = page.getByRole('button', { name: /Section:/ });
    await expect(trigger).toContainText('General');
    await trigger.click();

    const drawer = page.getByRole('navigation', { name: 'Settings sections' });
    await drawer.getByRole('button', { name: 'Clock Strip' }).click();

    await expect(page).toHaveURL(/\/settings\?tab=clock-strip$/);
    await expect(page.getByRole('button', { name: /Section:/ })).toContainText('Clock Strip');
  });

  test('mobile integrations sub-panel selection persists in the URL', async ({ page }) => {
    await page.goto('/settings?tab=integrations');

    const integrationSection = page.getByRole('combobox', { name: 'Integration' });
    await integrationSection.click();
    await page.getByRole('option', { name: 'Sonos' }).click();

    await expect(integrationSection).toContainText('Sonos');
    await expect(page).toHaveURL(/\/settings\?tab=integrations&panel=sonos$/);
  });
});
