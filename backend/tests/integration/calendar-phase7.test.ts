/**
 * Phase 7 (T034-T039): Calendar widget integration tests.
 *
 * Covers public endpoints, private event filtering, iCal sync E2E,
 * config validation, and cross-user security.
 */

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  createTestApp,
  extractCookies,
  extractCsrfToken,
  csrfHeader,
  type TestApp,
} from '../helpers/http.js';
import { getDb } from '../../src/db/drizzle.js';
import { calendarEvents, calendarSources } from '../../src/db/schema/index.js';

// ─── ICS fixtures ───────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;
const testEventDate = new Date(Date.now() + 14 * DAY_MS);
testEventDate.setUTCHours(0, 0, 0, 0);

const testEventDayIcs = [
  testEventDate.getUTCFullYear(),
  String(testEventDate.getUTCMonth() + 1).padStart(2, '0'),
  String(testEventDate.getUTCDate()).padStart(2, '0'),
].join('');

const TEST_EVENT_RANGE_FROM = new Date(testEventDate.getTime() - DAY_MS).toISOString();
const TEST_EVENT_RANGE_TO = new Date(testEventDate.getTime() + 2 * DAY_MS).toISOString();

const EVENTS_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
X-WR-CALNAME:Work Calendar
BEGIN:VEVENT
UID:pub-1@test
DTSTART:${testEventDayIcs}T090000Z
DTEND:${testEventDayIcs}T100000Z
SUMMARY:Team Meeting
LOCATION:Room 101
END:VEVENT
BEGIN:VEVENT
UID:pub-2@test
DTSTART:${testEventDayIcs}T140000Z
DTEND:${testEventDayIcs}T150000Z
SUMMARY:Code Review
END:VEVENT
END:VCALENDAR`;

const PRIVATE_EVENTS_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
X-WR-CALNAME:Personal Calendar
BEGIN:VEVENT
UID:priv-1@test
DTSTART:${testEventDayIcs}T100000Z
DTEND:${testEventDayIcs}T110000Z
SUMMARY:Doctor Appointment
CLASS:PRIVATE
END:VEVENT
BEGIN:VEVENT
UID:priv-2@test
DTSTART:${testEventDayIcs}T120000Z
DTEND:${testEventDayIcs}T130000Z
SUMMARY:Lunch with Team
CLASS:PUBLIC
END:VEVENT
BEGIN:VEVENT
UID:priv-3@test
DTSTART:${testEventDayIcs}T150000Z
DTEND:${testEventDayIcs}T160000Z
SUMMARY:HR Meeting
CLASS:CONFIDENTIAL
END:VEVENT
END:VCALENDAR`;

