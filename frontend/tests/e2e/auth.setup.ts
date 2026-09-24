/**
 * T043 (US1): Playwright smoke — first-run create admin then dashboard renders.
 *
 * Scenario: Fresh HomeDash install (no users).
 *   1. Navigate to / → auto-redirect to /first-run.
 *   2. Fill in the first-run admin form.
 *   3. Submit → redirect back to /.
 *   4. Verify header / main render (shell visible).
 *
 * The self-starting harness guarantees a fresh data directory for this setup.
 */

import { test, expect } from '@playwright/test';
import { ADMIN_AUTH_STATE, expectApiOk } from './support/admin.js';

test.describe('Authenticated E2E setup', () => {
  test('completes first-run and stores the admin session', async ({ page, request }) => {
    const bootstrapRes = await request.get('/api/public/bootstrap');
    await expectApiOk(bootstrapRes, 'GET /api/public/bootstrap');
    const bootstrap = (await bootstrapRes.json()) as { firstRunRequired: boolean };
    expect(bootstrap.firstRunRequired).toBe(true);

    await page.goto('/');
    await expect(page).toHaveURL(/\/first-run/);

    await page.getByLabel('Username').fill('admin');
    await page.getByLabel('Display name').fill('Admin');
    await page.getByLabel('Password', { exact: true }).fill('strongpassword1');
    await page.getByTestId('first-run-submit').click();

    await expect(page).toHaveURL('/');
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByTestId('user-display-name')).toHaveText('Admin');
    await page.context().storageState({ path: ADMIN_AUTH_STATE });
  });
});
