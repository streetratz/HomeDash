import { expect, test } from '@playwright/test';

test.describe('Settings navigation', () => {
  test('desktop retains the labeled tab and sidebar navigation', async ({ page }) => {
    await page.goto('/settings?tab=appearance');

    await expect(page.getByRole('tab', { name: 'Appearance' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Settings section' })).toBeHidden();
    await expect(page.getByRole('navigation', { name: 'Appearance sections' })).toBeVisible();
  });
});
