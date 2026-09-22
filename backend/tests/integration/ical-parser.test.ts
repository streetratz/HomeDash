/**
 * T020 (004): iCal parser + calendar CRUD integration tests.
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
import { calendarSources, calendarEvents, users } from '../../src/db/schema/index.js';

// ─── ICS fixtures ───────────────────────────────────────────────────────────

const SIMPLE_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
X-WR-CALNAME:Test Calendar
BEGIN:VEVENT
UID:test-1@example.com
DTSTART:20260501T100000Z
DTEND:20260501T110000Z
SUMMARY:Morning Standup
LOCATION:Conference Room A
DESCRIPTION:Daily standup meeting for the engineering team
END:VEVENT
BEGIN:VEVENT
UID:test-2@example.com
DTSTART:20260501T140000Z
DTEND:20260501T150000Z
SUMMARY:Design Review
END:VEVENT
BEGIN:VEVENT
UID:test-3@example.com
DTSTART:20260502T090000Z
DTEND:20260502T100000Z
SUMMARY:Sprint Planning
LOCATION:Room B
END:VEVENT
END:VCALENDAR`;

const ALLDAY_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:allday-1@example.com
DTSTART;VALUE=DATE:20260510
DTEND;VALUE=DATE:20260511
SUMMARY:Company Holiday
END:VEVENT
END:VCALENDAR`;

const MULTIDAY_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:multiday-1@example.com
DTSTART;VALUE=DATE:20260601
DTEND;VALUE=DATE:20260604
SUMMARY:Team Offsite
LOCATION:Beach Resort
END:VEVENT
END:VCALENDAR`;

const RECURRING_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:recurring-1@example.com
DTSTART:20260501T100000Z
DTEND:20260501T110000Z
RRULE:FREQ=WEEKLY;COUNT=8
SUMMARY:Weekly Sync
END:VEVENT
END:VCALENDAR`;

const BIRTHDAY_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Birthdays//EN
X-WR-CALNAME:Birthdays
BEGIN:VEVENT
UID:birthday-1@example.com
DTSTART;VALUE=DATE:19901003
DTEND;VALUE=DATE:19901004
RRULE:FREQ=YEARLY
SUMMARY:Alex's Birthday
END:VEVENT
END:VCALENDAR`;

const EMPTY_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
END:VCALENDAR`;

const MALFORMED_ICS = `This is not valid iCal data at all`;

// ─── Helpers ────────────────────────────────────────────────────────────────

const originalFetch = globalThis.fetch;

function mockFetchIcs(body: string, status = 200) {
  return vi.fn().mockResolvedValue(
    new Response(body, {
      status,
      headers: { 'Content-Type': 'text/calendar' },
    }),
  );
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

  const cookies = extractCookies(res.headers);
  const csrfToken = extractCsrfToken(res.body);
  return { cookies, csrfToken };
}

function getUserId(): string {
  const db = getDb();
  const user = db.select({ id: users.id }).from(users).get();
  return user!.id;
}

// ─── iCal parser tests ──────────────────────────────────────────────────────

describe('fetchAndParseIcal', () => {
  beforeEach(() => {
    globalThis.fetch = originalFetch;
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('parses simple .ics with 3 events and maps fields correctly', async () => {
    globalThis.fetch = mockFetchIcs(SIMPLE_ICS);

    const { fetchAndParseIcal } = await import('../../src/services/ical-service.js');
    const result = await fetchAndParseIcal(
      'https://example.com/cal.ics',
      '2026-04-01T00:00:00Z',
      '2026-06-01T00:00:00Z',
    );

    expect(result).toHaveLength(3);
    expect(result[0]!.title).toBe('Morning Standup');
    expect(result[0]!.location).toBe('Conference Room A');
    expect(result[0]!.description).toBe('Daily standup meeting for the engineering team');
    expect(result[0]!.providerEventId).toBe('test-1@example.com');
    expect(result[0]!.calendarName).toBe('Test Calendar');
    expect(result[0]!.isAllDay).toBe(false);

    expect(result[1]!.title).toBe('Design Review');
    expect(result[2]!.title).toBe('Sprint Planning');

    // Sorted by startAt
    expect(result[0]!.startAt < result[1]!.startAt).toBe(true);
    expect(result[1]!.startAt < result[2]!.startAt).toBe(true);
  });

  it('handles all-day events (VALUE=DATE) with isAllDay=true', async () => {
    globalThis.fetch = mockFetchIcs(ALLDAY_ICS);

    const { fetchAndParseIcal } = await import('../../src/services/ical-service.js');
    const result = await fetchAndParseIcal(
      'https://example.com/cal.ics',
      '2026-05-01T00:00:00Z',
      '2026-05-31T00:00:00Z',
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe('Company Holiday');
    expect(result[0]!.isAllDay).toBe(true);
  });

  it('handles multi-day events', async () => {
    globalThis.fetch = mockFetchIcs(MULTIDAY_ICS);

    const { fetchAndParseIcal } = await import('../../src/services/ical-service.js');
    const result = await fetchAndParseIcal(
      'https://example.com/cal.ics',
      '2026-05-01T00:00:00Z',
      '2026-07-01T00:00:00Z',
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe('Team Offsite');
    expect(result[0]!.location).toBe('Beach Resort');
    expect(result[0]!.isAllDay).toBe(true);
  });

  it('expands recurring events (RRULE FREQ=WEEKLY) within window', async () => {
    globalThis.fetch = mockFetchIcs(RECURRING_ICS);

    const { fetchAndParseIcal } = await import('../../src/services/ical-service.js');
    // Window covers 4 weeks — should get occurrences within
    const result = await fetchAndParseIcal(
      'https://example.com/cal.ics',
      '2026-05-01T00:00:00Z',
      '2026-05-31T00:00:00Z',
    );

    // Weekly from May 1 for 8 count, within May: May 1, 8, 15, 22, 29 = 5 occurrences
    expect(result.length).toBeGreaterThanOrEqual(4);
    expect(result.length).toBeLessThanOrEqual(5);

    // Each occurrence should have a unique providerEventId
    const ids = result.map((e) => e.providerEventId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('returns empty array for .ics with no events', async () => {
    globalThis.fetch = mockFetchIcs(EMPTY_ICS);

    const { fetchAndParseIcal } = await import('../../src/services/ical-service.js');
    const result = await fetchAndParseIcal(
      'https://example.com/cal.ics',
      '2026-05-01T00:00:00Z',
      '2026-05-31T00:00:00Z',
    );

    expect(result).toEqual([]);
  });

  it('throws on malformed .ics (no VCALENDAR)', async () => {
    globalThis.fetch = mockFetchIcs(MALFORMED_ICS);

    const { fetchAndParseIcal } = await import('../../src/services/ical-service.js');
    await expect(
      fetchAndParseIcal(
        'https://example.com/cal.ics',
        '2026-05-01T00:00:00Z',
        '2026-05-31T00:00:00Z',
      ),
    ).rejects.toThrow('not a valid iCalendar');
  });

  it('rejects events without a UID', async () => {
    const { parseIcalBody } = await import('../../src/services/ical-service.js');
    const withoutUid = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20260501T100000Z
SUMMARY:Missing UID
END:VEVENT
END:VCALENDAR`;

    expect(() =>
      parseIcalBody(withoutUid, '2026-05-01T00:00:00Z', '2026-05-02T00:00:00Z'),
    ).toThrow('iCalendar event is missing UID');
  });

  it('rejects recurring events without a UID even when outside the requested window', async () => {
    const { parseIcalBody } = await import('../../src/services/ical-service.js');
    const withoutUid = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART;VALUE=DATE:20261003
RRULE:FREQ=YEARLY
SUMMARY:Missing UID Birthday
END:VEVENT
END:VCALENDAR`;

    expect(() =>
      parseIcalBody(withoutUid, '2026-05-01T00:00:00Z', '2026-06-01T00:00:00Z'),
    ).toThrow('iCalendar event is missing UID');
  });

  it('allows worst-case JSON expansion at the 5 MiB content boundary', async () => {
    const {
      MAX_ICS_BODY_BYTES,
      MAX_ICS_JSON_BODY_BYTES,
      validateIcalBody,
    } = await import('../../src/services/ical-service.js');
    const prefix = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nDESCRIPTION:';
    const suffix = '\r\nEND:VCALENDAR';
    const paddingBytes =
      MAX_ICS_BODY_BYTES - Buffer.byteLength(prefix, 'utf8') - Buffer.byteLength(suffix, 'utf8');
    const body = `${prefix}${'\\'.repeat(paddingBytes)}${suffix}`;

    expect(Buffer.byteLength(body, 'utf8')).toBe(MAX_ICS_BODY_BYTES);
    expect(() => validateIcalBody(body)).not.toThrow();
    expect(
      Buffer.byteLength(
        JSON.stringify({
          name: 'Boundary',
          fileName: 'boundary.ics',
          icsContent: body,
        }),
        'utf8',
      ),
    ).toBeLessThanOrEqual(MAX_ICS_JSON_BODY_BYTES);
    expect(() => validateIcalBody(`${body}x`)).toThrow('iCal content too large');
  });

  it('parses a static yearly all-day birthday within the requested year', async () => {
    const { parseIcalBody } = await import('../../src/services/ical-service.js');
    const result = parseIcalBody(BIRTHDAY_ICS, '2026-09-01T00:00:00Z', '2026-11-01T00:00:00Z');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      title: "Alex's Birthday",
      isAllDay: true,
      calendarName: 'Birthdays',
    });
    expect(result[0]!.startAt.startsWith('2026-10-03')).toBe(true);
  });
});

// ─── Calendar source CRUD route tests ───────────────────────────────────────

describe('Calendar source CRUD routes', () => {
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

  it('creates an iCal calendar source', async () => {
    const res = await testApp.request
      .post('/api/admin/calendar/sources')
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({
        type: 'ical',
        name: 'Test iCal',
        url: 'https://example.com/basic.ics',
        color: '#ff0000',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.type).toBe('ical');
    expect(res.body.name).toBe('Test iCal');
    expect(res.body.url).toBe('https://example.com/basic.ics');
    expect(res.body.color).toBe('#ff0000');
  });

  it('lists calendar sources for the current user', async () => {
    const res = await testApp.request.get('/api/user/calendar/sources').set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0]).toHaveProperty('id');
    expect(res.body[0]).toHaveProperty('type');
    expect(res.body[0]).toHaveProperty('name');
  });

  it('updates a calendar source', async () => {
    // Get the source ID
    const listRes = await testApp.request.get('/api/user/calendar/sources').set('Cookie', cookies);

    const sourceId = listRes.body[0].id;

    const res = await testApp.request
      .put(`/api/admin/calendar/sources/${sourceId}`)
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({ name: 'Updated iCal', color: '#00ff00' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated iCal');
    expect(res.body.color).toBe('#00ff00');
  });

  it('deletes a calendar source', async () => {
    // Create a source to delete
    const createRes = await testApp.request
      .post('/api/admin/calendar/sources')
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({
        type: 'ical',
        name: 'To Delete',
        url: 'https://example.com/delete.ics',
      });

    const sourceId = createRes.body.id;

    const res = await testApp.request
      .delete(`/api/admin/calendar/sources/${sourceId}`)
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken));

    expect(res.status).toBe(204);

    // Verify it's gone
    const listRes = await testApp.request.get('/api/user/calendar/sources').set('Cookie', cookies);

    const ids = listRes.body.map((s: { id: string }) => s.id);
    expect(ids).not.toContain(sourceId);
  });

  it('rejects creation without auth', async () => {
    const res = await testApp.request
      .post('/api/admin/calendar/sources')
      .send({ type: 'ical', name: 'Test', url: 'https://example.com/cal.ics' });

    expect(res.status).toBe(401);
  });

  it('rejects creation without CSRF token', async () => {
    const res = await testApp.request
      .post('/api/admin/calendar/sources')
      .set('Cookie', cookies)
      .send({ type: 'ical', name: 'Test', url: 'https://example.com/cal.ics' });

    expect(res.status).toBe(403);
  });

  it('rejects HTTP URL on non-LAN address', async () => {
    const res = await testApp.request
      .post('/api/admin/calendar/sources')
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({
        type: 'ical',
        name: 'Bad URL',
        url: 'http://public-server.com/cal.ics',
      });

    expect(res.status).toBe(422);
  });

  it('accepts HTTP URL on LAN address', async () => {
    const res = await testApp.request
      .post('/api/admin/calendar/sources')
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({
        type: 'ical',
        name: 'LAN Cal',
        url: 'http://192.168.1.100/cal.ics',
      });

    expect(res.status).toBe(201);
  });

  it('imports and re-imports a static iCalendar file without exposing its body', async () => {
    const now = new Date();
    const firstDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 10);
    const secondDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 11);
    const toIcsDate = (date: Date) =>
      `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const makeIcs = (uid: string, title: string, date: Date) => `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Birthdays//EN
BEGIN:VEVENT
UID:${uid}
DTSTART;VALUE=DATE:${toIcsDate(date)}
DTEND;VALUE=DATE:${toIcsDate(new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1))}
SUMMARY:${title}
END:VEVENT
END:VCALENDAR`;

    const createRes = await testApp.request
      .post('/api/admin/calendar/sources/import')
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({
        name: 'Family Birthdays',
        color: '#a855f7',
        fileName: 'birthdays.ics',
        icsContent: makeIcs('birthday-one', 'First Birthday', firstDate),
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body).toMatchObject({
      type: 'ical_file',
      name: 'Family Birthdays',
      fileName: 'birthdays.ics',
      url: null,
    });
    expect(createRes.body).not.toHaveProperty('icsContent');

    const sourceId = createRes.body.id as string;
    const firstEvents = getDb()
      .select({ title: calendarEvents.title })
      .from(calendarEvents)
      .where(eq(calendarEvents.sourceId, sourceId))
      .all();
    expect(firstEvents).toEqual([{ title: 'First Birthday' }]);

    const replaceRes = await testApp.request
      .post(`/api/admin/calendar/sources/${sourceId}/import`)
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({
        name: 'Updated Birthdays',
        color: '#ec4899',
        fileName: 'birthdays-updated.ics',
        icsContent: makeIcs('birthday-two', 'Second Birthday', secondDate),
      });

    expect(replaceRes.status).toBe(200);
    expect(replaceRes.body).not.toHaveProperty('icsContent');
    const replacedEvents = getDb()
      .select({ title: calendarEvents.title })
      .from(calendarEvents)
      .where(eq(calendarEvents.sourceId, sourceId))
      .all();
    expect(replacedEvents).toEqual([{ title: 'Second Birthday' }]);

    const listRes = await testApp.request.get('/api/user/calendar/sources').set('Cookie', cookies);
    const listedSource = listRes.body.find((source: { id: string }) => source.id === sourceId);
    expect(listedSource).not.toHaveProperty('icsContent');

    const sourceBeforeRejectedImport = getDb()
      .select({
        name: calendarSources.name,
        color: calendarSources.color,
        fileName: calendarSources.fileName,
        icsContent: calendarSources.icsContent,
      })
      .from(calendarSources)
      .where(eq(calendarSources.id, sourceId))
      .get();

    const rejectedRes = await testApp.request
      .post(`/api/admin/calendar/sources/${sourceId}/import`)
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({
        name: 'Rejected Birthdays',
        color: '#000000',
        fileName: 'rejected.ics',
        icsContent: makeIcs('', 'Missing UID', secondDate).replace('UID:\n', ''),
      });

    expect(rejectedRes.status).toBe(422);
    const sourceAfterRejectedImport = getDb()
      .select({
        name: calendarSources.name,
        color: calendarSources.color,
        fileName: calendarSources.fileName,
        icsContent: calendarSources.icsContent,
      })
      .from(calendarSources)
      .where(eq(calendarSources.id, sourceId))
      .get();
    expect(sourceAfterRejectedImport).toEqual(sourceBeforeRejectedImport);

    const eventsAfterRejectedImport = getDb()
      .select({ title: calendarEvents.title })
      .from(calendarEvents)
      .where(eq(calendarEvents.sourceId, sourceId))
      .all();
    expect(eventsAfterRejectedImport).toEqual([{ title: 'Second Birthday' }]);
  });

  it('rejects static iCalendar import without auth or CSRF', async () => {
    const payload = {
      name: 'Birthdays',
      fileName: 'birthdays.ics',
      icsContent: BIRTHDAY_ICS,
    };

    const unauthenticated = await testApp.request
      .post('/api/admin/calendar/sources/import')
      .send(payload);
    expect(unauthenticated.status).toBe(401);

    const missingCsrf = await testApp.request
      .post('/api/admin/calendar/sources/import')
      .set('Cookie', cookies)
      .send(payload);
    expect(missingCsrf.status).toBe(403);
  });

  it('rejects malformed static iCalendar content before creating a source', async () => {
    const res = await testApp.request
      .post('/api/admin/calendar/sources/import')
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({
        name: 'Broken Birthdays',
        fileName: 'broken.ics',
        icsContent: 'not a calendar',
      });

    expect(res.status).toBe(422);
  });

  it('reprocesses uploaded recurring calendars locally as their events approach', async () => {
    const now = new Date();
    const eventDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 120);
    const advancedDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 40);
    const nextDate = new Date(
      eventDate.getFullYear(),
      eventDate.getMonth(),
      eventDate.getDate() + 1,
    );
    const toIcsDate = (date: Date) =>
      `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const sourceId = crypto.randomUUID();
    const recentSourceId = crypto.randomUUID();
    const db = getDb();

    db.update(calendarSources).set({ enabled: false }).run();
    db.insert(calendarSources)
      .values({
        id: sourceId,
        userId: getUserId(),
        type: 'ical_file',
        name: 'Advancing Birthdays',
        fileName: 'birthdays.ics',
        icsContent: `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:advancing-birthday
DTSTART;VALUE=DATE:${toIcsDate(eventDate)}
DTEND;VALUE=DATE:${toIcsDate(nextDate)}
RRULE:FREQ=YEARLY
SUMMARY:Upcoming Birthday
END:VEVENT
END:VCALENDAR`,
        color: '#a855f7',
        syncIntervalSeconds: 300,
        lastSyncAt: new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString(),
        enabled: true,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      })
      .run();
    db.insert(calendarSources)
      .values({
        id: recentSourceId,
        userId: getUserId(),
        type: 'ical_file',
        name: 'Recently Parsed Birthdays',
        fileName: 'recent.ics',
        icsContent: `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:recent-birthday
DTSTART;VALUE=DATE:${toIcsDate(eventDate)}
DTEND;VALUE=DATE:${toIcsDate(nextDate)}
RRULE:FREQ=YEARLY
SUMMARY:Should Not Reparse Yet
END:VEVENT
END:VCALENDAR`,
        color: '#3b82f6',
        syncIntervalSeconds: 300,
        lastSyncAt: new Date(now.getTime() - 23 * 60 * 60 * 1000).toISOString(),
        enabled: true,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      })
      .run();

    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;
    vi.useFakeTimers();
    vi.setSystemTime(advancedDate);
    try {
      const { runScheduledSync } =
        await import('../../src/services/calendar-sync-service.js');
      await runScheduledSync();
    } finally {
      vi.useRealTimers();
      globalThis.fetch = originalFetch;
    }

    const events = db
      .select({ title: calendarEvents.title })
      .from(calendarEvents)
      .where(eq(calendarEvents.sourceId, sourceId))
      .all();
    expect(events).toEqual([{ title: 'Upcoming Birthday' }]);
    const recentEvents = db
      .select({ title: calendarEvents.title })
      .from(calendarEvents)
      .where(eq(calendarEvents.sourceId, recentSourceId))
      .all();
    expect(recentEvents).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ─── Calendar events route tests ────────────────────────────────────────────

describe('Calendar events read route', () => {
  let testApp: TestApp;
  let cookies: string;
  let sourceId: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    await setupAdmin(testApp);
    const auth = await loginAdmin(testApp);
    cookies = auth.cookies;

    // Create a source and insert some events directly
    const userId = getUserId();
    const db = getDb();
    const now = new Date().toISOString();
    sourceId = crypto.randomUUID();

    db.insert(calendarSources)
      .values({
        id: sourceId,
        userId,
        type: 'ical',
        name: 'Events Test',
        url: 'https://example.com/events.ics',
        color: '#ff5733',
        syncIntervalSeconds: 900,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    // Insert test events
    for (let i = 0; i < 3; i++) {
      db.insert(calendarEvents)
        .values({
          id: crypto.randomUUID(),
          sourceId,
          providerEventId: `evt-${i}@example.com`,
          title: `Event ${i + 1}`,
          startAt: `2026-06-0${i + 1}T10:00:00.000Z`,
          endAt: `2026-06-0${i + 1}T11:00:00.000Z`,
          isAllDay: false,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('returns events filtered by sourceId and date range', async () => {
    const res = await testApp.request
      .get('/api/user/calendar/events')
      .query({
        sourceIds: sourceId,
        from: '2026-06-01T00:00:00Z',
        to: '2026-06-30T23:59:59Z',
      })
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(3);
    expect(res.body[0]).toHaveProperty('sourceColor', '#ff5733');
    expect(res.body[0]).toHaveProperty('sourceName', 'Events Test');
  });

  it('returns empty array when no events match date range', async () => {
    const res = await testApp.request
      .get('/api/user/calendar/events')
      .query({
        sourceIds: sourceId,
        from: '2025-01-01T00:00:00Z',
        to: '2025-01-31T23:59:59Z',
      })
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('rejects request without auth', async () => {
    const res = await testApp.request
      .get('/api/user/calendar/events')
      .query({ sourceIds: sourceId, from: '2026-06-01T00:00:00Z', to: '2026-06-30T23:59:59Z' });

    expect(res.status).toBe(401);
  });

  it('rejects request with missing query params', async () => {
    const res = await testApp.request.get('/api/user/calendar/events').set('Cookie', cookies);

    expect(res.status).toBe(422);
  });
});
