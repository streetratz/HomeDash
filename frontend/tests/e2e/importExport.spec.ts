/**
 * T022: Playwright E2E — Dashboard import/export flow.
 *
 * Verifies:
 *  - Export button triggers a JSON download with correct structure
 *  - Import dialog opens, accepts a JSON file, shows preview stats
 *  - Successful import creates the dashboard
 *  - Name conflict triggers the conflict resolution UI
 */

import { expectApiOk, expect, test } from './support/admin.js';
import type { Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import * as fs from 'node:fs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a dashboard with content via API for export testing. */
async function createDashboardWithContent(page: Page, csrf: string, name: string): Promise<string> {
  const api = page.request;
  const stableKey = randomUUID();

  const importRes = await api.post('/api/admin/dashboards/import', {
    headers: { 'x-csrf-token': csrf },
    data: {
      version: 1,
      dashboard: {
        name,
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
          title: 'Test Placeholder',
          opacity: 1,
          widgets: [
            {
              type: 'clock',
              orderIndex: 0,
              configJson: '{}',
            },
          ],
          links: [
            {
              title: 'Example',
              url: 'https://example.com',
              iconKey: null,
              iconOverrideKey: null,
              orderIndex: 0,
            },
          ],
        },
      ],
    },
  });
  await expectApiOk(importRes, 'Import dashboard fixture');
  return ((await importRes.json()) as { id: string }).id;
}

async function deleteDashboardViaApi(page: Page, csrf: string, dashboardId: string): Promise<void> {
  const response = await page.request.delete(`/api/admin/dashboards/${dashboardId}`, {
    headers: { 'x-csrf-token': csrf },
  });
  await expectApiOk(response, 'Delete dashboard fixture');
}

