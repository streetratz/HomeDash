/**
 * Phase R4: Placeholder widget — a grid cell with rounded border,
 * optional header bar with title + widget actions, and hosted widgets.
 *
 * FR-021: Aligns to grid, supports multiple shapes/sizes.
 * FR-023: Rounded border with configurable color.
 * FR-024: Header bar with title + action icons.
 * FR-025: Translucent so dashboard background shows through (uses stored opacity).
 * FR-026: Hosts one or more app widgets.
 */

import type { PlaceholderView } from '../state/dashboards.js';
import { WidgetRenderer } from './WidgetRenderer.js';
import { WidgetHeaderProvider, useWidgetHeaderCollector } from './WidgetHeaderContext.js';

interface PlaceholderWidgetProps {
  placeholder: PlaceholderView;
  /** When true (mobile), widget auto-expands — no fixed height or internal scroll */
  autoHeight?: boolean;
}

export function PlaceholderWidget({ placeholder, autoHeight }: PlaceholderWidgetProps) {
  const { borderColor, borderSize, showBorder, title, showTitle, titleStyle, childLayout, opacity, backgroundStyle, backgroundColor, widgets } = placeholder;
  const bgOpacity = Math.max(0, Math.min(1, opacity));
  const visibleTitle = showTitle ? title : null;
  const usePill = titleStyle === 'pill';
  const useHeader = !usePill && !!visibleTitle;
  const isSingleWidget = widgets.length === 1;
  const useAurora = backgroundStyle === 'aurora';
  const useAustralis = backgroundStyle === 'aurora-australis';

  return (
    <div
      className={`relative flex w-full flex-col overflow-visible rounded-lg ${autoHeight ? '' : 'h-full'}`}
      style={{ border: showBorder ? `${borderSize}px solid ${borderColor}` : `${borderSize}px solid transparent` }}
    >
      {/* Pill title — floating overlay badge on border */}
      {visibleTitle && usePill && (
        <div
          className="absolute -top-3 left-3 z-20 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md shadow-sm"
          style={{
            borderColor,
            backgroundColor: 'hsl(var(--card) / 0.7)',
            color: 'hsl(var(--foreground))',
          }}
        >
          {visibleTitle}
        </div>
      )}

      {/* Translucent background layer */}
      {useAurora ? (
        <div
          className="pointer-events-none absolute inset-0 rounded-[8px] ss-aurora-bg"
          aria-hidden="true"
        />
      ) : useAustralis ? (
        <div
          className="pointer-events-none absolute inset-0 rounded-[8px] ss-aurora-australis-bg"
          aria-hidden="true"
        />
      ) : (
        <div
          className={`pointer-events-none absolute inset-0 rounded-[8px] light-card-readability ${backgroundColor ? '' : 'bg-card'}`}
          style={{ opacity: bgOpacity, ...(backgroundColor ? { backgroundColor } : {}) }}
          aria-hidden="true"
        />
      )}

      {/* Content layer */}
      <div className={`relative z-10 flex flex-col overflow-hidden rounded-[8px] ${autoHeight ? '' : 'h-full'}`}>
        {widgets.length === 0 ? (
          <div className="flex h-full items-center justify-center p-2">
            <span className="text-xs text-muted-foreground/60">Empty</span>
          </div>
        ) : isSingleWidget ? (
          <SingleWidgetContent
            widget={widgets[0]!}
            useHeader={useHeader}
            visibleTitle={visibleTitle}
            autoHeight={!!autoHeight}
          />
        ) : (
          <MultiWidgetContent
            widgets={widgets}
            useHeader={useHeader}
            visibleTitle={visibleTitle}
            childLayout={childLayout}
            autoHeight={!!autoHeight}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Single widget: one header collector at placeholder level.
 * Title + widget actions merge into one fixed bar.
 */
function SingleWidgetContent({
  widget,
  useHeader,
  visibleTitle,
  autoHeight,
}: {
  widget: PlaceholderView['widgets'][0];
  useHeader: boolean;
  visibleTitle: string | null;
  autoHeight?: boolean;
}) {
  const { actions, contextValue } = useWidgetHeaderCollector();
  const showBar = useHeader || !!actions;

  return (
    <>
      {showBar && (
        <div className="widget-panel-header shrink-0 flex items-center gap-2 border-b px-2.5 py-1.5">
          {useHeader && visibleTitle ? (
            <div className="flex items-center min-w-0 flex-1">
              <span className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {visibleTitle}
              </span>
            </div>
          ) : (
            <div className="flex-1" />
          )}
          {actions && (
            <div className="flex items-center gap-0.5 shrink-0">
              {actions}
            </div>
          )}
        </div>
      )}
      <div className={autoHeight ? '' : 'flex-1 overflow-y-auto'}>
        <WidgetHeaderProvider value={contextValue}>
          <WidgetRenderer widget={widget} />
        </WidgetHeaderProvider>
      </div>
    </>
  );
}

/**
 * Multi widget: placeholder-level title bar + per-widget action bars.
 * Supports 'stacked' (vertical) and 'side-by-side' (horizontal) layouts.
 */
function MultiWidgetContent({
  widgets,
  useHeader,
  visibleTitle,
  childLayout,
  autoHeight,
}: {
  widgets: PlaceholderView['widgets'];
  useHeader: boolean;
  visibleTitle: string | null;
  childLayout: 'stacked' | 'side-by-side';
  autoHeight?: boolean;
}) {
  // On mobile auto-height, always stack vertically
  const isSideBySide = autoHeight ? false : childLayout === 'side-by-side';

  return (
    <>
      {useHeader && visibleTitle && (
        <div className="widget-panel-header shrink-0 flex items-center gap-2 border-b px-2.5 py-1.5">
          <div className="flex items-center min-w-0 flex-1">
            <span className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {visibleTitle}
            </span>
          </div>
        </div>
      )}
      <div className={`${autoHeight ? '' : 'flex-1'} ${isSideBySide ? 'flex flex-row gap-2 p-2 overflow-hidden' : `flex flex-col gap-2 p-2 ${autoHeight ? '' : 'overflow-hidden'}`}`}>
        {widgets.map((widget) => (
          <WidgetWithActions
            key={widget.id}
            widget={widget}
            isSideBySide={isSideBySide}
            showDivider={false}
          />
        ))}
      </div>
    </>
  );
}

/** Wraps a widget with its own action bar (no title, for multi-widget layouts) */
function WidgetWithActions({
  widget,
  isSideBySide,
}: {
  widget: PlaceholderView['widgets'][0];
  isSideBySide: boolean;
  showDivider: boolean;
}) {
  const { actions, contextValue } = useWidgetHeaderCollector();

  const panelClass = isSideBySide
    ? 'widget-panel flex-1 w-0 min-w-0 overflow-hidden rounded-lg border'
    : 'widget-panel flex-1 min-h-0 overflow-hidden rounded-lg border';

  return (
    <div className={`flex flex-col ${panelClass}`}>
      {actions && (
        <div className="widget-panel-header flex items-center gap-2 rounded-t-lg border-b px-2.5 py-1.5">
          <div className="flex-1" />
          <div className="flex items-center gap-0.5 shrink-0">
            {actions}
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto">
        <WidgetHeaderProvider value={contextValue}>
          <WidgetRenderer widget={widget} />
        </WidgetHeaderProvider>
      </div>
    </div>
  );
}
