import { expect, test, type Page } from '@playwright/test';

async function addAuroraFixtures(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('banner')).toBeVisible();
  await page.evaluate(() => {
    const widget = document.createElement('div');
    widget.dataset['testid'] = 'aurora-widget-fixture';
    widget.className = 'ss-aurora-bg';
    widget.style.width = '320px';
    widget.style.height = '180px';
    document.body.append(widget);

    const header = document.createElement('div');
    header.dataset['testid'] = 'aurora-header-fixture';
    header.className = 'header-anim-aurora-australis-bg';
    header.style.width = '640px';
    header.style.height = '72px';
    document.body.append(header);
  });
}

test('Aurora surfaces use layered animated curtain gradients', async ({ page }) => {
  await addAuroraFixtures(page);

  const styles = await page.evaluate(() => {
    const widget = document.querySelector<HTMLElement>('[data-testid="aurora-widget-fixture"]')!;
    const header = document.querySelector<HTMLElement>('[data-testid="aurora-header-fixture"]')!;
    const widgetCurtain = getComputedStyle(widget, '::before');
    const headerCurtain = getComputedStyle(header, '::after');
    return {
      widgetBackground: widgetCurtain.backgroundImage,
      widgetAnimation: widgetCurtain.animationName,
      headerBackground: headerCurtain.backgroundImage,
      headerAnimation: headerCurtain.animationName,
    };
  });

  expect(styles.widgetBackground.match(/radial-gradient/g)).toHaveLength(3);
  expect(styles.headerBackground.match(/radial-gradient/g)).toHaveLength(3);
  expect(styles.widgetAnimation).toBe('aurora-surface-drift');
  expect(styles.headerAnimation).toBe('aurora-curtain-drift');
});

test.describe('reduced motion', () => {
  test('Aurora curtain movement is disabled', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await addAuroraFixtures(page);

    const animations = await page.evaluate(() => {
      const widget = document.querySelector<HTMLElement>('[data-testid="aurora-widget-fixture"]')!;
      const header = document.querySelector<HTMLElement>('[data-testid="aurora-header-fixture"]')!;
      return {
        widget: getComputedStyle(widget, '::before').animationName,
        header: getComputedStyle(header, '::after').animationName,
      };
    });

    expect(animations).toEqual({ widget: 'none', header: 'none' });
  });
});