const EMPTY_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
END:VCALENDAR`;

// ─── Helpers ────────────────────────────────────────────────────────────────

const originalFetch = globalThis.fetch;

function mockFetchIcs(body: string) {
  return vi.fn().mockResolvedValue(
    new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'text/calendar' },
    }),
  );
}

beforeAll(() => {
  globalThis.fetch = mockFetchIcs(EMPTY_ICS);
});

beforeEach(() => {
  globalThis.fetch = mockFetchIcs(EMPTY_ICS);
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

async function createIcalSourceAfterInitialSync(
  testApp: TestApp,
  cookies: string,
  csrfToken: string,
  name: string,
  url: string,
): Promise<string> {
  globalThis.fetch = mockFetchIcs(EMPTY_ICS);

  const createRes = await testApp.request
    .post('/api/admin/calendar/sources')
    .set('Cookie', cookies)
    .set(csrfHeader(csrfToken))
    .send({ type: 'ical', name, url });

  expect(createRes.status).toBe(201);
  const sourceId = createRes.body.id as string;

  await vi.waitFor(() => {
    const source = getDb()
      .select({ lastSyncAt: calendarSources.lastSyncAt })
      .from(calendarSources)
      .where(eq(calendarSources.id, sourceId))
      .get();

    expect(source?.lastSyncAt).not.toBeNull();
  });

  return sourceId;
}

async function setupAdmin(testApp: TestApp) {
  await testApp.request
    .post('/api/first-run/admin')
    .send({ username: 'admin', displayName: 'Admin', password: 'supersecurepass1' })
    .set('Content-Type', 'application/json');
}

async function loginAdmin(testApp: TestApp) {
  const res = await testApp.request
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'supersecurepass1' })
    .set('Content-Type', 'application/json');

  return {
    cookies: extractCookies(res.headers),
    csrfToken: extractCsrfToken(res.body),
  };
}

// ─── T034: Public calendar endpoints ────────────────────────────────────────

describe('Public calendar endpoints', () => {
  let testApp: TestApp;
  let cookies: string;
  let csrfToken: string;
  let sourceId: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    await setupAdmin(testApp);
    const auth = await loginAdmin(testApp);
    cookies = auth.cookies;
    csrfToken = auth.csrfToken;

    // Create a source and seed events
    const createRes = await testApp.request
      .post('/api/admin/calendar/sources')
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({
        type: 'ical',
        name: 'Public Test',
        url: 'https://example.com/pub.ics',
        color: '#3b82f6',
      });

    sourceId = createRes.body.id;

    // Insert events directly
    const db = getDb();
    const now = new Date().toISOString();
    for (let i = 0; i < 3; i++) {
      db.insert(calendarEvents)
        .values({
          id: crypto.randomUUID(),
          sourceId,
          providerEventId: `pub-evt-${i}`,
          title: `Public Event ${i + 1}`,
          startAt: `2026-07-0${i + 1}T10:00:00.000Z`,
          endAt: `2026-07-0${i + 1}T11:00:00.000Z`,
          isAllDay: false,
          isPrivate: false,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('GET /api/public/calendar/sources returns sources without auth', async () => {
    const res = await testApp.request.get('/api/public/calendar/sources');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);

    const source = res.body.find((s: { id: string }) => s.id === sourceId);
    expect(source).toBeDefined();
    expect(source.name).toBe('Public Test');
    expect(source.color).toBe('#3b82f6');
    expect(source.enabled).toBe(true);
    // Public endpoint should NOT expose userId or url
    expect(source).not.toHaveProperty('userId');
    expect(source).not.toHaveProperty('url');
  });

  it('GET /api/public/calendar/events returns events without auth', async () => {
    const res = await testApp.request.get('/api/public/calendar/events').query({
      sourceIds: sourceId,
      from: '2026-07-01T00:00:00Z',
      to: '2026-07-31T23:59:59Z',
    });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(3);
    expect(res.body[0]).toHaveProperty('title');
    expect(res.body[0]).toHaveProperty('sourceColor');
    expect(res.body[0]).toHaveProperty('sourceName', 'Public Test');
  });

  it('public events endpoint rejects missing query params', async () => {
    const res = await testApp.request.get('/api/public/calendar/events');
    expect(res.status).toBe(422);
  });

  it('public events endpoint returns empty for non-existent sourceId', async () => {
    const fakeId = crypto.randomUUID();
    const res = await testApp.request.get('/api/public/calendar/events').query({
      sourceIds: fakeId,
      from: '2026-07-01T00:00:00Z',
      to: '2026-07-31T23:59:59Z',
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ─── T035: Private events (isPrivate) ───────────────────────────────────────

describe('Private events', () => {
  let testApp: TestApp;
  let cookies: string;
  let csrfToken: string;
  let sourceId: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    await setupAdmin(testApp);
    const auth = await loginAdmin(testApp);
    cookies = auth.cookies;
    csrfToken = auth.csrfToken;

    // Create source
    const createRes = await testApp.request
      .post('/api/admin/calendar/sources')
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({ type: 'ical', name: 'Privacy Test', url: 'https://example.com/priv.ics' });

    sourceId = createRes.body.id;

    // Insert events with varying privacy
    const db = getDb();
    const now = new Date().toISOString();

    db.insert(calendarEvents)
      .values({
        id: crypto.randomUUID(),
        sourceId,
        providerEventId: 'priv-1',
        title: 'Private Meeting',
        startAt: '2026-08-01T10:00:00.000Z',
        endAt: '2026-08-01T11:00:00.000Z',
        isAllDay: false,
        isPrivate: true,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    db.insert(calendarEvents)
      .values({
        id: crypto.randomUUID(),
        sourceId,
        providerEventId: 'pub-1',
        title: 'Public Meeting',
        startAt: '2026-08-01T14:00:00.000Z',
        endAt: '2026-08-01T15:00:00.000Z',
        isAllDay: false,
        isPrivate: false,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('API returns isPrivate field for events', async () => {
    const res = await testApp.request.get('/api/public/calendar/events').query({
      sourceIds: sourceId,
      from: '2026-08-01T00:00:00Z',
      to: '2026-08-31T23:59:59Z',
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);

    const privateEvent = res.body.find((e: { title: string }) => e.title === 'Private Meeting');
    const publicEvent = res.body.find((e: { title: string }) => e.title === 'Public Meeting');

    expect(privateEvent.isPrivate).toBe(true);
    expect(publicEvent.isPrivate).toBe(false);
  });
});

// ─── T036: iCal CLASS property parsing ──────────────────────────────────────

describe('iCal CLASS property → isPrivate mapping', () => {
  it('maps CLASS:PRIVATE to isPrivate=true', async () => {
    globalThis.fetch = mockFetchIcs(PRIVATE_EVENTS_ICS);

    const { fetchAndParseIcal } = await import('../../src/services/ical-service.js');
    const result = await fetchAndParseIcal(
      'https://example.com/priv.ics',
      TEST_EVENT_RANGE_FROM,
      TEST_EVENT_RANGE_TO,
    );

    expect(result).toHaveLength(3);

    const doctor = result.find((e) => e.title === 'Doctor Appointment');
    const lunch = result.find((e) => e.title === 'Lunch with Team');
    const hr = result.find((e) => e.title === 'HR Meeting');

    expect(doctor!.isPrivate).toBe(true);
    expect(lunch!.isPrivate).toBe(false);
    expect(hr!.isPrivate).toBe(true); // CONFIDENTIAL → private
  });

  it('defaults isPrivate=false when CLASS not present', async () => {
    globalThis.fetch = mockFetchIcs(EVENTS_ICS);

    const { fetchAndParseIcal } = await import('../../src/services/ical-service.js');
    const result = await fetchAndParseIcal(
      'https://example.com/pub.ics',
      TEST_EVENT_RANGE_FROM,
      TEST_EVENT_RANGE_TO,
    );

    expect(result).toHaveLength(2);
    expect(result.every((e) => e.isPrivate === false)).toBe(true);
  });
});

// ─── T037: Security tests ───────────────────────────────────────────────────

describe('Calendar security', () => {
  let testApp: TestApp;
  let cookies: string;
  let csrfToken: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    await setupAdmin(testApp);
    const auth = await loginAdmin(testApp);
    cookies = auth.cookies;
    csrfToken = auth.csrfToken;
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('admin source routes reject unauthenticated requests', async () => {
    const create = await testApp.request
      .post('/api/admin/calendar/sources')
      .send({ type: 'ical', name: 'Test', url: 'https://example.com/cal.ics' });
    expect(create.status).toBe(401);

    const update = await testApp.request
      .put(`/api/admin/calendar/sources/${crypto.randomUUID()}`)
      .send({ name: 'Updated' });
    expect(update.status).toBe(401);

    const del = await testApp.request.delete(`/api/admin/calendar/sources/${crypto.randomUUID()}`);
    expect(del.status).toBe(401);

    const sync = await testApp.request.post(
      `/api/admin/calendar/sources/${crypto.randomUUID()}/sync`,
    );
    expect(sync.status).toBe(401);
  });

  it('admin source routes reject requests without CSRF', async () => {
    const create = await testApp.request
      .post('/api/admin/calendar/sources')
      .set('Cookie', cookies)
      .send({ type: 'ical', name: 'Test', url: 'https://example.com/cal.ics' });
    expect(create.status).toBe(403);
  });

  it('user events route rejects unauthenticated requests', async () => {
    const res = await testApp.request.get('/api/user/calendar/events').query({
      sourceIds: crypto.randomUUID(),
      from: '2026-01-01T00:00:00Z',
      to: '2026-12-31T23:59:59Z',
    });
    expect(res.status).toBe(401);
  });

  it('user sources route rejects unauthenticated requests', async () => {
    const res = await testApp.request.get('/api/user/calendar/sources');
    expect(res.status).toBe(401);
  });

  it('rejects source creation with invalid URL scheme', async () => {
    const res = await testApp.request
      .post('/api/admin/calendar/sources')
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({ type: 'ical', name: 'FTP Cal', url: 'ftp://example.com/cal.ics' });
    expect(res.status).toBe(422);
  });

  it('rejects source creation with empty name', async () => {
    const res = await testApp.request
      .post('/api/admin/calendar/sources')
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({ type: 'ical', name: '', url: 'https://example.com/cal.ics' });
    expect(res.status).toBe(422);
  });

  it('rejects source creation with missing type', async () => {
    const res = await testApp.request
      .post('/api/admin/calendar/sources')
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({ name: 'No Type', url: 'https://example.com/cal.ics' });
    expect(res.status).toBe(422);
  });

  it('returns 404 when deleting non-existent source', async () => {
    const res = await testApp.request
      .delete(`/api/admin/calendar/sources/${crypto.randomUUID()}`)
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken));
    expect(res.status).toBe(404);
  });

  it('returns 404 when updating non-existent source', async () => {
    const res = await testApp.request
      .put(`/api/admin/calendar/sources/${crypto.randomUUID()}`)
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({ name: 'Ghost' });
    expect(res.status).toBe(404);
  });
});

// ─── T038: iCal source sync end-to-end ──────────────────────────────────────

describe('iCal source sync E2E', () => {
  let testApp: TestApp;
  let cookies: string;
  let csrfToken: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    await setupAdmin(testApp);
    const auth = await loginAdmin(testApp);
    cookies = auth.cookies;
    csrfToken = auth.csrfToken;
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('creates source → syncs → events appear in DB and API', async () => {
    // 1. Create source and allow its automatic initial sync to settle
    const sourceId = await createIcalSourceAfterInitialSync(
      testApp,
      cookies,
      csrfToken,
      'Sync Test',
      'https://example.com/sync.ics',
    );

    // 2. Mock fetch for sync
    globalThis.fetch = mockFetchIcs(EVENTS_ICS);

    // 3. Trigger sync
    const syncRes = await testApp.request
      .post(`/api/admin/calendar/sources/${sourceId}/sync`)
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({});

    expect(syncRes.status).toBe(200);
    expect(syncRes.body).toHaveProperty('eventsUpserted', 2);
    expect(syncRes.body).toHaveProperty('error', null);

    // 4. Verify events via API
    const eventsRes = await testApp.request
      .get('/api/user/calendar/events')
      .query({
        sourceIds: sourceId,
        from: TEST_EVENT_RANGE_FROM,
        to: TEST_EVENT_RANGE_TO,
      })
      .set('Cookie', cookies);

    expect(eventsRes.status).toBe(200);
    expect(eventsRes.body).toHaveLength(2);

    const titles = eventsRes.body.map((e: { title: string }) => e.title).sort();
    expect(titles).toEqual(['Code Review', 'Team Meeting']);

    // 5. Verify events also accessible via public endpoint
    const pubRes = await testApp.request.get('/api/public/calendar/events').query({
      sourceIds: sourceId,
      from: TEST_EVENT_RANGE_FROM,
      to: TEST_EVENT_RANGE_TO,
    });

    expect(pubRes.status).toBe(200);
    expect(pubRes.body).toHaveLength(2);
  });

  it('sync with private events preserves isPrivate flag in DB', async () => {
    const sourceId = await createIcalSourceAfterInitialSync(
      testApp,
      cookies,
      csrfToken,
      'Privacy Sync',
      'https://example.com/priv-sync.ics',
    );

    globalThis.fetch = mockFetchIcs(PRIVATE_EVENTS_ICS);

    const syncRes = await testApp.request
      .post(`/api/admin/calendar/sources/${sourceId}/sync`)
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({});

    expect(syncRes.status).toBe(200);
    expect(syncRes.body.eventsUpserted).toBe(3);

    // Check isPrivate via public events API
    const eventsRes = await testApp.request.get('/api/public/calendar/events').query({
      sourceIds: sourceId,
      from: TEST_EVENT_RANGE_FROM,
      to: TEST_EVENT_RANGE_TO,
    });

    expect(eventsRes.status).toBe(200);
    expect(eventsRes.body).toHaveLength(3);

    const doctor = eventsRes.body.find((e: { title: string }) => e.title === 'Doctor Appointment');
    const lunch = eventsRes.body.find((e: { title: string }) => e.title === 'Lunch with Team');
    const hr = eventsRes.body.find((e: { title: string }) => e.title === 'HR Meeting');

    expect(doctor.isPrivate).toBe(true);
    expect(lunch.isPrivate).toBe(false);
    expect(hr.isPrivate).toBe(true);
  });

  it('re-sync updates existing events and removes deleted ones', async () => {
    const sourceId = await createIcalSourceAfterInitialSync(
      testApp,
      cookies,
      csrfToken,
      'Resync Test',
      'https://example.com/resync.ics',
    );

    // First sync — 2 events
    globalThis.fetch = mockFetchIcs(EVENTS_ICS);

    await testApp.request
      .post(`/api/admin/calendar/sources/${sourceId}/sync`)
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({});

    // Second sync — different events (one removed, one added)
    const UPDATED_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:pub-1@test
DTSTART:${testEventDayIcs}T090000Z
DTEND:${testEventDayIcs}T100000Z
SUMMARY:Team Meeting Updated
LOCATION:Room 202
END:VEVENT
BEGIN:VEVENT
UID:new-1@test
DTSTART:${testEventDayIcs}T160000Z
DTEND:${testEventDayIcs}T170000Z
SUMMARY:New Event
END:VEVENT
END:VCALENDAR`;

    globalThis.fetch = mockFetchIcs(UPDATED_ICS);

    const resyncRes = await testApp.request
      .post(`/api/admin/calendar/sources/${sourceId}/sync`)
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({});

    expect(resyncRes.status).toBe(200);
    // pub-1 updated, new-1 inserted = 2 upserted; pub-2 removed = 1 deleted
    expect(resyncRes.body.eventsUpserted).toBe(2);
    expect(resyncRes.body.eventsDeleted).toBe(1);

    // Verify current state
    const eventsRes = await testApp.request
      .get('/api/user/calendar/events')
      .query({
        sourceIds: sourceId,
        from: TEST_EVENT_RANGE_FROM,
        to: TEST_EVENT_RANGE_TO,
      })
      .set('Cookie', cookies);

    expect(eventsRes.body).toHaveLength(2);
    const titles = eventsRes.body.map((e: { title: string }) => e.title).sort();
    expect(titles).toEqual(['New Event', 'Team Meeting Updated']);

    // Verify title was updated (not just inserted)
    const meeting = eventsRes.body.find(
      (e: { title: string }) => e.title === 'Team Meeting Updated',
    );
    expect(meeting).toBeDefined();
  });
});

