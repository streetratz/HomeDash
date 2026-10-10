import { useId } from 'react';
import { Input } from '../ui/input.js';
import { Button } from '../ui/button.js';
export function validCollectionDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '2199-12-31')
    return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function CollectionExplicitDatesEditor({
  dates,
  onChange,
}: {
  dates: string[];
  onChange: (dates: string[]) => void;
}) {
  const id = useId();
  return (
    <fieldset className="min-w-0 space-y-3">
      <legend className="text-sm font-medium">Finite explicit collection dates</legend>
      <p className="text-sm text-muted-foreground">
        No inferred continuation. Only the entered dates occur; past-only lists are exhausted, while
        a future date outside the displayed range is not.
      </p>
      <p className="text-sm">{dates.length} / 2048 dates · 8192 household total</p>
      {!dates.length && (
        <p role="alert" className="text-sm text-destructive">
          Enter at least one explicit date.
        </p>
      )}
      <div className="max-h-96 space-y-2 overflow-y-auto">
        {dates.map((date, index) => {
          const valid = validCollectionDate(date) && dates.indexOf(date) === index;
          return (
            <div key={index} className="space-y-1">
              <div className="flex min-w-0 items-end gap-2">
                <label className="min-w-0 flex-1 text-sm">
                  Collection date {index + 1}
                  <Input
                    type="date"
                    min="1900-01-01"
                    max="2199-12-31"
                    value={date}
                    aria-invalid={!valid}
                    aria-describedby={!valid ? `${id}-${index}` : undefined}
                    onChange={(e) =>
                      onChange(dates.map((d, i) => (i === index ? e.target.value : d)))
                    }
                  />
                </label>
                <Button
                  className="min-h-11 shrink-0"
                  variant="outline"
                  aria-label={`Remove collection date ${index + 1}`}
                  onClick={() => onChange(dates.filter((_, i) => i !== index))}
                >
                  Remove
                </Button>
              </div>
              {!valid && (
                <p id={`${id}-${index}`} role="alert" className="text-sm text-destructive">
                  Enter a unique valid date from 1900-01-01 to 2199-12-31.
                </p>
              )}
            </div>
          );
        })}
      </div>
      <Button
        className="min-h-11"
        variant="outline"
        disabled={dates.length >= 2048}
        onClick={() => onChange([...dates, ''])}
      >
        Add collection date
      </Button>
    </fieldset>
  );
}
