import { test } from './support/admin.js';
import { collectionIrregularSmoke } from './helpers/collectionIrregularSmoke.js';
test('360px WebKit holiday move and explicit dates with destructive confirmation', async ({ page, csrfToken }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await collectionIrregularSmoke(page, csrfToken, true);
});
