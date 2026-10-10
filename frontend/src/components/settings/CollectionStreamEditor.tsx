import { useId, useState } from 'react';
import type { CollectionStream } from '../../state/collectionHooks.js';
import { Input } from '../ui/input.js';
import { Button } from '../ui/button.js';
import {
  CollectionExplicitDatesEditor,
  validCollectionDate,
} from './CollectionExplicitDatesEditor.js';
import { CollectionExceptionEditor } from './CollectionExceptionEditor.js';

const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export function CollectionStreamEditor({
  stream,
  onChange,
}: {
  stream: CollectionStream;
  onChange: (stream: CollectionStream, confirmedRemoval?: boolean) => void;
}) {
  const id = useId();
  const [modeChange, setModeChange] = useState(false);
  const regular = stream.schedule.mode === 'regular' ? stream.schedule : null;
  const exceptions = 'exceptions' in stream ? stream.exceptions : [];
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
  return (
    <div className="min-w-0 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Stream name
          <Input
            value={stream.name}
            maxLength={80}
            aria-invalid={!nameValid}
            aria-describedby={!nameValid ? `${id}-name` : undefined}
            onChange={(e) => onChange({ ...stream, name: e.target.value })}
          />
        </label>
        <label className="text-sm">
          Hex colour
          <Input
            value={stream.color}
            maxLength={7}
            aria-invalid={!colorValid}
            aria-describedby={!colorValid ? `${id}-color` : undefined}
            onChange={(e) => onChange({ ...stream, color: e.target.value })}
          />
        </label>
      </div>
      {!nameValid && (
        <p id={`${id}-name`} role="alert" className="text-sm text-destructive">
          Enter a name of 1–80 characters without control characters.
        </p>
      )}
      {!colorValid && (
        <p id={`${id}-color`} role="alert" className="text-sm text-destructive">
          Use a six-digit hex colour such as #DC2626.
        </p>
      )}
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={stream.enabled}
          onChange={(e) => onChange({ ...stream, enabled: e.target.checked })}
        />
        Enabled
      </label>
      <div className="space-y-2">
        <p className="text-sm font-medium">
          Schedule mode: {regular ? 'Regular cycle' : 'Explicit dates'}
        </p>
        <Button className="min-h-11" variant="outline" onClick={() => setModeChange(true)}>
          Switch to {regular ? 'explicit dates' : 'regular cycle'}
        </Button>
        {modeChange && (
          <div role="alert" className="space-y-2 text-sm">
            <p>
              {regular
                ? 'Switching removes all regular exceptions and replaces the cycle with a finite explicit list.'
                : 'Switching clears every explicit date and replaces the finite list with a regular cycle.'}{' '}
              No date or exception is discarded until you confirm and save.
            </p>
            <Button
              className="min-h-11"
              variant="destructive"
              onClick={() => {
                const common = {
                  id: stream.id,
                  name: stream.name,
                  color: stream.color,
                  enabled: stream.enabled,
                };
                if (regular)
                  onChange({ ...common, schedule: { mode: 'explicit', dates: [] } }, true);
                else {
                  const first =
                    stream.schedule.mode === 'explicit'
                      ? stream.schedule.dates.find(validCollectionDate)
                      : undefined;
                  const anchorDate = first ?? '2026-10-12';
                  const weekday = new Date(`${anchorDate}T00:00:00Z`).getUTCDay() || 7;
                  onChange(
                    {
                      ...common,
                      schedule: {
                        mode: 'regular',
                        weekdays: [weekday],
                        intervalWeeks: 1,
                        anchorDate,
                      },
                      exceptions: [],
                    },
                    true,
                  );
                }
                setModeChange(false);
              }}
            >
              Confirm schedule mode change
            </Button>
            <Button className="min-h-11" variant="ghost" onClick={() => setModeChange(false)}>
              Keep current mode
            </Button>
          </div>
        )}
      </div>
      {stream.schedule.mode === 'explicit' && (
        <CollectionExplicitDatesEditor
          dates={stream.schedule.dates}
          onChange={(dates) => onChange({ ...stream, schedule: { mode: 'explicit', dates } })}
        />
      )}
      {regular && (
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Active weekdays (Monday–Sunday week)</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {weekdays.map((day, i) => (
              <label key={day} className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
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
                {day}
              </label>
            ))}
          </div>
          {!regular.weekdays.length && (
            <p id={`${id}-weekdays`} role="alert" className="text-sm text-destructive">
              Choose at least one weekday.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Interval (weeks)
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
            <label className="text-sm">
              Normal collection date
              <Input
                type="date"
                min="1900-01-01"
                max="2199-12-31"
                value={regular.anchorDate}
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
            </label>
          </div>
          {!intervalValid && (
            <p id={`${id}-interval`} role="alert" className="text-sm text-destructive">
              Choose an integer interval from 1 to 52 weeks.
            </p>
          )}
          <p
            id={`${id}-anchor`}
            className={`text-sm ${anchorValid ? 'text-muted-foreground' : 'text-destructive'}`}
          >
            {anchorValid
              ? `Every ${regular.intervalWeeks} week${regular.intervalWeeks === 1 ? '' : 's'}, on each selected weekday of the active week. The normal date anchors the cycle, not a start boundary.`
              : 'Choose a valid normal date on a selected weekday.'}
          </p>
        </fieldset>
      )}
      {regular && (
        <CollectionExceptionEditor
          exceptions={exceptions}
          onChange={(next, confirmed) =>
            onChange({ ...stream, schedule: regular, exceptions: next }, confirmed)
          }
        />
      )}
    </div>
  );
}
