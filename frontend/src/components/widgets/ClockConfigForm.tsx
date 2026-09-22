/**
 * 002 Phase 4 (US2): Clock/Date widget configuration form.
 *
 * Provides timezone picker, 12/24hr format toggle, and showDate/showSeconds
 * checkboxes. Uses Intl.supportedValuesOf('timeZone') with fallback.
 *
 * FR-020: Clock widget configuration.
 */

import { useMemo } from 'react';
import { Label } from '../ui/label.js';
import { Switch } from '../ui/switch.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select.js';
import type { WidgetConfigFormProps } from './registry.js';
import type { ClockConfig } from '../../state/dashboards.js';

/** Get timezone list with browser fallback */
function getTimezones(): string[] {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    // Fallback for environments without supportedValuesOf
    return [
      'UTC',
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'Europe/London',
      'Europe/Paris',
      'Asia/Tokyo',
      'Asia/Shanghai',
      'Australia/Sydney',
    ];
  }
}

function parseConfig(config: unknown): ClockConfig {
  const raw = (config ?? {}) as Partial<ClockConfig>;
  return {
    timezone: raw.timezone ?? null,
    format: raw.format ?? '12h',
    showDate: raw.showDate ?? true,
    showSeconds: raw.showSeconds ?? true,
  };
}

export function ClockConfigForm({ config, onChange }: WidgetConfigFormProps) {
  const c = parseConfig(config);
  const timezones = useMemo(() => getTimezones(), []);

  function update(patch: Partial<ClockConfig>) {
    onChange({ ...c, ...patch });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Timezone */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="clock-tz">Timezone</Label>
        <Select
          value={c.timezone ?? '__browser__'}
          onValueChange={(value) => update({ timezone: value === '__browser__' ? null : value })}
        >
          <SelectTrigger id="clock-tz" className="min-h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__browser__">Browser default</SelectItem>
            {timezones.map((tz) => (
              <SelectItem key={tz} value={tz}>
                {tz.replace(/_/g, ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Format */}
      <div className="flex flex-col gap-1.5">
        <Label id="clock-format-label">Time Format</Label>
        <div className="flex gap-2" role="group" aria-labelledby="clock-format-label">
          <button
            type="button"
            className={`rounded-md border px-3 py-1.5 text-sm ${
              c.format === '12h'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:border-primary/50'
            }`}
            onClick={() => update({ format: '12h' })}
            aria-pressed={c.format === '12h'}
          >
            12-hour
          </button>
          <button
            type="button"
            className={`rounded-md border px-3 py-1.5 text-sm ${
              c.format === '24h'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:border-primary/50'
            }`}
            onClick={() => update({ format: '24h' })}
            aria-pressed={c.format === '24h'}
          >
            24-hour
          </button>
        </div>
      </div>

      {/* Show Date */}
      <div className="flex items-center justify-between">
        <Label htmlFor="clock-date">Show Date</Label>
        <Switch
          id="clock-date"
          checked={c.showDate}
          onCheckedChange={(checked) => update({ showDate: checked })}
        />
      </div>

      {/* Show Seconds */}
      <div className="flex items-center justify-between">
        <Label htmlFor="clock-seconds">Show Seconds</Label>
        <Switch
          id="clock-seconds"
          checked={c.showSeconds}
          onCheckedChange={(checked) => update({ showSeconds: checked })}
        />
      </div>
    </div>
  );
}
