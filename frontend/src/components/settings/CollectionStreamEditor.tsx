import { useId } from 'react';
import type { CollectionStream } from '../../state/collectionHooks.js';
import { Input } from '../ui/input.js';

const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export function CollectionStreamEditor({ stream, onChange }: { stream: CollectionStream; onChange: (stream: CollectionStream) => void }) {
  const id = useId();
  const regular = stream.schedule.mode === 'regular' ? stream.schedule : null;
  const exceptions = 'exceptions' in stream ? stream.exceptions : [];
  const date = regular ? new Date(`${regular.anchorDate}T00:00:00Z`) : null;
  const anchorValid = !!date && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === regular?.anchorDate &&
    regular.weekdays.includes(date.getUTCDay() || 7) && regular.anchorDate >= '1900-01-01' && regular.anchorDate <= '2199-12-31';
  const colorValid = /^#[0-9a-f]{6}$/i.test(stream.color);
  const nameValid = stream.name.trim().length > 0 && stream.name.length <= 80 && ![...stream.name].some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127);
  const intervalValid = regular && Number.isInteger(regular.intervalWeeks) && regular.intervalWeeks >= 1 && regular.intervalWeeks <= 52;
  return <div className="min-w-0 space-y-3">
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm">Stream name<Input value={stream.name} maxLength={80} aria-invalid={!nameValid} aria-describedby={!nameValid ? `${id}-name` : undefined} onChange={e => onChange({ ...stream, name: e.target.value })} /></label>
      <label className="text-sm">Hex colour<Input value={stream.color} maxLength={7} aria-invalid={!colorValid} aria-describedby={!colorValid ? `${id}-color` : undefined} onChange={e => onChange({ ...stream, color: e.target.value })} /></label>
    </div>
    {!nameValid && <p id={`${id}-name`} role="alert" className="text-sm text-destructive">Enter a name of 1–80 characters without control characters.</p>}
    {!colorValid && <p id={`${id}-color`} role="alert" className="text-sm text-destructive">Use a six-digit hex colour such as #DC2626.</p>}
    <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={stream.enabled} onChange={e => onChange({ ...stream, enabled: e.target.checked })} />Enabled</label>
    {regular && <fieldset className="space-y-3">
      <legend className="text-sm font-medium">Active weekdays (Monday–Sunday week)</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {weekdays.map((day, i) => <label key={day} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={regular.weekdays.includes(i + 1)} aria-describedby={!regular.weekdays.length ? `${id}-weekdays` : undefined} onChange={e => onChange({ ...stream, exceptions, schedule: { ...regular, weekdays: e.target.checked ? [...regular.weekdays, i + 1].sort((a, b) => a - b) : regular.weekdays.filter(d => d !== i + 1) } })} />{day}</label>)}
      </div>
      {!regular.weekdays.length && <p id={`${id}-weekdays`} role="alert" className="text-sm text-destructive">Choose at least one weekday.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Interval (weeks)<Input type="number" min={1} max={52} step={1} value={Number.isFinite(regular.intervalWeeks) ? regular.intervalWeeks : ''} aria-invalid={!intervalValid} aria-describedby={!intervalValid ? `${id}-interval` : undefined} onChange={e => onChange({ ...stream, exceptions, schedule: { ...regular, intervalWeeks: e.target.value === '' ? 0 : Number(e.target.value) } })} /></label>
        <label className="text-sm">Normal collection date<Input type="date" min="1900-01-01" max="2199-12-31" value={regular.anchorDate} aria-invalid={!anchorValid} aria-describedby={`${id}-anchor`} onChange={e => onChange({ ...stream, exceptions, schedule: { ...regular, anchorDate: e.target.value } })} /></label>
      </div>
      {!intervalValid && <p id={`${id}-interval`} role="alert" className="text-sm text-destructive">Choose an integer interval from 1 to 52 weeks.</p>}
      <p id={`${id}-anchor`} className={`text-sm ${anchorValid ? 'text-muted-foreground' : 'text-destructive'}`}>{anchorValid ? `Every ${regular.intervalWeeks} week${regular.intervalWeeks === 1 ? '' : 's'}, on each selected weekday of the active week. The normal date anchors the cycle, not a start boundary.` : 'Choose a valid normal date on a selected weekday.'}</p>
    </fieldset>}
  </div>;
}
