/**
 * ConnectionPicker — Dropdown for selecting a Pi-hole or Docker connection.
 * Used inside widget config forms to replace inline credentials.
 */

import { useState } from 'react';
import { Link2, Plus, ExternalLink, Loader2 } from 'lucide-react';
import { Label } from '../ui/label.js';
import { Button } from '../ui/button.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select.js';
import {
  usePiholeConnections,
  useDockerConnections,
  useLinkedConnection,
  useLinkWidgetConnection,
  useUnlinkWidgetConnection,
} from '../../hooks/useConnections.js';

interface ConnectionPickerProps {
  widgetInstanceId: string | undefined;
  connectionType: 'pihole' | 'docker';
  label?: string;
  description?: string;
}

export function ConnectionPicker({ widgetInstanceId, connectionType, label, description }: ConnectionPickerProps) {
  const piholeQuery = usePiholeConnections();
  const dockerQuery = useDockerConnections();
  const linkedQuery = useLinkedConnection(widgetInstanceId, connectionType);
  const linkMutation = useLinkWidgetConnection();
  const unlinkMutation = useUnlinkWidgetConnection();

  const connections = connectionType === 'pihole' ? piholeQuery.data : dockerQuery.data;
  const isLoading = connectionType === 'pihole' ? piholeQuery.isLoading : dockerQuery.isLoading;
  const currentConnectionId = linkedQuery.data?.connectionId ?? undefined;

  // Derive selected from server state; local override only while mutation is in-flight
  const [localOverride, setLocalOverride] = useState<string | undefined>(undefined);
  const selected = localOverride ?? currentConnectionId;

  function handleChange(value: string) {
    setLocalOverride(value);
    if (widgetInstanceId && value) {
      linkMutation.mutate(
        { widgetInstanceId, connectionType, connectionId: value },
        { onSettled: () => setLocalOverride(undefined) },
      );
    }
  }

  function handleUnlink() {
    if (widgetInstanceId) {
      setLocalOverride(undefined);
      unlinkMutation.mutate({ widgetInstanceId, connectionType });
    }
  }

  if (!widgetInstanceId) {
    return (
      <p className="text-sm text-muted-foreground">
        Save the widget first to link a connection.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-blue-400" />
        <Label className="text-sm font-medium">
          {label ?? `${connectionType === 'pihole' ? 'Pi-hole' : 'Docker'} Connection`}
        </Label>
      </div>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}

      {isLoading || linkedQuery.isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading connections…
        </div>
      ) : connections && connections.length > 0 ? (
        <div className="space-y-2">
          <Select value={selected ?? ''} onValueChange={handleChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a connection…" />
            </SelectTrigger>
            <SelectContent>
              {connections.map((conn) => (
                <SelectItem key={conn.id} value={conn.id}>
                  {conn.name} — {'baseUrl' in conn ? conn.baseUrl : ('dockerUrl' in conn ? conn.dockerUrl : '')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selected && (
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={handleUnlink}>
              Unlink connection
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-white/10 p-3 text-center">
          <p className="text-sm text-muted-foreground">
            No {connectionType === 'pihole' ? 'Pi-hole' : 'Docker'} connections configured.
          </p>
          <a
            href="/settings#integrations"
            className="mt-2 inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300"
          >
            <Plus className="h-3 w-3" />
            Add in Settings
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      {(linkMutation.isPending || unlinkMutation.isPending) && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Updating…
        </div>
      )}
    </div>
  );
}
