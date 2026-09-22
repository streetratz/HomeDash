/**
 * CronScheduleBuilder — Human-friendly cron schedule picker.
 *
 * Presets: Every X Minutes, Hourly, Daily, Weekly, Monthly, Advanced (raw).
 * Auto-detects existing cron expressions and maps them to the matching preset.
 */

import { useEffect, useCallback, useReducer } from 'react';
import { Label } from '../ui/label.js';
import { Input } from '../ui/input.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select.js';

type Frequency = 'every_x_min' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'advanced';

const FREQUENCY_LABELS: Record<Frequency, string> = {
  every_x_min: 'Every X Minutes',
  hourly: 'Hourly',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  advanced: 'Advanced (raw cron)',
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface CronScheduleBuilderProps {
  value: string;
  onChange: (cron: string) => void;
}

// ── Auto-detect preset from cron expression ────────────────────────────────

interface DetectedPreset {
  frequency: Frequency;
  minute: number;
  hour: number;
  dayOfWeek: number;
  dayOfMonth: number;
  interval: number;
}

function detectPreset(cron: string): DetectedPreset {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return fallback(cron);

  const [min, hour, dom, , dow] = parts;

  // Every X minutes: */N * * * *
  if (min?.startsWith('*/') && hour === '*' && dom === '*' && dow === '*') {
    const interval = parseInt(min.slice(2), 10);
    if (!isNaN(interval) && interval >= 1 && interval <= 59) {
      return { frequency: 'every_x_min', minute: 0, hour: 0, dayOfWeek: 1, dayOfMonth: 1, interval };
    }
  }

  // Hourly: N * * * *
  if (min !== '*' && !min?.includes('/') && hour === '*' && dom === '*' && dow === '*') {
    const m = parseInt(min!, 10);
    if (!isNaN(m) && m >= 0 && m <= 59) {
      return { frequency: 'hourly', minute: m, hour: 0, dayOfWeek: 1, dayOfMonth: 1, interval: 5 };
    }
  }

  // Daily: N N * * *
  if (min !== '*' && hour !== '*' && !hour?.includes('*') && dom === '*' && dow === '*') {
    const m = parseInt(min!, 10);
    const h = parseInt(hour!, 10);
    if (!isNaN(m) && !isNaN(h)) {
      return { frequency: 'daily', minute: m, hour: h, dayOfWeek: 1, dayOfMonth: 1, interval: 5 };
    }
  }

  // Weekly: N N * * D
  if (min !== '*' && hour !== '*' && dom === '*' && dow !== '*' && !dow?.includes(',')) {
    const m = parseInt(min!, 10);
    const h = parseInt(hour!, 10);
    const d = parseInt(dow!, 10);
    if (!isNaN(m) && !isNaN(h) && !isNaN(d) && d >= 0 && d <= 6) {
      return { frequency: 'weekly', minute: m, hour: h, dayOfWeek: d, dayOfMonth: 1, interval: 5 };
    }
  }

  // Monthly: N N D * *
  if (min !== '*' && hour !== '*' && dom !== '*' && !dom?.includes(',') && dow === '*') {
    const m = parseInt(min!, 10);
    const h = parseInt(hour!, 10);
    const d = parseInt(dom!, 10);
    if (!isNaN(m) && !isNaN(h) && !isNaN(d) && d >= 1 && d <= 31) {
      return { frequency: 'monthly', minute: m, hour: h, dayOfWeek: 1, dayOfMonth: d, interval: 5 };
    }
  }

  return fallback(cron);
}

function fallback(_cron: string): DetectedPreset {
  return { frequency: 'advanced', minute: 0, hour: 0, dayOfWeek: 1, dayOfMonth: 1, interval: 5 };
}

// ── Build cron from preset state ───────────────────────────────────────────

function buildCron(frequency: Frequency, minute: number, hour: number, dayOfWeek: number, dayOfMonth: number, interval: number): string {
  switch (frequency) {
    case 'every_x_min': return `*/${interval} * * * *`;
    case 'hourly': return `${minute} * * * *`;
    case 'daily': return `${minute} ${hour} * * *`;
    case 'weekly': return `${minute} ${hour} * * ${dayOfWeek}`;
    case 'monthly': return `${minute} ${hour} ${dayOfMonth} * *`;
    default: return '* * * * *';
  }
}

// ── Human-readable description ─────────────────────────────────────────────

function describeCronPreset(frequency: Frequency, minute: number, hour: number, dayOfWeek: number, dayOfMonth: number, interval: number): string {
  const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  switch (frequency) {
    case 'every_x_min': return `Runs every ${interval} minute${interval > 1 ? 's' : ''}`;
    case 'hourly': return `Runs hourly at :${String(minute).padStart(2, '0')}`;
    case 'daily': return `Runs daily at ${timeStr}`;
    case 'weekly': return `Runs every ${DAY_LABELS[dayOfWeek]} at ${timeStr}`;
    case 'monthly': return `Runs on day ${dayOfMonth} of each month at ${timeStr}`;
    case 'advanced': return '';
  }
}

// ── Component ──────────────────────────────────────────────────────────────

interface BuilderState {
  frequency: Frequency;
  minute: number;
  hour: number;
  dayOfWeek: number;
  dayOfMonth: number;
  interval: number;
  rawCron: string;
}

type BuilderAction =
  | { type: 'SET_ALL'; payload: BuilderState }
  | { type: 'SET_FREQUENCY'; payload: Frequency }
  | { type: 'SET_MINUTE'; payload: number }
  | { type: 'SET_HOUR'; payload: number }
  | { type: 'SET_DAY_OF_WEEK'; payload: number }
  | { type: 'SET_DAY_OF_MONTH'; payload: number }
  | { type: 'SET_INTERVAL'; payload: number }
  | { type: 'SET_RAW'; payload: string };

function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
  switch (action.type) {
    case 'SET_ALL': return action.payload;
    case 'SET_FREQUENCY': return { ...state, frequency: action.payload };
    case 'SET_MINUTE': return { ...state, minute: action.payload };
    case 'SET_HOUR': return { ...state, hour: action.payload };
    case 'SET_DAY_OF_WEEK': return { ...state, dayOfWeek: action.payload };
    case 'SET_DAY_OF_MONTH': return { ...state, dayOfMonth: action.payload };
    case 'SET_INTERVAL': return { ...state, interval: action.payload };
    case 'SET_RAW': return { ...state, rawCron: action.payload };
  }
}

