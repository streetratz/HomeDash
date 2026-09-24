import { expectApiOk, expect, test } from './support/admin.js';
import { randomUUID } from 'node:crypto';

test.describe('Public widget visibility', () => {
  test('renders through the public namespace and disappears after revocation', async ({
    page,
    request,
    csrfToken,
  }) => {
    const headers = { 'x-csrf-token': csrfToken };
    const adminCookies = (await request.storageState()).cookies;

    const dashboardResponse = await request.post('/api/admin/dashboards', {
      headers,
      data: { name: `Public widget E2E ${Date.now()}` },
    });
    await expectApiOk(dashboardResponse, 'Create public dashboard');
    const dashboard = (await dashboardResponse.json()) as { id: string };

    const layoutResponse = await request.put(`/api/admin/dashboards/${dashboard.id}/layout`, {
      headers,
      data: {
        placeholders: [
          {
            stableKey: randomUUID(),
            x: 0,
            y: 0,
            w: 4,
            h: 3,
            widgets: [
              {
                type: 'app_shortcuts',
                orderIndex: 0,
                configJson: JSON.stringify({ columns: 4, iconSize: 'md', showLabels: true }),
                publicVisibility: 'visible',
              },
            ],
          },
        ],
      },
    });
    await expectApiOk(layoutResponse, 'Save public dashboard layout');
    const savedDashboard = (await layoutResponse.json()) as {
      placeholders: Array<{ widgets: Array<{ id: string }> }>;
    };
    const widgetId = savedDashboard.placeholders[0]?.widgets[0]?.id;
    expect(widgetId).toBeTruthy();

    const shortcutResponse = await request.post(`/api/admin/app-shortcuts/${widgetId}/shortcuts`, {
      headers,
      data: {
        name: 'Public Home Assistant',
        url: 'https://home.local',
        iconKey: 'home',
      },
    });
    await expectApiOk(shortcutResponse, 'Create public shortcut');

    const shellResponse = await request.put('/api/admin/shell', {
      headers,
      data: {
        unauthWebDashboardId: dashboard.id,
        unauthMobileDashboardId: dashboard.id,
      },
    });
    await expectApiOk(shellResponse, 'Set public dashboards');

    const requestedPaths: string[] = [];
    page.on('request', (browserRequest) => {
      requestedPaths.push(new URL(browserRequest.url()).pathname);
    });

    try {
      await page.context().clearCookies();
      await page.goto('/');

      await expect(page.getByRole('link', { name: 'Public Home Assistant' })).toBeVisible();
      expect(requestedPaths).toContain(`/api/public/widgets/${widgetId}`);
      expect(requestedPaths).not.toContain(`/api/app-shortcuts/${widgetId}/shortcuts`);
      expect(requestedPaths.some((path) => path.startsWith('/api/admin/'))).toBe(false);

      const revokeResponse = await request.put(`/api/admin/widgets/${widgetId}`, {
        headers,
        data: { publicVisibility: 'hidden' },
      });
      await expectApiOk(revokeResponse, 'Revoke public widget');

      await page.reload();
      await expect(page.getByRole('link', { name: 'Public Home Assistant' })).toHaveCount(0);
      const denied = await page.request.get(`/api/public/widgets/${widgetId}`);
      expect(denied.status()).toBe(404);

      await page.context().addCookies(adminCookies);
      await page.goto('/');
      await expect(page.getByRole('link', { name: 'Public Home Assistant' })).toBeVisible();
    } finally {
      const resetShell = await request.put('/api/admin/shell', {
        headers,
        data: { unauthWebDashboardId: null, unauthMobileDashboardId: null },
      });
      await expectApiOk(resetShell, 'Reset public dashboards');
      const deleteDashboard = await request.delete(`/api/admin/dashboards/${dashboard.id}`, {
        headers,
      });
      await expectApiOk(deleteDashboard, 'Delete public dashboard');
    }
  });
});
