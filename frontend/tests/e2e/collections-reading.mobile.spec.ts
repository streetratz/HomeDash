import { test } from './support/admin.js';
import { collectionReadingSmoke } from './helpers/collectionReadingSmoke.js';
test.use({ timezoneId: 'Pacific/Auckland' });
test('360px WebKit crowded names, keyboard and light-dark reduced motion', async ({ page, csrfToken }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await collectionReadingSmoke(page, csrfToken);
});
