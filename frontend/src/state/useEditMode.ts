/**
 * Phase R5/002: Edit mode state management hook.
 *
 * Manages the lifecycle of dashboard grid editing:
 * - Deep-clones placeholders into local draft state on enter
 * - All position/config/widget changes are local until Save
 * - Save sends PUT /api/admin/dashboards/:id/layout, then invalidates caches
 * - Cancel discards all local changes
 *
 * FR-018: Edit mode toggle (admin only)
 * FR-018a: Local state until Save
 * FR-001–FR-006: Widget management within edit mode
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '../lib/apiClient.js';
import { generateUUID } from '../lib/uuid.js';
import { dashboardKeys, type PlaceholderView, type WidgetView } from './dashboards.js';
import { bootstrapKeys } from './bootstrap.js';
import type { PublicVisibility } from './widgetVisibility.js';

// ── Draft types ──────────────────────────────────────────────────────────────

export interface WidgetDraft {
  /** DB id for existing widgets; undefined for newly added ones */
  persistedId?: string | undefined;
  /** Client-side identity for tracking in drafts */
  draftId: string;
  type: string;
  orderIndex: number;
  configJson: string;
  publicVisibility: PublicVisibility;
  /** Carried forward for display */
  links: WidgetView['links'];
}

export interface PlaceholderDraft {
  /** DB id for existing placeholders; undefined for newly added ones */
  persistedId?: string | undefined;
  stableKey: string;
  x: number;
  y: number;
  w: number;
  h: number;
  borderColor: string;
  borderSize: number;
  showBorder: boolean;
  title: string | null;
  showTitle: boolean;
  titleStyle: 'header' | 'pill';
  childLayout: 'stacked' | 'side-by-side';
  opacity: number;
  backgroundStyle: 'solid' | 'aurora' | 'aurora-australis';
  backgroundColor: string | null;
  /** Widget drafts within this placeholder */
  widgets: WidgetDraft[];
  /** Per-breakpoint layout overrides (md, sm, xs, xxs) */
  layouts?: Partial<Record<string, { x: number; y: number; w: number; h: number }>> | undefined;
}

export interface EditModeState {
  isEditing: boolean;
  editLayout: PlaceholderDraft[];
  isDirty: boolean;
  isSaving: boolean;
  enterEdit: () => void;
  exitEdit: () => void;
  saveEdit: () => void;
  updatePlaceholderPosition: (stableKey: string, x: number, y: number, w: number, h: number) => void;
  updateBreakpointPosition: (stableKey: string, breakpoint: string, x: number, y: number, w: number, h: number) => void;
  copyLayoutToSmaller: (fromBreakpoint: string) => void;
  addPlaceholder: () => string;
  removePlaceholder: (stableKey: string) => void;
  updatePlaceholderConfig: (stableKey: string, updates: Partial<Pick<PlaceholderDraft, 'title' | 'borderColor' | 'borderSize' | 'opacity' | 'backgroundStyle' | 'backgroundColor' | 'showBorder' | 'showTitle' | 'titleStyle' | 'childLayout'>>) => void;
  restorePlaceholder: (
    stableKey: string,
    snapshot: PlaceholderDraft,
    wasDirty: boolean,
  ) => void;
  // Widget draft operations
  addWidget: (stableKey: string, type: string, initialConfig: Record<string, unknown>) => void;
  removeWidget: (stableKey: string, draftId: string) => void;
  reorderWidgets: (stableKey: string, orderedDraftIds: string[]) => void;
  updateWidgetConfig: (stableKey: string, draftId: string, config: Record<string, unknown>) => void;
  updateWidgetVisibility: (stableKey: string, draftId: string, publicVisibility: PublicVisibility) => void;
}

const BREAKPOINT_ORDER = ['lg', 'md', 'sm', 'xs', 'xxs'];

function toWidgetDrafts(widgets: WidgetView[]): WidgetDraft[] {
  return widgets.map((w) => ({
    persistedId: w.id,
    draftId: w.id,
    type: w.type,
    orderIndex: w.orderIndex,
    configJson: typeof w.config === 'string' ? w.config : JSON.stringify(w.config ?? {}),
    publicVisibility: w.publicVisibility ?? 'hidden',
    links: w.links,
  }));
}

function toDrafts(placeholders: PlaceholderView[]): PlaceholderDraft[] {
  return placeholders.map((ph) => ({
    persistedId: ph.id,
    stableKey: ph.stableKey,
    x: ph.x,
    y: ph.y,
    w: ph.w,
    h: ph.h,
    borderColor: ph.borderColor,
    borderSize: ph.borderSize,
    showBorder: ph.showBorder,
    title: ph.title,
    showTitle: ph.showTitle,
    titleStyle: ph.titleStyle ?? 'header',
    childLayout: ph.childLayout ?? 'stacked',
    opacity: ph.opacity,
    backgroundStyle: ph.backgroundStyle ?? 'solid',
    backgroundColor: ph.backgroundColor ?? null,
    widgets: toWidgetDrafts(ph.widgets),
    layouts: ph.layouts,
  }));
}