/** Delete a dashboard by name via list + delete. */
async function deleteDashboardByName(page: Page, csrf: string, name: string): Promise<void> {
  const api = page.request;
  const listRes = await api.get('/api/admin/dashboards');
  if (!listRes.ok()) return;
  const dashboards = (await listRes.json()) as Array<{
    id: string;
    name: string;
  }>;
  const match = dashboards.find((d) => d.name === name);
  if (match) {
    await api.delete(`/api/admin/dashboards/${match.id}`, {
      headers: { 'x-csrf-token': csrf },
    });
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Dashboard Import/Export E2E (T022)', () => {
  test('export downloads valid JSON; import re-creates it', async ({ page, csrfToken }) => {
    const dashName = `Export E2E ${Date.now()}`;
    const dashId = await createDashboardWithContent(page, csrfToken, dashName);
    let completed = false;

    try {
      await page.goto('/admin/dashboards');
      await expect(page.getByRole('heading', { name: 'Dashboards', level: 2 })).toBeVisible();

      // --- Export ---
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: `Export ${dashName}` }).click();
      const download = await downloadPromise;

      // Verify filename pattern
      expect(download.suggestedFilename()).toMatch(/-export\.json$/);

      // Read and validate the downloaded JSON
      const downloadPath = await download.path();
      if (!downloadPath) throw new Error('Download path is null');
      const content = fs.readFileSync(downloadPath, 'utf-8');
      const exported = JSON.parse(content) as {
        version: number;
        dashboard: { name: string; applicability: string };
        placeholders: Array<{
          stableKey: string;
          widgets: Array<{ links?: unknown[] }>;
          links?: unknown[];
        }>;
      };

      expect(exported.version).toBe(2);
      expect(exported.dashboard.name).toBe(dashName);
      expect(exported.dashboard.applicability).toBe('both');
      expect(exported.placeholders).toHaveLength(1);
      expect(exported.placeholders[0]!.widgets.length).toBeGreaterThan(0);
      expect(
        exported.placeholders[0]!.widgets.flatMap((widget) => widget.links ?? []),
      ).not.toHaveLength(0);

      // --- Import the exported file ---
      // Open import dialog
      await page.getByRole('button', { name: 'Import', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Import Dashboard' })).toBeVisible();

      // Upload the exported JSON
      const fileInput = page.locator('input[type="file"]');
      // Write the exported content to a temp location within the project
      const importFilePath = path.join(process.cwd(), `test-import-${Date.now()}.json`);
      // Modify the name to avoid conflict
      const importPayload = {
        ...exported,
        dashboard: { ...exported.dashboard, name: `${dashName} (Imported)` },
      };
      fs.writeFileSync(importFilePath, JSON.stringify(importPayload));

      try {
        await fileInput.setInputFiles(importFilePath);

        // Preview should show stats
        await expect(page.getByText(/1 placeholder/)).toBeVisible();
        await expect(page.getByText(/1 link/)).toBeVisible();

        // Click Import
        await page.getByRole('button', { name: 'Import' }).click();

        // Dialog should close on success
        await expect(page.getByRole('heading', { name: 'Import Dashboard' })).not.toBeVisible({
          timeout: 10_000,
        });

        // The imported dashboard should appear in the list
        await expect(page.getByText(`${dashName} (Imported)`, { exact: true })).toBeVisible();
        completed = true;
      } finally {
        // Clean up temp file
        if (fs.existsSync(importFilePath)) {
          fs.unlinkSync(importFilePath);
        }
        // Clean up imported dashboard
        if (completed) {
          await deleteDashboardByName(page, csrfToken, `${dashName} (Imported)`);
        }
      }
    } finally {
      if (completed) {
        await deleteDashboardViaApi(page, csrfToken, dashId);
      }
    }
  });

  test('import with name conflict shows conflict resolution UI', async ({ page, csrfToken }) => {
    const dashName = `Conflict E2E ${Date.now()}`;
    const dashId = await createDashboardWithContent(page, csrfToken, dashName);
    let completed = false;

    try {
      await page.goto('/admin/dashboards');
      await expect(page.getByRole('heading', { name: 'Dashboards', level: 2 })).toBeVisible();

      // Create a JSON file with the same dashboard name to cause a conflict
      const conflictPayload = {
        version: 1,
        dashboard: {
          name: dashName,
          applicability: 'both',
          backgroundType: 'solid',
          backgroundColor: '#ffffff',
          backgroundDisplayMode: null,
        },
        placeholders: [],
      };
      const conflictFilePath = path.join(process.cwd(), `test-conflict-${Date.now()}.json`);
      fs.writeFileSync(conflictFilePath, JSON.stringify(conflictPayload));

      try {
        // Open import dialog
        await page.getByRole('button', { name: 'Import', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Import Dashboard' })).toBeVisible();

        // Upload the conflicting file
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(conflictFilePath);

        // Click Import to trigger the conflict
        await page.getByRole('button', { name: 'Import' }).click();

        // Should see conflict warning with the existing name
        await expect(page.getByText(/already exists/i)).toBeVisible({ timeout: 10_000 });

        // Override name input should be visible
        const overrideInput = page.locator('#override-name');
        await expect(overrideInput).toBeVisible();

        // Enter an alternative name
        const altName = `${dashName} (Alt)`;
        await overrideInput.fill(altName);

        // Re-click Import with the override name
        await page.getByRole('button', { name: 'Import' }).click();

        // Dialog should close on success
        await expect(page.getByRole('heading', { name: 'Import Dashboard' })).not.toBeVisible({
          timeout: 10_000,
        });

        // The imported dashboard with alt name should appear
        await expect(page.getByText(altName, { exact: true })).toBeVisible();

        // Clean up alt dashboard
        await deleteDashboardByName(page, csrfToken, altName);
        completed = true;
      } finally {
        if (fs.existsSync(conflictFilePath)) {
          fs.unlinkSync(conflictFilePath);
        }
      }
    } finally {
      if (completed) {
        await deleteDashboardViaApi(page, csrfToken, dashId);
      }
    }
  });
});
