import { expect, test } from '@playwright/test';

test.describe('No-dashboard empty state', () => {
  test('offers admins a direct action without exposing it publicly', async ({ page }) => {
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
