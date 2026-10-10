import { useState } from 'react';
import { useCollectionConfig, useCollectionPreview, useCollectionSave, type CollectionStream, type CollectionDraft, type CollectionPreview } from '../../state/collectionHooks.js';
import { addCollectionDays } from '../../lib/collectionDates.js';
import { CollectionGroup } from '../calendar/CollectionGroup.js';
import { Button } from '../ui/button.js';
import { Input } from '../ui/input.js';
import { ApiRequestError } from '../../lib/apiClient.js';

const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export function buildCollectionPreset(weekday: number, anchorDate: string): CollectionStream[] {
  const date = new Date(`${anchorDate}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchorDate) || !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== anchorDate || (date.getUTCDay() || 7) !== weekday) {
    throw new Error('The normal Recycling date must match the selected weekday');
  }
  return [
    { name: 'General waste', color: '#EF4444', intervalWeeks: 1, anchor: anchorDate },
    { name: 'Recycling', color: '#EAB308', intervalWeeks: 2, anchor: anchorDate },
    { name: 'Garden', color: '#22C55E', intervalWeeks: 2, anchor: addCollectionDays(anchorDate, 7) },
  ].map(s => ({ id: crypto.randomUUID(), name: s.name, color: s.color, enabled: true,
    schedule: { mode: 'regular', weekdays: [weekday], intervalWeeks: s.intervalWeeks, anchorDate: s.anchor }, exceptions: [] }));
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
  const busy = previewMutation.isPending || saveMutation.isPending;
  const change = (next: CollectionDraft) => { setDraft(next); setPreview(null); setError(null); };
  function begin(preset: boolean) {
    if (!config.data) return;
    try {
      const streams = config.data.configured ? structuredClone(config.data.streams) : preset ? buildCollectionPreset(weekday, anchor) : [];
      const from = anchor || new Date().toISOString().slice(0, 10);
      change({ expectedRevision: config.data.revision, runtimeEpoch: config.data.runtimeEpoch,
        timezone: config.data.timezone ?? timezone, providerLabel: config.data.providerLabel,
        streams, range: { from, to: addCollectionDays(from, 28) },
        confirmations: { timezoneConfirmed: confirmed, deletedStreamIds: [], removedExceptionIds: [], clearedExplicitStreamIds: [] } });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Correct the preset fields'); }
  }
  async function runPreview() {
    if (!draft) return;
    setError(null); setConflict(false);
    try { setPreview(await previewMutation.mutateAsync(draft)); }
    catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to preview; your draft is retained');
      setConflict(cause instanceof ApiRequestError && cause.status === 409);
    }
  }
  async function save() {
    if (!draft || !preview?.canSave) return;
    try {
      await saveMutation.mutateAsync({ ...draft, previewDigest: preview.previewDigest });
      setDraft(null); setPreview(null); setError(null); setConflict(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save; your draft is retained');
      setConflict(cause instanceof ApiRequestError && cause.status === 409);
    }
  }
  async function rebase() {
    const latest = await config.refetch();
    if (draft && latest.data) {
      change({ ...draft, expectedRevision: latest.data.revision, runtimeEpoch: latest.data.runtimeEpoch });
      setConflict(false);
    }
  }
  if (config.isLoading) return <p role="status">Loading household collections…</p>;
  if (config.isError) return <div role="alert">Collections unavailable. <Button onClick={() => void config.refetch()}>Retry</Button></div>;
  return (
    <section aria-label="Household collections" className="min-w-0 space-y-4 rounded-xl border border-border p-4">
      <div>
        <h3 className="text-lg font-semibold">Household collections</h3>
        <p className="text-sm text-muted-foreground">Customisable local rules. Verify dates with your provider; no council lookup or syncing.</p>
      </div>
      {!draft ? (
        <>
          {config.data?.configured ? (
            <>
              <p className="text-sm">{config.data.streams.length} streams · {config.data.timezone}. Select streams in an existing Calendar widget.</p>
              <Button className="min-h-11" onClick={() => begin(false)}>Edit collection configuration</Button>
            </>
          ) : (
            <div className="space-y-3">
              <label className="block text-sm">Household timezone
                <Input value={timezone} placeholder="Australia/Sydney" maxLength={100} onChange={e => setTimezone(e.target.value)} />
              </label>
              <label className="block text-sm">Collection weekday
                <select className="min-h-11 w-full rounded-md border border-border bg-background px-3" value={weekday} onChange={e => setWeekday(Number(e.target.value))}>
                  {weekdays.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
                </select>
              </label>
              <label className="block text-sm">Normal Recycling collection date
                <Input type="date" min="1900-01-01" max="2199-12-31" value={anchor} onChange={e => setAnchor(e.target.value)} />
              </label>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I confirm the household timezone and normal provider date
              </label>
              <div className="flex flex-wrap gap-2">
                <Button className="min-h-11" disabled={!timezone || !anchor || !confirmed} onClick={() => begin(true)}>Use weekly / alternating preset</Button>
                <Button variant="outline" className="min-h-11" disabled={!timezone || !confirmed} onClick={() => begin(false)}>Start custom without preset</Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          <label className="block text-sm">Household timezone<Input value={draft.timezone} maxLength={100} onChange={e => change({ ...draft, timezone: e.target.value, confirmations: { ...draft.confirmations, timezoneConfirmed: false } })} /></label>
          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={draft.confirmations.timezoneConfirmed} onChange={e => change({ ...draft, confirmations: { ...draft.confirmations, timezoneConfirmed: e.target.checked } })} />Confirm household timezone</label>
          <label className="block text-sm">Provider label (private, optional)<Input value={draft.providerLabel ?? ''} maxLength={120} onChange={e => change({ ...draft, providerLabel: e.target.value || null })} /></label>
          <ul className="space-y-1 text-sm">{draft.streams.map(s => <li key={s.id}>{s.name} · {s.schedule.mode === 'regular' ? `Every ${s.schedule.intervalWeeks} week${s.schedule.intervalWeeks === 1 ? '' : 's'}` : 'Explicit dates'}</li>)}</ul>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Preview from<Input type="date" value={draft.range.from} onChange={e => change({ ...draft, range: { ...draft.range, from: e.target.value } })} /></label>
            <label className="text-sm">Preview to<Input type="date" value={draft.range.to} onChange={e => change({ ...draft, range: { ...draft.range, to: e.target.value } })} /></label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button className="min-h-11" variant="outline" disabled={busy} onClick={() => void runPreview()}>Preview dates</Button>
            <Button className="min-h-11" disabled={busy || !preview?.canSave} onClick={() => void save()}>Save collections</Button>
            <Button className="min-h-11" variant="ghost" disabled={busy} onClick={() => { setDraft(null); setPreview(null); setError(null); setConflict(false); }}>Cancel</Button>
          </div>
          {preview && <div className="space-y-2">
            {preview.blockers.map((b, i) => <p role="alert" key={i} className="text-sm text-destructive">{b.message}</p>)}
            {preview.groups.map((g, i) => <CollectionGroup key={g.date} group={g} today={draft.range.from} timezone={draft.timezone} next={i === 0} />)}
          </div>}
        </div>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {conflict && <Button variant="outline" className="min-h-11" onClick={() => void rebase()}>Reload and rebase retained draft</Button>}
    </section>
  );
}
