/**
 * T021: Playwright E2E — Background settings in DashboardDialog.
 *
 * Verifies:
 *  - Admin can open edit dialog and see BackgroundSettings section
 *  - Selecting "Solid Color" + picking a color updates the preview
 *  - Saving preserves the background color on re-open
 *  - Selecting "None" resets the background
 */

import { expectApiOk, expect, test } from './support/admin.js';
import type { Page } from '@playwright/test';

async function createDashboardViaApi(page: Page, csrf: string, name: string): Promise<string> {
  const api = page.request;
  const res = await api.post('/api/admin/dashboards', {
    headers: { 'x-csrf-token': csrf },
    data: { name },
  });
  await expectApiOk(res, 'Create dashboard');
  const dash = (await res.json()) as { id: string };
  return dash.id;
}

async function deleteDashboardViaApi(page: Page, csrf: string, dashboardId: string): Promise<void> {
  const response = await page.request.delete(`/api/admin/dashboards/${dashboardId}`, {
    headers: { 'x-csrf-token': csrf },
  });
  await expectApiOk(response, 'Delete dashboard');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Background settings in DashboardDialog (T021)', () => {
  test('solid color background: set, save, verify persistence, then reset to none', async ({
    page,
    csrfToken,
  }) => {
    const dashName = `BG E2E ${Date.now()}`;
    const dashId = await createDashboardViaApi(page, csrfToken, dashName);
    let completed = false;

    try {
      // Navigate to admin dashboards page
      await page.goto('/admin/dashboards');
      await expect(page.getByRole('heading', { name: 'Dashboards', level: 2 })).toBeVisible();

      // Click Edit button on the dashboard card
      await page.getByRole('button', { name: `Edit ${dashName}` }).click();

      // The DashboardDialog should open in edit mode with BackgroundSettings
      await expect(page.getByRole('heading', { name: 'Edit Dashboard' })).toBeVisible();

      // BackgroundSettings: select "Solid Color" radio
      const solidRadio = page.getByLabel('Solid Color');
      await solidRadio.click();

      const colorButton = page.getByRole('button', { name: 'Change color' });
      await colorButton.click();

      // A color picker input should now be visible
      const colorPicker = page.locator('input[type="color"]');
      await expect(colorPicker).toBeVisible();

      // Set a specific hex color via the text input
      const hexInput = page.locator('input[placeholder="#3b82f6"]');
      await hexInput.fill('#ff5733');

      await expect(colorButton).toHaveCSS('background-color', 'rgb(255, 87, 51)');
      await page.keyboard.press('Escape');

      // Save the dialog
      await page.getByRole('button', { name: 'Save Changes' }).click();

      // Dialog should close
      await expect(page.getByRole('heading', { name: 'Edit Dashboard' })).not.toBeVisible();

      // Re-open the edit dialog to verify persistence
      await page.getByRole('button', { name: `Edit ${dashName}` }).click();
      await expect(page.getByRole('heading', { name: 'Edit Dashboard' })).toBeVisible();

      // "Solid Color" should still be selected
      const solidRadioAfter = page.getByLabel('Solid Color');
      await expect(solidRadioAfter).toBeChecked();

      // Hex input should show the saved color
      await page.getByRole('button', { name: 'Change color' }).click();
      const hexInputAfter = page.locator('input[placeholder="#3b82f6"]');
      await expect(hexInputAfter).toHaveValue('#ff5733');
      await page.keyboard.press('Escape');

      // Now test reset to "None"
      const noneRadio = page.getByLabel('None');
      await noneRadio.click();

      // Color picker should no longer be visible
      await expect(page.locator('input[type="color"]')).not.toBeVisible();

      // Save
      await page.getByRole('button', { name: 'Save Changes' }).click();
      await expect(page.getByRole('heading', { name: 'Edit Dashboard' })).not.toBeVisible();

      // Re-open and verify "None" is selected
      await page.getByRole('button', { name: `Edit ${dashName}` }).click();
      await expect(page.getByLabel('None')).toBeChecked();

      // Close dialog
      await page.getByRole('button', { name: 'Cancel' }).click();
      completed = true;
    } finally {
      if (completed) {
        await deleteDashboardViaApi(page, csrfToken, dashId);
      }
    }
  });
});
