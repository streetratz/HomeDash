/**
 * PiholeWidget — Pi-hole DNS Controls display widget.
 *
 * Two-list layout:
 * 1. Query Stats — total queries, blocked, percent blocked, clients, blocklist
 * 2. System Stats — CPU, memory, temperature, load, uptime
 * Plus blocking status banner with admin toggle.
 */

import { useState, useRef, useEffect } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Shield,
  Loader2,
  Cpu,
  HardDrive,
  Thermometer,
  Clock,
  AlertTriangle,
  Search,
  Ban,
  Percent,
  Users,
  ListFilter,
  Gauge,
} from 'lucide-react';
import { Button } from '../ui/button.js';
import type { WidgetDisplayProps } from './registry.js';
import {
  usePiholeConfig,
  usePiholeStats,
  usePiholeSystemHealth,
  usePiholeSetBlocking,
} from '../../state/piholeHooks.js';
import { useBootstrap } from '../../state/bootstrap.js';
import { cdnIconUrl } from '../IconPicker.js';
import type { PiholeStats, PiholeSystemHealth } from '../../state/piholeHooks.js';
import { useIsPublicView } from '../../state/publicView.js';
import { usePublicWidgetSnapshot } from '../../state/publicWidgets.js';

// ─── Config shape (from configJson) ─────────────────────────────────────────

/** Valid section identifiers */
type PiholeSection = 'controls' | 'system' | 'queries';

type PiholeStatsLayout = 'auto' | 'stacked' | 'side-by-side';

interface PiholeDisplayConfig {
  /** Which sections to render. Defaults to all three for backwards compat. */
  sections?: PiholeSection[];
  /** Stats panel layout: auto (responsive), stacked, or side-by-side. */
  statsLayout?: PiholeStatsLayout;
  // Legacy fields — ignored when sections is set
  showSystemHealth?: boolean;
  showBlocklistCount?: boolean;
  displayMode?: string;
}

/** Resolve active sections, supporting legacy configs. */
function resolveSections(cfg: PiholeDisplayConfig): Set<PiholeSection> {
  if (cfg.sections && cfg.sections.length > 0) return new Set(cfg.sections);
  // Legacy migration
  const s = new Set<PiholeSection>(['queries']);
  if (cfg.displayMode === 'controls') return new Set<PiholeSection>(['controls']);
  if (cfg.displayMode === 'stats') {
    if (cfg.showSystemHealth !== false) s.add('system');
    return s;
  }
  // 'all' or undefined
  s.add('controls');
  if (cfg.showSystemHealth !== false) s.add('system');
  return s;
}

// ─── Duration options ───────────────────────────────────────────────────────

