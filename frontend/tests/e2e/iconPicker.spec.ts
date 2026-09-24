/**
 * T020 / T023: Playwright E2E — Icon rendering on dashboard & performance.
 *
 * Verifies:
 *  - A link with iconKey renders the correct Lucide icon (not default Globe)
 *  - A link with no iconKey renders the default Globe icon
 *  - (T023) If IconPicker is accessible, search performance is under 200ms
 *
 * NOTE: The IconPicker dialog is not yet wired into the main dashboard view.
 * These tests verify icon _rendering_ on the links_list widget instead.
 * Performance test for the IconPicker dialog is skipped until it's accessible
 * from the E2E flow.
 */

import { expectApiOk, expect, test } from './support/admin.js';
import type { Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a dashboard with a links_list widget containing two links:
 * one with a valid Lucide iconKey and one without (null).
 * Sets it as the user's preferred web dashboard.
 */
async function setupLinksListDashboard(page: Page, csrf: string): Promise<string> {
  const api = page.request;

  const dashRes = await api.post('/api/admin/dashboards', {
    headers: { 'x-csrf-token': csrf },
    data: { name: `Icon E2E ${Date.now()}` },
  });
  await expectApiOk(dashRes, 'Create icon dashboard');
  const dash = (await dashRes.json()) as { id: string };

  // Import a dashboard payload with links via the import endpoint
  const stableKey = randomUUID();
  const importRes = await api.post('/api/admin/dashboards/import', {
    headers: { 'x-csrf-token': csrf },
    data: {
      version: 1,
      dashboard: {
        name: `Icon Links E2E ${Date.now()}`,
        applicability: 'both',
        backgroundType: 'solid',
        backgroundColor: '#1e293b',
        backgroundDisplayMode: null,
      },
      placeholders: [
        {
          stableKey,
          x: 0,
          y: 0,
          w: 6,
          h: 4,
          borderColor: '#334155',
          title: null,
          opacity: 1,
          widgets: [
            {
              type: 'links_list',
              orderIndex: 0,
              configJson: '{"layout":"vertical"}',
            },
          ],
          links: [
            {
              title: 'GitHub Link',
              url: 'https://github.com',
              iconKey: 'House',
              iconOverrideKey: null,
              orderIndex: 0,
            },
            {
              title: 'Plain Link',
              url: 'https://example.com',
              iconKey: null,
              iconOverrideKey: null,
              orderIndex: 1,
            },
          ],
        },
      ],
    },
  });
  await expectApiOk(importRes, 'Import icon dashboard');
  const imported = (await importRes.json()) as { id: string };

  // Clean up the empty dashboard created above
  await api.delete(`/api/admin/dashboards/${dash.id}`, {
    headers: { 'x-csrf-token': csrf },
  });

  // Set as preferred web dashboard
  const prefRes = await api.put('/api/user/preferences', {
    headers: { 'x-csrf-token': csrf },
    data: { webDashboardId: imported.id },
  });
  await expectApiOk(prefRes, 'Set preferred dashboard');

  return imported.id;
}

async function cleanupDashboard(page: Page, csrf: string, dashboardId: string): Promise<void> {
  const api = page.request;
  await api.put('/api/user/preferences', {
    headers: { 'x-csrf-token': csrf },
    data: { webDashboardId: null },
  });
  await api.delete(`/api/admin/dashboards/${dashboardId}`, {
    headers: { 'x-csrf-token': csrf },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Icon rendering on links_list widget (T020)', () => {
  test('link with iconKey renders a non-Globe icon; link without iconKey renders Globe', async ({
    page,
    csrfToken,
  }) => {
    const dashId = await setupLinksListDashboard(page, csrfToken);

    try {
      await page.goto('/');
      // Wait for links to render
      await expect(page.locator('a[href="https://github.com"]')).toBeVisible({ timeout: 10_000 });

      // The GitHub link should have an SVG that is NOT the Globe icon.
      // Lucide Github icon has a specific path; we just verify an <svg> exists.
      const githubLink = page.locator('a[href="https://github.com"]');
      const githubSvg = githubLink.locator('svg').first();
      await expect(githubSvg).toBeVisible();

      // The Plain Link should also have an SVG (the Globe default).
      const plainLink = page.locator('a[href="https://example.com"]');
      const plainSvg = plainLink.locator('svg').first();
      await expect(plainSvg).toBeVisible();

      // Both links should render distinct icon SVGs.
      // We verify by checking that the SVG inner HTML is different between
      // the two links (Github icon vs Globe icon have different paths).
      const githubHtml = await githubSvg.innerHTML();
      const plainHtml = await plainSvg.innerHTML();
      expect(githubHtml).not.toBe(plainHtml);
    } finally {
      await cleanupDashboard(page, csrfToken, dashId);
    }
  });
});

test.describe('IconPicker performance (T023)', () => {
  // The IconPicker dialog is not yet accessible from the main E2E flow.
  // This test is skipped until the icon picker is integrated into the
  // dashboard edit UI where it can be triggered via a button.
  test.skip('icon search returns results within 200ms', async () => {
    // When IconPicker is accessible in the UI:
    // 1. Open the icon picker dialog
    // 2. Type a search term
    // 3. Measure time from keystroke to results update
    // 4. Assert < 200ms
  });
});
