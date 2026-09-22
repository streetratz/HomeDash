/**
 * 004 Phase 5 (T023): Agenda view — timeline layout with date labels and event cards.
 */

import { Calendar } from 'lucide-react';
import type { CalendarEvent, CalendarSource } from '../../state/calendarHooks.js';
import { toCalendarDateKey } from '../../lib/calendarDates.js';

export interface AgendaViewProps {
  events: CalendarEvent[];
  sources: CalendarSource[];
  showLocation?: boolean;
  compact?: boolean;
  hour12?: boolean;
}

function getDayInfo(dateKey: string): { label: string; dayNum: string; isToday: boolean } {
  const today = new Date();
  const todayKey = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = [
    tomorrow.getFullYear(),
    String(tomorrow.getMonth() + 1).padStart(2, '0'),
    String(tomorrow.getDate()).padStart(2, '0'),
  ].join('-');

  const [y, m, d] = dateKey.split('-').map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d);
  const dayNum = String(d);

  if (dateKey === todayKey) return { label: 'Today', dayNum, isToday: true };
  if (dateKey === tomorrowKey) return { label: 'Tomorrow', dayNum, isToday: false };

  const label = new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date);
  return { label, dayNum, isToday: false };
}

function formatTimeRange(startAt: string, endAt: string, hour12?: boolean, startTz?: string): string {
  const opts: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    hour12,
    timeZone: startTz || undefined,
  };
  const fmt = new Intl.DateTimeFormat(undefined, opts);
  const start = fmt.format(new Date(startAt));
  const end = fmt.format(new Date(endAt));
  return `${start} – ${end}`;
}

export function AgendaView({ events, sources, showLocation = true, compact = false, hour12 }: AgendaViewProps) {
  const sourceMap = new Map(sources.map((s) => [s.id, s]));

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
        <Calendar className="h-8 w-8" />
        <p className="text-sm">No upcoming events</p>
      </div>
    );
  }

  // Group by date
  const grouped = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = toCalendarDateKey(event.startAt, event.isAllDay);
    const list = grouped.get(key);
    if (list) {
      list.push(event);
    } else {
      grouped.set(key, [event]);
    }
  }

  const sortedKeys = [...grouped.keys()].sort();

  return (
    <div className="flex flex-col gap-5">
      {sortedKeys.map((dateKey) => {
        const dayEvents = grouped.get(dateKey)!;
        dayEvents.sort((a, b) => {
          if (a.isAllDay !== b.isAllDay) return a.isAllDay ? -1 : 1;
          return new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
        });

        const { label, dayNum, isToday } = getDayInfo(dateKey);

        return (
          <div key={dateKey} className="flex flex-col gap-1.5">
            {/* Date header row */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {label}
              </span>
              <span
                className={`text-sm font-semibold ${
                  isToday
                    ? 'flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs'
                    : 'text-foreground'
                }`}
              >
                {dayNum}
              </span>
            </div>

            {/* Timeline + events */}
            <div className="relative flex flex-col gap-2 border-l-2 border-white/10 ml-3 pl-4">
              {dayEvents.map((event) => {
                const source = sourceMap.get(event.sourceId);
                const color = source?.color ?? '#3b82f6';

                if (compact) {
                  return (
                    <div
                      key={event.id}
                      className="widget-panel relative flex items-center gap-2 rounded-lg border px-3 py-2"
                    >
                      {/* Timeline dot — centered on border line */}
                      <div
                        className="absolute -left-[calc(1rem+4px)] top-1/2 -translate-y-1/2 h-2 w-2 rounded-full"
                        style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}60` }}
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {event.isAllDay
                          ? 'All Day'
                          : new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(event.startAt))}
                      </span>
                      <span className="truncate text-sm text-foreground">{event.title}</span>
                    </div>
                  );
                }

                return (
                  <div
                    key={event.id}
                    className="widget-panel relative flex items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-colors hover:bg-card/75"
                  >
                    {/* Timeline dot — centered on border line */}
                    <div
                      className="absolute -left-[calc(1rem+4px)] top-4 h-2 w-2 rounded-full"
                      style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}60` }}
                    />
                    {/* Event info */}
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{event.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {event.isAllDay ? 'All Day' : formatTimeRange(event.startAt, event.endAt, hour12, event.startTz ?? undefined)}
                      </p>
                      {showLocation && event.location && (
                        <p className="mt-0.5 text-xs text-muted-foreground truncate">
                          📍 {event.location}
                        </p>
                      )}
                    </div>
                    {/* Source badge */}
                    {source?.name && (
                      <span
                        className="shrink-0 mt-0.5 text-[10px] px-2 py-0.5 rounded-full border border-white/[0.1] dark:border-white/[0.1] light-badge-border"
                        style={{ color }}
                      >
                        {source.name}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
