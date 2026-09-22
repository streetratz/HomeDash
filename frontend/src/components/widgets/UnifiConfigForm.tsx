/**
 * UniFi Network Controller config form — URL, username, password, site, interval + display options.
 */

import { useState } from 'react';
import { Button } from '../ui/button.js';
import { Input } from '../ui/input.js';
import { Label } from '../ui/label.js';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import type { WidgetConfigFormProps } from './registry.js';
import {
  useUnifiConfig,
  useSaveUnifiConfig,
  useDeleteUnifiConfig,
  useTestUnifiConnection,
} from '../../state/unifiHooks.js';

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
  ispDomain?: string | undefined;
}

export function UnifiConfigForm({ widget, config: displayConfig, onChange }: WidgetConfigFormProps) {
  const widgetId = widget?.persistedId ?? '';
  const { data: config } = useUnifiConfig(widgetId || undefined);
  const saveMutation = useSaveUnifiConfig(widgetId);
  const deleteMutation = useDeleteUnifiConfig(widgetId);
  const testMutation = useTestUnifiConnection(widgetId);

  const [baseUrl, setBaseUrl] = useState(config?.baseUrl ?? '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [siteName, setSiteName] = useState(config?.siteName ?? 'default');
  const [pollInterval, setPollInterval] = useState(config?.pollIntervalSec ?? 30);

  // Sync when config loads
  const [prevConfigId, setPrevConfigId] = useState<string | undefined>();
  if (config && config.id !== prevConfigId) {
    setPrevConfigId(config.id);
    setBaseUrl(config.baseUrl ?? '');
    setSiteName(config.siteName ?? 'default');
    setPollInterval(config.pollIntervalSec ?? 30);
  }

  const canSave = baseUrl.trim() && username.trim() && password.trim();

  // Display config helpers
  const dc = (displayConfig ?? {}) as UnifiDisplayConfig;
  function updateDisplay(patch: Partial<UnifiDisplayConfig>) {
    onChange({ ...dc, ...patch });
  }

  function handleSave() {
    if (!canSave) return;
    saveMutation.mutate({
      baseUrl: baseUrl.trim(),
      username: username.trim(),
      password: password.trim(),
      siteName: siteName.trim() || 'default',
      pollIntervalSec: pollInterval,
    });
  }

  function handleTest() {
    if (!baseUrl.trim() || !username.trim() || !password.trim()) return;
    testMutation.mutate({
      baseUrl: baseUrl.trim(),
      username: username.trim(),
      password: password.trim(),
    });
  }

  return (
    <div className="flex flex-col gap-4 p-1">
      {/* ── Connection Settings ── */}
      <div className="space-y-2">
        <Label htmlFor="unifi-url">Controller URL</Label>
        <Input
          id="unifi-url"
          placeholder="https://192.168.1.1"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
        />
        <p className="text-[10px] text-muted-foreground">
          The local IP/hostname of your UniFi gateway (UCG Max, UCG Lite, UDM, etc.)
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="unifi-username">Username</Label>
        <Input
          id="unifi-username"
          placeholder="admin"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="unifi-password">Password</Label>
        <Input
          id="unifi-password"
          type="password"
          placeholder={config?.hasCredentials ? '••••••••' : 'Enter password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="unifi-site">Site Name</Label>
          <Input
            id="unifi-site"
            placeholder="default"
            value={siteName}
            onChange={(e) => setSiteName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="unifi-interval">Poll Interval (s)</Label>
          <Input
            id="unifi-interval"
            type="number"
            min={10}
            max={300}
            value={pollInterval}
            onChange={(e) => setPollInterval(Number(e.target.value))}
          />
        </div>
      </div>

      {/* Test result */}
      {testMutation.data && (
        <div className={`flex items-center gap-2 rounded-md p-2 text-xs ${testMutation.data.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
          {testMutation.data.success ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          <span>{testMutation.data.message}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={handleTest} disabled={!canSave || testMutation.isPending}>
          {testMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
          Test
        </Button>
        <Button size="sm" onClick={handleSave} disabled={!canSave || saveMutation.isPending}>
          {saveMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
          Save
        </Button>
        {config?.configured && (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            className="ml-auto"
          >
            Remove
          </Button>
        )}
      </div>

      {/* ── Display Settings ── */}
      <div className="border-t border-border/50 pt-4 mt-2">
        <h4 className="text-sm font-medium mb-3">Display Options</h4>

        {/* Layout */}
        <div className="mb-3">
          <Label className="text-xs text-muted-foreground mb-1.5 block">Layout</Label>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={dc.layout !== 'grid' ? 'default' : 'outline'}
              onClick={() => updateDisplay({ layout: 'stacked' })}
              className="text-xs h-7"
            >
              Stacked
            </Button>
            <Button
              size="sm"
              variant={dc.layout === 'grid' ? 'default' : 'outline'}
              onClick={() => updateDisplay({ layout: 'grid' })}
              className="text-xs h-7"
            >
              Grid (2-col)
            </Button>
          </div>
        </div>

        {/* Section toggles */}
        <Label className="text-xs text-muted-foreground mb-2 block">Sections</Label>
        <div className="grid grid-cols-2 gap-2">
          {([
            ['showDevice', 'Device / Gateway'],
            ['showWan', 'WAN / IPs'],
            ['showNetwork', 'Networks (WiFi + VPN)'],
          ] as [keyof UnifiDisplayConfig, string][]).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={dc[key] !== false}
                onChange={(e) => updateDisplay({ [key]: e.target.checked })}
                className="rounded border-border"
              />
              {label}
            </label>
          ))}
        </div>

        {/* Section order */}
        <div className="mt-3 space-y-1.5">
          <Label className="text-xs text-muted-foreground">Section Order (top → bottom)</Label>
          <div className="flex flex-col gap-1">
            {(dc.sectionOrder ?? ['device', 'wan', 'network']).map((section, idx, arr) => (
              <div key={section} className="flex items-center gap-2 text-xs">
                <span className="flex-1 capitalize">{section}</span>
                <button
                  type="button"
                  disabled={idx === 0}
                  className="px-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  onClick={() => {
                    const next = [...arr];
                    const tmp = next[idx - 1]!;
                    next[idx - 1] = next[idx]!;
                    next[idx] = tmp;
                    updateDisplay({ sectionOrder: next });
                  }}
                >↑</button>
                <button
                  type="button"
                  disabled={idx === arr.length - 1}
                  className="px-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  onClick={() => {
                    const next = [...arr];
                    const tmp = next[idx + 1]!;
                    next[idx + 1] = next[idx]!;
                    next[idx] = tmp;
                    updateDisplay({ sectionOrder: next });
                  }}
                >↓</button>
              </div>
            ))}
          </div>
        </div>

        {/* ISP Domain override */}
        <div className="mt-3 space-y-1.5">
          <Label htmlFor="unifi-isp-domain" className="text-xs text-muted-foreground">
            ISP Domain (optional — overrides auto-guess for logo)
          </Label>
          <Input
            id="unifi-isp-domain"
            placeholder="e.g. aussiebroadband.com.au"
            value={dc.ispDomain ?? ''}
            onChange={(e) => updateDisplay({ ispDomain: e.target.value || undefined })}
            className="h-7 text-xs"
          />
        </div>
      </div>
    </div>
  );
}
