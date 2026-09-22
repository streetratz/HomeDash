/**
 * T044 (US1): Playwright smoke — unauth view renders read-only dashboard.
 *
 * Scenario: Admin account exists (created via first-run or seeded).
 *   1. Ensure the server is past first-run (admin exists).
 *   2. In a fresh browser context (no session cookie), navigate to /.
 *   3. Verify it does NOT redirect to /first-run.
 *   4. Verify shell (header + main) is visible.
 *   5. Verify login link is visible and no user nav is shown.
 */

import { test, expect, type Locator, type Page } from '@playwright/test';

async function getVisibleLoginLink(page: Page): Promise<Locator> {
  await expect(page.getByRole('banner')).toBeVisible();
  const desktopLogin = page.getByTestId('login-link');
  if (await desktopLogin.isVisible()) {
    return desktopLogin;
  }

  await page.getByRole('button', { name: 'Open menu' }).click();
  return page
    .getByRole('navigation', { name: 'Mobile navigation' })
    .getByRole('link', { name: 'Login' });
}

test.describe('Unauthenticated view', () => {
  // Ensure an admin account exists before testing the unauth view
  test.beforeAll(async ({ request }) => {
    const bootstrapRes = await request.get('/api/public/bootstrap');
    expect(bootstrapRes.ok()).toBe(true);
    const bootstrap = (await bootstrapRes.json()) as { firstRunRequired: boolean };

    if (bootstrap.firstRunRequired) {
      // Create admin via API so the unauth view is reachable
      const res = await request.post('/api/first-run/admin', {
        data: { username: 'admin', displayName: 'Admin', password: 'strongpassword1' },
      });
      // 201 Created or 409 Conflict (already exists) are both acceptable
      expect([201, 409]).toContain(res.status());
    }
  });

  test('shows read-only dashboard shell without redirecting to first-run', async ({ page }) => {
    // Clear any cookies to ensure we're unauthenticated
    await page.context().clearCookies();

    // Navigate to root
    await page.goto('/');

    // Should NOT redirect to /first-run (admin already exists)
    await expect(page).toHaveURL('/');

    // Shell structure should be visible
    await expect(page.getByRole('banner')).toBeVisible(); // header
    await expect(page.getByRole('main')).toBeVisible(); // main content

    // Login remains reachable directly on desktop and through the mobile menu.
    const loginLink = await getVisibleLoginLink(page);
    await expect(loginLink).toBeVisible();

    // Logout button should NOT be present (not authenticated)
    await expect(page.getByTestId('logout-button')).not.toBeVisible();
  });

  test('login page is accessible from the login link', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/');

    const loginLink = await getVisibleLoginLink(page);
    await loginLink.click();
    await expect(page).toHaveURL(/\/login/);

    await expect(page.getByTestId('login-form')).toBeVisible();

    const password = page.locator('input[name="password"]');
    await password.fill('typed-password');
    await page.getByRole('button', { name: 'Show password' }).click();
    await expect(password).toHaveAttribute('type', 'text');
    await expect(password).toHaveValue('typed-password');

    await page.getByRole('button', { name: 'Hide password' }).click();
    await expect(password).toHaveAttribute('type', 'password');
    await expect(password).toHaveValue('typed-password');
  });
});
