/**
 * T076 (US2): Clock strip component.
 *
 * Renders a horizontal strip of digital clocks with:
 * - HH:MM display only (no seconds)
 * - Day/night indicator (sun FA icon 06:00–17:59, moon FA icon 18:00–05:59)
 * - Home clock highlighted with a FontAwesome house icon
 * - Configurable alignment (left / center / right)
 * - Up to 5 extra clocks alongside the home clock
 * - Updates every minute
 * - Per-clock display config: column (stacked) or row (horizontal) layout,
 *   optional GMT±XX offset, and configurable icon positions.
 */

import { useState, useEffect, useCallback } from 'react';
import { Home, Sun, Moon } from 'lucide-react';
import type { Clock, ClockDisplayConfig } from '../state/bootstrap.js';
import { useClockFormat } from '../state/bootstrap.js';

interface ClockStripProps {
  /** Clocks to display (home clock first with isHome=true, then extras). */
  clocks: Clock[];
  /** Horizontal alignment of the clock strip. Defaults to 'center'. */
  alignment?: 'left' | 'center' | 'right';
  /** Global display config from shell settings (fallback when no home clock). */
  clockDisplayConfig?: ClockDisplayConfig;
}

/** Format a Date in a specific IANA timezone as HH:MM (no seconds). */
function formatTime(date: Date, timezone: string, hour12: boolean): string {
  try {
    return new Intl.DateTimeFormat(hour12 ? undefined : 'en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12,
      timeZone: timezone,
    }).format(date);
  } catch {
    return '--:--';
  }
}

/** Return the abbreviated timezone label (e.g. "BST", "EST"). */
function formatTzAbbr(date: Date, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      timeZoneName: 'short',
    }).formatToParts(date);
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? timezone;
  } catch {
    return timezone;
  }
}

/** Return the UTC±XX numeric offset string (e.g. "UTC+11"). */
function formatUtcOffset(date: Date, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      timeZoneName: 'longOffset',
    }).formatToParts(date);
    const raw = parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
    // Intl returns "GMT+11:00" — convert to "UTC+11"
    return raw.replace(/^GMT/, 'UTC').replace(/:00$/, '');
  } catch {
    return '';
  }
}

/** Return the local hour (0–23) in the given timezone. */
function getLocalHour(date: Date, timezone: string): number {
  try {
    const hourStr = new Intl.DateTimeFormat('en-GB', {
      hour: 'numeric',
      hour12: false,
      timeZone: timezone,
    }).format(date);
    return parseInt(hourStr, 10);
  } catch {
    return 12;
  }
}

const ALIGNMENT_CLASSES: Record<'left' | 'center' | 'right', string> = {
  left: 'justify-start',
  center: 'justify-center',
  right: 'justify-end',
};

// ─── Row-layout clock item ────────────────────────────────────────────────────

function ClockItemRow({
  clock,
  now,
  isHome,
  cfg,
  hour12,
}: {
  clock: Clock;
  now: Date;
  isHome: boolean;
  cfg: ClockDisplayConfig;
  hour12: boolean;
}) {
  const time = formatTime(now, clock.timezone, hour12);
  const utcOffset = formatUtcOffset(now, clock.timezone);
  const hour = getLocalHour(now, clock.timezone);
  const isDay = hour >= 6 && hour < 18;

  const homeIconSide = cfg.homeIconSide ?? 'left';
  const dayNightSide = cfg.dayNightSide ?? 'right';

  const HomeIcon = isHome ? (
    <Home
      className="w-3 h-3 text-indigo-500 dark:text-indigo-400 shrink-0"
      aria-label="Home timezone"
    />
  ) : null;

  const DayNightIcon = (
    <span
      className={['text-[11px] leading-none shrink-0', isDay ? 'text-yellow-500 dark:text-yellow-400' : 'text-blue-500 dark:text-blue-300'].join(' ')}
      aria-label={isDay ? 'Day' : 'Night'}
    >
      {isDay ? <Sun className="w-3 h-3" /> : <Moon className="w-3 h-3" />}
    </span>
  );

  return (
    <div
      className={[
        'flex flex-col rounded px-3 py-1.5',
        isHome
          ? 'bg-indigo-100 ring-1 ring-indigo-300 dark:bg-indigo-900/40 dark:ring-indigo-500/40'
          : 'bg-gray-200/80 dark:bg-gray-800/60',
      ].join(' ')}
      data-testid={isHome ? 'clock-home' : 'clock-extra'}
      aria-label={`${clock.label}: ${time}`}
    >
      {/* Main row: [HomeIcon?] [Time] [DayNight?] — label omitted for home clock */}
      <div className="flex items-center gap-1.5">
        {isHome && homeIconSide === 'left' && HomeIcon}
        {dayNightSide === 'left' && DayNightIcon}
        {!isHome && <span className="text-[10px] leading-none text-gray-500 dark:text-gray-400 whitespace-nowrap">{clock.label}</span>}
        <span className="font-mono text-sm font-semibold tabular-nums text-gray-800 dark:text-gray-100 leading-none whitespace-nowrap">
          {time}
        </span>
        {dayNightSide === 'right' && DayNightIcon}
        {isHome && homeIconSide === 'right' && HomeIcon}
      </div>
      {/* UTC offset — centered */}
      {cfg.showOffset && utcOffset && (
        <span className="text-[9px] leading-none text-gray-400 dark:text-gray-500 mt-0.5 text-center w-full">{utcOffset}</span>
      )}
    </div>
  );
}

