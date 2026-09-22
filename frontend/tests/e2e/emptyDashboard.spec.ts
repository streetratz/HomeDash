import { expect, test, type Page } from '@playwright/test';

async function ensureAdminSession(page: Page) {
  const bootstrap = await page.request.get('/api/public/bootstrap');
  const state = (await bootstrap.json()) as { firstRunRequired: boolean };

  if (state.firstRunRequired) {
    const createAdmin = await page.request.post('/api/first-run/admin', {
      data: {
        username: 'admin',
        displayName: 'Admin',
        password: 'strongpassword1',
      },
    });
    expect(createAdmin.ok()).toBe(true);
  }

  const login = await page.request.post('/api/auth/login', {
    data: { username: 'admin', password: 'strongpassword1' },
  });
  expect(login.ok()).toBe(true);
}

test.describe('No-dashboard empty state', () => {
  test('offers admins a direct action without exposing it publicly', async ({ page }) => {
    await ensureAdminSession(page);
    await page.goto('/');

    const action = page.getByRole('link', { name: 'Open dashboard settings' });
    await expect(action).toBeVisible();
    await action.click();
    await expect(page).toHaveURL(/\/settings\?tab=dashboards$/);
    await expect(page.getByRole('heading', { name: 'Dashboards' })).toBeVisible();

    await page.context().clearCookies();
    await page.goto('/');
    await expect(page.getByText('No public dashboard has been configured yet.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open dashboard settings' })).toHaveCount(0);
  });
});
