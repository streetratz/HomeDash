import { test, expect } from './support/admin.js';
test('360px custom editor exposes seven keyboard-operable weekdays', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto('/settings?tab=integrations');
  await page.getByRole('combobox', { name: 'Integration' }).click();
  await page.getByRole('option', { name: 'Calendars', exact: true }).click();
  await page.getByRole('button', { name: 'Edit collection configuration' }).click();
  const add = page.getByRole('button', { name: 'Add regular stream' });
  if (await add.isEnabled()) await add.click();
  const editor = page.getByRole('group', { name: /Collection stream/ }).last();
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const dayBoxes = await Promise.all(
    dayNames.map((name) =>
      editor.getByRole('checkbox', { name, exact: true }).locator('..').boundingBox(),
    ),
  );
  expect(dayBoxes.every((box) => box && box.y === dayBoxes[0]?.y && box.height >= 44)).toBe(true);
  const initiallyChecked = await editor.getByLabel('Thursday', { exact: true }).isChecked();
  await editor.getByLabel('Thursday', { exact: true }).focus();
  await page.keyboard.press('Space');
  await expect(editor.getByLabel('Thursday', { exact: true })).toBeChecked({
    checked: !initiallyChecked,
  });
  await editor.getByRole('button', { name: /Change colour/ }).click();
  await page.getByRole('button', { name: 'Select colour #22c55e' }).click();
  await expect(page.getByRole('textbox', { name: 'Custom hex colour' })).toHaveValue('#22c55e');
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
});
