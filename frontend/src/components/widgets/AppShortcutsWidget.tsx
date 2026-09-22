/**
 * 013-app-shortcuts / 030-shortcuts-single-link (US1):
 * App Shortcuts display widget with flexbox wrapping.
 * Icons maintain fixed size and reflow into rows.
 * Overflow adapts to container height: S=1-row scroll, M=2-row scroll, L=all visible.
 */

import { createElement, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { WidgetDisplayProps } from './registry.js';
import type { AppShortcutsConfig, ShortcutView } from '../../state/dashboards.js';
import { useShortcuts } from '../../state/appShortcutHooks.js';
import { LayoutGrid, icons as lucideIcons } from 'lucide-react';
import { isCdnIcon, parseCdnIcon, cdnIconUrl } from '../IconPicker.js';
import { useIsPublicView } from '../../state/publicView.js';
import { usePublicWidgetSnapshot } from '../../state/publicWidgets.js';

const DEFAULT_CONFIG: AppShortcutsConfig = { columns: 4, iconSize: 'md', showLabels: true };

const ICON_SIZE_CLASS = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-14 w-14' } as const;

/** Fixed cell widths (px) per icon size — drives flexbox wrapping. */
export const ICON_CELL_WIDTH = { sm: 52, md: 60, lg: 76 } as const;

/** Icon pixel heights (matching Tailwind h-* classes). */
const ICON_PX_HEIGHT = { sm: 32, md: 40, lg: 56 } as const;

const GAP_PX = 4;       // gap-1 (compact spacing — T009)
const PADDING_PX = 16;  // p-2 on anchor (8px × 2 top+bottom)
const LABEL_HEIGHT = 24; // ~2 lines of text-xs leading-tight
const LABEL_GAP = 4;     // gap-1 between icon and label

type OverflowMode = 'single-row' | 'two-row' | 'all';

const MOBILE_MEDIA_QUERY = '(max-width: 767px)';

function subscribeToMobileBreakpoint(onStoreChange: () => void): () => void {
  const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY);
  mediaQuery.addEventListener('change', onStoreChange);
  return () => mediaQuery.removeEventListener('change', onStoreChange);
}

function getMobileBreakpointSnapshot(): boolean {
  return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
}

/** Compute item row height based on icon size and label visibility. */
function computeRowHeight(iconSize: 'sm' | 'md' | 'lg', showLabels: boolean): number {
  const iconH = ICON_PX_HEIGHT[iconSize] ?? ICON_PX_HEIGHT.md;
  return iconH + PADDING_PX + (showLabels ? LABEL_GAP + LABEL_HEIGHT : 0);
}

/** Determine overflow mode from available container height. */
function detectOverflowMode(containerHeight: number, rowHeight: number): OverflowMode {
  if (containerHeight <= rowHeight * 1.5) return 'single-row';
  if (containerHeight <= rowHeight * 2.5 + GAP_PX) return 'two-row';
  return 'all';
}

/** Hook: measure container height with ResizeObserver, returns overflow mode. */
function useOverflowMode(
  containerRef: React.RefObject<HTMLDivElement | null>,
  rowHeight: number,
  isMobile: boolean,
): OverflowMode {
  const [mode, setMode] = useState<OverflowMode>('all');

  useEffect(() => {
    if (isMobile) return;

    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setMode(detectOverflowMode(entry.contentRect.height, rowHeight));
    });
    observer.observe(el);

    return () => observer.disconnect();
  }, [containerRef, rowHeight, isMobile]);

  return isMobile ? 'all' : mode;
}

/** Hook: track mobile breakpoint (< 768px). */
function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribeToMobileBreakpoint,
    getMobileBreakpointSnapshot,
    () => false,
  );
}

