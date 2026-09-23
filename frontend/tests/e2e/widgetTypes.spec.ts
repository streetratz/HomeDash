/**
 * T023 (US4): Playwright E2E — Clock/Date widget acceptance criteria.
 *
 * Verifies:
 *  - Live time updates (text changes within ~2s)
 *  - 12hr format shows AM/PM indicator
 *  - 24hr format shows HH:MM in 00:00–23:59 range
 *  - Default (unconfigured) timezone renders browser-local time
 *  - Configured timezone displays the timezone label
 *  - Invalid timezone string falls back gracefully (no crash)
 *
 * Uses page.request (shares cookies with page) for all API calls so a single
 * login via browser form establishes the session for both page navigation and
 * API setup/teardown.
 */

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Ensure admin account exists via API, then log in via the browser form.
 * Returns CSRF token obtained from a subsequent API login call (using
 * page.request which shares the browser session cookie).
 */
async function ensureAdminAndLogin(page: Page): Promise<string> {
  const api = page.request;

  // Create admin if first run
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

  // Login via browser form (sets session cookie in the page context)
  await page.goto('/login');
  await page.getByLabel('Username').fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('strongpassword1');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('/');

  // Fetch CSRF from /api/auth/me — page.request shares the page's cookies
  const meRes = await api.get('/api/auth/me');
  if (!meRes.ok()) {
    throw new Error(`GET /api/auth/me failed (${meRes.status()})`);
  }
  const me = (await meRes.json()) as { csrfToken: string };
  return me.csrfToken;
}

/**
 * Create a dashboard with a clock widget and set it as the user's preferred
 * web dashboard so that navigating to / will render it.
 */
async function setupClockDashboard(
  page: Page,
  csrf: string,
  clockConfig?: Record<string, unknown>,
): Promise<string> {
  const api = page.request;

  const dashRes = await api.post('/api/admin/dashboards', {
    headers: { 'x-csrf-token': csrf },
    data: { name: `Clock E2E ${Date.now()}` },
  });
  if (!dashRes.ok()) {
    const text = await dashRes.text();
    throw new Error(`Create dashboard failed (${dashRes.status()}): ${text}`);
  }
  const dash = (await dashRes.json()) as { id: string };

  const stableKey = randomUUID();
  const layoutRes = await api.put(
    `/api/admin/dashboards/${dash.id}/layout`,
    {
      headers: { 'x-csrf-token': csrf },
      data: {
        placeholders: [
          {
            stableKey,
            x: 0,
            y: 0,
            w: 6,
            h: 4,
            widgets: [
              {
                type: 'clock',
                orderIndex: 0,
                configJson: clockConfig
                  ? JSON.stringify(clockConfig)
                  : undefined,
              },
            ],
          },
        ],
      },
    },
  );
  expect(layoutRes.ok()).toBe(true);

  const prefRes = await api.put('/api/user/preferences', {
    headers: { 'x-csrf-token': csrf },
    data: {
      webDashboardId: dash.id,
      mobileDashboardId: dash.id,
    },
  });
  expect(prefRes.ok()).toBe(true);

  return dash.id;
}

