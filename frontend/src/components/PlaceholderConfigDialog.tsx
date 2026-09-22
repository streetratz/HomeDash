/**
 * 002 Phase 3–5: Placeholder configuration dialog with widget management.
 *
 * Manages placeholder settings (title, border color, opacity, showBorder) and widget
 * lifecycle (add via picker, configure, reorder, delete).
 * All changes are immediate draft mutations — committed on layout Save.
 */

import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog.js';
import { Button } from './ui/button.js';
import { Input } from './ui/input.js';
import { Label } from './ui/label.js';
import { ColorPicker } from './ui/color-picker.js';
import { Switch } from './ui/switch.js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs.js';
import type { PlaceholderDraft, WidgetDraft } from '../state/useEditMode.js';
import { widgetRegistry } from './widgets/registry.js';
import { WidgetPicker } from './widgets/WidgetPicker.js';
import { WidgetListEditor } from './widgets/WidgetListEditor.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select.js';
import { AlertTriangle, Globe2, Lock } from 'lucide-react';
import {
  INTRINSIC_PUBLIC_WIDGET_TYPES,
  PUBLICLY_CONFIGURABLE_WIDGET_TYPES,
  SENSITIVE_PUBLIC_WIDGET_TYPES,
  type PublicVisibility,
} from '../state/widgetVisibility.js';

interface PlaceholderConfigDialogProps {
  placeholder: PlaceholderDraft | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dashboardDirty: boolean;
  onSave: (stableKey: string, updates: { title: string | null; borderColor: string; borderSize: number; opacity: number; backgroundStyle: 'solid' | 'aurora' | 'aurora-australis'; backgroundColor: string | null; showBorder: boolean; showTitle: boolean; titleStyle: 'header' | 'pill'; childLayout: 'stacked' | 'side-by-side' }) => void;
  onRestorePlaceholder: (
    stableKey: string,
    snapshot: PlaceholderDraft,
    wasDirty: boolean,
  ) => void;
  onAddWidget: (type: string, defaultConfig: Record<string, unknown>) => void;
  onRemoveWidget: (draftId: string) => void;
  onReorderWidgets: (orderedDraftIds: string[]) => void;
  onUpdateWidgetConfig: (draftId: string, config: Record<string, unknown>) => void;
  onUpdateWidgetVisibility: (draftId: string, publicVisibility: PublicVisibility) => void;
}

