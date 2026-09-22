import { useState } from 'react';
import { ArrowDown, ArrowUp, ExternalLink, Link2, Loader2, Plus } from 'lucide-react';
import { Button } from '../ui/button.js';
import { Label } from '../ui/label.js';
import {
  useDockerConnections,
  useReplaceDockerWidgetConnections,
} from '../../hooks/useConnections.js';
import { useDockerHosts } from '../../hooks/useDocker.js';

export function DockerConnectionPicker({
  widgetInstanceId,
}: {
  widgetInstanceId: string | undefined;
}) {
  const connectionsQuery = useDockerConnections();
  const hostsQuery = useDockerHosts(widgetInstanceId ?? '', !!widgetInstanceId);
  const replaceMutation = useReplaceDockerWidgetConnections();
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);

  if (!widgetInstanceId) {
    return (
      <p className="text-sm text-muted-foreground">
        Save the widget first to link Docker hosts.
      </p>
    );
  }
  const persistedWidgetId = widgetInstanceId;

  const connections = connectionsQuery.data ?? [];
  const serverOrder = (hostsQuery.data?.hosts ?? []).map((host) => host.connectionId);
  const selectedIds = localOrder ?? serverOrder;
  const selectedSet = new Set(selectedIds);
  const orderedConnections = [
    ...selectedIds
      .map((id) => connections.find((connection) => connection.id === id))
      .filter((connection) => connection !== undefined),
    ...connections.filter((connection) => !selectedSet.has(connection.id)),
  ];

  function save(next: string[]) {
    setLocalOrder(next);
    replaceMutation.mutate(
      { widgetInstanceId: persistedWidgetId, connectionIds: next },
      { onSettled: () => setLocalOrder(null) },
    );
  }

  function toggle(connectionId: string) {
    save(
      selectedSet.has(connectionId)
        ? selectedIds.filter((id) => id !== connectionId)
        : [...selectedIds, connectionId],
    );
  }

  function move(connectionId: string, direction: -1 | 1) {
    const index = selectedIds.indexOf(connectionId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= selectedIds.length) return;
    const next = [...selectedIds];
    [next[index], next[target]] = [next[target]!, next[index]!];
    save(next);
  }

  const isLoading = connectionsQuery.isLoading || hostsQuery.isLoading;
  const isError = connectionsQuery.isError || hostsQuery.isError;
  const isPending = replaceMutation.isPending;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-blue-400" aria-hidden="true" />
        <Label className="text-sm font-medium">Docker Hosts</Label>
      </div>
      <p className="text-xs text-muted-foreground">
        Select one or more hosts. Their order here is the order shown in the widget.
      </p>

      {isLoading ? (
        <div className="flex min-h-11 items-center gap-2 text-xs text-muted-foreground" role="status">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          Loading Docker hosts…
        </div>
      ) : isError ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-sm text-destructive">Docker hosts could not be loaded.</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2 min-h-11"
            onClick={() => {
              void connectionsQuery.refetch();
              void hostsQuery.refetch();
            }}
          >
            Retry
          </Button>
        </div>
      ) : orderedConnections.length > 0 ? (
        <div className="space-y-1 rounded-lg border border-border/70 p-1">
          {orderedConnections.map((connection) => {
            const selected = selectedSet.has(connection.id);
            const selectedIndex = selectedIds.indexOf(connection.id);
            return (
              <div
                key={connection.id}
                className="flex min-h-12 items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
              >
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggle(connection.id)}
                    disabled={isPending}
                    className="h-5 w-5 shrink-0 rounded border-border accent-primary"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{connection.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {connection.dockerUrl}
                    </span>
                  </span>
                </label>
                {selected && selectedIds.length > 1 && (
                  <div className="flex shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11"
                      aria-label={`Move ${connection.name} up`}
                      disabled={isPending || selectedIndex === 0}
                      onClick={() => move(connection.id, -1)}
                    >
                      <ArrowUp className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11"
                      aria-label={`Move ${connection.name} down`}
                      disabled={isPending || selectedIndex === selectedIds.length - 1}
                      onClick={() => move(connection.id, 1)}
                    >
                      <ArrowDown className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border p-4 text-center">
          <p className="text-sm text-muted-foreground">No Docker connections configured.</p>
          <a
            href="/settings?tab=integrations"
            className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add in Settings
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      )}

      {isPending && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          Updating host order…
        </div>
      )}
    </div>
  );
}
