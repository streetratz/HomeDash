/**
 * T012 (004): Generic calendar sync orchestrator — upsert/delete events,
 * scheduled polling wired into Fastify lifecycle.
 */

import { eq, and, notInArray, sql } from 'drizzle-orm';
import { getDb } from '../db/drizzle.js';
import { calendarBirthdays, calendarSources, calendarEvents } from '../db/schema/index.js';
import { refreshAccessToken } from './oauth-service.js';
import { fetchMicrosoftCalendarEvents } from './microsoft-calendar-service.js';
import { fetchGoogleCalendarEvents } from './google-calendar-service.js';
import { fetchAndParseIcal, parseIcalBody } from './ical-service.js';
import type { CalendarEvent } from './calendar-types.js';
import { getSqliteDb } from '../db/sqlite.js';
import { buildBirthdayEvents } from './birthday-calendar-service.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SyncResult {
  sourceId: string;
  eventsUpserted: number;
  eventsDeleted: number;
  error: string | null;
}

interface FileSourceReplacement {
  name: string;
  color: string;
  fileName: string;
  icsContent: string;
}

// ─── syncSource ─────────────────────────────────────────────────────────────

export async function syncSource(
  sourceId: string,
  options: {
    allowDisabled?: boolean;
    fileReplacement?: FileSourceReplacement;
  } = {},
): Promise<SyncResult> {
  const db = getDb();

  // 1. Load source
  const source = db.select().from(calendarSources).where(eq(calendarSources.id, sourceId)).get();

  if (!source || (!source.enabled && !options.allowDisabled)) {
    throw new Error(`Calendar source ${sourceId} not found or disabled`);
  }

  try {
    // 2. Resolve access token (OAuth providers) or URL (iCal)
    let accessToken: string | null = null;
    if (source.type === 'microsoft' || source.type === 'google') {
      if (!source.oauthAccountId) {
        throw new Error('OAuth account not linked to calendar source');
      }
      accessToken = await refreshAccessToken(source.oauthAccountId);
    } else if (source.type === 'ical') {
      if (!source.url) {
        throw new Error('iCal source missing URL');
      }
    }
    const fileContent = options.fileReplacement?.icsContent ?? source.icsContent;
    if (source.type === 'ical_file' && !fileContent) {
      throw new Error('Uploaded iCal source is missing file content');
    }

    // 3. Compute date window — 2 months back (start of month) to 90 days forward
    const now = new Date();
    const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const startDate = twoMonthsAgo.toISOString();
    const endDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();

    // 4. Fetch events from provider
    let fetched: CalendarEvent[];
    if (source.type === 'microsoft') {
      fetched = await fetchMicrosoftCalendarEvents(accessToken!, startDate, endDate);
    } else if (source.type === 'google') {
      fetched = await fetchGoogleCalendarEvents(accessToken!, startDate, endDate);
    } else if (source.type === 'ical') {
      fetched = await fetchAndParseIcal(source.url!, startDate, endDate);
    } else if (source.type === 'ical_file') {
      fetched = parseIcalBody(fileContent!, startDate, endDate);
    } else {
      const birthdays = db
        .select()
        .from(calendarBirthdays)
        .where(eq(calendarBirthdays.sourceId, sourceId))
        .all();
      fetched = buildBirthdayEvents(birthdays, source.name, startDate, endDate);
    }

    // 5. DB transaction — upsert + prune
    const nowIso = new Date().toISOString();
    const fetchedIds = fetched.map((e) => e.providerEventId);

    const rawDb = getSqliteDb();
    const txn = rawDb.transaction(() => {
      let upserted = 0;

      for (const ev of fetched) {
        // Check if event already exists
        const existing = db
          .select({ id: calendarEvents.id })
          .from(calendarEvents)
          .where(
            and(
              eq(calendarEvents.sourceId, sourceId),
              eq(calendarEvents.providerEventId, ev.providerEventId),
            ),
          )
          .get();

        if (existing) {
          db.update(calendarEvents)
            .set({
              title: ev.title,
              description: ev.description,
              location: ev.location,
              startAt: ev.startAt,
              endAt: ev.endAt,
              startTz: ev.startTz,
              endTz: ev.endTz,
              isAllDay: ev.isAllDay,
              isPrivate: ev.isPrivate,
              calendarName: ev.calendarName,
              rawJson: ev.rawJson,
              updatedAt: nowIso,
            })
            .where(eq(calendarEvents.id, existing.id))
            .run();
        } else {
          db.insert(calendarEvents)
            .values({
              id: crypto.randomUUID(),
              sourceId,
              providerEventId: ev.providerEventId,
              title: ev.title,
              description: ev.description,
              location: ev.location,
              startAt: ev.startAt,
              endAt: ev.endAt,
              startTz: ev.startTz,
              endTz: ev.endTz,
              isAllDay: ev.isAllDay,
              isPrivate: ev.isPrivate,
              calendarName: ev.calendarName,
              rawJson: ev.rawJson,
              createdAt: nowIso,
              updatedAt: nowIso,
            })
            .run();
        }
        upserted++;
      }

      // Delete events no longer present in provider
      let deleted = 0;
      if (fetchedIds.length > 0) {
        const result = db
          .delete(calendarEvents)
          .where(
            and(
              eq(calendarEvents.sourceId, sourceId),
              notInArray(calendarEvents.providerEventId, fetchedIds),
            ),
          )
          .run();
        deleted = result.changes;
      } else {
        // All events removed upstream — delete everything for this source
        const result = db.delete(calendarEvents).where(eq(calendarEvents.sourceId, sourceId)).run();
        deleted = result.changes;
      }

      // Update source sync metadata
      db.update(calendarSources)
        .set({
          ...(options.fileReplacement ?? {}),
          lastSyncAt: nowIso,
          lastSyncError: null,
          updatedAt: nowIso,
        })
        .where(eq(calendarSources.id, sourceId))
        .run();

      return { upserted, deleted };
    });

    const { upserted, deleted } = txn();

    return { sourceId, eventsUpserted: upserted, eventsDeleted: deleted, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown sync error';
    const nowIso = new Date().toISOString();

    if (!options.fileReplacement) {
      try {
        db.update(calendarSources)
          .set({ lastSyncError: message, updatedAt: nowIso })
          .where(eq(calendarSources.id, sourceId))
          .run();
      } catch (innerErr) {
        console.error(
          `[calendar-sync] Failed to update error status for source ${sourceId}:`,
          innerErr,
        );
      }
    }

    console.error(`[calendar-sync] Error syncing source ${sourceId}: ${message}`);
    return { sourceId, eventsUpserted: 0, eventsDeleted: 0, error: message };
  }
}

// ─── Scheduler ──────────────────────────────────────────────────────────────

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

/** @deprecated Use scheduledJobService.startScheduler() instead. */
export function startSyncScheduler(): void {
  console.warn(
    '[calendar-sync] startSyncScheduler() is deprecated — use scheduledJobService.startScheduler()',
  );
  if (schedulerInterval) return;

  schedulerInterval = setInterval(() => {
    void runScheduledSync();
  }, 60_000);
}

/** @deprecated Use scheduledJobService.stopScheduler() instead. */
export function stopSyncScheduler(): void {
  console.warn(
    '[calendar-sync] stopSyncScheduler() is deprecated — use scheduledJobService.stopScheduler()',
  );
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}

export async function runScheduledSync(): Promise<void> {
  try {
    const db = getDb();

    // Local sources are regenerated once per day so recurring events continue
    // advancing into the materialized 90-day window without outbound polling.
    const dueSources = db
      .select({ id: calendarSources.id })
      .from(calendarSources)
      .where(
        and(
          eq(calendarSources.enabled, true),
          sql`(
            ${calendarSources.lastSyncAt} IS NULL
            OR (
              ${calendarSources.type} IN ('ical_file', 'birthday_local')
              AND datetime(${calendarSources.lastSyncAt}) < datetime('now', '-1 day')
            )
            OR (
              ${calendarSources.type} NOT IN ('ical_file', 'birthday_local')
              AND datetime(${calendarSources.lastSyncAt}) < datetime('now', '-' || ${calendarSources.syncIntervalSeconds} || ' seconds')
            )
          )`,
        ),
      )
      .all();

    // Sync sequentially to avoid token race conditions
    for (const source of dueSources) {
      await syncSource(source.id);
    }
  } catch (err) {
    console.error('[calendar-sync] Scheduler error:', err);
  }
}
