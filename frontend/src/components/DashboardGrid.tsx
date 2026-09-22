/**
 * Phase R4/R5: Dashboard grid — renders placeholders on a responsive grid.
 *
 * FR-016: Editable grid with placeholder widgets.
 * FR-016a: Responsive breakpoints — single-column mobile, 2-col tablet, 4+ desktop.
 * FR-017: Solid-color or image background with fill/stretch modes.
 * FR-018/019: Edit mode with drag/drop/resize (admin only).
 * FR-019b: Touch drag handles via draggableHandle config.
 */

import { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { Responsive } from 'react-grid-layout';
import type { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { Eye, GripVertical, Settings, Trash2 } from 'lucide-react';
import type { DashboardView, PlaceholderView } from '../state/dashboards.js';
import type { PlaceholderDraft } from '../state/useEditMode.js';
import { PlaceholderWidget } from './PlaceholderWidget.js';
import { WidgetRenderer } from './WidgetRenderer.js';
import { widgetRegistry } from './widgets/registry.js';
import { Button } from './ui/button.js';

/** Look up per-widget-type min sizes from the registry. */
function getWidgetMinSize(ph: PlaceholderView | PlaceholderDraft): { minW: number; minH: number } {
  const wType = 'widgets' in ph && (ph as PlaceholderView).widgets?.[0]?.type;
  const def = wType ? widgetRegistry.get(wType) : undefined;
  return { minW: def?.minW ?? 1, minH: def?.minH ?? 1 };
}

const BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
const COLS: Record<string, number> = { lg: 12, md: 8, sm: 4, xs: 2, xxs: 1 };
const DESKTOP_CELL_SIZE = 180;
const DESKTOP_GRID_WIDTH = 12 * DESKTOP_CELL_SIZE + 13 * 12; // 2316px
const MARGIN: [number, number] = [12, 12];

/**
 * Compute a fallback layout for a smaller breakpoint from the lg (canonical) layout.
 * Strategy: scale width proportionally, clamp to available columns, stack vertically.
 */
function computeFallbackLayouts(lgLayout: Layout[], breakpoint: string): Layout[] {
  const cols = COLS[breakpoint] ?? 1;
  const lgCols = COLS['lg'] ?? 12;

  // Sort by original position (top-to-bottom, left-to-right) for stable stacking
  const sorted = [...lgLayout].sort((a, b) => a.y - b.y || a.x - b.x);

  if (cols <= 2) {
    // For xs/xxs: full-width stacked layout
    let nextY = 0;
    return sorted.map((item) => {
      const result = { ...item, x: 0, y: nextY, w: cols, h: item.h };
      nextY += item.h;
      return result;
    });
  }

  // For md/sm: scale width proportionally, reflow using simple packing
  const scaledItems = sorted.map((item) => {
    const scaledW = Math.max(2, Math.min(cols, Math.round((item.w / lgCols) * cols)));
    return { ...item, w: scaledW };
  });

  // Simple top-down packing: place each item at first available y position
  const colHeights = new Array(cols).fill(0);
  return scaledItems.map((item) => {
    const w = Math.min(item.w, cols);
    // Find the lowest y where this item fits
    let bestX = 0;
    let bestY = Infinity;
    for (let x = 0; x <= cols - w; x++) {
      const maxH = Math.max(...(colHeights.slice(x, x + w) as number[]));
      if (maxH < bestY) {
        bestY = maxH;
        bestX = x;
      }
    }
    const placed = { ...item, x: bestX, y: bestY, w };
    // Update column heights
    for (let c = bestX; c < bestX + w; c++) {
      colHeights[c] = bestY + placed.h;
    }
    return placed;
  });
}

/** Edit-mode 1×1 grid overlay so users can see cell boundaries. */
function GridOverlay({ cols, rowHeight, margin }: { cols: number; rowHeight: number; margin: [number, number] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState(8);

  useEffect(() => {
    const el = ref.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height ?? 0;
      setRows(Math.ceil(h / (rowHeight + margin[1])) || 8);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [rowHeight, margin]);

  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push(<div key={`${r}-${c}`} className="rounded border border-white/10" />);
    }
  }

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute inset-0 z-0"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridAutoRows: rowHeight,
        gap: margin[0],
        padding: margin[0],
      }}
    >
      {cells}
    </div>
  );
}

interface DashboardGridProps {
  dashboard: DashboardView;
  /** Edit mode state */
  isEditing?: boolean;
  editLayout?: PlaceholderDraft[] | undefined;
  onPositionChange?: (stableKey: string, x: number, y: number, w: number, h: number) => void;
  onBreakpointPositionChange?: (stableKey: string, breakpoint: string, x: number, y: number, w: number, h: number) => void;
  onActiveBreakpointChange?: (breakpoint: string) => void;
  onPlaceholderEdit?: (stableKey: string) => void;
  onPlaceholderDelete?: (stableKey: string) => void;
}

