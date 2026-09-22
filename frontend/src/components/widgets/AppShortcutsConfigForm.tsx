/**
 * 013-app-shortcuts (US1): Config form for the App Shortcuts widget.
 * Allows adding/editing/deleting shortcuts and configuring column count.
 */

import { createElement, useState } from 'react';
import { Pencil, Plus, Trash2, X, Check, Globe, icons as lucideIcons } from 'lucide-react';
import type { WidgetConfigFormProps } from './registry.js';
import type { AppShortcutsConfig } from '../../state/dashboards.js';
import {
  useShortcuts,
  useCreateShortcut,
  useUpdateShortcut,
  useDeleteShortcut,
} from '../../state/appShortcutHooks.js';
import { Label } from '../ui/label.js';
import { Switch } from '../ui/switch.js';
import { Input } from '../ui/input.js';
import { Button } from '../ui/button.js';
import { IconPicker, isCdnIcon, parseCdnIcon, cdnIconUrl } from '../IconPicker.js';

const DEFAULT_CONFIG: AppShortcutsConfig = { columns: 4, iconSize: 'md', showLabels: true };

const ICON_SIZES: { value: AppShortcutsConfig['iconSize']; label: string }[] = [
  { value: 'sm', label: 'S' },
  { value: 'md', label: 'M' },
  { value: 'lg', label: 'L' },
];

interface ShortcutFormState {
  name: string;
  url: string;
  iconKey: string | null;
}

const EMPTY_FORM: ShortcutFormState = { name: '', url: '', iconKey: null };

function IconButton({ iconKey, onClick }: { iconKey: string | null; onClick: () => void }) {
  const hasCdn = iconKey && isCdnIcon(iconKey);
  const hasLucide = iconKey && !hasCdn && (iconKey in lucideIcons);
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border hover:bg-accent transition-colors"
      title={iconKey ?? 'Choose icon'}
    >
      {hasCdn ? (
        <img
          src={cdnIconUrl(parseCdnIcon(iconKey))}
          alt={parseCdnIcon(iconKey)}
          className="h-5 w-5 object-contain"
        />
      ) : hasLucide ? (
        createElement(lucideIcons[iconKey as keyof typeof lucideIcons], { className: 'h-4 w-4' })
      ) : (
        <Globe className="h-4 w-4 text-muted-foreground" />
      )}
    </button>
  );
}