/** Map over widgets of a specific placeholder */
function mapPlaceholderWidgets(
  layout: PlaceholderDraft[],
  stableKey: string,
  fn: (widgets: WidgetDraft[]) => WidgetDraft[],
): PlaceholderDraft[] {
  return layout.map((d) =>
    d.stableKey === stableKey ? { ...d, widgets: fn(d.widgets) } : d,
  );
}

export function buildLayoutPayload(drafts: PlaceholderDraft[]) {
  return {
    placeholders: drafts.map((d) => ({
      stableKey: d.stableKey,
      x: d.x,
      y: d.y,
      w: d.w,
      h: d.h,
      borderColor: d.borderColor,
      borderSize: d.borderSize,
      showBorder: d.showBorder,
      title: d.title,
      showTitle: d.showTitle,
      titleStyle: d.titleStyle,
      childLayout: d.childLayout,
      opacity: d.opacity,
      backgroundStyle: d.backgroundStyle,
      backgroundColor: d.backgroundColor,
      widgets: d.widgets.map((w) => ({
        id: w.persistedId,
        type: w.type,
        orderIndex: w.orderIndex,
        configJson: w.configJson,
        publicVisibility: w.publicVisibility,
      })),
      layouts: d.layouts,
    })),
  };
}

export function useEditMode(
  dashboardId: string | null,
  placeholders: PlaceholderView[],
): EditModeState {
  const [isEditing, setIsEditing] = useState(false);
  const [editLayout, setEditLayout] = useState<PlaceholderDraft[]>([]);
  const editLayoutRef = useRef<PlaceholderDraft[]>([]);
  useEffect(() => { editLayoutRef.current = editLayout; }, [editLayout]);
  const isDirtyRef = useRef(false);
  const [isDirty, setIsDirty] = useState(false);
  const queryClient = useQueryClient();

  const markDirty = useCallback(() => {
    if (!isDirtyRef.current) {
      isDirtyRef.current = true;
      setIsDirty(true);
    }
  }, []);

  const enterEdit = useCallback(() => {
    setEditLayout(toDrafts(placeholders));
    isDirtyRef.current = false;
    setIsDirty(false);
    setIsEditing(true);
  }, [placeholders]);

  const exitEdit = useCallback(() => {
    setEditLayout([]);
    isDirtyRef.current = false;
    setIsDirty(false);
    setIsEditing(false);
  }, []);

  const saveMutation = useMutation({
    mutationFn: async (drafts: PlaceholderDraft[]) => {
      if (!dashboardId) throw new Error('No dashboard to save');
      const payload = buildLayoutPayload(drafts);
      return apiClient.put(`/api/admin/dashboards/${dashboardId}/layout`, payload);
    },
    onSuccess: () => {
      toast.success('Layout saved');
      setIsEditing(false);
      isDirtyRef.current = false;
      setIsDirty(false);
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.detail(dashboardId!) });
      void queryClient.invalidateQueries({ queryKey: bootstrapKeys.public });
    },
    onError: (err: Error) => {
      toast.error(`Save failed: ${err.message}`);
    },
  });

  const saveEdit = useCallback(() => {
    saveMutation.mutate(editLayoutRef.current);
  }, [saveMutation]);

  const updatePlaceholderPosition = useCallback(
    (stableKey: string, x: number, y: number, w: number, h: number) => {
      setEditLayout((prev) =>
        prev.map((d) => (d.stableKey === stableKey ? { ...d, x, y, w, h } : d)),
      );
      markDirty();
    },
    [markDirty],
  );

  const updateBreakpointPosition = useCallback(
    (stableKey: string, breakpoint: string, x: number, y: number, w: number, h: number) => {
      setEditLayout((prev) =>
        prev.map((d) => {
          if (d.stableKey !== stableKey) return d;
          const existing = d.layouts ?? {};
          return { ...d, layouts: { ...existing, [breakpoint]: { x, y, w, h } } };
        }),
      );
      markDirty();
    },
    [markDirty],
  );

  const copyLayoutToSmaller = useCallback(
    (fromBreakpoint: string) => {
      const fromIdx = BREAKPOINT_ORDER.indexOf(fromBreakpoint);
      if (fromIdx < 0) return;
      const smallerBps = BREAKPOINT_ORDER.slice(fromIdx + 1);
      if (smallerBps.length === 0) return;

      setEditLayout((prev) =>
        prev.map((d) => {
          // Get the source layout: for lg use canonical x/y/w/h, otherwise use layouts[bp]
          const source = fromBreakpoint === 'lg'
            ? { x: d.x, y: d.y, w: d.w, h: d.h }
            : d.layouts?.[fromBreakpoint] ?? { x: d.x, y: d.y, w: d.w, h: d.h };

          const updatedLayouts = { ...(d.layouts ?? {}) };
          for (const bp of smallerBps) {
            updatedLayouts[bp] = { ...source };
          }
          return { ...d, layouts: updatedLayouts };
        }),
      );
      markDirty();
    },
    [markDirty],
  );

  const addPlaceholder = useCallback((): string => {
    const stableKey = generateUUID();
    const newDraft: PlaceholderDraft = {
      stableKey,
      x: 0,
      y: 0,
      w: 4,
      h: 3,
      borderColor: '#3b82f6',
      borderSize: 2,
      showBorder: true,
      title: null,
      showTitle: false,
      titleStyle: 'header',
      childLayout: 'stacked',
      opacity: 0.3,
      backgroundStyle: 'solid',
      backgroundColor: null,
      widgets: [],
    };
    setEditLayout((prev) => [...prev, newDraft]);
    markDirty();
    return stableKey;
  }, [markDirty]);

  const removePlaceholder = useCallback(
    (stableKey: string) => {
      setEditLayout((prev) => prev.filter((d) => d.stableKey !== stableKey));
      markDirty();
    },
    [markDirty],
  );

  const updatePlaceholderConfig = useCallback(
    (stableKey: string, updates: Partial<Pick<PlaceholderDraft, 'title' | 'borderColor' | 'borderSize' | 'opacity' | 'backgroundStyle' | 'showBorder' | 'showTitle' | 'titleStyle' | 'childLayout'>>) => {
      setEditLayout((prev) =>
        prev.map((d) => (d.stableKey === stableKey ? { ...d, ...updates } : d)),
      );
      markDirty();
    },
    [markDirty],
  );

  const restorePlaceholder = useCallback(
    (stableKey: string, snapshot: PlaceholderDraft, wasDirty: boolean) => {
      setEditLayout((prev) =>
        prev.map((draft) => (draft.stableKey === stableKey ? snapshot : draft)),
      );
      isDirtyRef.current = wasDirty;
      setIsDirty(wasDirty);
    },
    [],
  );

  // ── Widget draft operations ───────────────────────────────────────────────

  const addWidget = useCallback(
    (stableKey: string, type: string, initialConfig: Record<string, unknown>) => {
      setEditLayout((prev) =>
        mapPlaceholderWidgets(prev, stableKey, (widgets) => [
          ...widgets,
          {
            draftId: generateUUID(),
            type,
            orderIndex: widgets.length,
            configJson: JSON.stringify(initialConfig),
            publicVisibility: 'hidden',
            links: [],
          },
        ]),
      );
      markDirty();
    },
    [markDirty],
  );

  const removeWidget = useCallback(
    (stableKey: string, draftId: string) => {
      setEditLayout((prev) =>
        mapPlaceholderWidgets(prev, stableKey, (widgets) =>
          widgets
            .filter((w) => w.draftId !== draftId)
            .map((w, i) => ({ ...w, orderIndex: i })),
        ),
      );
      markDirty();
    },
    [markDirty],
  );

  const reorderWidgets = useCallback(
    (stableKey: string, orderedDraftIds: string[]) => {
      setEditLayout((prev) =>
        mapPlaceholderWidgets(prev, stableKey, (widgets) => {
          // Safety: only apply if same set of IDs (prevents accidental deletion)
          const currentIds = new Set(widgets.map((w) => w.draftId));
          const newIds = new Set(orderedDraftIds);
          if (currentIds.size !== newIds.size || [...currentIds].some((id) => !newIds.has(id))) {
            return widgets;
          }
          const byId = new Map(widgets.map((w) => [w.draftId, w]));
          return orderedDraftIds
            .map((id) => byId.get(id)!)
            .map((w, i) => ({ ...w, orderIndex: i }));
        }),
      );
      markDirty();
    },
    [markDirty],
  );

  const updateWidgetConfig = useCallback(
    (stableKey: string, draftId: string, config: Record<string, unknown>) => {
      setEditLayout((prev) =>
        mapPlaceholderWidgets(prev, stableKey, (widgets) =>
          widgets.map((w) =>
            w.draftId === draftId ? { ...w, configJson: JSON.stringify(config) } : w,
          ),
        ),
      );
      markDirty();
    },
    [markDirty],
  );

  const updateWidgetVisibility = useCallback(
    (stableKey: string, draftId: string, publicVisibility: PublicVisibility) => {
      setEditLayout((prev) =>
        mapPlaceholderWidgets(prev, stableKey, (widgets) =>
          widgets.map((w) => (w.draftId === draftId ? { ...w, publicVisibility } : w)),
        ),
      );
      markDirty();
    },
    [markDirty],
  );

  return {
    isEditing,
    editLayout,
    isDirty,
    isSaving: saveMutation.isPending,
    enterEdit,
    exitEdit,
    saveEdit,
    updatePlaceholderPosition,
    updateBreakpointPosition,
    copyLayoutToSmaller,
    addPlaceholder,
    removePlaceholder,
    updatePlaceholderConfig,
    restorePlaceholder,
    addWidget,
    removeWidget,
    reorderWidgets,
    updateWidgetConfig,
    updateWidgetVisibility,
  };
}
