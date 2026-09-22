/**
 * T011 (004): Microsoft Graph calendar client — fetch calendar events with pagination.
 */

import type { CalendarEvent } from './calendar-types.js';

export type { CalendarEvent } from './calendar-types.js';

// ─── Graph API response types ───────────────────────────────────────────────

interface GraphDateTime {
  dateTime: string;
  timeZone: string;
}

interface GraphEvent {
  id: string;
  subject: string;
  start: GraphDateTime;
  end: GraphDateTime;
  location?: { displayName?: string };
  isAllDay: boolean;
  sensitivity?: string;
  calendar?: { name?: string };
  body?: { content?: string; contentType?: string };
}

interface GraphCalendarViewResponse {
  value: GraphEvent[];
  '@odata.nextLink'?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Strip HTML tags and truncate to maxLen characters. */
function stripHtml(html: string, maxLen: number): string {
  const text = html.replace(/<[^>]*>/g, '').trim();
  return text.length > maxLen ? text.slice(0, maxLen) : text;
}

/** Convert a Graph dateTime + timeZone to an ISO-8601 UTC string. */
function toUtcIso(dt: GraphDateTime): string {
  // Graph returns dateTime like "2024-06-15T09:00:00.0000000" with a separate timeZone.
  // If timeZone is "UTC" the datetime is already UTC; otherwise we store as-is
  // since full timezone conversion requires a tz library — the raw value is
  // an ISO-ish string that Date can parse.
  const raw = dt.dateTime;
  // Ensure it ends with Z if the timezone is UTC
  if (dt.timeZone === 'UTC') {
    return raw.endsWith('Z') ? raw : `${raw}Z`;
  }
  // For other timezones, return the datetime as-is — consumers use startTz for display
  return raw.endsWith('Z') ? raw : `${raw}Z`;
}

// ─── Public API ─────────────────────────────────────────────────────────────

const MAX_PAGES = 10;

export async function fetchMicrosoftCalendarEvents(
  accessToken: string,
  startDate: string,
  endDate: string,
): Promise<CalendarEvent[]> {
  const events: CalendarEvent[] = [];

  let url: string | null =
    `https://graph.microsoft.com/v1.0/me/calendarView` +
    `?startDateTime=${encodeURIComponent(startDate)}` +
    `&endDateTime=${encodeURIComponent(endDate)}` +
    `&$top=250` +
    `&$select=subject,start,end,location,isAllDay,sensitivity,recurrence,calendar,body`;

  for (let page = 0; page < MAX_PAGES && url; page++) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'outlook.timezone="UTC"',
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Microsoft Graph API error ${res.status}: ${text}`);
    }

    const data = (await res.json()) as GraphCalendarViewResponse;

    for (const ev of data.value) {
      events.push({
        providerEventId: ev.id,
        title: ev.subject,
        description: ev.body?.content ? stripHtml(ev.body.content, 500) : null,
        location: ev.location?.displayName || null,
        startAt: toUtcIso(ev.start),
        endAt: toUtcIso(ev.end),
        startTz: ev.start.timeZone || null,
        endTz: ev.end.timeZone || null,
        isAllDay: ev.isAllDay,
        isPrivate: ev.sensitivity === 'private' || ev.sensitivity === 'confidential',
        calendarName: ev.calendar?.name || null,
        rawJson: JSON.stringify(ev),
      });
    }

    url = data['@odata.nextLink'] ?? null;
  }

  return events;
}
