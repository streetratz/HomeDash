/**
 * 004 Phase 5 (T026): Calendar widget display component.
 *
 * Default view: today's agenda list with an expand button that opens
 * a full-screen month view overlay with prev/next month navigation.
 */

import { useMemo, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Expand, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button.js';
import { Skeleton } from '../ui/skeleton.js';
import type { WidgetDisplayProps } from './registry.js';
import {
  useCalendarEvents,
  useCalendarSources,
  useSyncCalendarSource,
} from '../../state/calendarHooks.js';
import { AgendaView } from '../calendar/AgendaView.js';
import { FullScreenCalendar } from '../calendar/FullScreenCalendar.js';
import { useClockFormat } from '../../state/bootstrap.js';
import { toCalendarDateKey, toLocalDateKey } from '../../lib/calendarDates.js';

interface CalendarConfig {
  sourceIds: string[];
  viewMode: 'compact' | 'expanded';
  daysAhead: number;
  maxEvents: number;
  showLocation: boolean;
  showPrivateEvents: boolean;
}

function parseConfig(widget: WidgetDisplayProps['widget']): CalendarConfig {
  const raw = (widget.config ?? {}) as Partial<CalendarConfig>;
  return {
    sourceIds: raw.sourceIds ?? [],
    viewMode: raw.viewMode === 'compact' ? 'compact' : 'expanded',
    daysAhead: raw.daysAhead ?? 7,
    maxEvents: raw.maxEvents ?? 25,
    showLocation: raw.showLocation ?? true,
    showPrivateEvents: raw.showPrivateEvents ?? false,
  };
}

function useCurrentTime(): number {
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return currentTime;
}

export function CalendarWidget({ widget }: WidgetDisplayProps) {
  const config = parseConfig(widget);
  const [expanded, setExpanded] = useState(false);
  const { hour12 } = useClockFormat();
  const syncMutation = useSyncCalendarSource();
  const [syncing, setSyncing] = useState(false);

  const sourcesQuery = useCalendarSources();
  const currentTime = useCurrentTime();

  // Compute most recent sync time across configured sources
  const lastSyncLabel = useMemo(() => {
    const sources = sourcesQuery.data ?? [];
    const syncTimes = sources
      .filter((s) => config.sourceIds.includes(s.id) && s.lastSyncAt)
      .map((s) => new Date(s.lastSyncAt!).getTime());
    if (syncTimes.length === 0) return null;
    const latest = Math.max(...syncTimes);
    const mins = Math.round((currentTime - latest) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ago`;
  }, [sourcesQuery.data, config.sourceIds, currentTime]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      await Promise.all(config.sourceIds.map((sid) => syncMutation.mutateAsync(sid)));
      // Brief minimum spin so user sees feedback
      await new Promise((r) => setTimeout(r, 600));
    } finally {
      setSyncing(false);
    }
  }, [config.sourceIds, syncMutation]);

  // Stable date range — start of today to daysAhead days out.
  // Uses start-of-day so past events today still appear in the agenda.
  const { from, to, visibleFrom, visibleTo } = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + config.daysAhead);
    const queryStart = new Date(start);
    queryStart.setDate(queryStart.getDate() - 1);
    const queryEnd = new Date(end);
    queryEnd.setDate(queryEnd.getDate() + 1);
    return {
      from: queryStart.toISOString(),
      to: queryEnd.toISOString(),
      visibleFrom: toLocalDateKey(start),
      visibleTo: toLocalDateKey(end),
    };
  }, [config.daysAhead]);

  const eventsQuery = useCalendarEvents(config.sourceIds, from, to);

  // Loading (initial load only — don't show skeleton on refetch/sync)
  if (
    (!sourcesQuery.data && sourcesQuery.isLoading) ||
    (!eventsQuery.data && eventsQuery.isLoading)
  ) {
    return (
      <div className="flex flex-col gap-2 p-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  // No sources configured
  if (config.sourceIds.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-sm text-muted-foreground">
        Configure calendar sources in Settings
      </div>
    );
  }

  // Error
  if (eventsQuery.isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-4 text-center">
        <AlertTriangle className="h-6 w-6 text-status-warning" />
        <p className="text-sm text-muted-foreground">Calendar unavailable</p>
        <Button variant="outline" size="sm" onClick={() => void eventsQuery.refetch()}>
          <RefreshCw className="mr-1 h-3.5 w-3.5" />
          Retry
        </Button>
      </div>
    );
  }

  const rawEvents = eventsQuery.data ?? [];
  const visibleEvents = rawEvents.filter((event) => {
    const key = toCalendarDateKey(event.startAt, event.isAllDay);
    return key >= visibleFrom && key <= visibleTo;
  });
  // Filter private events unless config says to show them
  const filteredEvents = config.showPrivateEvents
    ? visibleEvents
    : visibleEvents.filter((ev) => !ev.isPrivate);
  const events = filteredEvents.slice(0, config.maxEvents);
  const sources = sourcesQuery.data ?? [];

  return (
    <div className="flex h-full flex-col px-3 py-2">
      {/* Toolbar: expand left, sync right */}
      <div className="flex items-center justify-between shrink-0 pb-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          title="Open month view"
          onClick={() => setExpanded(true)}
        >
          <Expand className="h-3 w-3" />
        </Button>
        <div className="flex items-center gap-1">
          {lastSyncLabel && (
            <span className="text-[10px] text-muted-foreground/60">Synced {lastSyncLabel}</span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            title="Sync calendars"
            onClick={() => void handleSync()}
            disabled={syncing}
          >
            <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Agenda */}
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        <AgendaView
          events={events}
          sources={sources}
          showLocation={config.viewMode === 'expanded' && config.showLocation}
          compact={config.viewMode === 'compact'}
          hour12={hour12}
        />
      </div>

      {/* Full-screen month overlay — portalled to body to escape widget transforms */}
      {expanded &&
        createPortal(
          <FullScreenCalendar
            sourceIds={sources.map((s) => s.id)}
            sources={sources}
            showPrivateEvents={config.showPrivateEvents}
            onClose={() => setExpanded(false)}
          />,
          document.body,
        )}
    </div>
  );
}
