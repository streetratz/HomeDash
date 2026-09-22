/**
 * 003 Phase 1: Configuration form for the links_list widget type.
 *
 * Manages layout setting (vertical / horizontal) and full CRUD for links
 * via the backend link APIs.
 */

import { createElement, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Pencil, X, Check, Globe, icons as lucideIcons } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button.js';
import { Input } from '../ui/input.js';
import { Label } from '../ui/label.js';
import { apiClient } from '../../lib/apiClient.js';
import { IconPicker, isCdnIcon, parseCdnIcon, cdnIconUrl } from '../IconPicker.js';
import type { WidgetConfigFormProps } from './registry.js';
import type { LinksListConfig, LinkView } from '../../state/dashboards.js';

function parseConfig(config: unknown): LinksListConfig {
  const raw = (config ?? {}) as Partial<LinksListConfig>;
  return {
    layout: raw.layout ?? 'vertical',
  };
}

interface LinkFormData {
  title: string;
  url: string;
  iconKey: string | null;
}

const EMPTY_FORM: LinkFormData = { title: '', url: '', iconKey: null };

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function IconButton({ iconKey, onClick }: { iconKey: string | null; onClick: () => void }) {
  const hasCdn = iconKey && isCdnIcon(iconKey);
  const hasLucide = iconKey && !hasCdn && (iconKey in lucideIcons);
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border hover:bg-accent transition-colors"
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
        <Globe className="h-4 w-4" />
      )}
    </button>
  );
}

