import { expect, test } from '@playwright/test';

test.describe('Settings navigation', () => {
  test('mobile selectors expose primary and nested settings destinations', async ({ page }) => {
    await page.goto('/settings');

    const settingsSection = page.getByRole('combobox', { name: 'Settings section' });
    await expect(settingsSection).toContainText('General');
    await settingsSection.click();
    await page.getByRole('option', { name: 'Appearance' }).click();

    await expect(page).toHaveURL(/\/settings\?tab=appearance$/);
    const appearanceSection = page.getByRole('combobox', { name: 'Appearance section' });
    await appearanceSection.click();
    await page.getByRole('option', { name: 'Clock Strip' }).click();
    await expect(appearanceSection).toContainText('Clock Strip');

    await settingsSection.click();
    await page.getByRole('option', { name: 'Integrations' }).click();

    await expect(page).toHaveURL(/\/settings\?tab=integrations$/);
    const integrationSection = page.getByRole('combobox', { name: 'Integration' });
    await integrationSection.click();
    await page.getByRole('option', { name: 'Sonos' }).click();
    await expect(integrationSection).toContainText('Sonos');
  });
});