function initState(value: string): BuilderState {
  const d = detectPreset(value);
  return { frequency: d.frequency, minute: d.minute, hour: d.hour, dayOfWeek: d.dayOfWeek, dayOfMonth: d.dayOfMonth, interval: d.interval, rawCron: value };
}

export function CronScheduleBuilder({ value, onChange }: CronScheduleBuilderProps) {
  const [state, dispatch] = useReducer(builderReducer, value, initState);
  const { frequency, minute, hour, dayOfWeek, dayOfMonth, interval, rawCron } = state;

  // Sync external value changes (e.g. form reset)
  useEffect(() => {
    dispatch({ type: 'SET_ALL', payload: initState(value) });
  }, [value]);

  const emitChange = useCallback((freq: Frequency, min: number, hr: number, dow: number, dom: number, intv: number) => {
    if (freq === 'advanced') return;
    const cron = buildCron(freq, min, hr, dow, dom, intv);
    dispatch({ type: 'SET_RAW', payload: cron });
    onChange(cron);
  }, [onChange]);

  function handleFrequencyChange(f: Frequency) {
    dispatch({ type: 'SET_FREQUENCY', payload: f });
    if (f !== 'advanced') {
      emitChange(f, minute, hour, dayOfWeek, dayOfMonth, interval);
    }
  }

  function handleRawChange(raw: string) {
    dispatch({ type: 'SET_RAW', payload: raw });
    onChange(raw);
  }

  const preview = frequency !== 'advanced'
    ? describeCronPreset(frequency, minute, hour, dayOfWeek, dayOfMonth, interval)
    : '';

  return (
    <div className="space-y-3">
      {/* Frequency selector */}
      <div className="space-y-1.5">
        <Label>Schedule</Label>
        <Select value={frequency} onValueChange={(v) => handleFrequencyChange(v as Frequency)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(FREQUENCY_LABELS) as [Frequency, string][]).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Sub-controls per frequency */}
      {frequency === 'every_x_min' && (
        <div className="space-y-1.5">
          <Label>Every (minutes)</Label>
          <Select
            value={String(interval)}
            onValueChange={(v) => { const n = parseInt(v, 10); dispatch({ type: 'SET_INTERVAL', payload: n }); emitChange(frequency, minute, hour, dayOfWeek, dayOfMonth, n); }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 5, 10, 15, 20, 30].map((n) => (
                <SelectItem key={n} value={String(n)}>{n} min</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {frequency === 'hourly' && (
        <div className="space-y-1.5">
          <Label>At minute</Label>
          <Select
            value={String(minute)}
            onValueChange={(v) => { const n = parseInt(v, 10); dispatch({ type: 'SET_MINUTE', payload: n }); emitChange(frequency, n, hour, dayOfWeek, dayOfMonth, interval); }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((n) => (
                <SelectItem key={n} value={String(n)}>:{String(n).padStart(2, '0')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {frequency === 'daily' && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Hour</Label>
            <Select
              value={String(hour)}
              onValueChange={(v) => { const n = parseInt(v, 10); dispatch({ type: 'SET_HOUR', payload: n }); emitChange(frequency, minute, n, dayOfWeek, dayOfMonth, interval); }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }, (_, i) => (
                  <SelectItem key={i} value={String(i)}>{String(i).padStart(2, '0')}:00</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Minute</Label>
            <Select
              value={String(minute)}
              onValueChange={(v) => { const n = parseInt(v, 10); dispatch({ type: 'SET_MINUTE', payload: n }); emitChange(frequency, n, hour, dayOfWeek, dayOfMonth, interval); }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((n) => (
                  <SelectItem key={n} value={String(n)}>:{String(n).padStart(2, '0')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {frequency === 'weekly' && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Day of week</Label>
            <Select
              value={String(dayOfWeek)}
              onValueChange={(v) => { const n = parseInt(v, 10); dispatch({ type: 'SET_DAY_OF_WEEK', payload: n }); emitChange(frequency, minute, hour, n, dayOfMonth, interval); }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAY_LABELS.map((label, i) => (
                  <SelectItem key={i} value={String(i)}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Hour</Label>
              <Select
                value={String(hour)}
                onValueChange={(v) => { const n = parseInt(v, 10); dispatch({ type: 'SET_HOUR', payload: n }); emitChange(frequency, minute, n, dayOfWeek, dayOfMonth, interval); }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, i) => (
                    <SelectItem key={i} value={String(i)}>{String(i).padStart(2, '0')}:00</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Minute</Label>
              <Select
                value={String(minute)}
                onValueChange={(v) => { const n = parseInt(v, 10); dispatch({ type: 'SET_MINUTE', payload: n }); emitChange(frequency, n, hour, dayOfWeek, dayOfMonth, interval); }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((n) => (
                    <SelectItem key={n} value={String(n)}>:{String(n).padStart(2, '0')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {frequency === 'monthly' && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Day of month</Label>
            <Select
              value={String(dayOfMonth)}
              onValueChange={(v) => { const n = parseInt(v, 10); dispatch({ type: 'SET_DAY_OF_MONTH', payload: n }); emitChange(frequency, minute, hour, dayOfWeek, n, interval); }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 28 }, (_, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Hour</Label>
              <Select
                value={String(hour)}
                onValueChange={(v) => { const n = parseInt(v, 10); dispatch({ type: 'SET_HOUR', payload: n }); emitChange(frequency, minute, n, dayOfWeek, dayOfMonth, interval); }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, i) => (
                    <SelectItem key={i} value={String(i)}>{String(i).padStart(2, '0')}:00</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Minute</Label>
              <Select
                value={String(minute)}
                onValueChange={(v) => { const n = parseInt(v, 10); dispatch({ type: 'SET_MINUTE', payload: n }); emitChange(frequency, n, hour, dayOfWeek, dayOfMonth, interval); }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((n) => (
                    <SelectItem key={n} value={String(n)}>:{String(n).padStart(2, '0')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Advanced — raw cron input */}
      {frequency === 'advanced' && (
        <div className="space-y-1.5">
          <Label>Cron Expression</Label>
          <Input
            value={rawCron}
            onChange={(e) => handleRawChange(e.target.value)}
            placeholder="*/5 * * * *"
          />
          <p className="text-xs text-muted-foreground">
            5-field cron: minute hour day-of-month month day-of-week
          </p>
        </div>
      )}

      {/* Human-readable preview */}
      {preview && (
        <p className="text-sm font-medium text-muted-foreground">
          ⏱ {preview}
        </p>
      )}
    </div>
  );
}