export function LinksListConfigForm({ config, onChange, widget }: WidgetConfigFormProps) {
  const c = parseConfig(config);
  const queryClient = useQueryClient();

  // Local state for add / edit forms
  const [addForm, setAddForm] = useState<LinkFormData | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<LinkFormData>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [iconPickerTarget, setIconPickerTarget] = useState<'add' | 'edit'>('add');

  const widgetId = widget?.persistedId;
  // Local links state so UI updates immediately after add/edit/delete
  const [localLinks, setLocalLinks] = useState<LinkView[]>(widget?.links ?? []);
  const links: LinkView[] = localLinks;

  function update(patch: Partial<LinksListConfig>) {
    onChange({ ...c, ...patch });
  }

  async function invalidateLinks() {
    await queryClient.invalidateQueries({ queryKey: ['public-bootstrap'] });
    await queryClient.invalidateQueries({ queryKey: ['dashboards'] });
  }

  // ── Add link ───────────────────────────────────────────────────────────────

  async function handleAddLink() {
    if (!widgetId || !addForm) return;
    const title = addForm.title.trim();
    const url = addForm.url.trim();
    if (!title || !url) {
      toast.error('Title and URL are required');
      return;
    }
    if (!isValidUrl(url)) {
      toast.error('Please enter a valid URL');
      return;
    }
    setBusy(true);
    try {
      const newLink = await apiClient.post<LinkView>(`/api/admin/widgets/${widgetId}/links`, { title, url, iconKey: addForm.iconKey });
      toast.success('Link added');
      setAddForm(null);
      setLocalLinks((prev) => [...prev, newLink]);
      await invalidateLinks();
    } catch (err) {
      toast.error(`Failed to add link: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setBusy(false);
    }
  }

  // ── Edit link ──────────────────────────────────────────────────────────────

  function startEdit(link: LinkView) {
    setEditingId(link.id);
    setEditForm({ title: link.title, url: link.url, iconKey: link.iconKey ?? null });
    setAddForm(null);
  }

  async function handleSaveEdit() {
    if (!editingId) return;
    const title = editForm.title.trim();
    const url = editForm.url.trim();
    if (!title || !url) {
      toast.error('Title and URL are required');
      return;
    }
    if (!isValidUrl(url)) {
      toast.error('Please enter a valid URL');
      return;
    }
    setBusy(true);
    try {
      await apiClient.put(`/api/admin/links/${editingId}`, { title, url, iconKey: editForm.iconKey });
      toast.success('Link updated');
      setLocalLinks((prev) => prev.map((l) => l.id === editingId ? { ...l, title, url, iconKey: editForm.iconKey ?? null } : l));
      setEditingId(null);
      setEditForm(EMPTY_FORM);
      await invalidateLinks();
    } catch (err) {
      toast.error(`Failed to update link: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setBusy(false);
    }
  }

  // ── Delete link ────────────────────────────────────────────────────────────

  async function handleDelete(linkId: string) {
    setBusy(true);
    try {
      await apiClient.delete(`/api/admin/links/${linkId}`);
      toast.success('Link deleted');
      setLocalLinks((prev) => prev.filter((l) => l.id !== linkId));
      if (editingId === linkId) {
        setEditingId(null);
        setEditForm(EMPTY_FORM);
      }
      await invalidateLinks();
    } catch (err) {
      toast.error(`Failed to delete link: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Layout toggle ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5">
        <Label>Layout</Label>
        <div className="flex gap-2">
          <button
            type="button"
            className={`rounded-md border px-3 py-1.5 text-sm ${
              c.layout === 'vertical'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:border-primary/50'
            }`}
            onClick={() => update({ layout: 'vertical' })}
          >
            Vertical
          </button>
          <button
            type="button"
            className={`rounded-md border px-3 py-1.5 text-sm ${
              c.layout === 'horizontal'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:border-primary/50'
            }`}
            onClick={() => update({ layout: 'horizontal' })}
          >
            Horizontal
          </button>
        </div>
      </div>

      {/* ── Links management ──────────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5">
        <Label>Links</Label>

        {!widgetId ? (
          <p className="text-sm text-muted-foreground">
            Save the layout first, then configure links.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {/* Existing links */}
            {links.length === 0 && !addForm && (
              <p className="text-sm text-muted-foreground">No links yet.</p>
            )}

            {links.map((link) =>
              editingId === link.id ? (
                <div key={link.id} className="flex flex-col gap-1.5 rounded-md border border-border p-2">
                  <div className="flex items-center gap-2">
                    <IconButton iconKey={editForm.iconKey} onClick={() => { setIconPickerTarget('edit'); setIconPickerOpen(true); }} />
                    <Input
                      value={editForm.title}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      placeholder="Title"
                      maxLength={15}
                      disabled={busy}
                      className="flex-1"
                    />
                  </div>
                  <Input
                    value={editForm.url}
                    onChange={(e) => setEditForm({ ...editForm, url: e.target.value })}
                    placeholder="https://..."
                    disabled={busy}
                  />
                  <div className="flex gap-1.5 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setEditingId(null); setEditForm(EMPTY_FORM); }}
                      disabled={busy}
                    >
                      <X className="mr-1 h-3.5 w-3.5" />
                      Cancel
                    </Button>
                    <Button size="sm" onClick={() => { void handleSaveEdit(); }} disabled={busy}>
                      <Check className="mr-1 h-3.5 w-3.5" />
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  key={link.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{link.title}</span>
                    <span className="ml-1.5 truncate text-muted-foreground">{link.url}</span>
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => startEdit(link)}
                      disabled={busy}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => { void handleDelete(link.id); }}
                      disabled={busy}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ),
            )}

            {/* Always-visible inline add row */}
            <div className="flex items-center gap-2 border-t border-dashed border-border pt-2">
              <IconButton iconKey={addForm?.iconKey ?? null} onClick={() => { if (!addForm) setAddForm(EMPTY_FORM); setIconPickerTarget('add'); setIconPickerOpen(true); }} />
              <Input
                placeholder="Name"
                value={addForm?.title ?? ''}
                onChange={(e) => setAddForm(prev => ({ ...(prev ?? EMPTY_FORM), title: e.target.value }))}
                maxLength={15}
                disabled={busy}
                className="flex-1 h-8"
              />
              <Input
                placeholder="https://..."
                value={addForm?.url ?? ''}
                onChange={(e) => setAddForm(prev => ({ ...(prev ?? EMPTY_FORM), url: e.target.value }))}
                disabled={busy}
                className="flex-1 h-8"
              />
              <Button size="icon" className="h-8 w-8 shrink-0" onClick={() => { void handleAddLink(); }} disabled={busy || !addForm?.title?.trim() || !addForm?.url?.trim()}>
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
        selectedIcon={iconPickerTarget === 'add' ? (addForm?.iconKey ?? null) : editForm.iconKey}
        onSelect={(name) => {
          if (iconPickerTarget === 'add' && addForm) {
            setAddForm({ ...addForm, iconKey: name });
          } else {
            setEditForm({ ...editForm, iconKey: name });
          }
        }}
      />
    </div>
  );
}
