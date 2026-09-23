/**
 * T065 (US2): Playwright E2E — admin can update shell settings and see changes
 * reflected in the header / footer immediately.
 *
 * Scenarios:
 *  1. Admin navigates to /settings → updates titleText → header reflects change.
 *  2. Admin updates footerText → footer reflects change.
 *  3. Admin enables clock strip → clock strip appears on dashboard.
 *
 * Note: These tests require a running HomeDash server with a completed first-run.
 * They reset modified settings at the end of each test.
 */

import { test, expect } from '@playwright/test';
import type { Page, APIRequestContext } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function completeFirstRunIfNeeded(
  page: Page,
  request: APIRequestContext
) {
  const res = await request.get('/api/bootstrap');
  if (!res.ok()) return false;
  const body = await res.json() as { firstRunRequired?: boolean };
  if (!body.firstRunRequired) return true;

  await page.goto('/');
  await page.waitForURL(/\/first-run/);
  await page.getByLabel('Username').fill('admin');
  await page.getByLabel('Display name').fill('Admin');
  await page.getByLabel('Password', { exact: true }).fill('strongpassword1');
  await page.getByTestId('first-run-submit').click();
  await page.waitForURL('/');
  return true;
}

async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Username').fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('strongpassword1');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('/');
}

async function navigateToSettings(page: Page) {
  // Open UserMenu and click Settings link
  const userMenu = page.getByTestId('user-menu');
  await userMenu.click();
  await page.getByTestId('settings-link').click();
  await page.waitForURL('/settings');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Shell settings — admin', () => {
  test('updating titleText reflects in shell header', async ({ page, request }) => {
    const ready = await completeFirstRunIfNeeded(page, request);
    if (!ready) {
      test.skip();
      return;
    }

    await loginAsAdmin(page);
    await navigateToSettings(page);

    const titleInput = page.getByTestId('shell-title-input');
    await titleInput.fill('My Homelab');

    await page.getByTestId('save-shell-settings').click();

    // Navigate back to dashboard
    await page.goto('/');

    // Header should now contain the new title
    await expect(page.getByRole('banner')).toContainText('My Homelab');

    // --- Cleanup: restore default title ---
    await navigateToSettings(page);
    await page.getByTestId('shell-title-input').fill('HomeDash');
    await page.getByTestId('save-shell-settings').click();
  });

  test('updating footerText reflects in footer', async ({ page, request }) => {
    const ready = await completeFirstRunIfNeeded(page, request);
    if (!ready) {
      test.skip();
      return;
    }

    await loginAsAdmin(page);
    await navigateToSettings(page);

    const footerInput = page.getByTestId('footer-text-input');
    await footerInput.fill('Powered by E2E');

    await page.getByTestId('save-shell-settings').click();

    await page.goto('/');

    await expect(page.getByRole('contentinfo')).toContainText('Powered by E2E');

    // --- Cleanup ---
    await navigateToSettings(page);
    await page.getByTestId('footer-text-input').fill('');
    await page.getByTestId('save-shell-settings').click();
  });

  test('enabling clock strip shows it on the dashboard', async ({ page, request }) => {
    const ready = await completeFirstRunIfNeeded(page, request);
    if (!ready) {
      test.skip();
      return;
    }

    await loginAsAdmin(page);
    await navigateToSettings(page);

    const clockToggle = page.getByTestId('clock-strip-toggle');

    // Ensure it is enabled (click only if currently off)
    const checked = await clockToggle.isChecked();
    if (!checked) {
      await clockToggle.click();
    }

    await page.getByTestId('save-shell-settings').click();

    await page.goto('/');

    // At least one clock should be visible
    await expect(page.getByTestId('clock-home').first()).toBeVisible();

    // --- Cleanup: disable clock strip ---
    await navigateToSettings(page);
    const toggleAfter = page.getByTestId('clock-strip-toggle');
    if (await toggleAfter.isChecked()) {
      await toggleAfter.click();
    }
    await page.getByTestId('save-shell-settings').click();
  });
});
