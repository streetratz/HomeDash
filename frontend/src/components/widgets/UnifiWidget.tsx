/**
 * UniFi Network Controller Widget — displays network stats from UniFi OS.
 * Two primary sections: Device (gateway info) and WAN (ISP, IPs, usage, throughput).
 */

import type { WidgetDisplayProps } from './registry.js';
import { useUnifiStats, useUnifiConfig } from '../../state/unifiHooks.js';
import type { UnifiWan, UnifiGateway } from '../../state/unifiHooks.js';
import { Wifi, Router, Globe, ArrowDown, ArrowUp, ExternalLink, Cable, Shield, Network } from 'lucide-react';
import type { UnifiStats } from '../../state/unifiHooks.js';
import { useIsPublicView } from '../../state/publicView.js';
import { usePublicWidgetSnapshot } from '../../state/publicWidgets.js';

// ─── Display config interface ──────────────────────────────────────────────

interface UnifiDisplayConfig {
  showDevice?: boolean;
  showWan?: boolean;
  showNetwork?: boolean;
  showClients?: boolean;
  showDevices?: boolean;
  showWifi?: boolean;
  showIps?: boolean;
  showHealth?: boolean;
  layout?: 'stacked' | 'grid';
  sectionOrder?: string[];
  ispDomain?: string;
}

