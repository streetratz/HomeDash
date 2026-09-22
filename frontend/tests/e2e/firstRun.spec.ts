/**
 * T043 (US1): Playwright smoke — first-run create admin then dashboard renders.
 *
 * Scenario: Fresh HomeDash install (no users).
 *   1. Navigate to / → auto-redirect to /first-run.
 *   2. Fill in the first-run admin form.
 *   3. Submit → redirect back to /.
 *   4. Verify header / main render (shell visible).
 *
 * Skips gracefully if first-run has already been completed on the target server.
 */

import { test, expect } from '@playwright/test';

test.describe('First-run flow', () => {
  test('redirects to /first-run, creates admin, and lands on dashboard shell', async ({
    page,
    request,
  }) => {
    // Check whether first-run is still required
    const bootstrapRes = await request.get('/api/public/bootstrap');
    expect(bootstrapRes.ok()).toBe(true);
    const bootstrap = await bootstrapRes.json() as { firstRunRequired: boolean };

    if (!bootstrap.firstRunRequired) {
      test.skip();
      return;
    }

    // Step 1: Navigate to / → should redirect to /first-run
    await page.goto('/');
    await expect(page).toHaveURL(/\/first-run/);

    // Step 2: Fill in the first-run form
    await page.getByLabel('Username').fill('admin');
    await page.getByLabel('Display name').fill('Admin');
    await page.getByLabel('Password').fill('strongpassword1');

    // Step 3: Submit
    await page.getByTestId('first-run-submit').click();

    // Step 4: Should land on the dashboard page (/)
    await expect(page).toHaveURL('/');

    // Step 5: Verify shell structure is visible (header / main)
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();

    // The user display name should appear in the header after login
    await expect(page.getByTestId('user-display-name')).toHaveText('Admin');
  });
});
