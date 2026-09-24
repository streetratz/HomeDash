import { expect, test } from './support/admin.js';

test.describe('Scheduled Jobs responsive layout', () => {
  test('keeps job status and actions visible on mobile', async ({ page, csrfToken }) => {
    const jobName = `Mobile E2E Job ${Date.now()}`;
    const createJob = await page.request.post('/api/admin/scheduled-jobs', {
      headers: { 'x-csrf-token': csrfToken },
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
        headers: { 'x-csrf-token': csrfToken },
      });
    }
  });
});
