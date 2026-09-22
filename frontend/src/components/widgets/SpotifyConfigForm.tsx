/**
 * SpotifyConfigForm — Configuration form for the Spotify widget.
 * Shows connection status, connect/disconnect, and display options.
 */

import { Music, ExternalLink, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '../ui/button.js';
import { Label } from '../ui/label.js';
import { Switch } from '../ui/switch.js';
import type { WidgetConfigFormProps } from './registry.js';
import { useSpotifyStatus, useSpotifyDisconnect } from '../../hooks/useSpotify.js';

interface SpotifyFormConfig {
  showAlbumArt?: boolean;
  compactMode?: boolean;
}

export function SpotifyConfigForm({ config, onChange }: WidgetConfigFormProps) {
  const cfg = (config ?? {}) as SpotifyFormConfig;
  const { data: status, isLoading } = useSpotifyStatus();
  const disconnect = useSpotifyDisconnect();

  const update = (patch: Partial<SpotifyFormConfig>) => {
    onChange({ ...cfg, ...patch });
  };

  return (
    <div className="space-y-4">
      {/* Connection status */}
      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music className="h-4 w-4 text-green-400" />
            <span className="text-sm font-medium">Spotify Account</span>
          </div>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-white/40" />
          ) : status?.connected ? (
            <div className="flex items-center gap-1.5 text-xs text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Connected
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-red-400">
              <XCircle className="h-3.5 w-3.5" />
              Not connected
            </div>
          )}
        </div>

        {status?.connected && (
          <div className="mt-2 text-xs text-white/60">
            Signed in as <span className="text-white/80">{status.displayName ?? status.email}</span>
          </div>
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
          ) : (
            <a
              href="/api/spotify/login"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-green-500 hover:bg-green-400 text-black text-xs font-medium transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              Connect Spotify
            </a>
          )}
        </div>
      </div>

      {/* Settings link */}
      <p className="text-[10px] text-white/40">
        Manage your Spotify connection in{' '}
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
          <Label htmlFor="spotify-album-art" className="text-sm">
            Show album art
          </Label>
          <Switch
            id="spotify-album-art"
            checked={cfg.showAlbumArt !== false}
            onCheckedChange={(v) => update({ showAlbumArt: v })}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="spotify-compact" className="text-sm">
            Compact mode
          </Label>
          <Switch
            id="spotify-compact"
            checked={cfg.compactMode ?? false}
            onCheckedChange={(v) => update({ compactMode: v })}
          />
        </div>
      </div>

      {/* Info */}
      <p className="text-[10px] text-white/40">
        Spotify Premium is required for playback control. Free accounts can view
        what&apos;s playing but cannot play, pause, or skip tracks.
      </p>
    </div>
  );
}
