/**
 * T034 (US7): SystemStatusWidget — displays service health check results
 * with colored status indicators and response times.
 */

import type { WidgetDisplayProps } from './registry.js';
import type { SystemStatusConfig, StatusCheckResult } from '../../state/dashboards.js';
import { useStatusCheck } from '../../hooks/useStatusCheck.js';

const STATUS_COLORS: Record<string, string> = {
  up: 'bg-green-500',
  down: 'bg-red-500',
  unknown: 'bg-gray-400',
};

function StatusDot({ status }: { status: string }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${STATUS_COLORS[status] ?? STATUS_COLORS['unknown']}`}
      aria-label={status}
    />
  );
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

export function SystemStatusWidget({ widget }: WidgetDisplayProps) {
  const config = (widget.config ?? {}) as Partial<SystemStatusConfig>;
  const services = config.services ?? [];
  const pollInterval = config.pollIntervalSeconds ?? 60;

  const { data, isLoading } = useStatusCheck(services, pollInterval);

  if (services.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm" data-testid="status-widget-empty">
        No services configured
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm animate-pulse" data-testid="status-widget-loading">
        Checking…
      </div>
    );
  }

  const results: StatusCheckResult[] = data.results;

  return (
    <div className="h-full overflow-y-auto p-2 space-y-1" data-testid="status-widget">
      {results.map((r) => (
        <div key={r.name} className="flex items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-2 min-w-0">
            <StatusDot status={r.status} />
            <span className="truncate font-medium">{r.name}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground text-xs shrink-0">
            {r.responseTimeMs != null && (
              <span>{r.responseTimeMs}ms</span>
            )}
            <span>{formatRelativeTime(r.checkedAt)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
