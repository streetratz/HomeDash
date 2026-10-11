import { test, expect } from './support/admin.js';
import { resetCollectionsToEmpty } from './helpers/collections.js';

test('360px custom editor exposes seven keyboard-operable weekdays', async ({
  page,
  csrfToken,
}) => {
  await resetCollectionsToEmpty(page.request, csrfToken);
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto('/settings?tab=integrations');
  const integrationNav = page.getByRole('navigation', { name: 'Integration sections' });
  await integrationNav.getByRole('button', { expanded: false }).click();
  await integrationNav.getByRole('button', { name: 'Calendars', exact: true }).click();
  await page.getByRole('button', { name: 'Custom Events' }).click();
  const manager = page.getByRole('region', { name: 'Custom events' });
  await manager.getByRole('button', { name: 'Manage custom events' }).click();
  await manager.getByRole('button', { name: 'Add event', exact: true }).click();
  const editor = manager.getByRole('listitem', { name: /Custom event 1/ });
  await editor.getByRole('combobox', { name: 'Repeat', exact: true }).selectOption('weekly');
  await editor.getByRole('button', { name: 'Confirm repeat change' }).click();
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
  const title = editor.getByLabel('Event title', { exact: true });
  const beforeIcon = await title.boundingBox();
  const iconTrigger = editor.getByRole('button', { name: /Change icon for/ });
  await iconTrigger.click();
  const palette = page.getByRole('dialog', { name: /Icon for/ });
  await expect(palette).toBeVisible();
  expect(await title.boundingBox()).toEqual(beforeIcon);
  const paletteBox = await palette.boundingBox();
  expect(paletteBox!.x).toBeGreaterThanOrEqual(0);
  expect(paletteBox!.x + paletteBox!.width).toBeLessThanOrEqual(360);
  await palette.getByRole('button', { name: 'CalendarDays', exact: true }).click();
  await expect(palette).toBeHidden();
  await expect(iconTrigger).toBeFocused();
  await iconTrigger.click();
  await page.keyboard.press('Escape');
  await expect(palette).toBeHidden();
  await expect(iconTrigger).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await manager.getByRole('button', { name: 'Cancel', exact: true }).click();
});
