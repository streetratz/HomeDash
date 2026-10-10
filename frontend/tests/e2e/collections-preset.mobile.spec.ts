import { test } from './support/admin.js';
import { collectionPresetSmoke } from './helpers/collectionPresetSmoke.js';
test('360px WebKit preset reading and complete month detail', async ({ page, csrfToken }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await collectionPresetSmoke(page, csrfToken, true);
});
