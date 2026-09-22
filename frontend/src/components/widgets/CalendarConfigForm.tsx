/**
 * 004 Phase 6 (T029): Calendar widget configuration form.
 *
 * Source selection, view mode, days ahead, max events, show location toggle.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '../ui/input.js';
import { Label } from '../ui/label.js';
import { Switch } from '../ui/switch.js';
import { ColorPicker } from '../ui/color-picker.js';
import type { WidgetConfigFormProps } from './registry.js';
import { useCalendarSources, useUpdateCalendarSource, type CalendarSource } from '../../state/calendarHooks.js';

interface CalendarConfigValues {
  sourceIds: string[];
  viewMode: 'compact' | 'expanded';
  daysAhead: number;
  maxEvents: number;
  showLocation: boolean;
  showPrivateEvents: boolean;
}

function parseConfig(config: unknown): CalendarConfigValues {
  const raw = (config ?? {}) as Partial<CalendarConfigValues>;
  return {
    sourceIds: raw.sourceIds ?? [],
    viewMode: raw.viewMode === 'compact' ? 'compact' : 'expanded',
    daysAhead: raw.daysAhead ?? 7,
    maxEvents: raw.maxEvents ?? 25,
    showLocation: raw.showLocation ?? true,
    showPrivateEvents: raw.showPrivateEvents ?? false,
  };
}

function groupByType(sources: CalendarSource[]): Map<string, CalendarSource[]> {
  const map = new Map<string, CalendarSource[]>();
  for (const s of sources) {
    const list = map.get(s.type);
    if (list) {
      list.push(s);
    } else {
      map.set(s.type, [s]);
    }
  }
  return map;
}

const TYPE_LABELS: Record<string, string> = {
  microsoft: 'Microsoft',
  google: 'Google',
  ical: 'iCal',
};

export function CalendarConfigForm({ config, onChange }: WidgetConfigFormProps) {
  const c = parseConfig(config);
  const sourcesQuery = useCalendarSources();
  const updateSourceMutation = useUpdateCalendarSource();
  const sources = sourcesQuery.data ?? [];
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  function update(patch: Partial<CalendarConfigValues>) {
    onChange({ ...c, ...patch });
  }

  function toggleSource(sourceId: string, checked: boolean) {
    const next = checked
      ? [...c.sourceIds, sourceId]
      : c.sourceIds.filter((id) => id !== sourceId);
    update({ sourceIds: next });
  }

  function startRename(source: CalendarSource) {
    setEditingId(source.id);
    setEditName(source.name);
  }

  function handleColorChange(sourceId: string, color: string) {
    updateSourceMutation.mutate(
      { id: sourceId, color },
      {
        onError: () => toast.error('Failed to update color'),
      },
    );
  }

  function saveRename(sourceId: string) {
    const trimmed = editName.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }
    updateSourceMutation.mutate(
      { id: sourceId, name: trimmed },
      {
        onSuccess: () => {
          toast.success('Source renamed');
          setEditingId(null);
        },
        onError: () => toast.error('Failed to rename'),
      },
    );
  }

  if (sources.length === 0 && !sourcesQuery.isLoading) {
    return (
      <div className="flex flex-col gap-2 text-sm text-muted-foreground">
        <p>No calendar sources connected.</p>
        <Link to="/settings" className="text-primary underline hover:text-primary/80">
          Go to Settings to add calendars
        </Link>
      </div>
    );
  }

  const grouped = groupByType(sources);

  return (
    <div className="flex flex-col gap-4">
      {/* Source selection */}
      <div className="flex flex-col gap-1.5">
        <Label>Calendar Sources</Label>
        {[...grouped.entries()].map(([type, typeSources]) => (
          <div key={type} className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              {TYPE_LABELS[type] ?? type}
            </span>
            {typeSources.map((source) => (
              <div
                key={source.id}
                className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-accent"
              >
                <input
                  id={`calendar-source-${source.id}`}
                  type="checkbox"
                  checked={c.sourceIds.includes(source.id)}
                  onChange={(e) => toggleSource(source.id, e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                <ColorPicker
                  value={source.color}
                  onChange={(color) => handleColorChange(source.id, color)}
                />
                {editingId === source.id ? (
                  <form
                    className="flex flex-1 items-center gap-1"
                    onSubmit={(e) => { e.preventDefault(); saveRename(source.id); }}
                  >
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={() => saveRename(source.id)}
                      className="flex-1 rounded border border-border bg-background px-1.5 py-0.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                    <button
                      type="submit"
                      className="flex min-h-11 min-w-11 items-center justify-center text-muted-foreground hover:text-primary"
                      aria-label={`Save name for ${source.name}`}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  </form>
                ) : (
                  <>
                    <label
                      htmlFor={`calendar-source-${source.id}`}
                      className="flex-1 cursor-pointer text-sm"
                    >
                      {source.name}
                    </label>
                    <button
                      type="button"
                      onClick={() => startRename(source)}
                      className="flex min-h-11 min-w-11 items-center justify-center text-muted-foreground/50 hover:text-primary"
                      title="Rename source"
                      aria-label={`Rename ${source.name}`}
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* View mode */}
      <div className="flex flex-col gap-1.5">
        <Label>View Mode</Label>
        <div className="flex gap-2" role="group" aria-label="Calendar view mode">
          <button
            type="button"
            className={`rounded-md border px-3 py-1.5 text-sm ${
              c.viewMode === 'expanded'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:border-primary/50'
            }`}
            onClick={() => update({ viewMode: 'expanded' })}
            aria-pressed={c.viewMode === 'expanded'}
          >
            Expanded
          </button>
          <button
            type="button"
            className={`rounded-md border px-3 py-1.5 text-sm ${
              c.viewMode === 'compact'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:border-primary/50'
            }`}
            onClick={() => update({ viewMode: 'compact' })}
            aria-pressed={c.viewMode === 'compact'}
          >
            Compact
          </button>
        </div>
      </div>

      {/* Days ahead */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="calendar-days-ahead">Days Ahead</Label>
        <Input
          id="calendar-days-ahead"
          type="number"
          min={1}
          max={90}
          value={c.daysAhead}
          onChange={(e) => update({ daysAhead: Math.max(1, Math.min(90, Number(e.target.value) || 7)) })}
        />
      </div>

      {/* Max events */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="calendar-max-events">Max Events</Label>
        <Input
          id="calendar-max-events"
          type="number"
          min={5}
          max={100}
          value={c.maxEvents}
          onChange={(e) => update({ maxEvents: Math.max(5, Math.min(100, Number(e.target.value) || 25)) })}
        />
      </div>

      {/* Show location */}
      <div className="flex items-center justify-between">
        <Label htmlFor="calendar-show-location">Show Location</Label>
        <Switch
          id="calendar-show-location"
          checked={c.showLocation}
          onCheckedChange={(checked) => update({ showLocation: checked })}
        />
      </div>

      {/* Show private events */}
      <div className="flex items-center justify-between">
        <Label htmlFor="calendar-show-private">Show Private Events</Label>
        <Switch
          id="calendar-show-private"
          checked={c.showPrivateEvents}
          onCheckedChange={(checked) => update({ showPrivateEvents: checked })}
        />
      </div>
    </div>
  );
}
