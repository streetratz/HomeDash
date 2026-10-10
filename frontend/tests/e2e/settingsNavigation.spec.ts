import { expect, test } from '@playwright/test';

test.describe('Settings navigation', () => {
  test('desktop shows the grouped rail and marks the active leaf', async ({ page }) => {
    await page.goto('/settings?tab=branding');

    const rail = page.getByRole('navigation', { name: 'Settings sections' });
    await expect(rail).toBeVisible();
    await expect(rail.getByRole('button', { name: 'Branding' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    // The mobile drawer trigger is hidden on desktop.
    await expect(page.getByRole('button', { name: 'Open settings navigation' })).toBeHidden();
  });

  test('deep link to a flattened leaf survives reload', async ({ page }) => {
    await page.goto('/settings?tab=clock-strip');
    const rail = page.getByRole('navigation', { name: 'Settings sections' });
    await expect(rail.getByRole('button', { name: 'Clock Strip' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await page.reload();
    await expect(page).toHaveURL(/\/settings\?tab=clock-strip$/);
    await expect(rail.getByRole('button', { name: 'Clock Strip' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('integrations sub-panel is restored from the URL on reload', async ({ page }) => {
    await page.goto('/settings?tab=integrations&panel=sonos');

    const integrationSection = page.getByRole('navigation', { name: 'Integration sections' });
    await expect(integrationSection.getByRole('button', { name: 'Sonos' })).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(/\/settings\?tab=integrations&panel=sonos$/);
  });
});
