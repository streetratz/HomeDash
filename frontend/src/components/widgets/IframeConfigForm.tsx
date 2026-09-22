// T028: IframeConfigForm — URL input with validation and aspect ratio selector

import { Label } from '../ui/label.js';
import { Input } from '../ui/input.js';
import type { WidgetConfigFormProps } from './registry.js';
import type { IframeConfig } from '../../state/dashboards.js';

const ASPECT_OPTIONS = [
  { value: 'auto', label: 'Auto (fill widget)' },
  { value: '16:9', label: '16:9 (Widescreen)' },
  { value: '4:3', label: '4:3 (Standard)' },
  { value: '1:1', label: '1:1 (Square)' },
] as const;

export function IframeConfigForm({ config, onChange }: WidgetConfigFormProps) {
  const cfg = (config ?? {}) as Partial<IframeConfig>;
  const url = cfg.url ?? '';
  const aspectRatio = cfg.aspectRatio ?? 'auto';

  const isValidUrl = !url.trim() || /^https?:\/\//i.test(url);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="iframe-url">URL</Label>
        <Input
          id="iframe-url"
          type="url"
          value={url}
          onChange={(e) => onChange({ ...cfg, url: e.target.value })}
          placeholder="https://example.com"
        />
        {!isValidUrl && (
          <p className="text-xs text-destructive">URL must start with http:// or https://</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Aspect Ratio</Label>
        <div className="grid grid-cols-2 gap-2">
          {ASPECT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                aspectRatio === opt.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:bg-accent'
              }`}
              onClick={() => onChange({ ...cfg, aspectRatio: opt.value })}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
