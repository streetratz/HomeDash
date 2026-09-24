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
import type { Page } from '@playwright/test';

async function openAppearancePanel(page: Page, panelName: string) {
  await page.goto('/settings?tab=appearance');
  const navigation = page.getByRole('navigation', { name: 'Appearance sections' });
  await navigation.getByRole('button', { name: panelName, exact: true }).click();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Shell settings — admin', () => {
  test('updating titleText reflects in shell header', async ({ page }) => {
    await openAppearancePanel(page, 'Branding');

    const titleInput = page.getByLabel('Site title');
    await titleInput.fill('My Homelab');

    await page.getByRole('button', { name: 'Save Branding' }).click();

    // Navigate back to dashboard
    await page.goto('/');

    // Header should now contain the new title
    await expect(page.getByRole('banner')).toContainText('My Homelab');

    // --- Cleanup: restore default title ---
    await openAppearancePanel(page, 'Branding');
    await page.getByLabel('Site title').fill('HomeDash');
    await page.getByRole('button', { name: 'Save Branding' }).click();
  });

  test('updating footerText reflects in footer', async ({ page }) => {
    await openAppearancePanel(page, 'Header & Footer');

    const footerInput = page.getByLabel('Footer text');
    await footerInput.fill('Powered by E2E');

    await page.getByRole('button', { name: 'Save', exact: true }).click();

    await page.goto('/');

    await expect(page.getByRole('contentinfo')).toContainText('Powered by E2E');

    // --- Cleanup ---
    await openAppearancePanel(page, 'Header & Footer');
    await page.getByLabel('Footer text').fill('');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
  });

  test('enabling clock strip shows it on the dashboard', async ({ page }) => {
    await openAppearancePanel(page, 'Clock Strip');

    const clockToggle = page.getByRole('switch', { name: 'Clock strip enabled' });
    await page.getByLabel('Timezone', { exact: true }).fill('UTC');

    // Ensure it is enabled (click only if currently off)
    const checked = await clockToggle.isChecked();
    if (!checked) {
      await clockToggle.click();
    }

    await page.getByRole('button', { name: 'Save Clock Strip' }).click();

    await page.goto('/');

    // At least one clock should be visible
    await expect(page.getByTestId('clock-home').first()).toBeVisible();

    // --- Cleanup: disable clock strip ---
    await openAppearancePanel(page, 'Clock Strip');
    const toggleAfter = page.getByRole('switch', { name: 'Clock strip enabled' });
    if (await toggleAfter.isChecked()) {
      await toggleAfter.click();
    }
    await page.getByLabel('Timezone', { exact: true }).fill('');
    await page.getByRole('button', { name: 'Save Clock Strip' }).click();
  });
});
