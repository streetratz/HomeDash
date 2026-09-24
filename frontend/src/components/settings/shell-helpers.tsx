/**
 * Shared shell settings helper components — used by AppearanceTab and potentially others.
 * Extracted from the former ShellTab.tsx.
 */

import { Button } from '../ui/button.js';
import { Input } from '../ui/input.js';
import { Switch } from '../ui/switch.js';
import { X, ChevronUp, ChevronDown } from 'lucide-react';
import type { ClockDisplayConfig } from '../../state/bootstrap.js';

// ── Alignment Picker ─────────────────────────────────────────────────────────

export function AlignmentPicker({
  value,
  onChange,
}: {
  value: 'left' | 'center' | 'right';
  onChange: (v: 'left' | 'center' | 'right') => void;
}) {
  const options: Array<{ v: 'left' | 'center' | 'right'; label: string }> = [
    { v: 'left', label: 'Left' },
    { v: 'center', label: 'Center' },
    { v: 'right', label: 'Right' },
  ];
  return (
    <div className="flex gap-1">
      {options.map(({ v, label }) => (
        <Button
          key={v}
          type="button"
          variant={value === v ? 'default' : 'secondary'}
          size="sm"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}

// ── Timezone Combobox ────────────────────────────────────────────────────────

export const ALL_TIMEZONES: string[] = (() => {
  try {
    const tzList = (
      Intl as unknown as { supportedValuesOf: (k: string) => string[] }
    ).supportedValuesOf('timeZone');
    return tzList.includes('UTC') ? tzList : ['UTC', ...tzList];
  } catch {
    return ['UTC'];
  }
})();

export function TimezoneCombobox({
  value,
  onChange,
  placeholder,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  id?: string;
}) {
  const listId = id ? `${id}-tzlist` : 'tzlist-main';
  return (
    <>
      <Input
        id={id}
        type="text"
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'Search timezone…'}
        autoComplete="off"
        spellCheck={false}
      />
      <datalist id={listId}>
        {ALL_TIMEZONES.map((tz) => (
          <option key={tz} value={tz} />
        ))}
      </datalist>
      <p className="mt-0.5 text-[10px] text-muted-foreground">
        IANA timezone name.{' '}
        <a
          href="https://en.wikipedia.org/wiki/List_of_tz_database_time_zones"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          Browse the list ↗
        </a>
      </p>
    </>
  );
}

// ── Clock Display Config Picker (global — applies to all clocks) ─────────────

export function ClockDisplayConfigPicker({
  value,
  onChange,
}: {
  value: ClockDisplayConfig;
  onChange: (v: ClockDisplayConfig) => void;
}) {
  const layout = value.layout ?? 'column';
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Layout</span>
        <div className="flex gap-1">
          {(['column', 'row'] as const).map((l) => (
            <Button
              key={l}
              type="button"
              variant={layout === l ? 'default' : 'secondary'}
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() => onChange({ ...value, layout: l })}
            >
              {l === 'column' ? 'Stacked' : 'Horizontal'}
            </Button>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Show UTC offset</span>
        <Switch
          checked={value.showOffset ?? false}
          onCheckedChange={(checked) => onChange({ ...value, showOffset: checked })}
        />
      </div>
      {layout === 'row' && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Day/Night Icon Location</span>
          <div className="flex gap-1">
            {(['left', 'right'] as const).map((s) => (
              <Button
                key={s}
                type="button"
                variant={(value.dayNightSide ?? 'right') === s ? 'default' : 'secondary'}
                size="sm"
                className="h-7 px-3 text-xs"
                onClick={() => onChange({ ...value, dayNightSide: s })}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Extra Timezone Row (compact single-line) ─────────────────────────────────

export function ExtraTimezoneRow({
  index,
  entry,
  total,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  index: number;
  entry: { label: string; timezone: string };
  total: number;
  onChange: (updated: { label: string; timezone: string }) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="text"
        value={entry.label}
        onChange={(e) => onChange({ ...entry, label: e.target.value })}
        placeholder="Label"
        maxLength={32}
        className="h-8 w-20 shrink-0 text-xs"
        aria-label={`Clock ${index + 1} label`}
      />
      <Input
        type="text"
        list={`extra-tz-${index}-list`}
        value={entry.timezone}
        onChange={(e) => onChange({ ...entry, timezone: e.target.value })}
        placeholder="Timezone…"
        autoComplete="off"
        spellCheck={false}
        className="h-8 min-w-0 flex-1 text-xs"
        aria-label={`Clock ${index + 1} timezone`}
      />
      <datalist id={`extra-tz-${index}-list`}>
        {ALL_TIMEZONES.map((tz) => (
          <option key={tz} value={tz} />
        ))}
      </datalist>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground"
        onClick={onMoveUp}
        disabled={index === 0}
        aria-label="Move up"
      >
        <ChevronUp className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground"
        onClick={onMoveDown}
        disabled={index === total - 1}
        aria-label="Move down"
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRemove}
        aria-label="Remove clock"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
