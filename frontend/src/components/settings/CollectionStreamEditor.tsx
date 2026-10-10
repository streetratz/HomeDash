import { useId, useState } from 'react';
import type { CollectionStream } from '../../state/collectionHooks.js';
import { Input } from '../ui/input.js';
import { Button } from '../ui/button.js';
import { ColorPicker } from '../ui/color-picker.js';
import { CollectionIconPicker } from './CollectionIconPicker.js';
import {
  CollectionExplicitDatesEditor,
  validCollectionDate,
} from './CollectionExplicitDatesEditor.js';
import { CollectionExceptionEditor } from './CollectionExceptionEditor.js';

const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

type Repeat = 'off' | 'weekly' | 'fortnightly' | 'custom';

function repeatOf(stream: CollectionStream): Repeat {
  if (stream.schedule.mode === 'explicit') return 'off';
  if (stream.schedule.intervalWeeks === 1) return 'weekly';
  if (stream.schedule.intervalWeeks === 2) return 'fortnightly';
  return 'custom';
}

function firstDateOf(stream: CollectionStream): string {
  if (stream.schedule.mode === 'explicit') {
    return stream.schedule.dates.find(validCollectionDate) ?? '';
  }
  return stream.schedule.startDate || stream.schedule.anchorDate;
}

export function CollectionStreamEditor({
  stream,
  onChange,
  disabled = false,
}: {
  stream: CollectionStream;
  onChange: (stream: CollectionStream, confirmedRemoval?: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const [pendingRepeat, setPendingRepeat] = useState<Repeat | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const regular = stream.schedule.mode === 'regular' ? stream.schedule : null;
  const exceptions = 'exceptions' in stream ? stream.exceptions : [];
  const repeat = repeatOf(stream);

  const common = {
    id: stream.id,
    name: stream.name,
    color: stream.color,
    icon: stream.icon,
    enabled: stream.enabled,
  };

  const date = regular ? new Date(`${regular.anchorDate}T00:00:00Z`) : null;
  const anchorValid =
    !!date &&
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === regular?.anchorDate &&
    regular.weekdays.includes(date.getUTCDay() || 7) &&
    regular.anchorDate >= '1900-01-01' &&
    regular.anchorDate <= '2199-12-31';
  const colorValid = /^#[0-9a-f]{6}$/i.test(stream.color);
  const nameValid =
    stream.name.trim().length > 0 &&
    stream.name.length <= 80 &&
    ![...stream.name].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127);
  const intervalValid =
    regular &&
    Number.isInteger(regular.intervalWeeks) &&
    regular.intervalWeeks >= 1 &&
    regular.intervalWeeks <= 52;
  const startDate = regular?.startDate ?? null;
  const endDate = regular?.endDate ?? null;
  const boundsValid = !startDate || !endDate || startDate <= endDate;
  const explicitSingle =
    stream.schedule.mode === 'explicit' ? (stream.schedule.dates[0] ?? '') : '';

  // Build a regular schedule from a first date, preserving the chosen interval.
  function toRegular(intervalWeeks: number): CollectionStream {
    const first = firstDateOf(stream) || '2026-10-12';
    const anchorDate = validCollectionDate(first) ? first : '2026-10-12';
    const weekday = new Date(`${anchorDate}T00:00:00Z`).getUTCDay() || 7;
    return {
      ...common,
      schedule: {
        mode: 'regular',
        weekdays: [weekday],
        intervalWeeks,
        anchorDate,
        startDate: anchorDate,
        endDate: null,
      },
      exceptions: [],
    };
  }

  function commitRepeat(next: Repeat) {
    setPendingRepeat(null);
    if (next === 'off') {
      const existing = firstDateOf(stream);
      onChange(
        { ...common, schedule: { mode: 'explicit', dates: existing ? [existing] : [] } },
        true,
      );
      return;
    }
    if (repeat === 'off') {
      onChange(toRegular(next === 'weekly' ? 1 : next === 'fortnightly' ? 2 : 1), true);
      return;
    }
    if (!regular) return;
    const intervalWeeks =
      next === 'weekly' ? 1 : next === 'fortnightly' ? 2 : regular.intervalWeeks;
    onChange({ ...stream, exceptions, schedule: { ...regular, intervalWeeks } });
  }

  function applyRepeat(next: Repeat) {
    if (next === repeat) return;
    const crossesFamily = (next === 'off') !== (repeat === 'off');
    if (crossesFamily && (exceptions.length || explicitSingle)) {
      setPendingRepeat(next);
      return;
    }
    commitRepeat(next);
  }

  function setFirstDate(value: string) {
    if (!regular) return;
    onChange({ ...stream, exceptions, schedule: { ...regular, startDate: value || null } });
  }

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 text-sm">
          Event title
          <Input
            value={stream.name}
            maxLength={80}
            aria-invalid={!nameValid}
            aria-describedby={!nameValid ? `${id}-name` : undefined}
            onChange={(e) => onChange({ ...stream, name: e.target.value })}
          />
        </label>
        <CollectionIconPicker
          value={stream.icon}
          name={stream.name}
          disabled={disabled}
          onChange={(icon) => onChange({ ...stream, icon })}
        />
        <div className="space-y-1 text-sm">
          <p>Colour</p>
          <ColorPicker
            value={stream.color}
            ariaLabel={`Change colour for ${stream.name || 'custom event'}`}
            ariaInvalid={!colorValid}
            ariaDescribedBy={!colorValid ? `${id}-color` : undefined}
            className="h-11 w-11"
            disabled={disabled}
            onChange={(color) => onChange({ ...stream, color })}
          />
        </div>
      </div>
      {!nameValid && (
        <p id={`${id}-name`} role="alert" className="text-sm text-destructive">
          Enter a title of 1–80 characters without control characters.
        </p>
      )}
      {!colorValid && (
        <p id={`${id}-color`} role="alert" className="text-sm text-destructive">
          Use a six-digit hex colour such as #DC2626.
        </p>
      )}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <label className="block w-full text-sm sm:w-64">
          Repeat
          <select
            className="min-h-11 w-full rounded-md border border-border bg-background px-3"
            value={repeat}
            onChange={(e) => applyRepeat(e.target.value as Repeat)}
          >
            <option value="off">Off (single date)</option>
            <option value="weekly">Weekly</option>
            <option value="fortnightly">Every 2 weeks (fortnightly)</option>
            <option value="custom">Custom (every N weeks)</option>
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={stream.enabled}
            onChange={(e) => onChange({ ...stream, enabled: e.target.checked })}
          />
          Enabled
        </label>
      </div>
      {pendingRepeat && (
        <div role="alert" className="space-y-2 text-sm">
          <p>
            {pendingRepeat === 'off'
              ? 'Turning off repeat removes this event’s recurrence rule and exceptions, keeping a single date. Nothing is discarded until you save.'
              : 'Turning on repeat replaces the single/explicit dates with a recurring rule. Nothing is discarded until you save.'}
          </p>
          <Button
            className="min-h-11"
            variant="destructive"
            onClick={() => commitRepeat(pendingRepeat)}
          >
            Confirm repeat change
          </Button>
          <Button className="min-h-11" variant="ghost" onClick={() => setPendingRepeat(null)}>
            Keep current repeat
          </Button>
        </div>
      )}

      {stream.schedule.mode === 'explicit' && (
        <div className="space-y-3">
          <label className="block text-sm">
            Date
            <Input
              type="date"
              min="1900-01-01"
              max="2199-12-31"
              value={explicitSingle}
              onChange={(e) =>
                onChange({
                  ...stream,
                  schedule: {
                    mode: 'explicit',
                    dates:
                      stream.schedule.mode === 'explicit'
                        ? e.target.value
                          ? [e.target.value, ...stream.schedule.dates.slice(1)]
                          : stream.schedule.dates.slice(1)
                        : e.target.value
                          ? [e.target.value]
                          : [],
                  },
                })
              }
            />
          </label>
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 px-0 text-sm underline"
            onClick={() => setAdvanced((prev) => !prev)}
          >
            {advanced ? 'Hide extra dates' : 'Add more dates (advanced)'}
          </Button>
          {advanced && stream.schedule.mode === 'explicit' && (
            <CollectionExplicitDatesEditor
              dates={stream.schedule.dates}
              onChange={(dates) => onChange({ ...stream, schedule: { mode: 'explicit', dates } })}
            />
          )}
        </div>
      )}

      {regular && (
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Repeat on</legend>
          <div className="grid max-w-sm grid-cols-7 gap-1">
            {weekdays.map((day, i) => (
              <label key={day} title={day} className="min-w-0 cursor-pointer">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  aria-label={day}
                  checked={regular.weekdays.includes(i + 1)}
                  aria-describedby={!regular.weekdays.length ? `${id}-weekdays` : undefined}
                  onChange={(e) =>
                    onChange({
                      ...stream,
                      exceptions,
                      schedule: {
                        ...regular,
                        weekdays: e.target.checked
                          ? [...regular.weekdays, i + 1].sort((a, b) => a - b)
                          : regular.weekdays.filter((d) => d !== i + 1),
                      },
                    })
                  }
                />
                <span className="flex min-h-11 items-center justify-center rounded-md border border-border text-sm font-medium text-muted-foreground peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring peer-disabled:cursor-not-allowed peer-disabled:opacity-50">
                  {day[0]}
                </span>
              </label>
            ))}
          </div>
          {!regular.weekdays.length && (
            <p id={`${id}-weekdays`} role="alert" className="text-sm text-destructive">
              Choose at least one weekday.
            </p>
          )}
          <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {repeat === 'custom' && (
              <label className="text-sm">
                Every (weeks)
                <Input
                  type="number"
                  min={1}
                  max={52}
                  step={1}
                  value={Number.isFinite(regular.intervalWeeks) ? regular.intervalWeeks : ''}
                  aria-invalid={!intervalValid}
                  aria-describedby={!intervalValid ? `${id}-interval` : undefined}
                  onChange={(e) =>
                    onChange({
                      ...stream,
                      exceptions,
                      schedule: {
                        ...regular,
                        intervalWeeks: e.target.value === '' ? 0 : Number(e.target.value),
                      },
                    })
                  }
                />
              </label>
            )}
            <label className="text-sm">
              Normal date (cycle anchor)
              <Input
                type="date"
                min="1900-01-01"
                max="2199-12-31"
                value={regular.anchorDate}
                aria-label="Normal date (cycle anchor)"
                aria-invalid={!anchorValid}
                aria-describedby={`${id}-anchor`}
                onChange={(e) =>
                  onChange({
                    ...stream,
                    exceptions,
                    schedule: { ...regular, anchorDate: e.target.value },
                  })
                }
              />
              <p
                id={`${id}-anchor`}
                className={`mt-1 text-xs ${anchorValid ? 'text-muted-foreground' : 'text-destructive'}`}
              >
                {anchorValid
                  ? 'Sets the repeat cycle, not the start date.'
                  : 'Choose a valid normal date on a selected weekday.'}
              </p>
            </label>
            <label className="text-sm">
              First date (optional)
              <Input
                type="date"
                min="1900-01-01"
                max="2199-12-31"
                value={startDate ?? ''}
                aria-label="First date (optional)"
                aria-describedby={`${id}-first`}
                onChange={(e) => setFirstDate(e.target.value)}
              />
              <p id={`${id}-first`} className="mt-1 text-xs text-muted-foreground">
                No events before this date. Blank means no start limit.
              </p>
            </label>
            <div className="text-sm">
              <p className="mb-1">Ends</p>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex min-h-11 items-center gap-2">
                  <input
                    type="radio"
                    name={`${id}-ends`}
                    checked={!endDate}
                    onChange={() =>
                      onChange({ ...stream, exceptions, schedule: { ...regular, endDate: null } })
                    }
                  />
                  Never
                </label>
                <label className="flex min-h-11 items-center gap-2">
                  <input
                    type="radio"
                    name={`${id}-ends`}
                    checked={!!endDate}
                    onChange={() =>
                      onChange({
                        ...stream,
                        exceptions,
                        schedule: { ...regular, endDate: startDate ?? regular.anchorDate },
                      })
                    }
                  />
                  On date
                </label>
                {endDate && (
                  <Input
                    type="date"
                    min="1900-01-01"
                    max="2199-12-31"
                    value={endDate}
                    aria-label="End date"
                    aria-invalid={!boundsValid}
                    onChange={(e) =>
                      onChange({
                        ...stream,
                        exceptions,
                        schedule: { ...regular, endDate: e.target.value || null },
                      })
                    }
                  />
                )}
              </div>
            </div>
          </div>
          {!intervalValid && (
            <p id={`${id}-interval`} role="alert" className="text-sm text-destructive">
              Choose an integer interval from 1 to 52 weeks.
            </p>
          )}
          {!boundsValid && (
            <p role="alert" className="text-sm text-destructive">
              The end date must be on or after the first date.
            </p>
          )}
        </fieldset>
      )}

      {regular && (
        <div className="space-y-2">
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 px-0 text-sm underline"
            onClick={() => setAdvanced((prev) => !prev)}
          >
            {advanced ? 'Hide single-occurrence changes' : 'Single-occurrence changes (advanced)'}
          </Button>
          {advanced && (
            <CollectionExceptionEditor
              exceptions={exceptions}
              onChange={(next, confirmed) =>
                onChange({ ...stream, schedule: regular, exceptions: next }, confirmed)
              }
            />
          )}
        </div>
      )}
    </div>
  );
}
