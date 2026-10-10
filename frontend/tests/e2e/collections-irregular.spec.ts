import { test } from './support/admin.js';
import { collectionIrregularSmoke } from './helpers/collectionIrregularSmoke.js';
test('holiday move followed by deliberate explicit switch persists only finite dates', async ({ page, csrfToken }) => {
  await collectionIrregularSmoke(page, csrfToken, false);
});
