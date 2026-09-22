import { expect, test, type APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';

async function ensureAdminAndLogin(request: APIRequestContext): Promise<string> {
  const bootstrap = await request.get('/api/public/bootstrap');
  const state = (await bootstrap.json()) as { firstRunRequired: boolean };
  if (state.firstRunRequired) {
    const create = await request.post('/api/first-run/admin', {
      data: {
        username: 'admin',
        displayName: 'Admin',
        password: 'strongpassword1',
      },
    });
    expect([201, 409]).toContain(create.status());
  }

  const login = await request.post('/api/auth/login', {
    data: { username: 'admin', password: 'strongpassword1' },
  });
  expect(login.ok()).toBe(true);
  return ((await login.json()) as { csrfToken: string }).csrfToken;
}

test.describe('Public widget visibility', () => {
  test('renders through the public namespace and disappears after revocation', async ({
    page,
    request,
  }) => {
    const csrf = await ensureAdminAndLogin(request);
    const headers = { 'x-csrf-token': csrf };

    const dashboardResponse = await request.post('/api/admin/dashboards', {
      headers,
      data: { name: `Public widget E2E ${Date.now()}` },
    });
    expect(dashboardResponse.ok()).toBe(true);
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
    expect(layoutResponse.ok()).toBe(true);
    const savedDashboard = (await layoutResponse.json()) as {
      placeholders: Array<{ widgets: Array<{ id: string }> }>;
    };
    const widgetId = savedDashboard.placeholders[0]?.widgets[0]?.id;
    expect(widgetId).toBeTruthy();

    const shortcutResponse = await request.post(
      `/api/admin/app-shortcuts/${widgetId}/shortcuts`,
      {
        headers,
        data: {
          name: 'Public Home Assistant',
          url: 'https://home.local',
          iconKey: 'home',
        },
      },
    );
    expect(shortcutResponse.ok()).toBe(true);

    const shellResponse = await request.put('/api/admin/shell', {
      headers,
      data: {
        unauthWebDashboardId: dashboard.id,
        unauthMobileDashboardId: dashboard.id,
      },
    });
    expect(shellResponse.ok()).toBe(true);

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
      expect(revokeResponse.ok()).toBe(true);

      await page.reload();
      await expect(page.getByRole('link', { name: 'Public Home Assistant' })).toHaveCount(0);
      const denied = await page.request.get(`/api/public/widgets/${widgetId}`);
      expect(denied.status()).toBe(404);

      await page.goto('/login');
      await page.getByLabel('Username').fill('admin');
      await page.getByLabel('Password').fill('strongpassword1');
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.waitForURL('/');
      await expect(page.getByRole('link', { name: 'Public Home Assistant' })).toBeVisible();
    } finally {
      await request.put('/api/admin/shell', {
        headers,
        data: { unauthWebDashboardId: null, unauthMobileDashboardId: null },
      });
      await request.delete(`/api/admin/dashboards/${dashboard.id}`, { headers });
    }
  });
});
