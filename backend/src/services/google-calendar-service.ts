/**
 * T014 (004): Google Calendar API client — fetch events with pagination.
 */

import type { CalendarEvent } from './calendar-types.js';

export type { CalendarEvent } from './calendar-types.js';

// ─── Google API response types ──────────────────────────────────────────────

interface GoogleEventDateTime {
  dateTime?: string;
  date?: string;
  timeZone?: string;
}

interface GoogleEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  visibility?: string;
  start: GoogleEventDateTime;
  end: GoogleEventDateTime;
  organizer?: { displayName?: string };
}

interface GoogleEventsResponse {
  items: GoogleEvent[];
  nextPageToken?: string;
}

// ─── Public API ─────────────────────────────────────────────────────────────

const MAX_PAGES = 10;

export async function fetchGoogleCalendarEvents(
  accessToken: string,
  startDate: string,
  endDate: string,
): Promise<CalendarEvent[]> {
  const events: CalendarEvent[] = [];

  const baseUrl =
    `https://www.googleapis.com/calendar/v3/calendars/primary/events` +
    `?timeMin=${encodeURIComponent(startDate)}` +
    `&timeMax=${encodeURIComponent(endDate)}` +
    `&singleEvents=true` +
    `&orderBy=startTime` +
    `&maxResults=250`;

  let pageToken: string | null = null;

  for (let page = 0; page < MAX_PAGES; page++) {
    const fetchUrl = pageToken ? `${baseUrl}&pageToken=${encodeURIComponent(pageToken)}` : baseUrl;

    const res = await fetch(fetchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Google Calendar API error ${res.status}: ${text}`);
    }

    const data = (await res.json()) as GoogleEventsResponse;

    for (const ev of data.items) {
      const isAllDay = Boolean(ev.start.date && !ev.start.dateTime);

      events.push({
        providerEventId: ev.id,
        title: ev.summary ?? '(No title)',
        description:
          ev.description && ev.description.length > 500
            ? ev.description.slice(0, 500)
            : (ev.description ?? null),
        location: ev.location || null,
        startAt: ev.start.dateTime ?? ev.start.date ?? '',
        endAt: ev.end.dateTime ?? ev.end.date ?? '',
        startTz: ev.start.timeZone || null,
        endTz: ev.end.timeZone || null,
        isAllDay,
        isPrivate: ev.visibility === 'private' || ev.visibility === 'confidential',
        calendarName: ev.organizer?.displayName || null,
        rawJson: JSON.stringify(ev),
      });
    }

    if (data.nextPageToken) {
      pageToken = data.nextPageToken;
    } else {
      break;
    }
  }

  return events;
}