export function AppShortcutsWidget({ widget }: WidgetDisplayProps) {
  const cfg: AppShortcutsConfig = { ...DEFAULT_CONFIG, ...(widget.config as Partial<AppShortcutsConfig>) };
  const isPublicView = useIsPublicView();
  const privateQuery = useShortcuts(isPublicView ? '' : widget.id);
  const publicQuery = usePublicWidgetSnapshot<{ shortcuts: ShortcutView[] }>(
    widget.id,
    widget.type,
    isPublicView,
  );
  const data = isPublicView ? publicQuery.data?.data : privateQuery.data;
  const isLoading = isPublicView ? publicQuery.isLoading : privateQuery.isLoading;
  const containerRef = useRef<HTMLDivElement | null>(null);

  const isMobile = useIsMobile();
  const rowHeight = computeRowHeight(cfg.iconSize, cfg.showLabels);
  const overflowMode = useOverflowMode(containerRef, rowHeight, isMobile);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm animate-pulse">
        Loading…
      </div>
    );
  }

  const shortcuts = data?.shortcuts ?? [];

  if (shortcuts.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground text-sm" data-testid="app-shortcuts-empty">
        <LayoutGrid className="h-8 w-8 opacity-40" />
        <span>No shortcuts yet</span>
        {!isPublicView && <span className="text-xs">Open widget settings to add shortcuts</span>}
      </div>
    );
  }

  const maxCols = Math.min(Math.max(cfg.columns, 2), 8);
  const cellWidth = ICON_CELL_WIDTH[cfg.iconSize] ?? ICON_CELL_WIDTH.md;
  const isSingleIcon = shortcuts.length === 1;
  const SINGLE_ICON_SIZE = { sm: 'max-h-[35%]', md: 'max-h-[45%]', lg: 'max-h-[55%]' } as const;
  const iconCls = isSingleIcon
    ? `${SINGLE_ICON_SIZE[cfg.iconSize] ?? SINGLE_ICON_SIZE.md} w-auto aspect-square`
    : (ICON_SIZE_CLASS[cfg.iconSize] ?? ICON_SIZE_CLASS.md);

  // Cap inner container width so `columns` config limits icons per row
  const maxInnerWidth = maxCols * cellWidth + (maxCols - 1) * GAP_PX;

  // Outer container classes based on overflow mode
  const outerCls =
    overflowMode === 'single-row'
      ? 'flex h-full items-center justify-center overflow-x-auto overflow-y-hidden scrollbar-hide p-2'
      : 'flex h-full items-center justify-center overflow-y-auto scrollbar-hide p-2';

  // Inner flex container: wrap vs nowrap for single-row mode
  const innerCls =
    overflowMode === 'single-row'
      ? 'flex flex-nowrap gap-1 justify-center'
      : 'flex flex-wrap gap-1 justify-center';

  // For two-row mode, cap visible height to ~2 rows
  const innerStyle: React.CSSProperties =
    overflowMode === 'two-row'
      ? { maxWidth: maxInnerWidth, maxHeight: rowHeight * 2 + GAP_PX, overflowY: 'auto' }
      : overflowMode === 'single-row'
        ? {}  // no width cap — let content scroll horizontally
        : { maxWidth: maxInnerWidth };

  return (
    <div
      ref={containerRef}
      className={outerCls}
      data-testid="app-shortcuts-widget"
      data-overflow-mode={overflowMode}
    >
      <div className={`${innerCls} ${isSingleIcon ? 'h-full' : ''}`} style={innerStyle}>
        {shortcuts.map((shortcut: ShortcutView) => (
          <a
            key={shortcut.id}
            href={shortcut.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`group flex flex-col items-center justify-center gap-1 rounded-lg p-2 text-center shrink-0 transition-colors hover:bg-accent/50 active:scale-95 active:bg-accent/70 ${isSingleIcon ? 'h-full' : ''}`}
            style={{ flexBasis: isSingleIcon ? undefined : cellWidth }}
            title={shortcut.url}
          >
            {shortcut.iconKey && isCdnIcon(shortcut.iconKey) ? (
              <img
                src={cdnIconUrl(parseCdnIcon(shortcut.iconKey))}
                alt=""
                className={`${iconCls} rounded object-contain transition-transform group-hover:scale-105`}
                loading="lazy"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : shortcut.iconKey && shortcut.iconKey in lucideIcons ? (
              createElement(lucideIcons[shortcut.iconKey as keyof typeof lucideIcons], { className: `${iconCls} text-muted-foreground transition-transform group-hover:scale-105` })
            ) : shortcut.iconUrl ? (
              <img
                src={shortcut.iconUrl}
                alt=""
                className={`${iconCls} rounded object-contain transition-transform group-hover:scale-105`}
                loading="lazy"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <LayoutGrid className={`${iconCls} text-muted-foreground/50 transition-transform group-hover:scale-105`} />
            )}
            {cfg.showLabels && (
              <span className="max-w-full truncate text-xs leading-tight">{shortcut.name}</span>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}
