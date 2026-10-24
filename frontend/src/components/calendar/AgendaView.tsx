/**
 * 004 Phase 5 (T023): Agenda view — timeline layout with date labels and event cards.
 */

import { Calendar } from 'lucide-react';
import type { CalendarEvent, CalendarSource } from '../../state/calendarHooks.js';
import { toCalendarDateKey } from '../../lib/calendarDates.js';
import { collectionDateLabel } from '../../lib/collectionDates.js';
import { collectionIconComponent } from '../../lib/collectionIcons.js';
import type { CollectionDisplay } from '../../state/collectionHooks.js';

export interface AgendaViewProps {
  events: CalendarEvent[];
  sources: CalendarSource[];
  showLocation?: boolean;
  compact?: boolean;
  hour12?: boolean;
  collections?: CollectionDisplay | undefined;
}

function localDateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function formatStartTime(startAt: string, hour12?: boolean, startTz?: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12,
    timeZone: startTz || undefined,
  }).format(new Date(startAt));
}

function dayParts(dateKey: string, todayKey: string) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  const part = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en', { ...options, timeZone: 'UTC' }).format(date);
  const month = dateKey.slice(0, 7) === todayKey.slice(0, 7) ? '' : ` · ${part({ month: 'short' })}`;
  return { day: String(date.getUTCDate()), weekday: `${part({ weekday: 'short' })}${month}` };
}

const rowClass =
  'relative flex min-h-9 min-w-0 items-center gap-3 rounded-md bg-foreground/[0.06] px-2.5 py-1.5';

function RailIcon({ color, icon: Icon }: { color: string; icon: typeof Calendar }) {
  return (
    <span
      aria-hidden
      className="absolute -left-[calc(1rem+14px)] top-1/2 flex h-[26px] w-[26px] -translate-y-1/2 items-center justify-center rounded-full bg-background"
    >
      <span className="absolute inset-0 rounded-full opacity-20" style={{ backgroundColor: color }} />
      <Icon className="relative h-3.5 w-3.5" style={{ color }} />
    </span>
  );
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

  const showCollections = Boolean(collections?.timezone && collections.householdToday);
  const sortedKeys = [...new Set([...grouped.keys(), ...(showCollections ? collections!.groups.map(g => g.date) : [])])].sort();
  // Bins use household dates (spec 065); fall back to the browser date when no collections are shown.
  const todayKey = (showCollections && collections?.householdToday) || localDateKey(new Date());

  return (
    <div className="flex flex-col gap-4">
      {sortedKeys.map((dateKey) => {
        const dayEvents = grouped.get(dateKey) ?? [];
        const collectionGroup = showCollections ? collections?.groups.find(g => g.date === dateKey) : undefined;
        dayEvents.sort((a, b) => {
          if (a.isAllDay !== b.isAllDay) return a.isAllDay ? -1 : 1;
          return new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
        });

        const isToday = dateKey === todayKey;
        const { day, weekday } = dayParts(dateKey, todayKey);

        return (
          <section
            key={dateKey}
            aria-current={isToday ? 'date' : undefined}
            className="flex flex-col gap-1.5 px-3"
          >
            <h4 className="flex items-baseline gap-2">
              <span
                aria-hidden
                className={
                  isToday
                    ? 'text-2xl font-bold tabular-nums leading-none text-foreground'
                    : 'text-lg font-semibold tabular-nums leading-none text-foreground/80'
                }
              >
                {day}
              </span>
              <span
                aria-hidden
                className={`text-xs font-semibold uppercase tracking-wider ${isToday ? 'text-primary' : 'text-foreground/70'}`}
              >
                {isToday ? `${weekday} · Today` : weekday}
              </span>
              <span className="sr-only">{collectionDateLabel(dateKey, todayKey)}</span>
            </h4>

            {/* Timeline: collections first, then events; every row shares one icon-on-rail pattern */}
            <div className="relative ml-3 flex flex-col gap-1 border-l-2 border-foreground/20 pl-4">
              {collectionGroup && (
                <ul
                  className="flex flex-col gap-1"
                  aria-label={dateKey === collections?.groups[0]?.date ? 'Next collection' : 'Later collection'}
                >
                  {collectionGroup.streams.map((stream) => (
                    <li key={stream.key} className={rowClass}>
                      <RailIcon color={stream.color} icon={collectionIconComponent(stream.icon)} />
                      <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-foreground">
                        {stream.name}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {dayEvents.length > 0 && (
                <ul className="flex flex-col gap-1" aria-label="Events">
                  {dayEvents.map((event) => {
                    const source = sourceMap.get(event.sourceId);
                    const color = source?.color ?? '#3b82f6';
                    return (
                      <li key={event.id} className={rowClass}>
                        <RailIcon color={color} icon={Calendar} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-medium text-foreground">
                            {event.title}
                            {source?.name && <span className="sr-only"> ({source.name})</span>}
                          </p>
                          {!compact && showLocation && event.location && (
                            <p className="truncate text-xs text-foreground/70">📍 {event.location}</p>
                          )}
                        </div>
                        <span className="shrink-0 whitespace-nowrap text-[13px] tabular-nums text-foreground/70">
                          {event.isAllDay ? 'All Day' : formatStartTime(event.startAt, hour12, event.startTz ?? undefined)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        );
      })}
      {showCollections && collections!.groups.length > 0 && (
        <p className="px-3 text-xs text-muted-foreground">Collections in {collections!.timezone}</p>
      )}
    </div>
  );
}
