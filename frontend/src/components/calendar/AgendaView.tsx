/**
 * 004 Phase 5 (T023): Agenda view — timeline layout with date labels and event cards.
 */

import { Calendar } from 'lucide-react';
import type { CalendarEvent, CalendarSource } from '../../state/calendarHooks.js';
import { toCalendarDateKey } from '../../lib/calendarDates.js';
import { CollectionGroup } from './CollectionGroup.js';
import type { CollectionDisplay } from '../../state/collectionHooks.js';

export interface AgendaViewProps {
  events: CalendarEvent[];
  sources: CalendarSource[];
  showLocation?: boolean;
  compact?: boolean;
  hour12?: boolean;
  collections?: CollectionDisplay | undefined;
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

export function AgendaView({ events, sources, showLocation = true, compact = false, hour12, collections }: AgendaViewProps) {
  const sourceMap = new Map(sources.map((s) => [s.id, s]));

  if (events.length === 0 && !collections?.groups.length) {
    if (collections) return null; // The collection branch owns its permitted empty-state copy.
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

  const sortedKeys = [...new Set([...grouped.keys(), ...(collections?.groups.map(g => g.date) ?? [])])].sort();

  return (
    <div className="flex flex-col gap-5">
      {sortedKeys.map((dateKey) => {
        const dayEvents = grouped.get(dateKey) ?? [];
        const collectionGroup = collections?.groups.find(g => g.date === dateKey);
        dayEvents.sort((a, b) => {
          if (a.isAllDay !== b.isAllDay) return a.isAllDay ? -1 : 1;
          return new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
        });

        const { label, dayNum, isToday } = getDayInfo(dateKey);

        return (
          <div key={dateKey} className="flex flex-col gap-1.5">
            {collectionGroup && collections?.timezone && collections.householdToday &&
              <CollectionGroup group={collectionGroup} timezone={collections.timezone} today={collections.householdToday} next={dateKey === collections.groups[0]?.date} />}
            {dayEvents.length > 0 && (
            <section
              aria-current={isToday ? 'date' : undefined}
              className={`flex flex-col gap-2 rounded-lg border ${
                isToday ? 'border-border bg-muted/40 p-3' : 'border-transparent px-3'
              }`}
            >
            {/* Date header row */}
            <div className="flex items-center gap-2">
              <span
                className={`flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-sm font-semibold tabular-nums ${
                  isToday ? 'bg-primary text-primary-foreground' : 'text-foreground'
                }`}
              >
                {dayNum}
              </span>
              <span
                className={`text-xs font-semibold uppercase tracking-wide ${
                  isToday ? 'text-foreground' : 'text-foreground/75'
                }`}
              >
                {label}
              </span>
            </div>

            {/* Timeline + events */}
            <div className="relative ml-3 flex flex-col gap-2 border-l-2 border-foreground/20 pl-4">
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
                        className="absolute -left-[calc(1rem+6px)] top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full ring-2 ring-background"
                        style={{ backgroundColor: color }}
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
                      className="absolute -left-[calc(1rem+6px)] top-4 h-2.5 w-2.5 rounded-full ring-2 ring-background"
                      style={{ backgroundColor: color }}
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
            </section>
            )}
          </div>
        );
      })}
    </div>
  );
}
