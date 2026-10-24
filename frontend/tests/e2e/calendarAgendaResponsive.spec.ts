import type { Locator, Page } from '@playwright/test';
import { test, expect, expectApiOk } from './support/admin.js';
import {
  previewAndSaveCollections,
  collectionAdminState,
  resetCollectionsToEmpty,
} from './helpers/collections.js';

const TIMEZONE = 'Australia/Sydney';
const SOURCE_ID = '7d0e5b5e-0c4c-4d7a-9a51-0e2b1f7c6a01';
const VIEWPORTS = [
  { name: 'phone-small', width: 360, height: 740 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'desktop', width: 1920, height: 1080 },
] as const;

function dateKey(offsetDays: number): string {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(new Date());
  const date = new Date(`${today}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function event(id: string, offsetDays: number, title: string, allDay = true) {
  const key = dateKey(offsetDays);
  return {
    id,
    sourceId: SOURCE_ID,
    providerEventId: id,
    title,
    description: null,
    location: null,
    startAt: allDay ? `${key}T00:00:00.000Z` : `${key}T03:00:00.000Z`,
    endAt: allDay ? `${key}T23:59:59.000Z` : `${key}T04:00:00.000Z`,
    startTz: null,
    endTz: null,
    isAllDay: allDay,
    isPrivate: false,
    recurrenceRule: null,
    calendarName: null,
  };
}

async function mockCalendarFeed(page: Page) {
  const now = new Date().toISOString();
  await page.route('**/api/user/calendar/sources', (route) =>
    route.fulfill({
      json: [
        {
          id: SOURCE_ID,
          oauthAccountId: null,
          type: 'ical',
          name: 'Synthetic birthdays',
          url: null,
          fileName: null,
          color: '#F59E0B',
          syncIntervalSeconds: 3600,
          lastSyncAt: now,
          lastSyncError: null,
          enabled: true,
          createdAt: now,
          updatedAt: now,
        },
      ],
    }),
  );
  await page.route('**/api/public/calendar/events?**', (route) =>
    route.fulfill({
      json: [
        event('e1', 0, 'Synthetic birthday one'),
        event('e2', 0, 'Synthetic birthday with a much longer name than usual'),
        event('e3', 2, 'Synthetic birthday two'),
        event('e4', 3, 'Synthetic grooming', false),
      ],
    }),
  );
}

async function computed(locator: Locator, property: string): Promise<string> {
  return locator.evaluate((el, prop) => getComputedStyle(el).getPropertyValue(prop), property);
}

function alpha(color: string): number {
  const match = /rgba?\(([^)]+)\)/.exec(color);
  if (!match) return 1;
  const parts = match[1]!.split(/[ ,/]+/).filter(Boolean);
  return parts.length === 4 ? Number(parts[3]) : 1;
}

async function expectUnboxed(section: Locator) {
  expect(await computed(section, 'border-top-width')).toBe('0px');
  expect(alpha(await computed(section, 'background-color'))).toBe(0);
}

for (const viewport of VIEWPORTS) {
  test.describe(`calendar agenda at ${viewport.name} (${viewport.width}x${viewport.height})`, () => {
    test.use({
      viewport: { width: viewport.width, height: viewport.height },
      timezoneId: TIMEZONE,
    });

    test('highlights Today without boxes and keeps the timeline aligned in light and dark', async ({
      page,
      csrfToken,
    }, testInfo) => {
      const headers = { 'x-csrf-token': csrfToken };
      const binDate = dateKey(2);
      const streamId = crypto.randomUUID();
      const state = (await collectionAdminState(page.request)) as {
        revision: number;
        runtimeEpoch: string;
        streams?: { id: string }[];
      };
      await previewAndSaveCollections(page.request, {
        expectedRevision: state.revision,
        runtimeEpoch: state.runtimeEpoch,
        timezone: TIMEZONE,
        providerLabel: null,
        streams: [
          {
            id: streamId,
            name: 'General waste',
            color: '#EF4444',
            icon: 'Trash2',
            enabled: true,
            schedule: {
              mode: 'regular',
              weekdays: [new Date(`${binDate}T00:00:00.000Z`).getUTCDay()],
              intervalWeeks: 1,
              anchorDate: binDate,
            },
            exceptions: [],
          },
        ],
        range: { from: dateKey(0), to: dateKey(28) },
        confirmations: {
          timezoneConfirmed: true,
          deletedStreamIds: (state.streams ?? []).map((s) => s.id),
          removedExceptionIds: [],
          clearedExplicitStreamIds: [],
        },
      });

      const dashboardResponse = await page.request.post('/api/admin/dashboards', {
        headers,
        data: { name: `Calendar responsive ${viewport.name}` },
      });
      await expectApiOk(dashboardResponse, 'Create calendar dashboard');
      const dashboard = (await dashboardResponse.json()) as { id: string };
      const previousPrefs = (await (await page.request.get('/api/user/preferences')).json()) as {
        themeMode?: 'light' | 'dark';
      };

      try {
        await expectApiOk(
          await page.request.put(`/api/admin/dashboards/${dashboard.id}/layout`, {
            headers,
            data: {
              placeholders: [
                {
                  stableKey: crypto.randomUUID(),
                  x: 0,
                  y: 0,
                  w: 6,
                  h: 10,
                  widgets: [
                    {
                      type: 'calendar',
                      orderIndex: 0,
                      configJson: JSON.stringify({
                        sourceIds: [SOURCE_ID],
                        collectionStreamIds: [streamId],
                        publicCollectionStreamIds: [],
                        daysAhead: 14,
                        maxEvents: 10,
                      }),
                    },
                  ],
                },
              ],
            },
          }),
          'Save calendar layout',
        );
        await mockCalendarFeed(page);

        for (const theme of ['light', 'dark'] as const) {
          await expectApiOk(
            await page.request.put('/api/user/preferences', {
              headers,
              data: {
                webDashboardId: dashboard.id,
                mobileDashboardId: dashboard.id,
                themeMode: theme,
              },
            }),
            `Set ${theme} theme`,
          );
          await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
          await page.goto('/');
          await expect
            .poll(() => page.evaluate(() => document.documentElement.classList.contains('dark')))
            .toBe(theme === 'dark');

          const today = page.locator('[aria-current="date"]');
          await expect(today).toHaveCount(1);
          await expect(today).toContainText('Today');
          await expect(today).toContainText('Synthetic birthday one');
          await expectUnboxed(today);

          const todayHeading = today.getByRole('heading');
          await expect(todayHeading).toContainText(/· Today/);
          expect(await computed(todayHeading.locator('.text-2xl'), 'font-size')).toBe('24px');

          const binDay = page
            .locator('section')
            .filter({ has: page.getByRole('list', { name: 'Next collection' }) });
          await expect(binDay).toHaveCount(1);
          await expect(binDay).toContainText('General waste');
          await expect(binDay).toContainText('Synthetic birthday two');
          await expectUnboxed(binDay);

          const laterHeading = page
            .locator('section:not([aria-current])')
            .filter({ hasText: 'Synthetic grooming' })
            .getByRole('heading')
            .locator('.text-lg');
          expect(alpha(await computed(laterHeading, 'color'))).toBeGreaterThanOrEqual(0.75);

          for (const row of await page.locator('section:has(> h4) li').all()) {
            expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(36);
            expect(await computed(row, 'border-top-width')).toBe('0px');
            expect(alpha(await computed(row, 'background-color'))).toBeLessThanOrEqual(0.1);
            const title = row.locator('.text-\\[15px\\]').first();
            expect(alpha(await computed(title, 'color'))).toBe(1);
          }
          for (const time of await page.locator('section:has(> h4) li .text-\\[13px\\]').all()) {
            expect(alpha(await computed(time, 'color'))).toBeGreaterThanOrEqual(0.7);
          }
          await expect(page.getByText(/Australia\/Sydney/)).toHaveCount(1);

          const days = page.locator('section:has(> h4)');
          const rails = page.locator('section:has(> h4) > .border-l-2');
          expect(await days.count()).toBeGreaterThanOrEqual(3);
          await expect(rails).toHaveCount(await days.count());
          for (const rail of await rails.all()) {
            const railBox = (await rail.boundingBox())!;
            const railCenter = railBox.x + 1;
            for (const dot of await rail.locator('.absolute.rounded-full').all()) {
              expect(await computed(dot, 'box-shadow')).toBe('none');
              const dotBox = (await dot.boundingBox())!;
              expect(Math.abs(dotBox.x + dotBox.width / 2 - railCenter)).toBeLessThanOrEqual(1.5);
            }
          }

          const todayBox = (await today.boundingBox())!;
          for (const title of await today.locator('li p.truncate').all()) {
            const box = (await title.boundingBox())!;
            expect(box.x + box.width).toBeLessThanOrEqual(todayBox.x + todayBox.width + 1);
          }
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
          ).toBe(true);

          const shot = testInfo.outputPath(`calendar-${viewport.name}-${theme}.png`);
          await today
            .locator('xpath=ancestor::div[contains(@class,"h-full")][1]')
            .screenshot({ path: shot });
          await testInfo.attach(`calendar-${viewport.name}-${theme}`, {
            path: shot,
            contentType: 'image/png',
          });
        }
      } finally {
        await page.request.put('/api/user/preferences', {
          headers,
          data: {
            webDashboardId: null,
            mobileDashboardId: null,
            themeMode: previousPrefs.themeMode ?? 'dark',
          },
        });
        await page.request.delete(`/api/admin/dashboards/${dashboard.id}`, { headers });
        await resetCollectionsToEmpty(page.request, csrfToken);
      }
    });
  });
}