export function PlaceholderConfigDialog({
  placeholder,
  open,
  onOpenChange,
  dashboardDirty,
  onSave,
  onRestorePlaceholder,
  onAddWidget,
  onRemoveWidget,
  onReorderWidgets,
  onUpdateWidgetConfig,
  onUpdateWidgetVisibility,
}: PlaceholderConfigDialogProps) {
  const [title, setTitle] = useState('');
  const [borderColor, setBorderColor] = useState('#3b82f6');
  const [borderSize, setBorderSize] = useState(2);
  const [opacity, setOpacity] = useState(0.3);
  const [showBorder, setShowBorder] = useState(true);
  const [showTitle, setShowTitle] = useState(false);
  const [titleStyle, setTitleStyle] = useState<'header' | 'pill'>('header');
  const [childLayout, setChildLayout] = useState<'stacked' | 'side-by-side'>('stacked');
  const [backgroundStyle, setBackgroundStyle] = useState<'solid' | 'aurora' | 'aurora-australis'>('solid');
  const [backgroundColor, setBackgroundColor] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [configWidgetId, setConfigWidgetId] = useState<string | null>(null);
  const sessionSnapshotRef = useRef<PlaceholderDraft | null>(null);
  const sessionWasDirtyRef = useRef(false);
  const sessionKeyRef = useRef<string | null>(null);
  const applyingRef = useRef(false);

  // Sync form state when dialog opens with a different placeholder
  const [prevKey, setPrevKey] = useState<string | null>(null);
  // Track which placeholder already had auto-picker triggered
  const [autoPickerKey, setAutoPickerKey] = useState<string | null>(null);
  let autoOpenPicker = false;
  if (placeholder && placeholder.stableKey !== prevKey) {
    setPrevKey(placeholder.stableKey);
    setTitle(placeholder.title ?? '');
    setBorderColor(placeholder.borderColor);
    setBorderSize(placeholder.borderSize ?? 2);
    setOpacity(placeholder.opacity);
    setShowBorder(placeholder.showBorder ?? true);
    setShowTitle(placeholder.showTitle ?? false);
    setTitleStyle(placeholder.titleStyle ?? 'header');
    setChildLayout(placeholder.childLayout ?? 'stacked');
    setBackgroundStyle(placeholder.backgroundStyle ?? 'solid');
    setBackgroundColor(placeholder.backgroundColor ?? null);
    setConfigWidgetId(null);
    // Auto-open picker when opening a placeholder with no widgets
    if (open && placeholder.widgets.length === 0 && autoPickerKey !== placeholder.stableKey) {
      setAutoPickerKey(placeholder.stableKey);
      autoOpenPicker = true;
    }
    // Auto-open config for single-widget placeholders
    if (placeholder.widgets.length === 1) {
      const only = placeholder.widgets[0]!;
      const def = widgetRegistry.get(only.type);
      if (def?.ConfigFormComponent) {
        setConfigWidgetId(only.draftId);
      }
    }
  }
  if (autoOpenPicker && !pickerOpen) {
    setPickerOpen(true);
  }

  useEffect(() => {
    if (!open || !placeholder || sessionKeyRef.current === placeholder.stableKey) return;

    sessionKeyRef.current = placeholder.stableKey;
    sessionWasDirtyRef.current = dashboardDirty;
    sessionSnapshotRef.current = {
      ...placeholder,
      widgets: placeholder.widgets.map((widget) => ({
        ...widget,
        links: [...widget.links],
      })),
      ...(placeholder.layouts
        ? {
            layouts: Object.fromEntries(
              Object.entries(placeholder.layouts).map(([breakpoint, layout]) => [
                breakpoint,
                layout ? { ...layout } : layout,
              ]),
            ),
          }
        : {}),
    };
  }, [dashboardDirty, open, placeholder]);

  // Derive selected widget from live draft
  const configWidget = configWidgetId
    ? placeholder?.widgets.find((w) => w.draftId === configWidgetId) ?? null
    : null;

  const configWidgetDef = configWidget ? widgetRegistry.get(configWidget.type) : null;
  const ConfigForm = configWidgetDef?.ConfigFormComponent ?? null;
  const isSingleWidget = (placeholder?.widgets.length ?? 0) === 1;

  function handleDialogOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      const snapshot = sessionSnapshotRef.current;
      if (!applyingRef.current && snapshot) {
        onRestorePlaceholder(snapshot.stableKey, snapshot, sessionWasDirtyRef.current);
      }
      applyingRef.current = false;
      sessionSnapshotRef.current = null;
      sessionKeyRef.current = null;
    }
    onOpenChange(nextOpen);
  }

  function handleSave() {
    if (!placeholder) return;
    onSave(placeholder.stableKey, {
      title: title.trim() || null,
      borderColor,
      borderSize,
      opacity: Math.max(0, Math.min(1, opacity)),
      backgroundStyle,
      backgroundColor,
      showBorder,
      showTitle,
      titleStyle,
      childLayout,
    });
    applyingRef.current = true;
    handleDialogOpenChange(false);
  }

  function handleWidgetConfigChange(newConfig: unknown) {
    if (configWidgetId && newConfig && typeof newConfig === 'object') {
      onUpdateWidgetConfig(configWidgetId, newConfig as Record<string, unknown>);
    }
  }

  function parseWidgetConfig(widget: WidgetDraft): unknown {
    try {
      return JSON.parse(widget.configJson);
    } catch {
      return {};
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Configure Widget Container</DialogTitle>
            <DialogDescription>
              Apply stages these changes. Use Save in the dashboard toolbar to persist them.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="widgets" className="py-2">
            <TabsList className="w-full">
              <TabsTrigger value="widgets" className="flex-1">Widgets</TabsTrigger>
              <TabsTrigger value="styling" className="flex-1">Styling</TabsTrigger>
            </TabsList>

            {/* ── Tab 1: Widgets ──────────────────────────────────────── */}
            <TabsContent value="widgets" className="flex flex-col gap-4 pt-2">
              <div className="flex flex-col gap-2">
                {/* Per-widget config panel */}
                {configWidget && ConfigForm ? (
                  <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
                    {!isSingleWidget && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          Configure {configWidgetDef?.displayName ?? configWidget.type}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfigWidgetId(null)}
                        >
                          Done
                        </Button>
                      </div>
                    )}
                    <ConfigForm
                      config={parseWidgetConfig(configWidget)}
                      onChange={handleWidgetConfigChange}
                      widget={configWidget}
                    />
                    <WidgetVisibilityControl
                      widget={configWidget}
                      onChange={(visibility) =>
                        onUpdateWidgetVisibility(configWidget.draftId, visibility)
                      }
                    />
                  </div>
                ) : (
                  <WidgetListEditor
                    widgets={placeholder?.widgets ?? []}
                    onReorder={onReorderWidgets}
                    onDelete={(draftId) => {
                      if (configWidgetId === draftId) setConfigWidgetId(null);
                      onRemoveWidget(draftId);
                    }}
                    onConfigure={setConfigWidgetId}
                    onAddWidget={() => setPickerOpen(true)}
                  />
                )}
              </div>
            </TabsContent>

            {/* ── Tab 2: Styling ─────────────────────────────────────── */}
            <TabsContent value="styling" className="flex flex-col gap-4 pt-2">
              {/* Title */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ph-title">Title</Label>
                <Input
                  id="ph-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={64}
                  placeholder="Widget title"
                />
              </div>

              {/* Title: Show/Hide + Style switcher */}
              <div className="flex min-h-11 items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    id="ph-show-title"
                    checked={showTitle}
                    onCheckedChange={setShowTitle}
                  />
                  <Label htmlFor="ph-show-title" className="text-sm">Show Title</Label>
                </div>
                <div
                  className="flex items-center gap-1.5"
                  role="group"
                  aria-label="Title style"
                >
                  <span className="text-xs text-muted-foreground mr-1">Style:</span>
                  <button
                    type="button"
                    onClick={() => setTitleStyle('header')}
                    aria-pressed={titleStyle === 'header'}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      titleStyle === 'header'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    Header
                  </button>
                  <button
                    type="button"
                    onClick={() => setTitleStyle('pill')}
                    aria-pressed={titleStyle === 'pill'}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      titleStyle === 'pill'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    Pill
                  </button>
                </div>
              </div>

              {/* Child Layout (only relevant for multi-widget) */}
              {(placeholder?.widgets.length ?? 0) > 1 && (
                <>
                  <div className="flex items-center gap-2" role="group" aria-label="Widget layout">
                    <span className="text-xs text-muted-foreground mr-1">Layout:</span>
                    <button
                      type="button"
                      onClick={() => setChildLayout('stacked')}
                      aria-pressed={childLayout === 'stacked'}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                        childLayout === 'stacked'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      Stacked
                    </button>
                    <button
                      type="button"
                      onClick={() => setChildLayout('side-by-side')}
                      aria-pressed={childLayout === 'side-by-side'}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                        childLayout === 'side-by-side'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      Side by Side
                    </button>
                  </div>
                </>
              )}

              <div className="border-t" />
              <div className="flex min-h-11 items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    id="ph-show-border"
                    checked={showBorder}
                    onCheckedChange={setShowBorder}
                  />
                  <Label htmlFor="ph-show-border" className="text-sm">Show Border</Label>
                </div>
                <div className={`flex items-center gap-2 ${!showBorder ? 'opacity-40 pointer-events-none' : ''}`}>
                  <span className="text-xs text-muted-foreground">Color:</span>
                  <ColorPicker
                    value={borderColor}
                    onChange={setBorderColor}
                    disabled={!showBorder}
                  />
                </div>
              </div>

              {/* Size + Opacity side by side */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className={`space-y-1.5 ${!showBorder ? 'opacity-40 pointer-events-none' : ''}`}>
                  <Label htmlFor="ph-border-size" className="text-xs">Size ({borderSize}px)</Label>
                  <input
                    id="ph-border-size"
                    type="range"
                    min={1}
                    max={8}
                    step={1}
                    value={borderSize}
                    onChange={(e) => setBorderSize(parseInt(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ph-opacity" className="text-xs">Opacity ({Math.round(opacity * 100)}%)</Label>
                  <input
                    id="ph-opacity"
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={opacity}
                    onChange={(e) => setOpacity(parseFloat(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
              </div>

              {/* Background Style */}
              <div
                className="flex flex-wrap items-center gap-2"
                role="group"
                aria-label="Widget background"
              >
                <span className="text-xs text-muted-foreground mr-1">Background:</span>
                <button
                  type="button"
                  onClick={() => setBackgroundStyle('solid')}
                  aria-pressed={backgroundStyle === 'solid'}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    backgroundStyle === 'solid'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  Solid
                </button>
                <button
                  type="button"
                  onClick={() => setBackgroundStyle('aurora')}
                  aria-pressed={backgroundStyle === 'aurora'}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    backgroundStyle === 'aurora'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  Aurora Borealis
                </button>
                <button
                  type="button"
                  onClick={() => setBackgroundStyle('aurora-australis')}
                  aria-pressed={backgroundStyle === 'aurora-australis'}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    backgroundStyle === 'aurora-australis'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  Aurora Australis
                </button>
              </div>

              {/* Background Color (only for Solid) */}
              {backgroundStyle === 'solid' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground mr-1">Color:</span>
                  <ColorPicker
                    value={backgroundColor ?? 'hsl(var(--card))'}
                    onChange={(c) => setBackgroundColor(c)}
                  />
                  {backgroundColor && (
                    <button
                      type="button"
                      onClick={() => setBackgroundColor(null)}
                      className="text-[10px] text-muted-foreground underline hover:text-foreground"
                    >
                      Reset
                    </button>
                  )}
                </div>
              )}

              {/* Live preview */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Preview</Label>
                <div
                  className="relative h-16 overflow-visible rounded-lg"
                  style={{ border: showBorder ? `${borderSize}px solid ${borderColor}` : `${borderSize}px solid transparent` }}
                >
                  {backgroundStyle === 'aurora' ? (
                    <div className="absolute inset-0 rounded-[8px] ss-aurora-bg" />
                  ) : backgroundStyle === 'aurora-australis' ? (
                    <div className="absolute inset-0 rounded-[8px] ss-aurora-australis-bg" />
                  ) : (
                    <div
                      className={`absolute inset-0 rounded-[8px] ${backgroundColor ? '' : 'bg-card'}`}
                      style={{ opacity, ...(backgroundColor ? { backgroundColor } : {}) }}
                    />
                  )}
                  {title.trim() && showTitle && titleStyle === 'pill' && (
                    <div className="absolute -top-2.5 left-3 z-10">
                      <span
                        className="inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-semibold text-white"
                        style={{ backgroundColor: borderColor, borderColor }}
                      >
                        {title.trim()}
                      </span>
                    </div>
                  )}
                  {title.trim() && showTitle && titleStyle === 'header' && (
                    <div className="relative z-10 flex items-center rounded-t-[8px] px-3 py-1" style={{ backgroundColor: `${borderColor}33` }}>
                      <span className="text-xs font-semibold text-foreground">{title.trim()}</span>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="ghost" onClick={() => handleDialogOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Apply to Draft</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Widget picker dialog */}
      <WidgetPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={onAddWidget}
      />
    </>
  );
}

export function WidgetVisibilityControl({
  widget,
  onChange,
}: {
  widget: WidgetDraft;
  onChange: (visibility: PublicVisibility) => void;
}) {
  const isConfigurable = PUBLICLY_CONFIGURABLE_WIDGET_TYPES.has(widget.type);
  const isIntrinsic = INTRINSIC_PUBLIC_WIDGET_TYPES.has(widget.type);
  const isSensitive = SENSITIVE_PUBLIC_WIDGET_TYPES.has(widget.type);

  if (isIntrinsic) {
    return (
      <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
        <div className="flex items-center gap-2 font-medium">
          <Globe2 className="h-4 w-4 text-status-info" />
          Public dashboard visibility
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          This self-contained widget appears whenever its dashboard is selected as public.
        </p>
      </div>
    );
  }

  if (!isConfigurable) {
    return (
      <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
        <div className="flex items-center gap-2 font-medium">
          <Lock className="h-4 w-4 text-muted-foreground" />
          Private only
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          This widget type cannot be exposed on a public dashboard.
        </p>
      </div>
    );
  }

  const visibility = widget.publicVisibility ?? 'hidden';
  return (
    <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
      <div className="space-y-1">
        <Label htmlFor={`visibility-${widget.draftId}`}>Public dashboard visibility</Label>
        <Select value={visibility} onValueChange={(value) => onChange(value as PublicVisibility)}>
          <SelectTrigger id={`visibility-${widget.draftId}`} className="min-h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hidden">Hidden</SelectItem>
            <SelectItem value="read-only">Read-only</SelectItem>
            <SelectItem value="visible">Visible</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-muted-foreground">
        Hidden keeps this widget off anonymous dashboards. Read-only and Visible both expose
        display data without controls.
      </p>
      {visibility !== 'hidden' && isSensitive && (
        <div
          className="flex gap-2 rounded-md border border-status-warning/40 bg-status-warning/10 p-2 text-xs text-foreground"
          role="alert"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-warning" />
          <span>
            This may reveal household infrastructure, playback, or financial information to
            anyone who can reach HomeDash on your network.
          </span>
        </div>
      )}
    </div>
  );
}