// ─── T039: Calendar config validation ───────────────────────────────────────

describe('Calendar config validation', () => {
  let testApp: TestApp;
  let cookies: string;
  let csrfToken: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    await setupAdmin(testApp);
    const auth = await loginAdmin(testApp);
    cookies = auth.cookies;
    csrfToken = auth.csrfToken;
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('accepts valid calendar widget config via layout endpoint', async () => {
    // Create a dashboard first
    const dashRes = await testApp.request
      .post('/api/admin/dashboards')
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({ name: 'Config Test Dashboard' });

    expect(dashRes.status).toBe(201);
    const dashboardId = dashRes.body.id;

    // Save layout with a placeholder containing a calendar widget
    const res = await testApp.request
      .put(`/api/admin/dashboards/${dashboardId}/layout`)
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({
        placeholders: [
          {
            stableKey: crypto.randomUUID(),
            x: 0,
            y: 0,
            w: 2,
            h: 3,
            widgets: [
              {
                type: 'calendar',
                orderIndex: 0,
                configJson: JSON.stringify({
                  sourceIds: [],
                  viewMode: 'expanded',
                  daysAhead: 14,
                  maxEvents: 50,
                  showLocation: true,
                  showPrivateEvents: false,
                }),
              },
            ],
          },
        ],
      });

    expect(res.status).toBe(200);
  });

  it('rejects source update with invalid sync interval', async () => {
    // Create source first
    const createRes = await testApp.request
      .post('/api/admin/calendar/sources')
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({ type: 'ical', name: 'Interval Test', url: 'https://example.com/int.ics' });

    const sourceId = createRes.body.id;

    // Try to set sync interval below minimum (60s)
    const res = await testApp.request
      .put(`/api/admin/calendar/sources/${sourceId}`)
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({ syncIntervalSeconds: 5 });

    expect(res.status).toBe(422);
  });

  it('rejects source update with invalid color', async () => {
    const createRes = await testApp.request
      .post('/api/admin/calendar/sources')
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({ type: 'ical', name: 'Color Test', url: 'https://example.com/color.ics' });

    const sourceId = createRes.body.id;

    const res = await testApp.request
      .put(`/api/admin/calendar/sources/${sourceId}`)
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({ color: 'not-a-color' });

    expect(res.status).toBe(422);
  });
});
