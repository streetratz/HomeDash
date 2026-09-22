/**
 * 002 Phase 4 (US2): Clock/Date widget display component.
 *
 * Renders live time using Intl.DateTimeFormat with configurable timezone,
 * 12/24hr format, optional date line, and optional seconds display.
 *
 * FR-020: Clock/Date widget with live updates.
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import type { WidgetDisplayProps } from './registry.js';
import type { ClockConfig } from '../../state/dashboards.js';

function getClockConfig(widget: WidgetDisplayProps['widget']): ClockConfig {
  const raw = widget.config as Partial<ClockConfig> | undefined;
  return {
    timezone: raw?.timezone ?? null,
    format: raw?.format ?? '12h',
    showDate: raw?.showDate ?? true,
    showSeconds: raw?.showSeconds ?? true,
  };
}

function resolveTimeZone(timezone: string | null | undefined): string | undefined {
  if (!timezone) return undefined;
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return timezone;
  } catch (error) {
    if (error instanceof RangeError) return undefined;
    throw error;
  }
}

export function ClockWidget({ widget }: WidgetDisplayProps) {
  const config = getClockConfig(widget);
  const [now, setNow] = useState(() => new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const timeZone = useMemo(() => resolveTimeZone(config.timezone), [config.timezone]);

  // Update interval: 1s if seconds shown, 1min otherwise
  const intervalMs = config.showSeconds ? 1_000 : 60_000;

  useEffect(() => {
    intervalRef.current = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(intervalRef.current);
  }, [intervalMs]);

  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        second: config.showSeconds ? '2-digit' : undefined,
        hour12: config.format === '12h',
        timeZone,
      }),
    [config.format, config.showSeconds, timeZone],
  );

  const dateFormatter = useMemo(
    () =>
      config.showDate
        ? new Intl.DateTimeFormat(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            timeZone,
          })
        : null,
    [config.showDate, timeZone],
  );

  const timeStr = timeFormatter.format(now);
  const dateStr = dateFormatter?.format(now);

  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-0.5 p-2"
      data-testid="clock-widget"
      data-format={config.format}
      data-timezone={timeZone ?? 'local'}
    >
      <div
        className="text-2xl font-bold tabular-nums tracking-tight text-foreground sm:text-3xl"
        data-testid="clock-time"
      >
        {timeStr}
      </div>
      {dateStr && (
        <div className="text-xs text-muted-foreground" data-testid="clock-date">
          {dateStr}
        </div>
      )}
      {timeZone && (
        <div
          className="text-[10px] text-muted-foreground/60"
          data-testid="clock-timezone"
        >
          {timeZone.replace(/_/g, ' ')}
        </div>
      )}
    </div>
  );
}