const DISABLE_DURATIONS = [
  { label: '5 min', seconds: 300 },
  { label: '15 min', seconds: 900 },
  { label: '30 min', seconds: 1800 },
  { label: 'Indefinite', seconds: 0 },
] as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatTimer(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return '';
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatLoad(load: [number, number, number]): string {
  return load.map((v) => v.toFixed(2)).join(' / ');
}

// ─── Stat row component ─────────────────────────────────────────────────────

function StatRow({
  icon: Icon,
  label,
  value,
  sub,
  iconColor,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  iconColor?: string;
}) {
  return (
    <div className="flex items-center gap-2 py-1">
      <Icon className={`h-3.5 w-3.5 shrink-0 ${iconColor ?? 'text-muted-foreground'}`} />
      <span className="flex-1 text-xs light-text-primary">{label}</span>
      <span className="text-xs font-semibold tabular-nums light-text-primary">{value}</span>
      {sub && <span className="text-[10px] light-text-secondary">{sub}</span>}
    </div>
  );
}

// ─── Compact stat row for small cells ───────────────────────────────────────

function CompactStatRow({
  icon: Icon,
  value,
  iconColor,
}: {
  icon: LucideIcon;
  value: string;
  iconColor?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 py-0.5">
      <Icon className={`h-3 w-3 shrink-0 ${iconColor ?? 'text-muted-foreground'}`} />
      <span className="truncate text-[10px] font-semibold tabular-nums light-text-primary">{value}</span>
    </div>
  );
}

// ─── Main widget ────────────────────────────────────────────────────────────

// ─── Controls-only panel ────────────────────────────────────────────────────

function ControlsPanel({
  stats,
  isAdmin,
  showDurations,
  onShowDurations,
  onDisable,
  widgetId,
}: {
  stats: { blocking: 'enabled' | 'disabled'; timer: number | null };
  isAdmin: boolean;
  showDurations: boolean;
  onShowDurations: (show: boolean) => void;
  onDisable: (seconds: number) => void;
  widgetId: string;
}) {
  const setBlocking = usePiholeSetBlocking();
  const isBlocking = stats.blocking === 'enabled';

  const handleEnable = () => {
    setBlocking.mutate({ widgetId, action: 'enable' });
    onShowDurations(false);
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      {/* Pi-hole logo */}
      <img src={cdnIconUrl('pi-hole')} alt="Pi-hole" className="h-20 w-20 rounded object-contain" />

      {/* Status + action side by side */}
      <div className="flex items-center gap-2.5">
        <span className="relative flex h-3 w-3 shrink-0">
          {isBlocking && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
          )}
          <span className={`relative inline-flex h-3 w-3 rounded-full ${isBlocking ? 'bg-emerald-400' : 'bg-red-400'}`} />
        </span>
        <span className={`text-sm font-semibold ${isBlocking ? 'text-emerald-400' : 'text-red-400'}`}>
          {isBlocking ? 'Active' : 'Disabled'}
        </span>

        {isAdmin && !showDurations && (
          <>
            {setBlocking.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin text-white/40" />
            ) : isBlocking ? (
              <Button size="sm" variant="ghost" className="h-6 px-2.5 text-xs text-red-400/70 hover:text-red-300" onClick={() => onShowDurations(true)}>Disable</Button>
            ) : (
              <Button size="sm" variant="ghost" className="h-6 px-2.5 text-xs text-emerald-400/70 hover:text-emerald-300" onClick={handleEnable}>Enable</Button>
            )}
          </>
        )}
      </div>

      {/* Timer when disabled */}
      {!isBlocking && stats.timer != null && stats.timer > 0 && (
        <span className="text-xs tabular-nums text-white/50">{formatTimer(stats.timer)}</span>
      )}

      {/* Duration picker */}
      {isAdmin && showDurations && (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {DISABLE_DURATIONS.map((d) => (
            <Button key={d.label} size="sm" variant="outline" className="h-6 px-2 border-white/20 text-[11px] text-white/80 hover:bg-white/10" onClick={() => onDisable(d.seconds)}>{d.label}</Button>
          ))}
          <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[11px] text-white/40 hover:text-white/60" onClick={() => onShowDurations(false)}>✕</Button>
        </div>
      )}
    </div>
  );
}

