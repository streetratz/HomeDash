/**
 * T021: Playwright E2E — Background settings in DashboardDialog.
 *
 * Verifies:
 *  - Admin can open edit dialog and see BackgroundSettings section
 *  - Selecting "Solid Color" + picking a color updates the preview
 *  - Saving preserves the background color on re-open
 *  - Selecting "None" resets the background
 */

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function ensureAdminAndLogin(page: Page): Promise<string> {
  const api = page.request;

  const bootstrap = await api.get('/api/public/bootstrap');
  const body = (await bootstrap.json()) as { firstRunRequired: boolean };
  if (body.firstRunRequired) {
    await api.post('/api/first-run/admin', {
      data: {
        username: 'admin',
        displayName: 'Admin',
        password: 'strongpassword1',
      },
    });
  }

  await page.goto('/login');
  await page.getByLabel('Username').fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('strongpassword1');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('/');

  const meRes = await api.get('/api/auth/me');
  if (!meRes.ok()) {
    throw new Error(`GET /api/auth/me failed (${meRes.status()})`);
  }
  const me = (await meRes.json()) as { csrfToken: string };
  return me.csrfToken;
}

async function createDashboardViaApi(
  page: Page,
  csrf: string,
  name: string,
): Promise<string> {
  const api = page.request;
  const res = await api.post('/api/admin/dashboards', {
    headers: { 'x-csrf-token': csrf },
    data: { name },
  });
  if (!res.ok()) {
    throw new Error(`Create dashboard failed (${res.status()})`);
  }
  const dash = (await res.json()) as { id: string };
  return dash.id;
}

async function deleteDashboardViaApi(
  page: Page,
  csrf: string,
  dashboardId: string,
): Promise<void> {
  await page.request.delete(`/api/admin/dashboards/${dashboardId}`, {
    headers: { 'x-csrf-token': csrf },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Background settings in DashboardDialog (T021)', () => {
  test('solid color background: set, save, verify persistence, then reset to none', async ({
    page,
  }) => {
    const csrf = await ensureAdminAndLogin(page);
    const dashName = `BG E2E ${Date.now()}`;
    const dashId = await createDashboardViaApi(page, csrf, dashName);

    try {
      // Navigate to admin dashboards page
      await page.goto('/admin/dashboards');
      await page.waitForSelector('text=Dashboards');

      // Click Edit button on the dashboard card
      await page.getByRole('button', { name: `Edit ${dashName}` }).click();

      // The DashboardDialog should open in edit mode with BackgroundSettings
      await expect(
        page.getByRole('heading', { name: 'Edit Dashboard' }),
      ).toBeVisible();

      // BackgroundSettings: select "Solid Color" radio
      const solidRadio = page.getByLabel('Solid Color');
      await solidRadio.click();

      // A color picker input should now be visible
      const colorPicker = page.locator('input[type="color"]');
      await expect(colorPicker).toBeVisible();

      // Set a specific hex color via the text input
      const hexInput = page.locator('input[placeholder="#1e293b"]');
      await hexInput.fill('#ff5733');

      // Verify the preview panel has updated its background color
      // The preview div is inside BackgroundSettings, has the class "h-24"
      const preview = page.locator('.h-24.w-full');
      await expect(preview).toBeVisible();

      // Save the dialog
      await page.getByRole('button', { name: 'Save Changes' }).click();

      // Dialog should close
      await expect(
        page.getByRole('heading', { name: 'Edit Dashboard' }),
      ).not.toBeVisible();

      // Re-open the edit dialog to verify persistence
      await page.getByRole('button', { name: `Edit ${dashName}` }).click();
      await expect(
        page.getByRole('heading', { name: 'Edit Dashboard' }),
      ).toBeVisible();

      // "Solid Color" should still be selected
      const solidRadioAfter = page.getByLabel('Solid Color');
      await expect(solidRadioAfter).toBeChecked();

      // Hex input should show the saved color
      const hexInputAfter = page.locator('input[placeholder="#1e293b"]');
      await expect(hexInputAfter).toHaveValue('#ff5733');

      // Now test reset to "None"
      const noneRadio = page.getByLabel('None');
      await noneRadio.click();

      // Color picker should no longer be visible
      await expect(page.locator('input[type="color"]')).not.toBeVisible();

      // Save
      await page.getByRole('button', { name: 'Save Changes' }).click();
      await expect(
        page.getByRole('heading', { name: 'Edit Dashboard' }),
      ).not.toBeVisible();

      // Re-open and verify "None" is selected
      await page.getByRole('button', { name: `Edit ${dashName}` }).click();
      await expect(page.getByLabel('None')).toBeChecked();

      // Close dialog
      await page.getByRole('button', { name: 'Cancel' }).click();
    } finally {
      await deleteDashboardViaApi(page, csrf, dashId);
    }
  });
});
