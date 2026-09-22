/**
 * T013 (004): Microsoft calendar integration tests.
 *
 * Tests Graph API client and sync orchestrator with mocked fetch.
 */

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import {
  createTestApp,
  type TestApp,
} from '../helpers/http.js';
import { getDb } from '../../src/db/drizzle.js';
import {
  calendarSources,
  calendarEvents,
  oauthAccounts,
  users,
} from '../../src/db/schema/index.js';
import { eq } from 'drizzle-orm';
import { encryptToken } from '../../src/lib/token-encryption.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

const originalFetch = globalThis.fetch;

function makeGraphEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt-1',
    subject: 'Team Standup',
    start: { dateTime: '2024-06-15T09:00:00.0000000', timeZone: 'UTC' },
    end: { dateTime: '2024-06-15T09:30:00.0000000', timeZone: 'UTC' },
    location: { displayName: 'Room 42' },
    isAllDay: false,
    calendar: { name: 'Work Calendar' },
    body: { content: '<p>Daily standup</p>', contentType: 'html' },
    ...overrides,
  };
}

function mockGraphResponse(events: unknown[], nextLink?: string) {
  return new Response(
    JSON.stringify({
      value: events,
      ...(nextLink ? { '@odata.nextLink': nextLink } : {}),
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

async function setupAdmin(testApp: TestApp) {
  await testApp.request
    .post('/api/first-run/admin')
    .send({ username: 'admin', displayName: 'Admin', password: 'supersecurepass1' })
    .set('Content-Type', 'application/json');
}

function getUserId(): string {
  const db = getDb();
  const user = db.select({ id: users.id }).from(users).get();
  return user!.id;
}

function createOAuthAccount(userId: string): string {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const futureExpiry = new Date(Date.now() + 3600_000).toISOString();

  db.insert(oauthAccounts)
    .values({
      id,
      userId,
      provider: 'microsoft',
      providerAccountId: `ms-test-${crypto.randomUUID()}`,
      accessTokenEnc: encryptToken('mock-access-token'),
      refreshTokenEnc: encryptToken('mock-refresh-token'),
      tokenExpiresAt: futureExpiry,
      email: 'test@example.com',
      displayName: 'Test User',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return id;
}

function createCalendarSource(userId: string, oauthAccountId: string): string {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.insert(calendarSources)
    .values({
      id,
      userId,
      oauthAccountId,
      type: 'microsoft',
      name: 'Test Microsoft Calendar',
      color: '#3b82f6',
      syncIntervalSeconds: 300,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return id;
}

// ─── fetchMicrosoftCalendarEvents tests ─────────────────────────────────────

describe('fetchMicrosoftCalendarEvents', () => {
  beforeEach(() => {
    globalThis.fetch = originalFetch;
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('maps a single-page response correctly', async () => {
    const event = makeGraphEvent();
    globalThis.fetch = vi.fn().mockResolvedValue(mockGraphResponse([event]));

    const { fetchMicrosoftCalendarEvents } = await import(
      '../../src/services/microsoft-calendar-service.js'
    );
    const result = await fetchMicrosoftCalendarEvents(
      'token',
      '2024-06-01T00:00:00Z',
      '2024-07-01T00:00:00Z',
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.providerEventId).toBe('evt-1');
    expect(result[0]!.title).toBe('Team Standup');
    expect(result[0]!.startAt).toContain('2024-06-15T09:00:00');
    expect(result[0]!.endAt).toContain('2024-06-15T09:30:00');
    expect(result[0]!.location).toBe('Room 42');
    expect(result[0]!.isAllDay).toBe(false);
    expect(result[0]!.calendarName).toBe('Work Calendar');
    expect(result[0]!.description).toBe('Daily standup');
    expect(result[0]!.rawJson).toContain('Team Standup');
    expect(result[0]!.startTz).toBe('UTC');
  });

  it('follows @odata.nextLink for pagination', async () => {
    const page1Event = makeGraphEvent({ id: 'evt-page1' });
    const page2Event = makeGraphEvent({ id: 'evt-page2', subject: 'Page 2 Event' });

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        mockGraphResponse([page1Event], 'https://graph.microsoft.com/next-page'),
      )
      .mockResolvedValueOnce(mockGraphResponse([page2Event]));

    const { fetchMicrosoftCalendarEvents } = await import(
      '../../src/services/microsoft-calendar-service.js'
    );
    const result = await fetchMicrosoftCalendarEvents(
      'token',
      '2024-06-01T00:00:00Z',
      '2024-07-01T00:00:00Z',
    );

    expect(result).toHaveLength(2);
    expect(result[0]!.providerEventId).toBe('evt-page1');
    expect(result[1]!.providerEventId).toBe('evt-page2');
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(2);
  });

  it('handles all-day events', async () => {
    const event = makeGraphEvent({
      isAllDay: true,
      start: { dateTime: '2024-06-15T00:00:00.0000000', timeZone: 'UTC' },
      end: { dateTime: '2024-06-16T00:00:00.0000000', timeZone: 'UTC' },
    });

    globalThis.fetch = vi.fn().mockResolvedValue(mockGraphResponse([event]));

    const { fetchMicrosoftCalendarEvents } = await import(
      '../../src/services/microsoft-calendar-service.js'
    );
    const result = await fetchMicrosoftCalendarEvents(
      'token',
      '2024-06-01T00:00:00Z',
      '2024-07-01T00:00:00Z',
    );

    expect(result[0]!.isAllDay).toBe(true);
  });

  it('returns null location when not present', async () => {
    const event = makeGraphEvent({ location: {} });

    globalThis.fetch = vi.fn().mockResolvedValue(mockGraphResponse([event]));

    const { fetchMicrosoftCalendarEvents } = await import(
      '../../src/services/microsoft-calendar-service.js'
    );
    const result = await fetchMicrosoftCalendarEvents(
      'token',
      '2024-06-01T00:00:00Z',
      '2024-07-01T00:00:00Z',
    );

    expect(result[0]!.location).toBeNull();
  });
});

// ─── syncSource tests (Microsoft) ───────────────────────────────────────────

describe('syncSource (Microsoft)', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
    await setupAdmin(testApp);
  });

  afterAll(async () => {
    globalThis.fetch = originalFetch;
    await testApp.close();
  });

  beforeEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('upserts new events into DB', async () => {
    const userId = getUserId();
    const oauthId = createOAuthAccount(userId);
    const sourceId = createCalendarSource(userId, oauthId);

    const event = makeGraphEvent({ id: 'ms-evt-new' });
    globalThis.fetch = vi.fn().mockResolvedValue(mockGraphResponse([event]));

    const { syncSource } = await import('../../src/services/calendar-sync-service.js');
    const result = await syncSource(sourceId);

    expect(result.eventsUpserted).toBe(1);
    expect(result.error).toBeNull();

    const db = getDb();
    const stored = db
      .select()
      .from(calendarEvents)
      .where(eq(calendarEvents.sourceId, sourceId))
      .all();
    expect(stored).toHaveLength(1);
    expect(stored[0]!.providerEventId).toBe('ms-evt-new');
    expect(stored[0]!.title).toBe('Team Standup');
  });

  it('deletes events removed from provider', async () => {
    const userId = getUserId();
    const oauthId = createOAuthAccount(userId);
    const sourceId = createCalendarSource(userId, oauthId);
    const db = getDb();
    const now = new Date().toISOString();

    // Pre-insert an event that won't be in the provider response
    db.insert(calendarEvents)
      .values({
        id: crypto.randomUUID(),
        sourceId,
        providerEventId: 'old-evt-to-delete',
        title: 'Old Event',
        startAt: now,
        endAt: now,
        isAllDay: false,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    // Provider returns a different event
    const event = makeGraphEvent({ id: 'ms-evt-kept' });
    globalThis.fetch = vi.fn().mockResolvedValue(mockGraphResponse([event]));

    const { syncSource } = await import('../../src/services/calendar-sync-service.js');
    const result = await syncSource(sourceId);

    expect(result.eventsDeleted).toBe(1);
    expect(result.eventsUpserted).toBe(1);

    const stored = db
      .select()
      .from(calendarEvents)
      .where(eq(calendarEvents.sourceId, sourceId))
      .all();
    expect(stored).toHaveLength(1);
    expect(stored[0]!.providerEventId).toBe('ms-evt-kept');
  });

  it('updates lastSyncAt on success', async () => {
    const userId = getUserId();
    const oauthId = createOAuthAccount(userId);
    const sourceId = createCalendarSource(userId, oauthId);

    globalThis.fetch = vi.fn().mockResolvedValue(mockGraphResponse([]));

    const { syncSource } = await import('../../src/services/calendar-sync-service.js');
    await syncSource(sourceId);

    const db = getDb();
    const source = db
      .select({ lastSyncAt: calendarSources.lastSyncAt })
      .from(calendarSources)
      .where(eq(calendarSources.id, sourceId))
      .get();

    expect(source!.lastSyncAt).not.toBeNull();
  });

  it('sets lastSyncError on fetch failure', async () => {
    const userId = getUserId();
    const oauthId = createOAuthAccount(userId);
    const sourceId = createCalendarSource(userId, oauthId);

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('Internal Server Error', { status: 500 }),
    );

    const { syncSource } = await import('../../src/services/calendar-sync-service.js');
    const result = await syncSource(sourceId);

    expect(result.error).toContain('500');

    const db = getDb();
    const source = db
      .select({ lastSyncError: calendarSources.lastSyncError })
      .from(calendarSources)
      .where(eq(calendarSources.id, sourceId))
      .get();

    expect(source!.lastSyncError).toContain('500');
  });
});
