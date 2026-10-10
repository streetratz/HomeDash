import { useState } from 'react';
import {
  useCollectionConfig,
  useCollectionPreview,
  useCollectionSave,
  type CollectionStream,
  type CollectionDraft,
  type CollectionPreview,
} from '../../state/collectionHooks.js';
import { addCollectionDays } from '../../lib/collectionDates.js';
import { CollectionGroup } from '../calendar/CollectionGroup.js';
import { Button } from '../ui/button.js';
import { Input } from '../ui/input.js';
import { ApiRequestError } from '../../lib/apiClient.js';
import { CollectionStreamEditor } from './CollectionStreamEditor.js';

const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export function buildCollectionPreset(weekday: number, anchorDate: string): CollectionStream[] {
  const date = new Date(`${anchorDate}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(anchorDate) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== anchorDate ||
    (date.getUTCDay() || 7) !== weekday
  ) {
    throw new Error('The normal Recycling date must match the selected weekday');
  }
  return [
    { name: 'General waste', color: '#EF4444', intervalWeeks: 1, anchor: anchorDate },
    { name: 'Recycling', color: '#EAB308', intervalWeeks: 2, anchor: anchorDate },
    {
      name: 'Garden',
      color: '#22C55E',
      intervalWeeks: 2,
      anchor: addCollectionDays(anchorDate, 7),
    },
  ].map((s) => ({
    id: crypto.randomUUID(),
    name: s.name,
    color: s.color,
    enabled: true,
    schedule: {
      mode: 'regular',
      weekdays: [weekday],
      intervalWeeks: s.intervalWeeks,
      anchorDate: s.anchor,
    },
    exceptions: [],
  }));
}
export function CollectionManager() {
  const config = useCollectionConfig();
  const previewMutation = useCollectionPreview();
  const saveMutation = useCollectionSave();
  const [draft, setDraft] = useState<CollectionDraft | null>(null);
  const [preview, setPreview] = useState<CollectionPreview | null>(null);
  const [timezone, setTimezone] = useState('');
  const [weekday, setWeekday] = useState(3);
  const [anchor, setAnchor] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [reviewDestructive, setReviewDestructive] = useState(false);
  const [presetDraft, setPresetDraft] = useState(false);
  const busy = previewMutation.isPending || saveMutation.isPending;
  const change = (next: CollectionDraft) => {
    setDraft(next);
    setPreview(null);
    setError(null);
  };
  function begin(preset: boolean) {
    if (!config.data) return;
    try {
      const streams = config.data.configured
        ? structuredClone(config.data.streams)
        : preset
          ? buildCollectionPreset(weekday, anchor)
          : [];
      const from = anchor || new Date().toISOString().slice(0, 10);
      setPresetDraft(!config.data.configured && preset);
      change({
        expectedRevision: config.data.revision,
        runtimeEpoch: config.data.runtimeEpoch,
        timezone: config.data.timezone ?? timezone,
        providerLabel: config.data.providerLabel,
        streams,
        range: { from, to: addCollectionDays(from, 28) },
        confirmations: {
          timezoneConfirmed: confirmed,
          deletedStreamIds: [],
          removedExceptionIds: [],
          clearedExplicitStreamIds: [],
        },
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Correct the preset fields');
    }
  }
  async function runPreview() {
    if (!draft) return;
    if (
      presetDraft &&
      new Date(`${draft.range.to}T00:00:00Z`).getTime() -
        new Date(`${draft.range.from}T00:00:00Z`).getTime() <
        28 * 86_400_000
    ) {
      setError('Preview at least four weeks before accepting the household preset.');
      setPreview(null);
      return;
    }
    setError(null);
    setConflict(false);
    try {
      setPreview(await previewMutation.mutateAsync(draft));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Unable to preview; your draft is retained',
      );
      setConflict(cause instanceof ApiRequestError && cause.status === 409);
    }
  }
  async function save() {
    if (!draft || !preview?.canSave) return;
    try {
      await saveMutation.mutateAsync({ ...draft, previewDigest: preview.previewDigest });
      setDraft(null);
      setPreview(null);
      setError(null);
      setConflict(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save; your draft is retained');
      setConflict(cause instanceof ApiRequestError && cause.status === 409);
    }
  }
  async function rebase() {
    const latest = await config.refetch();
    if (draft && latest.data) {
      change({
        ...draft,
        expectedRevision: latest.data.revision,
        runtimeEpoch: latest.data.runtimeEpoch,
        confirmations: {
          timezoneConfirmed: false,
          deletedStreamIds: [],
          removedExceptionIds: [],
          clearedExplicitStreamIds: [],
        },
      });
      setConflict(false);
    }
  }
  function addRegular() {
    if (!draft || draft.streams.length >= 32) return;
    const candidate = new Date(`${draft.range.from}T00:00:00Z`);
    const normal = Number.isFinite(candidate.getTime())
      ? addCollectionDays(draft.range.from, (8 - (candidate.getUTCDay() || 7)) % 7)
      : '2026-10-12';
    change({
      ...draft,
      streams: [
        ...draft.streams,
        {
          id: crypto.randomUUID(),
          name: 'New collection',
          color: '#64748B',
          enabled: true,
          schedule: { mode: 'regular', weekdays: [1], intervalWeeks: 1, anchorDate: normal },
          exceptions: [],
        },
      ],
    });
  }
  function removeStream(id: string) {
    if (!draft) return;
    const persisted = config.data?.streams.find((s) => s.id === id);
    change({
      ...draft,
      streams: draft.streams.filter((s) => s.id !== id),
      confirmations: {
        ...draft.confirmations,
        deletedStreamIds: persisted
          ? [...new Set([...draft.confirmations.deletedStreamIds, id])]
          : draft.confirmations.deletedStreamIds,
        removedExceptionIds: draft.confirmations.removedExceptionIds.filter(
          (key) =>
            !persisted ||
            !('exceptions' in persisted) ||
            !persisted.exceptions.some((e) => e.id === key),
        ),
        clearedExplicitStreamIds: draft.confirmations.clearedExplicitStreamIds.filter(
          (key) => key !== id,
        ),
      },
    });
    setRemoveId(null);
  }
  function reorder(index: number, direction: number) {
    if (!draft) return;
    const streams = [...draft.streams];
    const other = index + direction;
    if (other < 0 || other >= streams.length) return;
    [streams[index], streams[other]] = [streams[other]!, streams[index]!];
    change({ ...draft, streams });
  }
  function updateStream(next: CollectionStream, confirmedRemoval = false) {
    if (!draft) return;
    const streams = draft.streams.map((existing) => (existing.id === next.id ? next : existing));
    let confirmations = draft.confirmations;
    if (confirmedRemoval) {
      const removedExceptionIds = (config.data?.streams ?? []).flatMap((old) => {
        const current = streams.find((s) => s.id === old.id);
        return current && 'exceptions' in old
          ? old.exceptions
              .filter(
                (e) => !('exceptions' in current) || !current.exceptions.some((n) => n.id === e.id),
              )
              .map((e) => e.id)
          : [];
      });
      const clearedExplicitStreamIds = (config.data?.streams ?? [])
        .filter(
          (old) =>
            old.schedule.mode === 'explicit' &&
            streams.some((s) => s.id === old.id && s.schedule.mode === 'regular'),
        )
        .map((s) => s.id);
      confirmations = { ...confirmations, removedExceptionIds, clearedExplicitStreamIds };
    }
    change({ ...draft, streams, confirmations });
  }
  function confirmRetainedRemovals() {
    if (!draft || !config.data) return;
    const deletedStreamIds = config.data.streams
      .filter((old) => !draft.streams.some((next) => next.id === old.id))
      .map((s) => s.id);
    const removedExceptionIds = config.data.streams.flatMap((old) => {
      const current = draft.streams.find((s) => s.id === old.id);
      return current && 'exceptions' in old
        ? old.exceptions
            .filter(
              (e) => !('exceptions' in current) || !current.exceptions.some((n) => n.id === e.id),
            )
            .map((e) => e.id)
        : [];
    });
    const clearedExplicitStreamIds = config.data.streams
      .filter(
        (old) =>
          old.schedule.mode === 'explicit' &&
          draft.streams.some((next) => next.id === old.id && next.schedule.mode === 'regular'),
      )
      .map((s) => s.id);
    change({
      ...draft,
      confirmations: {
        ...draft.confirmations,
        deletedStreamIds,
        removedExceptionIds,
        clearedExplicitStreamIds,
      },
    });
    setReviewDestructive(false);
  }
  if (config.isLoading) return <p role="status">Loading household collections…</p>;
  if (config.isError)
    return (
      <div role="alert">
        Collections unavailable. <Button onClick={() => void config.refetch()}>Retry</Button>
      </div>
    );
  return (
    <section
      aria-label="Household collections"
      className="min-w-0 space-y-4 rounded-xl border border-border p-4"
    >
      <div>
        <h3 className="text-lg font-semibold">Household collections</h3>
        <p className="text-sm text-muted-foreground">
          Customisable local rules. Verify dates with your provider; no council lookup or syncing.
        </p>
      </div>
      {!draft ? (
        <>
          {config.data?.configured ? (
            <>
              <p className="text-sm">
                {config.data.streams.length} streams · {config.data.timezone}. Select streams in an
                existing Calendar widget.
              </p>
              <Button className="min-h-11" onClick={() => begin(false)}>
                Edit collection configuration
              </Button>
            </>
          ) : (
            <div className="space-y-3">
              <label className="block text-sm">
                Household timezone
                <Input
                  value={timezone}
                  placeholder="Australia/Sydney"
                  maxLength={100}
                  onChange={(e) => setTimezone(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                Collection weekday
                <select
                  className="min-h-11 w-full rounded-md border border-border bg-background px-3"
                  value={weekday}
                  onChange={(e) => setWeekday(Number(e.target.value))}
                >
                  {weekdays.map((name, i) => (
                    <option key={name} value={i + 1}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Normal Recycling collection date
                <Input
                  type="date"
                  min="1900-01-01"
                  max="2199-12-31"
                  value={anchor}
                  onChange={(e) => setAnchor(e.target.value)}
                />
              </label>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                I confirm the household timezone and normal provider date
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  className="min-h-11"
                  disabled={!timezone || !anchor || !confirmed}
                  onClick={() => begin(true)}
                >
                  Use weekly / alternating preset
                </Button>
                <Button
                  variant="outline"
                  className="min-h-11"
                  disabled={!timezone || !confirmed}
                  onClick={() => begin(false)}
                >
                  Start custom without preset
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <fieldset disabled={busy} className="min-w-0 space-y-4">
          <label className="block text-sm">
            Household timezone
            <Input
              value={draft.timezone}
              maxLength={100}
              onChange={(e) =>
                change({
                  ...draft,
                  timezone: e.target.value,
                  confirmations: { ...draft.confirmations, timezoneConfirmed: false },
                })
              }
            />
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.confirmations.timezoneConfirmed}
              onChange={(e) =>
                change({
                  ...draft,
                  confirmations: { ...draft.confirmations, timezoneConfirmed: e.target.checked },
                })
              }
            />
            Confirm household timezone
          </label>
          <label className="block text-sm">
            Provider label (private, optional)
            <Input
              value={draft.providerLabel ?? ''}
              maxLength={120}
              onChange={(e) => change({ ...draft, providerLabel: e.target.value || null })}
            />
          </label>
          <p className="text-sm text-muted-foreground">
            Up to 32 independent streams. New streams are not selected or published automatically.
            Disabled streams keep their rules and phase.
          </p>
          {!draft.streams.length && (
            <p className="text-sm">
              No streams configured. Add a regular stream or save an empty household configuration.
            </p>
          )}
          {draft.streams.map((s, index) => (
            <fieldset
              key={s.id}
              aria-label={`Collection stream ${index + 1}: ${s.name}`}
              className="min-w-0 space-y-3 rounded-lg border border-border p-3"
            >
              <legend className="max-w-full break-words px-1 text-sm font-semibold">
                {s.name || `Stream ${index + 1}`}
              </legend>
              <CollectionStreamEditor stream={s} onChange={updateStream} />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="min-h-11"
                  disabled={index === 0}
                  onClick={() => reorder(index, -1)}
                >
                  Move up
                </Button>
                <Button
                  variant="outline"
                  className="min-h-11"
                  disabled={index === draft.streams.length - 1}
                  onClick={() => reorder(index, 1)}
                >
                  Move down
                </Button>
                <Button variant="outline" className="min-h-11" onClick={() => setRemoveId(s.id)}>
                  Remove stream
                </Button>
              </div>
              {removeId === s.id && (
                <div role="alert" className="space-y-2 text-sm">
                  <p>
                    Remove {s.name}, its dates and exceptions, and its Calendar selections? Other
                    streams and providers are unchanged. Removal applies only when you save.
                  </p>
                  <Button
                    className="min-h-11"
                    variant="destructive"
                    onClick={() => removeStream(s.id)}
                  >
                    Confirm remove stream
                  </Button>
                  <Button className="min-h-11" variant="ghost" onClick={() => setRemoveId(null)}>
                    Keep stream
                  </Button>
                </div>
              )}
            </fieldset>
          ))}
          <Button className="min-h-11" variant="outline" onClick={() => setReviewDestructive(true)}>
            Review retained destructive changes
          </Button>
          {reviewDestructive && (
            <div role="alert" className="space-y-2 text-sm">
              <p>
                Confirm all stream removals, cleared explicit lists and removed exceptions in this
                retained draft relative to the latest loaded configuration. This may include changes
                made by another administrator. Verify every stream above before confirming. A new
                preview is required.
              </p>
              <Button className="min-h-11" variant="destructive" onClick={confirmRetainedRemovals}>
                Confirm retained draft removals
              </Button>
              <Button
                className="min-h-11"
                variant="ghost"
                onClick={() => setReviewDestructive(false)}
              >
                Keep reviewing
              </Button>
            </div>
          )}
          <Button
            className="min-h-11"
            variant="outline"
            disabled={busy || draft.streams.length >= 32}
            onClick={addRegular}
          >
            Add regular stream
          </Button>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Preview from
              <Input
                type="date"
                value={draft.range.from}
                onChange={(e) =>
                  change({ ...draft, range: { ...draft.range, from: e.target.value } })
                }
              />
            </label>
            <label className="text-sm">
              Preview to
              <Input
                type="date"
                value={draft.range.to}
                onChange={(e) =>
                  change({ ...draft, range: { ...draft.range, to: e.target.value } })
                }
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              className="min-h-11"
              variant="outline"
              disabled={busy}
              onClick={() => void runPreview()}
            >
              Preview dates
            </Button>
            <Button
              className="min-h-11"
              disabled={busy || !preview?.canSave}
              onClick={() => void save()}
            >
              Save collections
            </Button>
            <Button
              className="min-h-11"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setDraft(null);
                setPreview(null);
                setError(null);
                setConflict(false);
              }}
            >
              Cancel
            </Button>
          </div>
          {preview && (
            <div className="space-y-2">
              {preview.blockers.map((b, i) => (
                <p role="alert" key={i} className="text-sm text-destructive">
                  {b.message}
                </p>
              ))}
              {preview.groups.map((g, i) => (
                <CollectionGroup
                  key={g.date}
                  group={g}
                  today={draft.range.from}
                  timezone={draft.timezone}
                  next={i === 0}
                />
              ))}
            </div>
          )}
        </fieldset>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {conflict && (
        <Button variant="outline" className="min-h-11" onClick={() => void rebase()}>
          Reload and rebase retained draft
        </Button>
      )}
    </section>
  );
}
