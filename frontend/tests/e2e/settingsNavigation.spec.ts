import { expect, test, type Page } from '@playwright/test';

async function ensureAdminAndLogin(page: Page) {
  const bootstrap = await page.request.get('/api/public/bootstrap');
  const state = (await bootstrap.json()) as { firstRunRequired: boolean };

  if (state.firstRunRequired) {
    const create = await page.request.post('/api/first-run/admin', {
      data: {
        username: 'admin',
        displayName: 'Admin',
        password: 'strongpassword1',
      },
    });
    expect(create.ok()).toBe(true);
  }

  await page.goto('/login');
  await page.getByLabel('Username').fill('admin');
  await page.getByLabel('Password').fill('strongpassword1');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('/');
}

test.describe('Settings navigation', () => {
  test('mobile selectors expose primary and nested settings destinations', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await ensureAdminAndLogin(page);
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

  test('desktop retains the labeled tab and sidebar navigation', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await ensureAdminAndLogin(page);
    await page.goto('/settings?tab=appearance');

    await expect(page.getByRole('tab', { name: 'Appearance' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Settings section' })).toBeHidden();
    await expect(page.getByRole('navigation', { name: 'Appearance sections' })).toBeVisible();
  });
});