// ─── Formatters ────────────────────────────────────────────────────────────

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatRate(bytesPerSec: number): string {
  if (bytesPerSec === 0) return '0 B/s';
  const k = 1024;
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.floor(Math.log(bytesPerSec) / Math.log(k));
  return `${(bytesPerSec / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

// ─── Device Section (Gateway) ──────────────────────────────────────────────

function DeviceSection({ gateway, consoleUrl }: { gateway: UnifiGateway; consoleUrl?: string | undefined }) {
  return (
    <div className="rounded-lg border border-border/50 bg-muted/30 light-panel-card p-3">
      {/* Header: device name + console link */}
      <div className="flex items-center gap-2 mb-2">
        <Router className="h-4 w-4 text-blue-400" />
        <span className="font-semibold text-sm">{gateway.name}</span>
        {consoleUrl && (
          <a
            href={consoleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {/* Client counts */}
      <div className="flex items-center gap-4 mb-2 text-[11px]">
        <span className="flex items-center gap-1 text-muted-foreground">
          <Wifi className="h-3 w-3" /> {gateway.wirelessClients} wireless
        </span>
        <span className="flex items-center gap-1 text-muted-foreground">
          <Cable className="h-3 w-3" /> {gateway.wiredClients} wired
        </span>
        <span className="text-muted-foreground ml-auto">{gateway.totalClients} total</span>
      </div>

      {/* Device details grid */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px]">
        <div className="flex gap-1.5">
          <span className="text-muted-foreground whitespace-nowrap">Gateway</span>
          <span className="font-mono ml-auto text-right">{gateway.lanIp || '—'}</span>
        </div>
        <div className="flex gap-1.5">
          <span className="text-muted-foreground">Uptime</span>
          <span className="ml-auto text-right">{formatUptime(gateway.uptime)}</span>
        </div>
        <div className="flex gap-1.5">
          <span className="text-muted-foreground">Network</span>
          <span className="ml-auto text-right">v{gateway.version}</span>
        </div>
        {gateway.osVersion && (
          <div className="flex gap-1.5">
            <span className="text-muted-foreground">UniFi OS</span>
            <span className="ml-auto text-right">v{gateway.osVersion}</span>
          </div>
        )}
      </div>

      {/* CPU / Mem / IDPS — compact footer */}
      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-2 pt-2 border-t border-border/30 text-[10px] text-muted-foreground">
        {gateway.cpu != null && <span>CPU {Math.round(gateway.cpu)}%</span>}
        {gateway.mem != null && <span>MEM {Math.round(gateway.mem)}%</span>}
        {gateway.temp != null && <span>{Math.round(gateway.temp)}°C</span>}
        {gateway.idps && (
          <span className="flex items-center gap-1">
            <Shield className="h-3 w-3 text-amber-400" />
            IDPS: {gateway.idps.blocked} blocked
          </span>
        )}
      </div>

    </div>
  );
}

// ─── Network Section (WiFi + VPN) ──────────────────────────────────────────

function NetworkSection({ gateway }: { gateway: UnifiGateway }) {
  if (gateway.wifiNetworks.length === 0 && gateway.vpnSubnets.length === 0) return null;
  return (
    <div className="rounded-lg border border-border/50 bg-muted/30 light-panel-card p-3">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <Network className="h-4 w-4 text-purple-400" />
        <span className="font-semibold text-sm">Networks</span>
        <span className="ml-auto text-muted-foreground text-[10px]">
          {gateway.wifiNetworks.length + gateway.vpnSubnets.length} configured
        </span>
      </div>
      <div className="flex flex-col gap-0.5 text-[11px]">
        {gateway.wifiNetworks.map((w) => (
          <div key={w.name} className="flex items-center gap-1.5">
            <Wifi className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="truncate">{w.name}</span>
            <span className="text-muted-foreground text-[10px]">({w.bands})</span>
            <span className="text-muted-foreground">· {w.clients}</span>
            <span className="ml-auto text-muted-foreground font-mono text-[10px]">{w.subnet || ''}</span>
          </div>
        ))}
        {gateway.vpnSubnets.map((v) => (
          <div key={v.name} className="flex items-center gap-1.5">
            <Shield className="h-3 w-3 text-green-400 shrink-0" />
            <span>{v.type}</span>
            <span className="ml-auto text-muted-foreground font-mono text-[10px]">{v.subnet || ''}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── WAN Section ───────────────────────────────────────────────────────────

function WanSection({ wan, ispDomainOverride }: { wan: UnifiWan; ispDomainOverride?: string | undefined }) {
  const domain = ispDomainOverride || wan.ispDomain;
  const faviconUrl = domain
    ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
    : null;

  return (
    <div className="rounded-lg border border-border/50 bg-muted/30 light-panel-card p-3">
      {/* ISP header with logo */}
      <div className="flex items-center gap-2 mb-2">
        {faviconUrl ? (
          <img src={faviconUrl} alt="" className="h-4 w-4 rounded-sm" />
        ) : (
          <Globe className="h-4 w-4 text-green-400" />
        )}
        <span className="font-semibold text-sm">{wan.isp || 'WAN'}</span>
        <span className="ml-auto flex items-center gap-1 text-green-400 text-[10px]">
          <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
          Connected
        </span>
      </div>

      {/* IPs */}
      <div className="flex flex-col gap-0.5 mb-2 text-[11px]">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground w-8 shrink-0">IPv4</span>
          <span className="font-mono font-semibold">{wan.ip || '—'}</span>
        </div>
        {wan.ipv6.map((addr, i) => (
          <div key={i} className="flex items-center gap-2 overflow-hidden">
            <span className="text-muted-foreground w-8 shrink-0">{i === 0 ? 'IPv6' : ''}</span>
            <span className="font-mono text-[10px] truncate">{addr}</span>
          </div>
        ))}
      </div>

      {/* Monthly Data Usage — only show if data available */}
      {(wan.monthlyRx > 0 || wan.monthlyTx > 0) && (
        <div className="mb-2 p-2 rounded bg-muted/50 border border-border/30">
          <div className="text-[10px] text-muted-foreground mb-1">Monthly Usage</div>
          <div className="flex gap-4 text-[11px]">
            <span className="flex items-center gap-1">
              <ArrowDown className="h-3 w-3 text-blue-400" />
              {formatBytes(wan.monthlyRx)}
            </span>
            <span className="flex items-center gap-1">
              <ArrowUp className="h-3 w-3 text-orange-400" />
              {formatBytes(wan.monthlyTx)}
            </span>
            <span className="ml-auto text-muted-foreground">
              {formatBytes(wan.monthlyRx + wan.monthlyTx)} total
            </span>
          </div>
        </div>
      )}

      {/* Throughput */}
      <div className="flex gap-4 text-[11px]">
        <span className="flex items-center gap-1">
          <ArrowDown className="h-3 w-3 text-blue-400" />
          {formatRate(wan.rxRate)}
        </span>
        <span className="flex items-center gap-1">
          <ArrowUp className="h-3 w-3 text-orange-400" />
          {formatRate(wan.txRate)}
        </span>
        <span className="ml-auto text-muted-foreground text-[10px]">
          Up {formatUptime(wan.uptime)}
        </span>
      </div>
    </div>
  );
}

// ─── Main Widget ───────────────────────────────────────────────────────────

export function UnifiWidget({ widget }: WidgetDisplayProps) {
  const isPublicView = useIsPublicView();
  const { data: config } = useUnifiConfig(isPublicView ? undefined : widget.id);
  const privateQuery = useUnifiStats(
    !isPublicView && config?.configured ? widget.id : undefined,
    config?.pollIntervalSec,
  );
  const publicQuery = usePublicWidgetSnapshot<UnifiStats>(
    widget.id,
    widget.type,
    isPublicView,
  );
  const stats = isPublicView ? publicQuery.data?.data : privateQuery.data;
  const isLoading = isPublicView ? publicQuery.isLoading : privateQuery.isLoading;
  const error = isPublicView ? publicQuery.error : privateQuery.error;

  const displayConfig = (widget.config ?? {}) as UnifiDisplayConfig;
  const showDevice = displayConfig.showDevice !== false;
  const showWan = displayConfig.showWan !== false;
  const showNetwork = displayConfig.showNetwork !== false;
  const layout = displayConfig.layout ?? 'stacked';
  const sectionOrder = displayConfig.sectionOrder ?? ['device', 'wan', 'network'];

  if (!isPublicView && !config?.configured) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
        <div className="text-center">
          <Router className="mx-auto mb-2 h-8 w-8 opacity-40" />
          <p>UniFi not configured</p>
          <p className="text-xs mt-1">Open widget settings to connect</p>
        </div>
      </div>
    );
  }

  if (isLoading && !stats) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="animate-pulse text-sm text-muted-foreground">Loading network data...</div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-destructive">
        <p>Failed to connect to UniFi controller</p>
      </div>
    );
  }

  if (!stats) return null;

  const consoleUrl = isPublicView ? undefined : config?.baseUrl;
  const isGrid = layout === 'grid';

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto scrollbar-hide p-3 text-xs">
      <div className={`flex-1 ${isGrid ? 'grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2 place-content-center' : 'flex flex-col justify-center gap-2'}`}>
        {sectionOrder.map((section) => {
          if (section === 'device' && showDevice && stats.gateway) {
            return <DeviceSection key="device" gateway={stats.gateway} consoleUrl={consoleUrl} />;
          }
          if (section === 'wan' && showWan && stats.wan) {
            return <WanSection key="wan" wan={stats.wan} ispDomainOverride={displayConfig.ispDomain} />;
          }
          if (section === 'network' && showNetwork && stats.gateway) {
            return <NetworkSection key="network" gateway={stats.gateway} />;
          }
          return null;
        })}
      </div>
    </div>
  );
}
