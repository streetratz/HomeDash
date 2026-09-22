import { expect, test, type Page } from '@playwright/test';

async function ensureAdminSession(page: Page): Promise<string> {
  const bootstrap = await page.request.get('/api/public/bootstrap');
  const state = (await bootstrap.json()) as { firstRunRequired: boolean };

  if (state.firstRunRequired) {
    const createAdmin = await page.request.post('/api/first-run/admin', {
      data: {
        username: 'admin',
        displayName: 'Admin',
        password: 'strongpassword1',
      },
    });
    expect(createAdmin.ok()).toBe(true);
  }

  const login = await page.request.post('/api/auth/login', {
    data: { username: 'admin', password: 'strongpassword1' },
  });
  expect(login.ok()).toBe(true);
  return ((await login.json()) as { csrfToken: string }).csrfToken;
}

test.describe('Scheduled Jobs responsive layout', () => {
  test('keeps job status and actions visible on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const csrf = await ensureAdminSession(page);
    const jobName = `Mobile E2E Job ${Date.now()}`;
    const createJob = await page.request.post('/api/admin/scheduled-jobs', {
      headers: { 'x-csrf-token': csrf },
      data: {
        name: jobName,
        actionType: 'calendar_sync',
        actionParams: '{}',
        cronExpression: '0 * * * *',
        enabled: true,
      },
    });
    expect(createJob.ok()).toBe(true);
    const job = (await createJob.json()) as { id: string };

    try {
      await page.goto('/settings?tab=system');

      const card = page.getByRole('region', { name: jobName });
      await expect(card).toBeVisible();
      await expect(card.getByText('Every hour')).toBeVisible();
      await expect(card.getByRole('switch', { name: 'Enabled' })).toBeVisible();
      await expect(card.getByRole('button', { name: `Run ${jobName} now` })).toBeVisible();
      await expect(card.getByRole('button', { name: `Edit ${jobName}` })).toBeVisible();
      await expect(card.getByRole('button', { name: `Delete ${jobName}` })).toBeVisible();

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBe(0);
    } finally {
      await page.request.delete(`/api/admin/scheduled-jobs/${job.id}`, {
        headers: { 'x-csrf-token': csrf },
      });
    }
  });
});
