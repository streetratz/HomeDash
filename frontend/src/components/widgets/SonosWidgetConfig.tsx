/**
 * SonosWidgetConfig — Configuration form for the Sonos Music widget.
 * Shows connection status and display options.
 */

import { Speaker, ExternalLink, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '../ui/button.js';
import { Label } from '../ui/label.js';
import { Switch } from '../ui/switch.js';
import type { WidgetConfigFormProps } from './registry.js';
import { useSonosStatus, useSonosDisconnect } from '../../hooks/useSonos.js';

interface SonosFormConfig {
  showGrouping?: boolean;
  compactMode?: boolean;
}

export function SonosWidgetConfig({ config, onChange }: WidgetConfigFormProps) {
  const cfg = (config ?? {}) as SonosFormConfig;
  const { data: status, isLoading } = useSonosStatus();
  const disconnect = useSonosDisconnect();

  const update = (patch: Partial<SonosFormConfig>) => {
    onChange({ ...cfg, ...patch });
  };

  return (
    <div className="space-y-4">
      {/* Connection status */}
      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Speaker className="h-4 w-4 text-orange-400" />
            <span className="text-sm font-medium">Sonos Account</span>
          </div>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-white/40" />
          ) : status?.connected ? (
            <div className="flex items-center gap-1.5 text-xs text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {status.mode === 'local'
                ? `${status.speakerCount ?? 0} speaker${(status.speakerCount ?? 0) !== 1 ? 's' : ''} found`
                : 'Connected'}
            </div>
          ) : status?.mode === 'local' ? (
            <div className="flex items-center gap-1.5 text-xs text-yellow-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Discovering speakers…
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-red-400">
              <XCircle className="h-3.5 w-3.5" />
              Not connected
            </div>
          )}
        </div>

        {status?.connected && status.displayName && status.mode !== 'local' && (
          <div className="mt-2 text-xs text-white/60">
            Signed in as <span className="text-white/80">{status.displayName}</span>
          </div>
        )}

        {status?.mode === 'local' && !status.connected && (
          <p className="mt-2 text-[10px] text-white/40">
            Speakers are discovered automatically via UPnP on your local network.
          </p>
        )}

        <div className="mt-3 flex gap-2">
          {status?.connected ? (
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => disconnect.mutate()}
              disabled={disconnect.isPending}
            >
              {disconnect.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : null}
              Disconnect
            </Button>
          ) : status?.mode !== 'local' ? (
            <a
              href="/api/sonos/login"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-orange-500 hover:bg-orange-400 text-black text-xs font-medium transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              Connect Sonos
            </a>
          ) : null}
        </div>
      </div>

      {/* Settings link */}
      <p className="text-[10px] text-white/40">
        Manage your Sonos connection in{' '}
        <a href="/settings#integrations" className="text-blue-400 hover:text-blue-300 underline">
          Settings → Integrations
        </a>
      </p>

      {/* Display options */}
      <div className="space-y-3">
        <h4 className="text-xs font-medium text-white/60 uppercase tracking-wider">
          Display Options
        </h4>

        <div className="flex items-center justify-between">
          <Label htmlFor="sonos-grouping" className="text-sm">
            Show room grouping
          </Label>
          <Switch
            id="sonos-grouping"
            checked={cfg.showGrouping !== false}
            onCheckedChange={(v) => update({ showGrouping: v })}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="sonos-compact" className="text-sm">
            Compact mode
          </Label>
          <Switch
            id="sonos-compact"
            checked={cfg.compactMode ?? false}
            onCheckedChange={(v) => update({ compactMode: v })}
          />
        </div>
      </div>

      {/* Info */}
      <p className="text-[10px] text-white/40">
        Controls any music service playing through Sonos — Spotify, Apple Music,
        Amazon Music, radio, and more.
      </p>
    </div>
  );
}