// ─── Column-layout clock item (default) ──────────────────────────────────────

function ClockItemColumn({
  clock,
  now,
  isHome,
  cfg,
  hour12,
}: {
  clock: Clock;
  now: Date;
  isHome: boolean;
  cfg: ClockDisplayConfig;
  hour12: boolean;
}) {
  const time = formatTime(now, clock.timezone, hour12);
  const tzAbbr = formatTzAbbr(now, clock.timezone);
  const utcOffset = formatUtcOffset(now, clock.timezone);
  const hour = getLocalHour(now, clock.timezone);
  const isDay = hour >= 6 && hour < 18;

  return (
    <div
      className={[
        'flex flex-col items-center rounded px-3 py-1.5 text-center min-w-[60px]',
        isHome
          ? 'bg-indigo-100 ring-1 ring-indigo-300 dark:bg-indigo-900/40 dark:ring-indigo-500/40'
          : 'bg-gray-200/80 dark:bg-gray-800/60',
      ].join(' ')}
      data-testid={isHome ? 'clock-home' : 'clock-extra'}
      aria-label={`${clock.label}: ${time}`}
    >
      {/* Day/Night indicator */}
      <span
        className={['text-[10px] leading-none mb-0.5', isDay ? 'text-yellow-500 dark:text-yellow-400' : 'text-blue-500 dark:text-blue-300'].join(' ')}
        aria-label={isDay ? 'Day' : 'Night'}
      >
        {isDay ? <Sun className="w-2.5 h-2.5" /> : <Moon className="w-2.5 h-2.5" />}
      </span>
      {/* Time */}
      <span className="font-mono text-sm font-semibold tabular-nums text-gray-800 dark:text-gray-100 leading-none">
        {time}
      </span>
      {/* Label — hidden for home clock (icon is sufficient); shown for extra clocks */}
      <span className="mt-0.5 flex items-center gap-1 text-[10px] leading-none text-gray-500 dark:text-gray-400">
        {isHome ? (
          <Home className="w-2 h-2 text-indigo-500 dark:text-indigo-400" aria-label="Home timezone" />
        ) : (
          clock.label
        )}
      </span>
      {/* TZ abbreviation or UTC offset — centered */}
      <span className="text-[9px] leading-none text-gray-400 dark:text-gray-500 mt-0.5 text-center">
        {cfg.showOffset && utcOffset ? utcOffset : tzAbbr}
      </span>
    </div>
  );
}

// ─── Unified clock item dispatcher ───────────────────────────────────────────

/**
 * Renders a single clock using the global display config for layout/icons,
 * but the clock-specific showOffset flag for the UTC offset.
 */
function ClockItem({
  clock,
  now,
  isHome,
  globalCfg,
  hour12,
}: {
  clock: Clock;
  now: Date;
  isHome: boolean;
  globalCfg: ClockDisplayConfig;
  hour12: boolean;
}) {
  // showOffset is global — driven solely by the home clock config
  const effectiveCfg: ClockDisplayConfig = {
    ...globalCfg,
    showOffset: globalCfg.showOffset ?? false,
  };
  if (effectiveCfg.layout === 'row') {
    return <ClockItemRow clock={clock} now={now} isHome={isHome} cfg={effectiveCfg} hour12={hour12} />;
  }
  return <ClockItemColumn clock={clock} now={now} isHome={isHome} cfg={effectiveCfg} hour12={hour12} />;
}

export function ClockStrip({ clocks, alignment = 'center', clockDisplayConfig }: ClockStripProps) {
  const [now, setNow] = useState(() => new Date());
  const { hour12 } = useClockFormat();

  const tick = useCallback(() => setNow(new Date()), []);

  useEffect(() => {
    // Align to the next minute boundary for efficiency (no seconds shown)
    const msUntilNextMinute = (60 - new Date().getSeconds()) * 1000 - new Date().getMilliseconds();
    let interval: ReturnType<typeof setInterval>;
    const timeout = setTimeout(() => {
      tick();
      interval = setInterval(tick, 60_000);
    }, msUntilNextMinute);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [tick]);

  if (clocks.length === 0) return null;

  // Global display config: prefer shell-level config, fall back to home clock's config
  const globalCfg: ClockDisplayConfig = clockDisplayConfig ?? clocks.find((c) => c.isHome)?.config ?? {};

  return (
    <div
      className={['flex items-center gap-2 overflow-x-auto px-4 py-2', ALIGNMENT_CLASSES[alignment]].join(' ')}
      role="region"
      aria-label="Clock strip"
      data-testid="clock-strip"
    >
      {clocks.map((clock) => (
        <ClockItem
          key={`${clock.timezone}-${String(clock.isHome)}`}
          clock={clock}
          now={now}
          isHome={clock.isHome}
          globalCfg={globalCfg}
          hour12={hour12}
        />
      ))}
    </div>
  );
}
