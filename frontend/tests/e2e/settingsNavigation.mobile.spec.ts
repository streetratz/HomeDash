import { expect, test } from '@playwright/test';

test.describe('Settings navigation', () => {
  test('mobile drawer flattens appearance panels into direct destinations', async ({ page }) => {
    await page.goto('/settings');

    const trigger = page.getByRole('button', { name: 'Open settings navigation' });
    await trigger.click();

    const drawer = page.getByRole('navigation', { name: 'Settings sections' });
    await drawer.getByRole('button', { name: 'Clock Strip' }).click();

    await expect(page).toHaveURL(/\/settings\?tab=clock-strip$/);
    await expect(page.getByRole('heading', { name: 'Clock Strip', level: 3 })).toBeVisible();
  });

  test('mobile integrations sub-panel selection persists in the URL', async ({ page }) => {
    await page.goto('/settings?tab=integrations');

    const integrationNav = page.getByRole('navigation', { name: 'Integration sections' });

    // Mobile renders a grouped disclosure: open it before the grouped list is reachable.
    await integrationNav.getByRole('button', { expanded: false }).click();
    await integrationNav.getByRole('button', { name: 'Sonos', exact: true }).click();

    await expect(page).toHaveURL(/\/settings\?tab=integrations&panel=sonos$/);
    // Selecting collapses the disclosure; the trigger now reflects the active trail.
    await expect(integrationNav.getByRole('button', { name: 'Media Sonos' })).toBeVisible();
  });
});
