/**
 * 030-shortcuts-single-link (US3): Config form for the Single-Link widget.
 * URL, label, icon, subtitle, and background colour/gradient.
 */

import { useState, createElement } from 'react';
import { Globe, icons as lucideIcons } from 'lucide-react';
import type { WidgetConfigFormProps } from './registry.js';
import type { SingleLinkConfig } from '../../state/dashboards.js';
import { GRADIENT_PRESETS } from './SingleLinkWidget.js';
import { Label } from '../ui/label.js';
import { Input } from '../ui/input.js';
import { Button } from '../ui/button.js';
import { IconPicker, isCdnIcon, parseCdnIcon, cdnIconUrl } from '../IconPicker.js';
import { ColorPicker } from '../ui/color-picker.js';

const DEFAULT_CONFIG: SingleLinkConfig = {
  url: '',
  label: '',
  iconKey: null,
  subtitle: null,
  background: null,
};

function isValidUrl(s: string): boolean {
  try { new URL(s); return true; } catch { return false; }
}

export function SingleLinkConfigForm({ config, onChange }: WidgetConfigFormProps) {
  const cfg: SingleLinkConfig = { ...DEFAULT_CONFIG, ...(config as Partial<SingleLinkConfig>) };
  const [iconPickerOpen, setIconPickerOpen] = useState(false);

  function update(patch: Partial<SingleLinkConfig>) {
    onChange({ ...cfg, ...patch });
  }

  const urlError = cfg.url.length > 0 && !isValidUrl(cfg.url);

  return (
    <div className="flex flex-col gap-4">
      {/* URL */}
      <div className="space-y-1.5">
        <Label htmlFor="sl-url">URL *</Label>
        <Input
          id="sl-url"
          type="url"
          placeholder="https://example.com"
          value={cfg.url}
          onChange={(e) => update({ url: e.target.value })}
        />
        {urlError && (
          <p className="text-xs text-destructive">Please enter a valid URL</p>
        )}
      </div>

      {/* Label */}
      <div className="space-y-1.5">
        <Label htmlFor="sl-label">Label *</Label>
        <Input
          id="sl-label"
          placeholder="My Link"
          maxLength={100}
          value={cfg.label}
          onChange={(e) => update({ label: e.target.value })}
        />
      </div>

      {/* Icon */}
      <div className="space-y-1.5">
        <Label>Icon</Label>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            type="button"
            className="flex items-center gap-2"
            onClick={() => setIconPickerOpen(true)}
          >
            {cfg.iconKey && isCdnIcon(cfg.iconKey) ? (
              <img src={cdnIconUrl(parseCdnIcon(cfg.iconKey))} alt="" className="h-5 w-5 rounded object-contain" />
            ) : cfg.iconKey && cfg.iconKey in lucideIcons ? (
              createElement(lucideIcons[cfg.iconKey as keyof typeof lucideIcons], { className: 'h-5 w-5' })
            ) : (
              <Globe className="h-5 w-5 text-muted-foreground" />
            )}
            {cfg.iconKey ? 'Change Icon' : 'Pick Icon'}
          </Button>
          {cfg.iconKey && (
            <Button variant="ghost" size="sm" type="button" onClick={() => update({ iconKey: null })}>
              Clear
            </Button>
          )}
        </div>
        <IconPicker
          open={iconPickerOpen}
          onOpenChange={setIconPickerOpen}
          selectedIcon={cfg.iconKey}
          onSelect={(key) => { update({ iconKey: key }); setIconPickerOpen(false); }}
        />
      </div>

      {/* Subtitle */}
      <div className="space-y-1.5">
        <Label htmlFor="sl-subtitle">Subtitle (optional)</Label>
        <Input
          id="sl-subtitle"
          placeholder="Brief description"
          maxLength={200}
          value={cfg.subtitle ?? ''}
          onChange={(e) => update({ subtitle: e.target.value || null })}
        />
      </div>

      {/* Background */}
      <div className="space-y-2">
        <Label>Background</Label>

        {/* Gradient presets */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(GRADIENT_PRESETS).map(([key, gradient]) => (
            <button
              key={key}
              type="button"
              className={`h-8 w-8 rounded-md border-2 transition-[border-color,box-shadow] duration-150 ease-out ${
                cfg.background === key ? 'border-primary ring-2 ring-primary/30' : 'border-transparent'
              }`}
              style={{ background: gradient }}
              title={key.replace('gradient-', '')}
              onClick={() => update({ background: cfg.background === key ? null : key })}
            />
          ))}
        </div>

        {/* Solid colour picker */}
        <div className="flex items-center gap-2">
          <ColorPicker
            value={cfg.background?.startsWith('#') ? cfg.background : '#3b82f6'}
            onChange={(color) => update({ background: color })}
          />
          <span className="text-xs text-muted-foreground">or pick a solid colour</span>
        </div>

        {cfg.background && (
          <Button variant="ghost" size="sm" type="button" onClick={() => update({ background: null })}>
            Reset to default
          </Button>
        )}
      </div>
    </div>
  );
}
