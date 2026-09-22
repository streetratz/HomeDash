/**
 * Full-screen month calendar overlay.
 *
 * Opened from the CalendarWidget expand button. Shows a month grid with
 * prev/next navigation and a day detail panel on click.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, MapPin, Calendar } from 'lucide-react';
import { Button } from '../ui/button.js';
import type { CalendarEvent, CalendarSource } from '../../state/calendarHooks.js';
import { useCalendarEvents } from '../../state/calendarHooks.js';
import { useClockFormat } from '../../state/bootstrap.js';
import { toCalendarDateKey } from '../../lib/calendarDates.js';

export interface FullScreenCalendarProps {
  /** All configured source IDs to fetch events for (empty = use all sources passed) */
  sourceIds: string[];
  sources: CalendarSource[];
  showPrivateEvents?: boolean;
  onClose: () => void;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
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

export function FullScreenCalendar({ sourceIds, sources, showPrivateEvents, onClose }: FullScreenCalendarProps) {
  const todayKey = useMemo(() => toDateKey(new Date()), []);
  const { hour12 } = useClockFormat();

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState<string>(todayKey);

  // Fetch events for the full visible month range (includes overflow days from prev/next month)
  const [from, to] = useMemo(() => {
    const { year, month } = currentMonth;
    const start = new Date(year, month, 1);
    // Go back to fill the first week row
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(year, month + 1, 0);
    // Go forward to fill the last week row
    end.setDate(end.getDate() + (6 - end.getDay()) + 1);
    // Include UTC-midnight all-day events on the visible edge dates.
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() + 1);
    return [start.toISOString(), end.toISOString()] as const;
  }, [currentMonth]);

  const allSourceIds = useMemo(
    () => (sourceIds.length > 0 ? sourceIds : sources.map((s) => s.id)),
    [sourceIds, sources],
  );

  const eventsQuery = useCalendarEvents(allSourceIds, from, to);
  const events = useMemo(() => {
    const raw = eventsQuery.data ?? [];
    return showPrivateEvents ? raw : raw.filter((ev) => !ev.isPrivate);
  }, [eventsQuery.data, showPrivateEvents]);

  // Close on Escape key
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const sourceMap = useMemo(() => new Map(sources.map((s) => [s.id, s])), [sources]);

  // Build event map: dateKey → CalendarEvent[]
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = toCalendarDateKey(event.startAt, event.isAllDay);
      const list = map.get(key);
      if (list) {
        list.push(event);
      } else {
        map.set(key, [event]);
      }
    }
    return map;
  }, [events]);

  const { year, month } = currentMonth;
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);

  const monthLabel = new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month, 1));

  const prevMonth = useCallback(() => {
    setCurrentMonth((prev) => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 };
      return { ...prev, month: prev.month - 1 };
    });
  }, []);

  const nextMonth = useCallback(() => {
    setCurrentMonth((prev) => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 };
      return { ...prev, month: prev.month + 1 };
    });
  }, []);

  const goToToday = useCallback(() => {
    const now = new Date();
    setCurrentMonth({ year: now.getFullYear(), month: now.getMonth() });
    setSelectedDate(todayKey);
  }, [todayKey]);

  // Grid cells
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length < 42) cells.push(null);

  // Selected day events
  const selectedEvents = (eventsByDate.get(selectedDate) ?? []).sort((a, b) => {
    if (a.isAllDay !== b.isAllDay) return a.isAllDay ? -1 : 1;
    return new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
  });

  // Format selected date for header
  const selectedDateFormatted = (() => {
    const [y, m, d] = selectedDate.split('-').map(Number) as [number, number, number];
    const date = new Date(y, m - 1, d);
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="flex h-full w-full sm:h-[85vh] sm:w-[85vw] max-w-[1400px] flex-col overflow-hidden rounded-none sm:rounded-xl border border-border bg-background/90 shadow-2xl backdrop-blur">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={prevMonth}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-lg font-semibold">{monthLabel}</h2>
          <Button variant="ghost" size="icon" onClick={nextMonth}>
            <ChevronRight className="h-5 w-5" />
          </Button>
          <Button variant="outline" size="sm" className="ml-2" onClick={goToToday}>
            Today
          </Button>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Main content: calendar grid + day detail sidebar */}
      <div className="flex min-h-0 flex-1 flex-col sm:flex-row overflow-y-auto sm:overflow-hidden">
        {/* Month grid */}
        <div className="flex flex-1 flex-col p-4">
          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 border-b pb-2 text-center text-xs font-medium text-muted-foreground">
            {DAY_LABELS.map((label) => (
              <div key={label}>{label}</div>
            ))}
          </div>

          {/* Calendar grid — fill available space */}
          <div className="grid flex-1 grid-cols-7 grid-rows-6">
            {cells.map((day, i) => {
              if (day === null) {
                return <div key={`empty-${i}`} className="border-b border-r border-border/30" />;
              }

              const dateKey = `${year}-${pad(month + 1)}-${pad(day)}`;
              const isToday = dateKey === todayKey;
              const isSelected = dateKey === selectedDate;
              const dayEvents = eventsByDate.get(dateKey) ?? [];

              return (
                <button
                  key={dateKey}
                  type="button"
                  onClick={() => setSelectedDate(dateKey)}
                  className={`relative flex flex-col border-b border-r border-border/30 p-1 text-left transition-colors hover:bg-accent overflow-hidden ${
                    isSelected ? 'bg-accent' : ''
                  }`}
                >
                  <span
                    className={`mb-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs shrink-0 ${
                      isToday
                        ? 'bg-primary text-primary-foreground font-bold'
                        : 'text-foreground'
                    }`}
                  >
                    {day}
                  </span>
                  {/* Event list */}
                  {dayEvents.length > 0 && (
                    <div className="flex min-h-0 flex-1 flex-col gap-px overflow-hidden">
                      {dayEvents.slice(0, 3).map((evt) => {
                        const source = sourceMap.get(evt.sourceId);
                        const color = source?.color ?? '#3b82f6';
                        return (
                          <div
                            key={evt.id}
                            className="flex items-center gap-1 truncate rounded px-1 py-px text-[10px] leading-tight"
                            style={{ backgroundColor: `${color}20`, borderLeft: `2px solid ${color}` }}
                          >
                            <span className="truncate">{evt.title}</span>
                          </div>
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <span className="px-1 text-[9px] text-muted-foreground">+{dayEvents.length - 3} more</span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Day detail sidebar */}
        <div className="w-full sm:w-80 shrink-0 overflow-y-auto border-t sm:border-t-0 sm:border-l p-4">
          <h3 className="mb-3 text-sm font-semibold">{selectedDateFormatted}</h3>
          {selectedEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
              <Calendar className="h-6 w-6" />
              <p className="text-sm">No events on this day</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {selectedEvents.map((event) => {
                const source = sourceMap.get(event.sourceId);
                const color = source?.color ?? '#3b82f6';
                return (
                  <div
                    key={event.id}
                    className="widget-panel flex items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-colors hover:bg-card/75"
                  >
                    {/* Colored dot */}
                    <div
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}60` }}
                    />
                    {/* Event info */}
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{event.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {event.isAllDay
                          ? 'All Day'
                          : formatTimeRange(event.startAt, event.endAt, hour12, event.startTz ?? undefined)}
                      </p>
                      {event.location && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground/70 truncate">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{event.location}</span>
                        </p>
                      )}
                    </div>
                    {/* Source badge — uses configured name from settings */}
                    {source?.name && (
                      <span
                        className="shrink-0 mt-0.5 text-[10px] px-2 py-0.5 rounded-full border border-white/[0.1]"
                        style={{ color }}
                      >
                        {source.name}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