export function DashboardGrid({
  dashboard,
  isEditing = false,
  editLayout,
  onPositionChange,
  onBreakpointPositionChange,
  onActiveBreakpointChange,
  onPlaceholderEdit,
  onPlaceholderDelete,
}: DashboardGridProps) {
  const { backgroundType, backgroundColor, backgroundUrl, backgroundDisplayMode } = dashboard;

  // Use editLayout when editing, otherwise server placeholders
  const activePlaceholders = isEditing && editLayout ? editLayout : dashboard.placeholders;

  // Build per-breakpoint RGL layouts with responsive fallbacks
  const lgLayout: Layout[] = useMemo(
    () =>
      activePlaceholders.map((ph) => {
        const { minW, minH } = getWidgetMinSize(ph);
        return {
          i: ph.stableKey,
          x: ph.x,
          y: ph.y,
          w: ph.w,
          h: ph.h,
          minW,
          minH,
        };
      }),
    [activePlaceholders],
  );

  const layouts = useMemo(() => {
    const buildBreakpoint = (bp: string): Layout[] => {
      // Use persisted layouts if ALL placeholders have one for this breakpoint
      const allHavePersisted = activePlaceholders.every(
        (ph) => 'layouts' in ph && ph.layouts?.[bp],
      );
      if (allHavePersisted) {
        return activePlaceholders.map((ph) => {
          const bpLayout = ph.layouts![bp]!;
          const { minW, minH } = getWidgetMinSize(ph);
          return {
            i: ph.stableKey,
            x: bpLayout.x,
            y: bpLayout.y,
            w: bpLayout.w,
            h: bpLayout.h,
            minW,
            minH,
          };
        });
      }
      // Otherwise compute fallback from lg
      return computeFallbackLayouts(lgLayout, bp);
    };

    return {
      lg: lgLayout,
      md: buildBreakpoint('md'),
      sm: buildBreakpoint('sm'),
      xs: buildBreakpoint('xs'),
      xxs: buildBreakpoint('xxs'),
    };
  }, [lgLayout, activePlaceholders]);

  // Fixed cell size — 180×180px on desktop, never resizes
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const rowHeight = DESKTOP_CELL_SIZE;

  // Compute content width based on rightmost widget edge
  const contentWidth = useMemo(() => {
    const rightEdge = lgLayout.reduce((max, item) => Math.max(max, item.x + item.w), 0);
    const cols = Math.max(rightEdge, 1);
    // width = cols * cellSize + (cols + 1) * margin
    return cols * DESKTOP_CELL_SIZE + (cols + 1) * MARGIN[0];
  }, [lgLayout]);

  // Track active breakpoint for compaction strategy
  const [activeBreakpoint, setActiveBreakpoint] = useState('lg');
  const handleBreakpointChange = useCallback((bp: string) => {
    setActiveBreakpoint(bp);
    onActiveBreakpointChange?.(bp);
  }, [onActiveBreakpointChange]);

  // Sync positions on drag/resize stop (not every tick)
  const handleDragStop = useCallback(
    (_layout: Layout[], _oldItem: Layout, newItem: Layout) => {
      if (activeBreakpoint === 'lg') {
        onPositionChange?.(newItem.i, newItem.x, newItem.y, newItem.w, newItem.h);
      } else {
        onBreakpointPositionChange?.(newItem.i, activeBreakpoint, newItem.x, newItem.y, newItem.w, newItem.h);
      }
    },
    [onPositionChange, onBreakpointPositionChange, activeBreakpoint],
  );

  const handleResizeStop = useCallback(
    (_layout: Layout[], _oldItem: Layout, newItem: Layout) => {
      if (activeBreakpoint === 'lg') {
        onPositionChange?.(newItem.i, newItem.x, newItem.y, newItem.w, newItem.h);
      } else {
        onBreakpointPositionChange?.(newItem.i, activeBreakpoint, newItem.x, newItem.y, newItem.w, newItem.h);
      }
    },
    [onPositionChange, onBreakpointPositionChange, activeBreakpoint],
  );

  // Background styles
  const backgroundStyle = useMemo(() => {
    if (backgroundType === 'image' && backgroundUrl) {
      return {
        backgroundImage: `url(${backgroundUrl})`,
        backgroundSize: backgroundDisplayMode === 'stretch' ? '100% 100%' : 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat' as const,
        backgroundAttachment: 'fixed' as const,
      };
    }
    if (backgroundType === 'solid' && backgroundColor) {
      return { backgroundColor };
    }
    return {};
  }, [backgroundType, backgroundColor, backgroundUrl, backgroundDisplayMode]);

  // Mobile detection — use stacked layout without fixed heights
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= BREAKPOINTS.xs);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${BREAKPOINTS.xs}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Mobile stacked layout — widgets auto-expand, no internal scroll
  if (isMobile && !isEditing) {
    const sorted = [...dashboard.placeholders].sort((a, b) => a.y - b.y || a.x - b.x);
    const mobileBackgroundStyle = {
      ...backgroundStyle,
      backgroundAttachment: 'scroll' as const,
    };
    return (
      <div
        className="relative flex min-h-full flex-col gap-3 overflow-x-clip p-3"
        style={mobileBackgroundStyle}
        data-testid="dashboard-grid"
      >
        {sorted.map((ph) => (
          <div key={ph.stableKey} className="min-w-0" data-testid={`placeholder-${ph.stableKey}`}>
            <PlaceholderWidget placeholder={ph} autoHeight />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="w-full min-h-full overflow-x-auto" style={backgroundStyle}>
    <div
      ref={gridContainerRef}
      className={`relative min-h-full ${isEditing ? 'ring-2 ring-dashed ring-status-info/50' : ''}`}
      style={{ width: `${contentWidth}px` }}
      data-testid="dashboard-grid"
    >
      {isEditing && (
        <GridOverlay
          cols={COLS[activeBreakpoint] ?? 12}
          rowHeight={rowHeight}
          margin={MARGIN}
        />
      )}
      <Responsive
        width={DESKTOP_GRID_WIDTH}
        layouts={layouts}
        breakpoints={BREAKPOINTS}
        cols={COLS}
        rowHeight={rowHeight}
        margin={MARGIN}
        isDraggable={isEditing}
        isResizable={isEditing}
        compactType={activeBreakpoint === 'lg' ? null : 'vertical'}
        preventCollision={activeBreakpoint === 'lg'}
        useCSSTransforms
        draggableHandle=".drag-handle"
        draggableCancel=".no-drag"
        onBreakpointChange={handleBreakpointChange}
        onDragStop={isEditing ? handleDragStop : undefined}
        onResizeStop={isEditing ? handleResizeStop : undefined}
      >
        {isEditing && editLayout
          ? editLayout.map((ph) => (
              <div key={ph.stableKey} data-testid={`placeholder-${ph.stableKey}`}>
                <EditablePlaceholder
                  draft={ph}
                  onEdit={() => onPlaceholderEdit?.(ph.stableKey)}
                  onDelete={() => onPlaceholderDelete?.(ph.stableKey)}
                />
              </div>
            ))
          : dashboard.placeholders.map((ph) => (
              <div key={ph.stableKey} data-testid={`placeholder-${ph.stableKey}`}>
                <PlaceholderWidget placeholder={ph} />
              </div>
            ))}
      </Responsive>
    </div>
    </div>
  );
}

// ── Editable placeholder wrapper ──────────────────────────────────────────────

interface EditablePlaceholderProps {
  draft: PlaceholderDraft;
  onEdit: () => void;
  onDelete: () => void;
}

function EditablePlaceholder({ draft, onEdit, onDelete }: EditablePlaceholderProps) {
  const { borderColor, borderSize, showBorder, title, opacity, widgets } = draft;
  const bgOpacity = Math.max(0, Math.min(1, opacity));
  const exposedCount = widgets.filter((widget) => widget.publicVisibility !== 'hidden').length;

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden rounded-lg"
      style={{ border: showBorder ? `${borderSize}px solid ${borderColor}` : `${borderSize}px solid transparent` }}
    >
      {/* Translucent background */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[8px] bg-card"
        style={{ opacity: bgOpacity }}
        aria-hidden="true"
      />

      {/* Content */}
      <div className="relative z-10 flex h-full flex-col">
        {/* Drag handle bar + edit controls */}
        <div className="drag-handle flex cursor-grab items-center justify-between bg-muted/60 px-1.5 py-1 active:cursor-grabbing">
          <div className="flex items-center gap-1.5 min-w-0">
            <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" aria-label="Drag to reorder" />
            {title && (
              <span className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {title}
              </span>
            )}
          </div>
          <div className="no-drag flex items-center gap-0.5">
            {exposedCount > 0 && (
              <span
                className="mr-1 inline-flex min-h-8 items-center gap-1 rounded-md bg-status-warning/15 px-2 text-xs font-medium text-status-warning"
                aria-label={`${exposedCount} publicly exposed ${exposedCount === 1 ? 'widget' : 'widgets'}`}
              >
                <Eye className="h-3.5 w-3.5" />
                {exposedCount}
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onEdit}
              aria-label="Configure placeholder"
            >
              <Settings className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={onDelete}
              aria-label="Delete placeholder"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Widget preview (read-only in edit mode) */}
        <div className="flex-1 overflow-hidden opacity-60 pointer-events-none">
          {widgets.length > 0 ? (
            <div className="overflow-y-auto h-full">
              {widgets.map((wd) => {
                const config = (() => { try { return JSON.parse(wd.configJson) as Record<string, unknown>; } catch { return {}; } })();
                return (
                  <WidgetRenderer
                    key={wd.draftId}
                    widget={{
                      id: wd.persistedId ?? wd.draftId,
                      type: wd.type,
                      orderIndex: wd.orderIndex,
                      config,
                      links: wd.links ?? [],
                      publicVisibility: wd.publicVisibility,
                    }}
                  />
                );
              })}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <span className="text-xs text-muted-foreground/60">Empty</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