async function cleanupDashboard(
  page: Page,
  csrf: string,
  dashboardId: string,
): Promise<void> {
  const api = page.request;
  await api.put('/api/user/preferences', {
    headers: { 'x-csrf-token': csrf },
    data: {
      webDashboardId: null,
      mobileDashboardId: null,
    },
  });
  await api.delete(`/api/admin/dashboards/${dashboardId}`, {
    headers: { 'x-csrf-token': csrf },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Clock/Date widget — E2E (US4)', () => {
  test('12hr clock shows AM/PM and updates live', async ({ page }) => {
    const csrf = await ensureAdminAndLogin(page);
    const dashId = await setupClockDashboard(page, csrf, {
      format: '12h',
      showDate: true,
      showSeconds: true,
    });

    try {
      await page.goto('/');

      const clockWidget = page.getByTestId('clock-widget').first();
      await expect(clockWidget).toBeVisible({ timeout: 10_000 });
      expect(await clockWidget.getAttribute('data-format')).toBe('12h');

      const timeEl = page.getByTestId('clock-time').first();
      await expect(timeEl).toBeVisible();

      // 12hr format must include AM or PM
      const timeText = await timeEl.textContent();
      expect(timeText).toMatch(/AM|PM/i);

      // Live update: capture text, wait ~2s, check it changed (seconds tick)
      const firstReading = await timeEl.textContent();
      await page.waitForTimeout(2_000);
      const secondReading = await timeEl.textContent();
      expect(secondReading).not.toBe(firstReading);

      // Date line should be visible
      await expect(page.getByTestId('clock-date').first()).toBeVisible();
    } finally {
      await cleanupDashboard(page, csrf, dashId);
    }
  });

  test('24hr clock shows time in HH:MM range', async ({ page }) => {
    const csrf = await ensureAdminAndLogin(page);
    const dashId = await setupClockDashboard(page, csrf, {
      format: '24h',
      showDate: false,
      showSeconds: false,
    });

    try {
      await page.goto('/');

      const clockWidget = page.getByTestId('clock-widget').first();
      await expect(clockWidget).toBeVisible({ timeout: 10_000 });
      expect(await clockWidget.getAttribute('data-format')).toBe('24h');

      const timeEl = page.getByTestId('clock-time').first();
      const timeText = (await timeEl.textContent()) ?? '';

      // 24hr: no AM/PM
      expect(timeText).not.toMatch(/AM|PM/i);

      // Match HH:MM pattern (leading zero may or may not be present)
      expect(timeText.trim()).toMatch(/^[0-2]?\d:[0-5]\d$/);

      // showDate: false → no date element
      await expect(page.getByTestId('clock-date')).not.toBeVisible();
    } finally {
      await cleanupDashboard(page, csrf, dashId);
    }
  });

  test('unconfigured timezone defaults to browser-local', async ({ page }) => {
    const csrf = await ensureAdminAndLogin(page);
    const dashId = await setupClockDashboard(page, csrf, {
      format: '12h',
      showDate: true,
      showSeconds: true,
    });

    try {
      await page.goto('/');

      const clockWidget = page.getByTestId('clock-widget').first();
      await expect(clockWidget).toBeVisible({ timeout: 10_000 });

      // data-timezone="local" means no timezone configured
      expect(await clockWidget.getAttribute('data-timezone')).toBe('local');

      // Timezone label should not render
      await expect(page.getByTestId('clock-timezone')).not.toBeVisible();
    } finally {
      await cleanupDashboard(page, csrf, dashId);
    }
  });

  test('configured timezone displays timezone label', async ({ page }) => {
    const csrf = await ensureAdminAndLogin(page);
    const dashId = await setupClockDashboard(page, csrf, {
      timezone: 'America/New_York',
      format: '12h',
      showDate: true,
      showSeconds: true,
    });

    try {
      await page.goto('/');

      const clockWidget = page.getByTestId('clock-widget').first();
      await expect(clockWidget).toBeVisible({ timeout: 10_000 });

      expect(await clockWidget.getAttribute('data-timezone')).toBe(
        'America/New_York',
      );

      const tzLabel = page.getByTestId('clock-timezone').first();
      await expect(tzLabel).toBeVisible();
      await expect(tzLabel).toHaveText('America/New York');
    } finally {
      await cleanupDashboard(page, csrf, dashId);
    }
  });

  test('invalid timezone falls back gracefully (no crash)', async ({
    page,
  }) => {
    const csrf = await ensureAdminAndLogin(page);
    const dashId = await setupClockDashboard(page, csrf, {
      timezone: 'Invalid/Timezone_XYZ',
      format: '12h',
      showDate: true,
      showSeconds: true,
    });

    try {
      await page.goto('/');

      // Page should not crash
      await expect(page.getByRole('main')).toBeVisible({ timeout: 10_000 });
    } finally {
      await cleanupDashboard(page, csrf, dashId);
    }
  });
});
