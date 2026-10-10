import { useId, useState } from 'react';
import type { CollectionException } from '../../state/collectionHooks.js';
import { Input } from '../ui/input.js';
import { Button } from '../ui/button.js';
import { validCollectionDate } from './CollectionExplicitDatesEditor.js';
export function CollectionExceptionEditor({
  exceptions,
  onChange,
}: {
  exceptions: CollectionException[];
  onChange: (exceptions: CollectionException[], confirmedRemoval: boolean) => void;
}) {
  const id = useId();
  const [removeId, setRemoveId] = useState<string | null>(null);
  function update(next: CollectionException) {
    onChange(
      exceptions.map((e) => (e.id === next.id ? next : e)),
      false,
    );
  }
  function add(kind: CollectionException['kind']) {
    const key = crypto.randomUUID();
    const next: CollectionException =
      kind === 'skip'
        ? { id: key, kind, originalDate: '' }
        : kind === 'replace'
          ? { id: key, kind, originalDate: '', actualDate: '' }
          : { id: key, kind, actualDate: '' };
    onChange([...exceptions, next], false);
  }
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">
        One-off exceptions ({exceptions.length} / 512)
      </legend>
      <p className="text-sm text-muted-foreground">
        Skip a scheduled origin, move it to an actual date, or add an extra. The base cycle never
        shifts. Preview checks all origins and collisions, not only displayed dates.
      </p>
      {exceptions.map((exception, index) => (
        <fieldset key={exception.id} className="space-y-2 rounded-md border border-border p-2">
          <legend className="text-sm">
            {exception.kind === 'replace' ? 'Move' : exception.kind === 'skip' ? 'Skip' : 'Add'}{' '}
            exception {index + 1}
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {exception.kind !== 'add' && (
              <label className="text-sm">
                Original scheduled date
                <Input
                  type="date"
                  value={exception.originalDate}
                  min="1900-01-01"
                  max="2199-12-31"
                  aria-invalid={!validCollectionDate(exception.originalDate)}
                  aria-describedby={`${id}-${exception.id}`}
                  onChange={(e) => update({ ...exception, originalDate: e.target.value })}
                />
              </label>
            )}
            {exception.kind !== 'skip' && (
              <label className="text-sm">
                Actual collection date
                <Input
                  type="date"
                  value={exception.actualDate}
                  min="1900-01-01"
                  max="2199-12-31"
                  aria-invalid={!validCollectionDate(exception.actualDate)}
                  aria-describedby={`${id}-${exception.id}`}
                  onChange={(e) => update({ ...exception, actualDate: e.target.value })}
                />
              </label>
            )}
          </div>
          <p id={`${id}-${exception.id}`} className="text-xs text-muted-foreground">
            Use valid civil dates. An original date must belong to this stream&apos;s base schedule.
            Resolve orphan origins explicitly after editing the base rule.
          </p>
          <Button className="min-h-11" variant="outline" onClick={() => setRemoveId(exception.id)}>
            Remove exception
          </Button>
          {removeId === exception.id && (
            <div role="alert" className="space-y-2 text-sm">
              <p>
                Removing this exception restores the base occurrence or removes the extra. Preview
                may reveal a restored-date collision. Applies only on save.
              </p>
              <Button
                className="min-h-11"
                variant="destructive"
                onClick={() => {
                  onChange(
                    exceptions.filter((e) => e.id !== exception.id),
                    true,
                  );
                  setRemoveId(null);
                }}
              >
                Confirm remove exception
              </Button>
              <Button className="min-h-11" variant="ghost" onClick={() => setRemoveId(null)}>
                Keep exception
              </Button>
            </div>
          )}
        </fieldset>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button
          className="min-h-11"
          variant="outline"
          disabled={exceptions.length >= 512}
          onClick={() => add('skip')}
        >
          Skip collection
        </Button>
        <Button
          className="min-h-11"
          variant="outline"
          disabled={exceptions.length >= 512}
          onClick={() => add('replace')}
        >
          Move collection
        </Button>
        <Button
          className="min-h-11"
          variant="outline"
          disabled={exceptions.length >= 512}
          onClick={() => add('add')}
        >
          Add extra collection
        </Button>
      </div>
    </fieldset>
  );
}
