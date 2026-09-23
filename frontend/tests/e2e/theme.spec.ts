/**
 * T064 (US2): Playwright E2E — theme toggle persists across page reloads.
 *
 * Scenarios:
 *  1. Unauthenticated user toggles theme → persists via localStorage after reload.
 *  2. Admin user toggles theme → persists server-side (survives reload + new tab).
 *
 * Note: These tests require a running HomeDash server and a completed first-run
 * (admin account already created). They are skipped automatically when
 * first-run is still required.
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

async function loginAsAdmin(
  page: Page
) {
  await page.goto('/login');
  await page.getByLabel('Username').fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('strongpassword1');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('/');
}

function isDarkMode(page: Page) {
  return page.evaluate(() => document.documentElement.classList.contains('dark'));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Theme toggle — unauthenticated user', () => {
  test('toggling theme persists in localStorage after page reload', async ({ page, request }) => {
    const ready = await completeFirstRunIfNeeded(page, request);
    if (!ready) {
      test.skip();
      return;
    }

    // Navigate to dashboard (no auth → unauth view)
    await page.goto('/');

    const toggle = page.getByTestId('theme-toggle');

    // Determine initial state
    const initiallyDark = await isDarkMode(page);
    const expectedAfterToggle = !initiallyDark;

    await toggle.click();

    // Verify the DOM class changed
    await expect
      .poll(() => isDarkMode(page))
      .toBe(expectedAfterToggle);

    // Verify localStorage was updated
    const storedTheme = await page.evaluate(() =>
      localStorage.getItem('homedash_theme')
    );
    expect(storedTheme).toBe(expectedAfterToggle ? 'dark' : 'light');

    // Reload and confirm theme is restored from localStorage
    await page.reload();
    await expect
      .poll(() => isDarkMode(page))
      .toBe(expectedAfterToggle);
  });
});

test.describe('Theme toggle — authenticated admin', () => {
  test('toggling theme persists server-side after page reload', async ({ page, request }) => {
    const ready = await completeFirstRunIfNeeded(page, request);
    if (!ready) {
      test.skip();
      return;
    }

    await loginAsAdmin(page);

    const toggle = page.getByTestId('theme-toggle');

    const initiallyDark = await isDarkMode(page);
    const expectedAfterToggle = !initiallyDark;

    await toggle.click();

    // DOM should update immediately
    await expect
      .poll(() => isDarkMode(page))
      .toBe(expectedAfterToggle);

    // Reload — server preference should restore the same theme
    await page.reload();
    await expect
      .poll(() => isDarkMode(page))
      .toBe(expectedAfterToggle);

    // Toggle back so we don't bleed state into other tests
    await toggle.click();
  });
});
