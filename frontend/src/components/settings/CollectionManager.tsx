import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import {
  useCollectionConfig,
  useCollectionPreview,
  useCollectionSave,
  type CollectionStream,
  type CollectionDraft,
  type CollectionPreview,
} from '../../state/collectionHooks.js';
import { addCollectionDays } from '../../lib/collectionDates.js';
import { collectionIconComponent } from '../../lib/collectionIcons.js';
import { CollectionGroup } from '../calendar/CollectionGroup.js';
import { Button } from '../ui/button.js';
import { Input } from '../ui/input.js';
import { ApiRequestError } from '../../lib/apiClient.js';
import { CollectionStreamEditor } from './CollectionStreamEditor.js';

const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * Builds the additive bin-collection preset: a weekly red General waste event, a
 * fortnightly yellow Recycling event, and an alternate-week green Garden event,
 * all anchored on the household's normal collection weekday. These are regular,
 * independently editable events appended to whatever custom events already
 * exist — applying the preset never replaces or deletes other events.
 */
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
    {
      name: 'General waste',
      color: '#EF4444',
      icon: 'Trash2',
      intervalWeeks: 1,
      anchor: anchorDate,
    },
    { name: 'Recycling', color: '#EAB308', icon: 'Recycle', intervalWeeks: 2, anchor: anchorDate },
    {
      name: 'Garden',
      color: '#22C55E',
      icon: 'Leaf',
      intervalWeeks: 2,
      anchor: addCollectionDays(anchorDate, 7),
    },
  ].map((s) => ({
    id: crypto.randomUUID(),
    name: s.name,
    color: s.color,
    icon: s.icon,
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

function repeatSummary(stream: CollectionStream): string {
  if (stream.schedule.mode === 'explicit') {
    const count = stream.schedule.dates.length;
    return count <= 1 ? 'Single date' : `${count} dates`;
  }
  const { intervalWeeks } = stream.schedule;
  if (intervalWeeks === 1) return 'Weekly';
  if (intervalWeeks === 2) return 'Fortnightly';
  return `Every ${intervalWeeks} weeks`;
}

export function CollectionManager() {
  const config = useCollectionConfig();
  const previewMutation = useCollectionPreview();
  const saveMutation = useCollectionSave();
  const [draft, setDraft] = useState<CollectionDraft | null>(null);
  const [preview, setPreview] = useState<CollectionPreview | null>(null);
  const [timezone, setTimezone] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [reviewDestructive, setReviewDestructive] = useState(false);
  const [presetOpen, setPresetOpen] = useState(false);
  const [presetWeekday, setPresetWeekday] = useState(3);
  const [presetAnchor, setPresetAnchor] = useState('');
  const busy = previewMutation.isPending || saveMutation.isPending;
  const change = (next: CollectionDraft) => {
    setDraft(next);
    setPreview(null);
    setError(null);
  };

  function begin() {
    if (!config.data) return;
    const streams = config.data.configured ? structuredClone(config.data.streams) : [];
    const from = new Date().toISOString().slice(0, 10);
    change({
      expectedRevision: config.data.revision,
      runtimeEpoch: config.data.runtimeEpoch,
      timezone: config.data.timezone ?? timezone,
      providerLabel: config.data.providerLabel,
      streams,
      range: { from, to: addCollectionDays(from, 28) },
      confirmations: {
        timezoneConfirmed: config.data.configured ? false : confirmed,
        deletedStreamIds: [],
        removedExceptionIds: [],
        clearedExplicitStreamIds: [],
      },
    });
    setExpandedId(null);
  }

  async function runPreview() {
    if (!draft) return;
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

  function addEvent() {
    if (!draft || draft.streams.length >= 32) return;
    const id = crypto.randomUUID();
    const first = draft.range.from || new Date().toISOString().slice(0, 10);
    change({
      ...draft,
      streams: [
        ...draft.streams,
        {
          id,
          name: 'New event',
          color: '#64748B',
          icon: 'CalendarDays',
          enabled: true,
          schedule: { mode: 'explicit', dates: [first] },
        },
      ],
    });
    setExpandedId(id);
  }

  function appendPreset() {
    if (!draft) return;
    try {
      const preset = buildCollectionPreset(presetWeekday, presetAnchor);
      if (draft.streams.length + preset.length > 32) {
        setError('Too many events; remove some before adding the bin preset.');
        return;
      }
      change({ ...draft, streams: [...draft.streams, ...preset] });
      setPresetOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Correct the preset fields');
    }
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
    if (expandedId === id) setExpandedId(null);
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

  if (config.isLoading) return <p role="status">Loading custom events…</p>;
  if (config.isError)
    return (
      <div role="alert">
        Custom events unavailable. <Button onClick={() => void config.refetch()}>Retry</Button>
      </div>
    );

  return (
    <section aria-label="Custom events" className="min-w-0 space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Custom events</h3>
        <p className="text-sm text-muted-foreground">
          Local one-off and recurring events such as bin days, with your own title, icon and colour.
          No council lookup or syncing.
        </p>
      </div>
      {!draft ? (
        <>
          {config.data?.configured ? (
            <>
              <p className="text-sm">
                {config.data.streams.length} event{config.data.streams.length === 1 ? '' : 's'} ·{' '}
                {config.data.timezone}. Select events in an existing Calendar widget.
              </p>
              <Button className="min-h-11" onClick={begin}>
                Manage custom events
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
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                I confirm the household timezone is correct
              </label>
              <Button className="min-h-11" disabled={!timezone || !confirmed} onClick={begin}>
                Set up custom events
              </Button>
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
            Up to 32 independent events. New events are not selected or published automatically.
            Disabled events keep their rules and phase.
          </p>
          {!draft.streams.length && (
            <p className="text-sm">
              No events yet. Add an event or append the bin collection preset below.
            </p>
          )}
          <ul className="space-y-2">
            {draft.streams.map((s, index) => {
              const Icon = collectionIconComponent(s.icon);
              const open = expandedId === s.id;
              return (
                <li
                  key={s.id}
                  className="min-w-0 rounded-lg border border-border"
                  aria-label={`Custom event ${index + 1}: ${s.name}`}
                >
                  <div className="flex min-w-0 items-center gap-2 p-3">
                    <Icon aria-hidden className="h-5 w-5 shrink-0" style={{ color: s.color }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {s.name || `Event ${index + 1}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {repeatSummary(s)}
                        {s.enabled ? '' : ' · Disabled'}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="min-h-10"
                      aria-expanded={open}
                      onClick={() => setExpandedId(open ? null : s.id)}
                    >
                      <Pencil className="mr-1 h-3.5 w-3.5" />
                      {open ? 'Close' : 'Edit'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="min-h-10 text-destructive hover:text-destructive"
                      onClick={() => setRemoveId(s.id)}
                      aria-label={`Delete ${s.name || `event ${index + 1}`}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {removeId === s.id && (
                    <div role="alert" className="space-y-2 border-t border-border p-3 text-sm">
                      <p>
                        Delete {s.name || 'this event'}, its dates and exceptions, and its Calendar
                        selections? Other events and providers are unchanged. Deletion applies only
                        when you save.
                      </p>
                      <Button
                        className="min-h-11"
                        variant="destructive"
                        onClick={() => removeStream(s.id)}
                      >
                        Confirm delete event
                      </Button>
                      <Button
                        className="min-h-11"
                        variant="ghost"
                        onClick={() => setRemoveId(null)}
                      >
                        Keep event
                      </Button>
                    </div>
                  )}
                  {open && (
                    <div className="space-y-3 border-t border-border p-3">
                      <CollectionStreamEditor stream={s} onChange={updateStream} disabled={busy} />
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
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button
              className="min-h-11"
              variant="outline"
              disabled={busy || draft.streams.length >= 32}
              onClick={addEvent}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add event
            </Button>
            <Button
              className="min-h-11"
              variant="outline"
              disabled={busy}
              onClick={() => setPresetOpen((prev) => !prev)}
            >
              Add bin collection preset
            </Button>
            <Button
              className="min-h-11"
              variant="outline"
              onClick={() => setReviewDestructive(true)}
            >
              Review retained deletions
            </Button>
          </div>
          {presetOpen && (
            <div className="space-y-3 rounded-lg border border-border p-3 text-sm">
              <p className="text-muted-foreground">
                Appends a weekly General waste, fortnightly Recycling and alternate-week Garden
                event anchored on your normal collection date. Existing events are kept; edit any of
                them afterwards.
              </p>
              <label className="block">
                Collection weekday
                <select
                  className="min-h-11 w-full rounded-md border border-border bg-background px-3"
                  value={presetWeekday}
                  onChange={(e) => setPresetWeekday(Number(e.target.value))}
                >
                  {weekdays.map((name, i) => (
                    <option key={name} value={i + 1}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                Normal Recycling collection date
                <Input
                  type="date"
                  min="1900-01-01"
                  max="2199-12-31"
                  value={presetAnchor}
                  onChange={(e) => setPresetAnchor(e.target.value)}
                />
              </label>
              <Button
                className="min-h-11"
                disabled={!presetAnchor || draft.streams.length >= 32}
                onClick={appendPreset}
              >
                Append bin preset
              </Button>
            </div>
          )}
          {reviewDestructive && (
            <div role="alert" className="space-y-2 text-sm">
              <p>
                Confirm all event deletions, cleared explicit lists and removed exceptions in this
                retained draft relative to the latest loaded configuration. This may include changes
                made by another administrator. Verify every event above before confirming. A new
                preview is required.
              </p>
              <Button className="min-h-11" variant="destructive" onClick={confirmRetainedRemovals}>
                Confirm retained draft deletions
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
              Save events
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
                setExpandedId(null);
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
