/**
 * T015 (004): Google calendar integration tests.
 *
 * Tests Google Calendar API client and sync orchestrator with mocked fetch.
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

function makeGoogleEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'google-evt-1',
    summary: 'Sprint Planning',
    description: 'Weekly sprint planning meeting',
    location: 'Conference Room A',
    start: { dateTime: '2024-06-15T14:00:00+00:00', timeZone: 'UTC' },
    end: { dateTime: '2024-06-15T15:00:00+00:00', timeZone: 'UTC' },
    organizer: { displayName: 'Engineering' },
    ...overrides,
  };
}

function mockGoogleResponse(events: unknown[], nextPageToken?: string) {
  return new Response(
    JSON.stringify({
      items: events,
      ...(nextPageToken ? { nextPageToken } : {}),
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

function createGoogleOAuthAccount(userId: string): string {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const futureExpiry = new Date(Date.now() + 3600_000).toISOString();

  db.insert(oauthAccounts)
    .values({
      id,
      userId,
      provider: 'google',
      providerAccountId: `google-test-${crypto.randomUUID()}`,
      accessTokenEnc: encryptToken('mock-google-access-token'),
      refreshTokenEnc: encryptToken('mock-google-refresh-token'),
      tokenExpiresAt: futureExpiry,
      email: 'test@gmail.com',
      displayName: 'Google Test',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return id;
}

function createGoogleCalendarSource(userId: string, oauthAccountId: string): string {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.insert(calendarSources)
    .values({
      id,
      userId,
      oauthAccountId,
      type: 'google',
      name: 'Test Google Calendar',
      color: '#34a853',
      syncIntervalSeconds: 300,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return id;
}

// ─── fetchGoogleCalendarEvents tests ────────────────────────────────────────

describe('fetchGoogleCalendarEvents', () => {
  beforeEach(() => {
    globalThis.fetch = originalFetch;
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('maps a single-page response correctly', async () => {
    const event = makeGoogleEvent();
    globalThis.fetch = vi.fn().mockResolvedValue(mockGoogleResponse([event]));

    const { fetchGoogleCalendarEvents } = await import(
      '../../src/services/google-calendar-service.js'
    );
    const result = await fetchGoogleCalendarEvents(
      'token',
      '2024-06-01T00:00:00Z',
      '2024-07-01T00:00:00Z',
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.providerEventId).toBe('google-evt-1');
    expect(result[0]!.title).toBe('Sprint Planning');
    expect(result[0]!.startAt).toBe('2024-06-15T14:00:00+00:00');
    expect(result[0]!.endAt).toBe('2024-06-15T15:00:00+00:00');
    expect(result[0]!.location).toBe('Conference Room A');
    expect(result[0]!.isAllDay).toBe(false);
    expect(result[0]!.calendarName).toBe('Engineering');
    expect(result[0]!.description).toBe('Weekly sprint planning meeting');
    expect(result[0]!.rawJson).toContain('Sprint Planning');
    expect(result[0]!.startTz).toBe('UTC');
  });

  it('follows nextPageToken for pagination', async () => {
    const page1Event = makeGoogleEvent({ id: 'g-page1' });
    const page2Event = makeGoogleEvent({ id: 'g-page2', summary: 'Page 2 Meeting' });

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(mockGoogleResponse([page1Event], 'next-token-abc'))
      .mockResolvedValueOnce(mockGoogleResponse([page2Event]));

    const { fetchGoogleCalendarEvents } = await import(
      '../../src/services/google-calendar-service.js'
    );
    const result = await fetchGoogleCalendarEvents(
      'token',
      '2024-06-01T00:00:00Z',
      '2024-07-01T00:00:00Z',
    );

    expect(result).toHaveLength(2);
    expect(result[0]!.providerEventId).toBe('g-page1');
    expect(result[1]!.providerEventId).toBe('g-page2');
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(2);
  });

  it('handles all-day events (date vs dateTime)', async () => {
    const event = makeGoogleEvent({
      id: 'g-allday',
      start: { date: '2024-06-15' },
      end: { date: '2024-06-16' },
    });

    globalThis.fetch = vi.fn().mockResolvedValue(mockGoogleResponse([event]));

    const { fetchGoogleCalendarEvents } = await import(
      '../../src/services/google-calendar-service.js'
    );
    const result = await fetchGoogleCalendarEvents(
      'token',
      '2024-06-01T00:00:00Z',
      '2024-07-01T00:00:00Z',
    );

    expect(result[0]!.isAllDay).toBe(true);
    expect(result[0]!.startAt).toBe('2024-06-15');
    expect(result[0]!.endAt).toBe('2024-06-16');
  });

  it('returns null location when not present', async () => {
    const event = makeGoogleEvent({ location: undefined });
    // Remove location key entirely
    delete (event as Record<string, unknown>)['location'];

    globalThis.fetch = vi.fn().mockResolvedValue(mockGoogleResponse([event]));

    const { fetchGoogleCalendarEvents } = await import(
      '../../src/services/google-calendar-service.js'
    );
    const result = await fetchGoogleCalendarEvents(
      'token',
      '2024-06-01T00:00:00Z',
      '2024-07-01T00:00:00Z',
    );

    expect(result[0]!.location).toBeNull();
  });
});

// ─── syncSource tests (Google) ──────────────────────────────────────────────

describe('syncSource (Google)', () => {
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

  it('upserts new Google events into DB', async () => {
    const userId = getUserId();
    const oauthId = createGoogleOAuthAccount(userId);
    const sourceId = createGoogleCalendarSource(userId, oauthId);

    const event = makeGoogleEvent({ id: 'google-evt-new' });
    globalThis.fetch = vi.fn().mockResolvedValue(mockGoogleResponse([event]));

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
    expect(stored[0]!.providerEventId).toBe('google-evt-new');
    expect(stored[0]!.title).toBe('Sprint Planning');
  });
});
