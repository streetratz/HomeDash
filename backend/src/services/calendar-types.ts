/**
 * T011/T014 (004): Shared calendar event type used by all provider clients.
 */

export interface CalendarEvent {
  providerEventId: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: string; // ISO UTC
  endAt: string; // ISO UTC
  startTz: string | null;
  endTz: string | null;
  isAllDay: boolean;
  isPrivate: boolean;
  calendarName: string | null;
  rawJson: string | null;
}
