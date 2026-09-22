/**
 * PhotoFrameConfigForm — configure photo source, display settings, and transitions.
 */

import { RefreshCcw, Loader2 } from 'lucide-react';
import { Label } from '../ui/label.js';
import { Input } from '../ui/input.js';
import { Button } from '../ui/button.js';
import { Switch } from '../ui/switch.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select.js';
import type { WidgetConfigFormProps } from './registry.js';
import type { PhotoFrameConfig } from '../../state/dashboards.js';
import { usePhotoSources } from '../../hooks/usePhotoFrame.js';

function parseConfig(config: unknown): PhotoFrameConfig {
  const raw = (config ?? {}) as Partial<PhotoFrameConfig>;
  return {
    sourceId: raw.sourceId ?? '',
    intervalSeconds: raw.intervalSeconds ?? 30,
    transition: raw.transition ?? 'crossfade',
    fitMode: raw.fitMode ?? 'cover',
    shuffle: raw.shuffle ?? true,
    showCaption: raw.showCaption ?? false,
  };
}

export function PhotoFrameConfigForm({ config, onChange }: WidgetConfigFormProps) {
  const cfg = parseConfig(config);
  const { data, isLoading, refetch } = usePhotoSources();
  const sources = data?.sources ?? [];

  function update(patch: Partial<PhotoFrameConfig>) {
    onChange({ ...cfg, ...patch });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Source picker */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="photo-source">Photo Source</Label>
        <div className="flex gap-2">
          <Select
            value={cfg.sourceId ?? ''}
            onValueChange={(value) => update({ sourceId: value || undefined })}
          >
            <SelectTrigger id="photo-source" className="min-h-11 flex-1">
              <SelectValue placeholder="Select a source…" />
            </SelectTrigger>
            <SelectContent>
              {sources.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} ({s.imageCount} images)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => { void refetch(); }}
            title="Refresh sources"
            aria-label="Refresh photo sources"
            className="shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
          </Button>
        </div>
        {sources.length === 0 && !isLoading && (
          <p className="text-[11px] text-muted-foreground">
            No photo sources configured. Add one in Settings → Integrations → Photo Sources.
          </p>
        )}
      </div>

      {/* Interval + Fit Mode */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="photo-interval">Slide Duration (sec)</Label>
          <Input
            id="photo-interval"
            type="number"
            min={5}
            max={300}
            step={5}
            value={cfg.intervalSeconds ?? 30}
            onChange={(e) => update({ intervalSeconds: Math.max(5, parseInt(e.target.value, 10) || 30) })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="photo-fit-mode">Fit Mode</Label>
          <Select
            value={cfg.fitMode ?? 'cover'}
            onValueChange={(value) =>
              update({ fitMode: value as PhotoFrameConfig['fitMode'] })
            }
          >
            <SelectTrigger id="photo-fit-mode" className="min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cover">Cover (crop to fill)</SelectItem>
              <SelectItem value="contain">Contain (show all)</SelectItem>
              <SelectItem value="fill">Fill (stretch)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Transition */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="photo-transition">Transition</Label>
        <Select
          value={cfg.transition ?? 'crossfade'}
          onValueChange={(value) =>
            update({ transition: value as PhotoFrameConfig['transition'] })
          }
        >
          <SelectTrigger id="photo-transition" className="min-h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="crossfade">Crossfade</SelectItem>
            <SelectItem value="none">None (instant)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Toggles */}
      <div className="flex min-h-11 items-center justify-between">
        <Label htmlFor="photo-shuffle">Shuffle photos</Label>
        <Switch
          id="photo-shuffle"
          checked={cfg.shuffle ?? true}
          onCheckedChange={(checked) => update({ shuffle: checked })}
        />
      </div>
      <div className="flex min-h-11 items-center justify-between">
        <Label htmlFor="photo-caption">Show filename caption</Label>
        <Switch
          id="photo-caption"
          checked={cfg.showCaption ?? false}
          onCheckedChange={(checked) => update({ showCaption: checked })}
        />
      </div>
    </div>
  );
}