export function AppShortcutsConfigForm({ config, onChange, widget }: WidgetConfigFormProps) {
  const cfg: AppShortcutsConfig = { ...DEFAULT_CONFIG, ...(config as Partial<AppShortcutsConfig>) };
  const widgetId = widget?.persistedId ?? '';

  const { data } = useShortcuts(widgetId);
  const createShortcut = useCreateShortcut();
  const updateShortcut = useUpdateShortcut();
  const deleteShortcut = useDeleteShortcut();

  const [form, setForm] = useState<ShortcutFormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ShortcutFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [iconPickerTarget, setIconPickerTarget] = useState<'add' | 'edit'>('add');

  const shortcuts = data?.shortcuts ?? [];

  function update(patch: Partial<AppShortcutsConfig>) {
    onChange({ ...cfg, ...patch });
  }

  function validateForm(f: ShortcutFormState): boolean {
    if (!f.name.trim()) {
      setFormError('Name is required');
      return false;
    }
    if (!f.url.trim()) {
      setFormError('URL is required');
      return false;
    }
    try {
      new URL(f.url);
    } catch {
      setFormError('Please enter a valid URL (e.g. https://example.com)');
      return false;
    }
    setFormError('');
    return true;
  }

  function handleAdd() {
    if (!validateForm(form) || !widgetId) return;
    createShortcut.mutate({
      widgetId,
      name: form.name.trim(),
      url: form.url.trim(),
      ...(form.iconKey != null ? { iconKey: form.iconKey } : {}),
    });
    setForm(EMPTY_FORM);
  }

  function handleSaveEdit() {
    if (!validateForm(editForm) || !widgetId || !editingId) return;
    updateShortcut.mutate({
      widgetId,
      shortcutId: editingId,
      name: editForm.name.trim(),
      url: editForm.url.trim(),
      ...(editForm.iconKey !== undefined ? { iconKey: editForm.iconKey } : {}),
    });
    setEditingId(null);
    setEditForm(EMPTY_FORM);
  }

  function startEdit(shortcut: { id: string; name: string; url: string; iconKey?: string | null }) {
    setEditingId(shortcut.id);
    setEditForm({ name: shortcut.name, url: shortcut.url, iconKey: shortcut.iconKey ?? null });
    setFormError('');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(EMPTY_FORM);
    setFormError('');
  }

  function handleDelete(shortcutId: string) {
    if (!widgetId) return;
    deleteShortcut.mutate({ widgetId, shortcutId });
    if (editingId === shortcutId) cancelEdit();
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Column count */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="shortcut-columns">Grid Columns ({String(cfg.columns)})</Label>
        <input
          id="shortcut-columns"
          type="range"
          min={2}
          max={8}
          value={cfg.columns}
          onChange={(e) => update({ columns: Number(e.target.value) })}
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>2</span>
          <span>8</span>
        </div>
      </div>

      {/* Icon size */}
      <div className="flex flex-col gap-1.5">
        <Label>Icon Size</Label>
        <div className="flex gap-1" role="group" aria-label="Icon size">
          {ICON_SIZES.map((s) => (
            <button
              key={s.value}
              type="button"
              className={`rounded-md border px-4 py-1.5 text-sm font-medium transition-colors ${
                cfg.iconSize === s.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/50'
              }`}
              onClick={() => update({ iconSize: s.value })}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Show labels */}
      <div className="flex min-h-11 items-center justify-between gap-4">
        <Label htmlFor="shortcut-labels">Show Labels</Label>
        <Switch
          id="shortcut-labels"
          checked={cfg.showLabels}
          onCheckedChange={(checked) => update({ showLabels: checked })}
        />
      </div>

      {/* Shortcuts management */}
      <div className="flex flex-col gap-1.5">
        <Label>Shortcuts</Label>

        {!widgetId ? (
          <p className="text-sm text-muted-foreground">
            Save the layout first, then configure shortcuts.
          </p>
        ) : (
          <div className="flex flex-col gap-0">
            {/* Shortcut list */}
            {shortcuts.map((s) =>
              editingId === s.id ? (
                /* Inline edit row */
                <div key={s.id} className="flex items-center gap-2 py-1.5 border-b border-border/50">
                  <IconButton iconKey={editForm.iconKey} onClick={() => { setIconPickerTarget('edit'); setIconPickerOpen(true); }} />
                  <Input
                    value={editForm.name}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Name"
                    maxLength={100}
                    className="flex-1 h-8"
                  />
                  <Input
                    value={editForm.url}
                    onChange={(e) => setEditForm((f) => ({ ...f, url: e.target.value }))}
                    placeholder="https://..."
                    maxLength={2048}
                    className="flex-1 h-8"
                  />
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSaveEdit} disabled={updateShortcut.isPending}>
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelEdit}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                /* Read-only row */
                <div key={s.id} className="flex items-center gap-2 py-1.5 border-b border-border/50 last:border-b-0">
                  <IconButton iconKey={s.iconKey ?? null} onClick={() => startEdit(s)} />
                  <span className="flex-1 truncate text-sm font-medium">{s.name}</span>
                  <span className="flex-1 truncate text-xs text-muted-foreground">{s.url}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(s)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(s.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ),
            )}

            {formError && <p className="text-xs text-destructive py-1">{formError}</p>}

            {/* Inline add row */}
            <div className="flex items-center gap-2 py-1.5 border-t border-dashed border-border">
              <IconButton iconKey={form.iconKey} onClick={() => { setIconPickerTarget('add'); setIconPickerOpen(true); }} />
              <Input
                placeholder="Name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                maxLength={100}
                className="flex-1 h-8"
              />
              <Input
                placeholder="https://..."
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                maxLength={2048}
                className="flex-1 h-8"
              />
              <Button size="icon" className="h-8 w-8 shrink-0" onClick={handleAdd} disabled={createShortcut.isPending}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Icon picker dialog (shared between add and edit forms) */}
      <IconPicker
        open={iconPickerOpen}
        onOpenChange={setIconPickerOpen}
        selectedIcon={iconPickerTarget === 'add' ? form.iconKey : editForm.iconKey}
        onSelect={(name) => {
          if (iconPickerTarget === 'add') {
            setForm((f) => ({ ...f, iconKey: name }));
          } else {
            setEditForm((f) => ({ ...f, iconKey: name }));
          }
        }}
      />
    </div>
  );
}
