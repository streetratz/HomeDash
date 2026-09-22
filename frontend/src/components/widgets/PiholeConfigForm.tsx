/**
 * PiholeConfigForm — Configuration form for the Pi-hole DNS Controls widget.
 * Connection is managed via ConnectionPicker; only display options remain here.
 */

import { Label } from '../ui/label.js';
import { Switch } from '../ui/switch.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select.js';
import type { WidgetConfigFormProps } from './registry.js';
import { ConnectionPicker } from './ConnectionPicker.js';

type PiholeSection = 'controls' | 'system' | 'queries';
type PiholeStatsLayout = 'auto' | 'stacked' | 'side-by-side';
const ALL_SECTIONS: PiholeSection[] = ['controls', 'system', 'queries'];
const SECTION_LABELS: Record<PiholeSection, string> = {
  controls: 'Controls (status & blocking toggle)',
  system: 'System Stats (CPU, memory, temp)',
  queries: 'Query Stats (queries, blocked, clients)',
};

interface PiholeDisplayConfig {
  sections?: PiholeSection[];
  statsLayout?: PiholeStatsLayout;
}

export function PiholeConfigForm({ config, onChange, widget }: WidgetConfigFormProps) {
  const cfg = (config ?? {}) as PiholeDisplayConfig;
  const widgetId = widget?.persistedId;
  const active = new Set<PiholeSection>(cfg.sections && cfg.sections.length > 0 ? cfg.sections : ALL_SECTIONS);
  const statsLayout = cfg.statsLayout ?? 'auto';
  const hasMultipleStats = active.has('system') && active.has('queries');

  const toggle = (section: PiholeSection) => {
    const next = new Set(active);
    if (next.has(section)) {
      if (next.size <= 1) return; // at least one required
      next.delete(section);
    } else {
      next.add(section);
    }
    onChange({ ...cfg, sections: [...next] });
  };

  return (
    <div className="space-y-5">
      {/* ── Connection picker ──────────────────────────────────────── */}
      <ConnectionPicker
        widgetInstanceId={widgetId}
        connectionType="pihole"
        description="Select a Pi-hole server. Manage connections in Settings → Integrations."
      />

      {/* ── Sections ─────────────────────────────────────────────── */}
      <div className="space-y-3 border-t border-white/10 pt-4">
        <span className="text-sm font-medium">Visible Sections</span>
        <p className="text-xs text-muted-foreground">At least one section must be enabled.</p>

        {ALL_SECTIONS.map((section) => (
          <div key={section} className="flex items-center justify-between">
            <Label htmlFor={`ph-${section}`} className="text-xs">
              {SECTION_LABELS[section]}
            </Label>
            <Switch
              id={`ph-${section}`}
              checked={active.has(section)}
              onCheckedChange={() => toggle(section)}
            />
          </div>
        ))}
      </div>

      {/* ── Stats layout ─────────────────────────────────────────── */}
      {hasMultipleStats && (
        <div className="space-y-2 border-t border-white/10 pt-4">
          <Label className="text-sm font-medium">Stats Layout</Label>
          <Select
            value={statsLayout}
            onValueChange={(v) => onChange({ ...cfg, statsLayout: v as PiholeStatsLayout })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto (responsive)</SelectItem>
              <SelectItem value="side-by-side">Side by Side</SelectItem>
              <SelectItem value="stacked">Stacked</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Auto adapts based on widget width.
          </p>
        </div>
      )}
    </div>
  );
}
