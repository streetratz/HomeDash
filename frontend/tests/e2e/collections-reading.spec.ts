import { test } from './support/admin.js';
import { collectionReadingSmoke } from './helpers/collectionReadingSmoke.js';
test.use({ timezoneId: 'America/Los_Angeles' });
test('foreign visitor sees all 32 complete named collections and restored dialog focus', async ({ page, csrfToken }) => {
  await collectionReadingSmoke(page, csrfToken);
});
