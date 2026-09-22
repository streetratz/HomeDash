/**
 * DockerWidget — displays Docker container status with color-coded indicators.
 *
 * Features:
 * - Container name, image, status, uptime, ports
 * - Color-coded state indicators (green=running, yellow=paused, red=stopped)
 * - Admin controls: start/stop/restart (when allowControls is true)
 * - Auto-refresh via polling
 */

import { Play, RotateCcw, Server, Square } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button.js';
import type { WidgetDisplayProps } from './registry.js';
import type { DockerConfig } from '../../state/dashboards.js';
import { WidgetSkeleton } from './WidgetSkeleton.js';
import {
  useDockerContainers,
  useDockerAction,
  useDockerHosts,
  classifyDockerError,
  type DockerContainer,
  type DockerErrorKind,
  type DockerHost,
} from '../../hooks/useDocker.js';
import { useBootstrap } from '../../state/bootstrap.js';

const STATE_COLORS: Record<string, string> = {
  running: 'bg-emerald-500',
  paused: 'bg-yellow-500',
  restarting: 'bg-yellow-500',
  created: 'bg-blue-500',
  exited: 'bg-red-500/70',
  dead: 'bg-red-500/70',
  removing: 'bg-orange-500',
};

function formatUptime(created: number): string {
  const seconds = Math.floor(Date.now() / 1000 - created);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

function formatPorts(container: DockerContainer): string {
  return container.ports
    .filter((p) => p.publicPort)
    .map((p) => `${p.publicPort}→${p.privatePort}`)
    .slice(0, 3)
    .join(', ');
}

function ContainerRow({
  container,
  showControls,
  widgetInstanceId,
  connectionId,
  hostName,
}: {
  container: DockerContainer;
  showControls: boolean;
  widgetInstanceId: string;
  connectionId: string;
  hostName: string;
}) {
  const action = useDockerAction(widgetInstanceId, connectionId);
  const isRunning = container.state === 'running';
  const isBusy = action.isPending;

  function handleAction(act: 'start' | 'stop' | 'restart') {
    action.mutate(
      { containerId: container.id, action: act },
      {
        onSuccess: () => toast.success(`${act} sent to ${container.name} on ${hostName}`),
        onError: (err) => toast.error(`Failed: ${err instanceof Error ? err.message : 'Unknown'}`),
      },
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-accent/30">
      {/* Status dot */}
      <div
        className={`h-2 w-2 shrink-0 rounded-full ${STATE_COLORS[container.state] ?? 'bg-muted-foreground'}`}
        title={container.state}
      />

      {/* Name + image */}
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-foreground/90">{container.name}</div>
        <div className="truncate text-[10px] text-muted-foreground">{container.image}</div>
      </div>

      {/* Ports */}
      {formatPorts(container) && (
        <span className="hidden shrink-0 text-[10px] text-muted-foreground sm:inline">
          {formatPorts(container)}
        </span>
      )}

      {/* Uptime/status */}
      <span className="shrink-0 text-[10px] text-muted-foreground w-8 text-right">
        {isRunning ? formatUptime(container.created) : container.state}
      </span>

      {/* Admin controls */}
      {showControls && (
        <div className="flex shrink-0 gap-0.5">
          {!isRunning && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={() => handleAction('start')}
              disabled={isBusy}
              title="Start"
              aria-label={`Start ${container.name} on ${hostName}`}
            >
              <Play className="h-3 w-3 text-emerald-500" />
            </Button>
          )}
          {isRunning && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={() => handleAction('stop')}
              disabled={isBusy}
              title="Stop"
              aria-label={`Stop ${container.name} on ${hostName}`}
            >
              <Square className="h-3 w-3 text-red-400" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={() => handleAction('restart')}
            disabled={isBusy}
            title="Restart"
            aria-label={`Restart ${container.name} on ${hostName}`}
          >
            <RotateCcw className="h-3 w-3 text-muted-foreground" />
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Headline + remedy per failure category (FR-010, FR-011).
 *
 * The headline says what is wrong; the detail is the server's own message,
 * which names the endpoint. A widget in any of these states shows *no*
 * container data — there is no local daemon to fall back to.
 */
const ERROR_COPY: Record<DockerErrorKind, { title: string; hint: string }> = {
  not_configured: {
    title: 'No Docker connection',
    hint: 'Link this widget to a Docker connection in Settings → Integrations.',
  },
  invalid_endpoint: {
    title: 'Invalid Docker endpoint',
    hint: 'Edit the connection and re-enter the address.',
  },
  unreachable: {
    title: 'Docker host unreachable',
    hint: 'The address is valid but the daemon did not answer.',
  },
  ssh_auth: {
    title: 'SSH authentication failed',
    hint: 'The host refused the key. Check the key is authorised for that user.',
  },
  ssh_host_key: {
    title: 'SSH host key not verified',
    hint: 'Add the host to known_hosts on the server.',
  },
  ssh_client_missing: {
    title: 'SSH client unavailable',
    hint: 'This HomeDash image has no ssh binary; ssh:// endpoints cannot be used.',
  },
  api_version: {
    title: 'Incompatible Docker API',
    hint: 'The daemon does not support an API version HomeDash can speak.',
  },
  unauthorized: {
    title: 'Sign in required',
    hint: 'Your session has expired. Sign in again.',
  },
  unknown: { title: 'Docker unavailable', hint: '' },
};

function DockerWidgetError({ error, fill = true }: { error: unknown; fill?: boolean }) {
  const { kind, message } = classifyDockerError(error);
  const copy = ERROR_COPY[kind] ?? ERROR_COPY.unknown;

  return (
    <div
      className={`flex flex-col items-center justify-center gap-1 p-4 text-center ${
        fill ? 'h-full' : 'min-h-28'
      }`}
    >
      <p className="text-sm font-medium text-destructive">{copy.title}</p>
      {copy.hint && <p className="text-xs text-muted-foreground">{copy.hint}</p>}
      <p className="max-w-full break-words text-[10px] text-muted-foreground/80">{message}</p>
    </div>
  );
}

function DockerHostSection({
  host,
  widgetInstanceId,
  pollIntervalSeconds,
  maxContainers,
  showControls,
  showHostHeader,
}: {
  host: DockerHost;
  widgetInstanceId: string;
  pollIntervalSeconds: number;
  maxContainers: number;
  showControls: boolean;
  showHostHeader: boolean;
}) {
  const { data, isLoading, error } = useDockerContainers(
    widgetInstanceId,
    host.connectionId,
    pollIntervalSeconds,
  );
  const containers = data?.containers ?? [];
  const displayed = containers.slice(0, maxContainers);
  const runningCount = containers.filter((container) => container.state === 'running').length;

  // Sort: running first, then by name
  displayed.sort((a, b) => {
    if (a.state === 'running' && b.state !== 'running') return -1;
    if (a.state !== 'running' && b.state === 'running') return 1;
    return a.name.localeCompare(b.name);
  });

  const sectionClass = showHostHeader
    ? 'border-b border-border/60 last:border-b-0'
    : 'flex h-full flex-col overflow-hidden';
  const listClass = showHostHeader ? '' : 'flex-1 overflow-y-auto';

  return (
    <section className={sectionClass} aria-label={`Docker host ${host.name}`}>
      {showHostHeader && (
        <div className="sticky top-0 z-10 flex min-h-11 items-center gap-2 border-b border-border/50 bg-card/95 px-3 py-2 backdrop-blur">
          <Server className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="min-w-0 truncate text-xs font-semibold">{host.name}</span>
        </div>
      )}

      {isLoading ? (
        <WidgetSkeleton variant="list" rows={showHostHeader ? 2 : 4} />
      ) : error ? (
        <DockerWidgetError error={error} fill={!showHostHeader} />
      ) : displayed.length === 0 ? (
        <div
          className={`flex items-center justify-center p-4 text-sm text-muted-foreground ${
            showHostHeader ? 'min-h-24' : 'h-full'
          }`}
        >
          No containers found
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 border-b border-border/50 px-3 py-1.5 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {runningCount} running
            </span>
            {containers.length - runningCount > 0 && (
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500/70" />
                {containers.length - runningCount} stopped
              </span>
            )}
            <span className="ml-auto">{containers.length} total</span>
          </div>

          <div className={listClass}>
            {displayed.map((container) => (
              <ContainerRow
                key={container.id}
                container={container}
                showControls={showControls}
                widgetInstanceId={widgetInstanceId}
                connectionId={host.connectionId}
                hostName={host.name}
              />
            ))}
            {containers.length > maxContainers && (
              <div className="py-1.5 text-center text-[10px] text-muted-foreground">
                +{containers.length - maxContainers} more
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

export function DockerWidget({ widget }: WidgetDisplayProps) {
  const config = (widget.config ?? {}) as Partial<DockerConfig>;
  const { user } = useBootstrap();
  const isAdmin = user?.role === 'admin';
  const showControls = (config.allowControls ?? false) && isAdmin;
  const hostsQuery = useDockerHosts(widget.id, !!widget.id);

  if (hostsQuery.isLoading) {
    return <WidgetSkeleton variant="list" rows={4} />;
  }

  if (hostsQuery.error) {
    return <DockerWidgetError error={hostsQuery.error} />;
  }

  const hosts = hostsQuery.data?.hosts ?? [];
  if (hosts.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 p-4 text-center">
        <p className="text-sm font-medium text-destructive">No Docker connection</p>
        <p className="text-xs text-muted-foreground">
          Link this widget to a Docker connection in Settings → Integrations.
        </p>
      </div>
    );
  }

  const sectionProps = {
    widgetInstanceId: widget.id,
    pollIntervalSeconds: config.pollIntervalSeconds ?? 30,
    maxContainers: config.maxContainers ?? 25,
    showControls,
  };

  if (hosts.length === 1) {
    return <DockerHostSection host={hosts[0]!} {...sectionProps} showHostHeader={false} />;
  }

  return (
    <div className="h-full overflow-y-auto">
      {hosts.map((host) => (
        <DockerHostSection
          key={host.connectionId}
          host={host}
          {...sectionProps}
          showHostHeader
        />
      ))}
    </div>
  );
}