export function PiholeWidget({ widget }: WidgetDisplayProps) {
  const isPublicView = useIsPublicView();
  const displayConfig = (widget.config ?? {}) as PiholeDisplayConfig;
  const sections = resolveSections(displayConfig);
  const hasControls = sections.has('controls') && !isPublicView;
  const hasSystem = sections.has('system');
  const hasQueries =
    sections.has('queries') ||
    (isPublicView && sections.has('controls') && !sections.has('system'));
  const statsLayout = displayConfig.statsLayout ?? 'auto';
  const widgetId = widget.id;
  const [showDurations, setShowDurations] = useState(false);

  // Compact mode detection via container width
  const containerRef = useRef<HTMLDivElement>(null);
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        setIsCompact(entry.contentRect.width <= 200);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { data: piConfig } = usePiholeConfig(isPublicView ? '' : widgetId);
  const pollInterval = piConfig?.pollIntervalSec ?? 30;
  const privateStats = usePiholeStats(isPublicView ? '' : widgetId, pollInterval);
  const privateHealth = usePiholeSystemHealth(
    isPublicView ? '' : widgetId,
    hasSystem ? pollInterval : 0,
  );
  const publicQuery = usePublicWidgetSnapshot<{
    stats: PiholeStats;
    system: PiholeSystemHealth;
  }>(widgetId, widget.type, isPublicView);
  const stats = isPublicView ? publicQuery.data?.data.stats : privateStats.data;
  const health = isPublicView ? publicQuery.data?.data.system : privateHealth.data;
  const isLoading = isPublicView ? publicQuery.isLoading : privateStats.isLoading;
  const isError = isPublicView ? publicQuery.isError : privateStats.isError;
  const { user } = useBootstrap();
  const isAdmin = !isPublicView && user?.role === 'admin';
  const setBlocking = usePiholeSetBlocking();

  const isStale = isError && !!stats;

  const handleDisable = (seconds: number) => {
    const payload: { widgetId: string; action: 'enable' | 'disable'; duration?: number } = {
      widgetId,
      action: 'disable',
    };
    if (seconds) payload.duration = seconds;
    setBlocking.mutate(payload);
    setShowDurations(false);
  };

  // Not configured
  if (!isPublicView && !piConfig) {
    return (
      <div ref={containerRef} className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
        <Shield className="h-8 w-8 opacity-40" />
        <span className="text-sm">Configure Pi-hole in widget settings</span>
      </div>
    );
  }

  // Loading
  if (isLoading && !stats) {
    return (
      <div ref={containerRef} className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error
  if (isError && !stats) {
    return (
      <div ref={containerRef} className="flex flex-col items-center justify-center gap-2 py-6 text-muted-foreground">
        <AlertTriangle className="h-6 w-6 text-yellow-500" />
        <span className="text-xs">Failed to reach Pi-hole</span>
      </div>
    );
  }

  if (!stats) return <div ref={containerRef} />;

  const layoutClass =
    statsLayout === 'stacked' ? 'flex-col' :
    statsLayout === 'side-by-side' ? 'flex-row' :
    'flex-col sm:flex-row';

  // ── Compact layout for small cells (≤200px) ────────────────────────────────
  if (isCompact) {
    const isBlocking = stats.blocking === 'enabled';
    return (
      <div ref={containerRef} className="flex h-full flex-col gap-1 p-1.5 overflow-hidden">
        {/* Compact controls: logo + status inline */}
        {hasControls && (
          <div className="flex items-center gap-1.5">
            <img src={cdnIconUrl('pi-hole')} alt="Pi-hole" className="h-14 w-14 rounded object-contain shrink-0" />
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={`inline-flex h-2.5 w-2.5 rounded-full ${isBlocking ? 'bg-emerald-400' : 'bg-red-400'}`} />
                <span className={`text-[10px] font-semibold ${isBlocking ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isBlocking ? 'Active' : 'Off'}
                </span>
              </div>
              {isAdmin && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-5 px-1.5 text-[10px] w-fit mt-0.5"
                  onClick={() => {
                    if (isBlocking) {
                      setShowDurations(true);
                    } else {
                      setBlocking.mutate({ widgetId, action: 'enable' });
                    }
                  }}
                >
                  {isBlocking ? 'Disable' : 'Enable'}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Compact query stats */}
        {hasQueries && (
          <div className="flex flex-col min-w-0">
            <CompactStatRow icon={Ban} value={`${formatNumber(stats.blockedQueries)} (${stats.percentBlocked.toFixed(0)}%)`} iconColor="text-red-400" />
            <CompactStatRow icon={Search} value={formatNumber(stats.totalQueries)} iconColor="text-blue-400" />
            <CompactStatRow icon={Users} value={stats.uniqueClients.toString()} iconColor="text-cyan-400" />
          </div>
        )}

        {/* Compact system stats */}
        {hasSystem && health && (
          <div className="flex flex-col min-w-0">
            {health.cpu !== null && (
              <CompactStatRow icon={Cpu} value={`${health.cpu.toFixed(0)}%`} iconColor="text-amber-400" />
            )}
            {health.memory !== null && (
              <CompactStatRow icon={HardDrive} value={`${health.memory.toFixed(0)}%`} iconColor="text-teal-400" />
            )}
            {health.temp !== null && (
              <CompactStatRow icon={Thermometer} value={`${health.temp.toFixed(0)}°C`} iconColor="text-rose-400" />
            )}
          </div>
        )}

        {/* Compact duration picker */}
        {showDurations && (
          <div className="flex flex-wrap gap-1">
            {DISABLE_DURATIONS.map((d) => (
              <Button key={d.label} size="sm" variant="outline" className="h-5 px-1.5 text-[9px] border-white/20" onClick={() => handleDisable(d.seconds)}>{d.label}</Button>
            ))}
            <Button size="sm" variant="ghost" className="h-5 px-1 text-[9px] text-white/40" onClick={() => setShowDurations(false)}>✕</Button>
          </div>
        )}
      </div>
    );
  }

  // ── Standard layout ─────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} className="flex h-full flex-col gap-2 p-2">
      {/* Staleness indicator */}
      {isStale && (
        <div className="flex items-center gap-1.5 rounded-md bg-yellow-500/20 px-3 py-1.5 text-[11px] text-yellow-300">
          <AlertTriangle className="h-3.5 w-3.5" />
          Data may be stale — Pi-hole not responding
        </div>
      )}

      {/* ── All section panels ───────────────────────────────────── */}
      <div className={`flex flex-1 gap-2 ${layoutClass}`}>
        {/* Controls panel */}
        {hasControls && (
          <div className="widget-panel flex flex-1 flex-col items-center justify-center rounded-lg border px-3.5 py-2.5">
            <ControlsPanel
              stats={stats}
              isAdmin={isAdmin}
              showDurations={showDurations}
              onShowDurations={setShowDurations}
              onDisable={handleDisable}
              widgetId={widgetId}
            />
          </div>
        )}

        {/* System panel */}
        {hasSystem && health && (
          <div className="widget-panel flex-1 rounded-lg border px-3.5 py-2.5">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider light-text-secondary">
              System
            </p>
            {health.cpu !== null && (
              <StatRow icon={Cpu} label="CPU" value={`${health.cpu.toFixed(1)}%`} iconColor="text-amber-400" />
            )}
            {health.memory !== null && (
              <StatRow icon={HardDrive} label="Memory" value={`${health.memory.toFixed(1)}%`} iconColor="text-teal-400" />
            )}
            {health.temp !== null && (
              <StatRow icon={Thermometer} label="Temp" value={`${health.temp.toFixed(1)}°C`} iconColor="text-rose-400" />
            )}
            {health.load !== null && (
              <StatRow icon={Gauge} label="Load" value={formatLoad(health.load)} iconColor="text-indigo-400" />
            )}
            {health.uptime !== null && (
              <StatRow icon={Clock} label="Uptime" value={formatUptime(health.uptime)} iconColor="text-emerald-400" />
            )}
          </div>
        )}

        {/* Query Stats panel */}
        {hasQueries && (
          <div className="widget-panel flex-1 rounded-lg border px-3.5 py-2.5">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider light-text-secondary">
              Query Stats
            </p>
            <StatRow icon={Search} label="Total Queries" value={formatNumber(stats.totalQueries)} iconColor="text-blue-400" />
            <StatRow icon={Ban} label="Blocked" value={formatNumber(stats.blockedQueries)} iconColor="text-red-400" />
            <StatRow icon={Percent} label="Blocked %" value={`${stats.percentBlocked.toFixed(1)}%`} iconColor="text-orange-400" />
            <StatRow icon={Users} label="Clients" value={stats.uniqueClients.toString()} iconColor="text-cyan-400" />
            {displayConfig.showBlocklistCount !== false && (
              <StatRow icon={ListFilter} label="Blocklist" value={formatNumber(stats.domainsOnBlocklist)} iconColor="text-purple-400" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
