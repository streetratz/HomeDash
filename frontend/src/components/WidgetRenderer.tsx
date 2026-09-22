/**
 * 002: Widget type discriminator — resolves widget type via registry.
 *
 * FR-027: System supports multiple widget types via extensible registry.
 */

import { AlertTriangle } from 'lucide-react';
import type { WidgetView } from '../state/dashboards.js';
import { widgetRegistry } from './widgets/registry.js';

interface WidgetRendererProps {
  widget: WidgetView;
}

export function WidgetRenderer({ widget }: WidgetRendererProps) {
  const definition = widgetRegistry.get(widget.type);

  if (!definition) {
    return (
      <div className="flex items-center gap-2 p-2 text-xs text-muted-foreground">
        <AlertTriangle className="h-4 w-4 text-status-warning" />
        <span>Unknown widget type: {widget.type}</span>
      </div>
    );
  }

  const { DisplayComponent } = definition;
  return <DisplayComponent widget={widget} />;
}
