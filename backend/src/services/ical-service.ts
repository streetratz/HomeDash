/**
 * T016 (004): iCal parser service — fetch and parse .ics URLs with recurring event expansion.
 */

import * as ical from 'node-ical';
import type { VEvent, CalendarResponse, ParameterValue, EventInstance } from 'node-ical';
import type { CalendarEvent } from './calendar-types.js';

const FETCH_TIMEOUT_MS = 30_000;
export const MAX_ICS_BODY_BYTES = 5 * 1024 * 1024;
export const MAX_ICS_JSON_BODY_BYTES = MAX_ICS_BODY_BYTES * 2 + 64 * 1024;

/**
 * Fetch an iCal URL and parse events within the given date window.
 * Handles recurring events via node-ical's expandRecurringEvent.
 */
export async function fetchAndParseIcal(
  url: string,
  startDate: string,
  endDate: string,
): Promise<CalendarEvent[]> {
  const body = await fetchIcsBody(url);
  return parseIcalBody(body, startDate, endDate);
}

export function validateIcalBody(body: string): void {
  if (Buffer.byteLength(body, 'utf8') > MAX_ICS_BODY_BYTES) {
    throw new Error(`iCal content too large (max ${MAX_ICS_BODY_BYTES} bytes)`);
  }
  if (!body.includes('BEGIN:VCALENDAR') || !body.includes('END:VCALENDAR')) {
    throw new Error('Content is not a valid iCalendar file');
  }
}

/**
 * Parse an iCalendar body and expand events within the requested date window.
 * Shared by URL-backed and uploaded-file sources.
 */
export function parseIcalBody(
  body: string,
  startDate: string,
  endDate: string,
): CalendarEvent[] {
  validateIcalBody(body);
  const parsed: CalendarResponse = ical.sync.parseICS(body);
  const calendarName = parsed.vcalendar?.['WR-CALNAME'] ?? null;

  const start = new Date(startDate);
  const end = new Date(endDate);

  const events: CalendarEvent[] = [];

  for (const key of Object.keys(parsed)) {
    const component = parsed[key];
    if (!component || component.type !== 'VEVENT') continue;

    const vevent = component;
    const eventUid = requireEventUid(vevent.uid);

    if (vevent.rrule) {
      // Recurring event — expand occurrences within the window
      const instances: EventInstance[] = ical.expandRecurringEvent(vevent, {
        from: start,
        to: end,
        excludeExdates: true,
        includeOverrides: true,
      });

      for (const instance of instances) {
        const mapped = mapInstance(instance, vevent, calendarName, eventUid);
        if (mapped.startAt >= startDate && mapped.startAt <= endDate) {
          events.push(mapped);
        }
      }
    } else {
      // Non-recurring — map directly if in window
      const mapped = mapVEvent(vevent, calendarName, eventUid);
      if (mapped.startAt >= startDate && mapped.startAt <= endDate) {
        events.push(mapped);
      }
    }
  }

  events.sort((a, b) => a.startAt.localeCompare(b.startAt));
  return events;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function fetchIcsBody(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`iCal fetch failed: HTTP ${response.status}`);
    }

    // Check Content-Length header if present
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_ICS_BODY_BYTES) {
      throw new Error(
        `iCal response too large (${contentLength} bytes, max ${MAX_ICS_BODY_BYTES})`,
      );
    }

    // Stream body with size accumulation
    const reader = response.body?.getReader();
    if (!reader) {
      return await response.text();
    }

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    for (;;) {
      const result = await reader.read();
      if (result.done) break;
      const chunk = result.value as Uint8Array;
      totalBytes += chunk.byteLength;
      if (totalBytes > MAX_ICS_BODY_BYTES) {
        void reader.cancel();
        throw new Error(`iCal response too large (exceeded ${MAX_ICS_BODY_BYTES} bytes)`);
      }
      chunks.push(chunk);
    }

    const decoder = new TextDecoder();
    return chunks.map((c) => decoder.decode(c, { stream: true })).join('') + decoder.decode();
  } finally {
    clearTimeout(timeout);
  }
}

function extractParamValue(val: ParameterValue | undefined): string | null {
  if (val == null) return null;
  if (typeof val === 'string') return val;
  return val.val ?? null;
}

/** Check iCal CLASS property — PRIVATE or CONFIDENTIAL means private. */
function isPrivateClass(vevent: VEvent): boolean {
  const cls = vevent['class'];
  if (!cls) return false;
  const upper = String(cls).toUpperCase();
  return upper === 'PRIVATE' || upper === 'CONFIDENTIAL';
}

function dateToUtcIso(d: Date, isAllDay = false): string {
  if (isAllDay || (d as Date & { dateOnly?: true }).dateOnly) {
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString();
  }
  return d.toISOString();
}

function requireEventUid(uid: unknown): string {
  if (typeof uid !== 'string' || uid.trim() === '') {
    throw new Error('iCalendar event is missing UID');
  }
  return uid.trim();
}

function mapVEvent(
  vevent: VEvent,
  calendarName: string | null,
  eventUid: string,
): CalendarEvent {
  const isAllDay = vevent.datetype === 'date';
  const startAt = dateToUtcIso(vevent.start, isAllDay);
  const endAt = vevent.end ? dateToUtcIso(vevent.end, isAllDay) : startAt;
  const startTz = (vevent.start as Date & { tz?: string }).tz ?? null;
  const endTz = vevent.end ? ((vevent.end as Date & { tz?: string }).tz ?? null) : null;
  const description = extractParamValue(vevent.description);

  return {
    providerEventId: eventUid,
    title: extractParamValue(vevent.summary) ?? 'Untitled',
    description: description ? description.slice(0, 500) : null,
    location: extractParamValue(vevent.location) ?? null,
    startAt,
    endAt,
    startTz,
    endTz,
    isAllDay,
    isPrivate: isPrivateClass(vevent),
    calendarName,
    rawJson: null,
  };
}

function mapInstance(
  instance: EventInstance,
  baseEvent: VEvent,
  calendarName: string | null,
  eventUid: string,
): CalendarEvent {
  const startAt = dateToUtcIso(instance.start, instance.isFullDay);
  const endAt = dateToUtcIso(instance.end, instance.isFullDay);
  const startTz = (instance.start as Date & { tz?: string }).tz ?? null;
  const endTz = (instance.end as Date & { tz?: string }).tz ?? null;
  const description = extractParamValue(baseEvent.description);

  // For recurring events, use UID + occurrence start date as unique ID
  const occurrenceDate = instance.start.toISOString().split('T')[0];
  const providerEventId = instance.isRecurring
    ? `${eventUid}-${occurrenceDate}`
    : eventUid;

  return {
    providerEventId,
    title: extractParamValue(instance.summary) ?? 'Untitled',
    description: description ? description.slice(0, 500) : null,
    location: extractParamValue(baseEvent.location) ?? null,
    startAt,
    endAt,
    startTz,
    endTz,
    isAllDay: instance.isFullDay,
    isPrivate: isPrivateClass(baseEvent),
    calendarName,
    rawJson: null,
  };
}
