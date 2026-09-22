/**
 * DockerConfigForm — configure Docker widget display settings.
 * Connection is managed via ConnectionPicker; display options remain here.
 */

import { Label } from '../ui/label.js';
import { Input } from '../ui/input.js';
import { Switch } from '../ui/switch.js';
import type { WidgetConfigFormProps } from './registry.js';
import { DockerConnectionPicker } from './DockerConnectionPicker.js';

interface DockerDisplayConfig {
  pollIntervalSeconds?: number;
  maxContainers?: number;
  allowControls?: boolean;
}

export function DockerConfigForm({ config, onChange, widget }: WidgetConfigFormProps) {
  const raw = (config ?? {}) as Partial<DockerDisplayConfig>;
  const cfg: DockerDisplayConfig = {
    pollIntervalSeconds: raw.pollIntervalSeconds ?? 30,
    maxContainers: raw.maxContainers ?? 25,
    allowControls: raw.allowControls ?? false,
  };
  const widgetId = widget?.persistedId;

  function update(patch: Partial<DockerDisplayConfig>) {
    onChange({ ...cfg, ...patch });
  }

  return (
    <div className="space-y-5">
      {/* ── Connection picker ──────────────────────────────────────── */}
      <DockerConnectionPicker widgetInstanceId={widgetId} />

      {/* ── Display options ──────────────────────────────────────────── */}
      <div className="space-y-3 border-t border-white/10 pt-4">
        <span className="text-sm font-medium">Display Options</span>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="poll-interval" className="text-xs">Poll interval (sec)</Label>
            <Input
              id="poll-interval"
              type="number"
              min={10}
              max={300}
              step={5}
              value={cfg.pollIntervalSeconds}
              onChange={(e) => update({ pollIntervalSeconds: Math.max(10, parseInt(e.target.value, 10) || 30) })}
              className="h-8 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="max-containers" className="text-xs">Max containers</Label>
            <Input
              id="max-containers"
              type="number"
              min={1}
              max={100}
              value={cfg.maxContainers}
              onChange={(e) => update({ maxContainers: Math.max(1, parseInt(e.target.value, 10) || 25) })}
              className="h-8 text-sm"
            />
          </div>
        </div>

        <div className="flex min-h-11 items-center justify-between gap-4">
          <Label htmlFor="docker-allow-controls">
            Allow start/stop/restart controls (admin only)
          </Label>
          <Switch
            id="docker-allow-controls"
            checked={cfg.allowControls ?? false}
            onCheckedChange={(checked) => update({ allowControls: checked })}
          />
        </div>
      </div>
    </div>
  );
}
