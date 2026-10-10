import { test, expect } from './support/admin.js';
import { collectionPresetSmoke } from './helpers/collectionPresetSmoke.js';
test('preset setup, existing Calendar, month detail and reload offline', async ({
  page,
  csrfToken,
  browser,
}) => {
  await collectionPresetSmoke(page, csrfToken, false);
  const anonymous = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  try {
    const response = await anonymous.request.get('/api/admin/calendar/collections');
    expect(response.status()).toBe(401);
  } finally {
    await anonymous.close();
  }
});
