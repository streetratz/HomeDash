/**
 * Integrations settings tab — Left sidebar nav per service with content panel.
 * External service connections only (Clock Strip and Screensaver moved to Appearance).
 * Admin-only.
 */

import { type ReactNode, useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Shield,
  Music,
  Calendar,
  CheckSquare,
  Container,
  ImageIcon,
  Plus,
  Trash2,
  Pencil,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Folder,
  RefreshCw,
  Speaker,
  Link2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card.js';
import { Button } from '../ui/button.js';
import { Input } from '../ui/input.js';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../ui/alert-dialog.js';
import { ConnectedAccounts } from './ConnectedAccounts.js';
import { CalendarSourceList } from './CalendarSourceList.js';
import { TodoAccountManager } from '../TodoAccountManager.js';
import { PiholeConnectionForm } from './PiholeConnectionForm.js';
import { DockerConnectionForm } from './DockerConnectionForm.js';
import {
  usePiholeConnections,
  useDeletePiholeConnection,
  useTestPiholeConnection,
  useDockerConnections,
  useDeleteDockerConnection,
  useTestDockerConnection,
} from '../../hooks/useConnections.js';
import type { PiholeConnection, DockerConnection } from '../../hooks/useConnections.js';
import { useSpotifyStatus, useSpotifyDisconnect } from '../../hooks/useSpotify.js';
import { useSonosStatus, useSonosDisconnect, useSonosConfig, useSonosHouseholds, useSonosMode, useSetSonosMode, useSonosDiscover, useSonosServices, useServiceLabels, useUpdateServiceLabels } from '../../hooks/useSonos.js';
import { apiClient } from '../../lib/apiClient.js';
import { queryClient } from '../../state/queryClient.js';
import { MobileSectionSelect } from './MobileSectionSelect.js';
import { SettingsErrorState, SettingsLoadingState } from './SettingsDataState.js';

// ─── Service nav items ──────────────────────────────────────────────────────

type ServiceId = 'pihole' | 'spotify' | 'sonos' | 'photos' | 'calendars' | 'todo' | 'docker' | 'accounts';

interface ServiceNavItem {
  id: ServiceId;
  label: string;
  icon: ReactNode;
}

interface ServiceGroup {
  label: string;
  items: ServiceNavItem[];
}

const serviceGroups: ServiceGroup[] = [
  {
    label: 'Infrastructure',
    items: [
      { id: 'docker', label: 'Docker', icon: <Container className="h-4 w-4" /> },
      { id: 'pihole', label: 'Pi-hole', icon: <Shield className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Media',
    items: [
      { id: 'photos', label: 'Photo Sources', icon: <ImageIcon className="h-4 w-4" /> },
      { id: 'spotify', label: 'Spotify', icon: <Music className="h-4 w-4" /> },
      { id: 'sonos', label: 'Sonos', icon: <Speaker className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Productivity',
    items: [
      { id: 'calendars', label: 'Calendars', icon: <Calendar className="h-4 w-4" /> },
      { id: 'todo', label: 'Todo', icon: <CheckSquare className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Connections',
    items: [
      { id: 'accounts', label: 'Accounts', icon: <ExternalLink className="h-4 w-4" /> },
    ],
  },
];
const serviceItems = serviceGroups.flatMap((group) => group.items);

// ─── Pi-hole connections panel ──────────────────────────────────────────────

function PiholePanel() {
  const connectionsQuery = usePiholeConnections();
  const { data: connections } = connectionsQuery;
  const [showForm, setShowForm] = useState<string | null>(null);

  const editingConnection = showForm && showForm !== 'new'
    ? connections?.find((c) => c.id === showForm)
    : undefined;

  if (connectionsQuery.isLoading) {
    return <SettingsLoadingState label="Loading Pi-hole connections…" />;
  }

  if (connectionsQuery.isError) {
    return (
      <SettingsErrorState
        message="Pi-hole connections could not be loaded."
        onRetry={() => {
          void connectionsQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Pi-hole</h3>
          <p className="text-sm text-muted-foreground">DNS-level ad blocking and network monitoring</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowForm('new')}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add
        </Button>
      </div>

      <div className="space-y-3">
        {connections?.map((conn) => (
          <PiholeConnectionRow
            key={conn.id}
            connection={conn}
            onEdit={() => setShowForm(conn.id)}
          />
        ))}

        {showForm && (
          <PiholeConnectionForm
            {...(editingConnection ? { connection: editingConnection } : {})}
            onClose={() => setShowForm(null)}
          />
        )}

        {!connections?.length && !showForm && (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <Shield className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No Pi-hole connections configured.
            </p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => setShowForm('new')}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Pi-hole
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function PiholeConnectionRow({
  connection,
  onEdit,
}: {
  connection: PiholeConnection;
  onEdit: () => void;
}) {
  const deleteMutation = useDeletePiholeConnection();
  const testMutation = useTestPiholeConnection();
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  function handleTest() {
    setTestStatus('testing');
    testMutation.mutate(
      { id: connection.id },
      {
        onSuccess: (result) => {
          setTestStatus(result.success ? 'success' : 'error');
          if (result.success) {
            toast.success('Connection test passed');
          } else {
            toast.error(result.message ?? 'Connection test failed');
          }
        },
        onError: (err) => {
          setTestStatus('error');
          toast.error(err instanceof Error ? err.message : 'Connection test failed');
        },
      },
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <StatusDot status={testStatus} />
          <span className="text-sm font-medium">{connection.name}</span>
        </div>
        <p className="truncate text-xs text-muted-foreground">{connection.baseUrl}</p>
        {connection.linkedWidgets > 0 && (
          <p className="text-[10px] text-muted-foreground">
            {connection.linkedWidgets} linked widget{connection.linkedWidgets !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      <div className="flex gap-1.5">
        <Button
          variant="outline"
          size="icon"
          className="h-11 w-11 sm:h-9 sm:w-9"
          onClick={handleTest}
          disabled={testMutation.isPending}
          title="Test"
          aria-label={`Test ${connection.name}`}
        >
          {testMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : testStatus === 'success' ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          ) : testStatus === 'error' ? (
            <XCircle className="h-3.5 w-3.5 text-red-500" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-11 w-11 sm:h-9 sm:w-9"
          onClick={onEdit}
          title="Edit"
          aria-label={`Edit ${connection.name}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11 sm:h-9 sm:w-9"
              disabled={deleteMutation.isPending}
              title="Remove"
              aria-label={`Remove ${connection.name}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Pi-hole Connection</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove &ldquo;{connection.name}&rdquo; and unlink any associated widgets.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteMutation.mutate(connection.id)}>
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

// ─── Spotify panel ──────────────────────────────────────────────────────────

function SpotifyPanel() {
  const { data: status, isLoading } = useSpotifyStatus();
  const disconnect = useSpotifyDisconnect();

  // Spotify app credentials config
  const configQuery = useQuery({
    queryKey: ['spotify', 'config'],
    queryFn: () => apiClient.get<{ configured: boolean; clientId: string | null; redirectUri: string | null }>('/api/spotify/config'),
  });

  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [redirectUri, setRedirectUri] = useState('');
  const [showForm, setShowForm] = useState(false);

  // Build recommended redirect URI — Spotify requires HTTPS or 127.0.0.1 (localhost not allowed)
  const origin = window.location.origin;
  const safeOrigin = origin.replace('://localhost', '://127.0.0.1');
  const defaultRedirect = `${safeOrigin}/api/spotify/callback`;

  const saveConfig = useMutation({
    mutationFn: () =>
      apiClient.put('/api/spotify/config', {
        clientId,
        clientSecret,
        redirectUri: redirectUri || defaultRedirect,
      }),
    onSuccess: () => {
      toast.success('Spotify credentials saved');
      void queryClient.invalidateQueries({ queryKey: ['spotify', 'config'] });
      setShowForm(false);
      setClientSecret('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const configured = configQuery.data?.configured ?? false;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Spotify</h3>
        <p className="text-sm text-muted-foreground">Music playback and now-playing display</p>
      </div>

      {/* ── App Credentials ───────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">App Credentials</CardTitle>
              <CardDescription>
                Create a Spotify app at{' '}
                <a
                  href="https://developer.spotify.com/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  developer.spotify.com/dashboard
                </a>
                , set the redirect URI, then enter the credentials below.
              </CardDescription>
            </div>
            {configured && !showForm && (
              <span className="flex items-center gap-1.5 text-xs text-green-500">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Configured
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {configured && !showForm ? (
            <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted-foreground">
                  Client ID: <span className="font-mono text-foreground">{configQuery.data?.clientId}</span>
                </p>
                {configQuery.data?.redirectUri && (
                  <p className="truncate text-xs text-muted-foreground">
                    Redirect: {configQuery.data.redirectUri}
                  </p>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Edit
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Client ID</label>
                <Input
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="e.g. 1a2b3c4d5e6f…"
                  className="font-mono text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Client Secret</label>
                <Input
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder="Enter client secret"
                  className="font-mono text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Redirect URI</label>
                <Input
                  value={redirectUri}
                  onChange={(e) => setRedirectUri(e.target.value)}
                  placeholder={defaultRedirect}
                  className="font-mono text-sm"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Add this exact URI to your Spotify app&apos;s Redirect URIs: <code className="rounded bg-muted px-1">{defaultRedirect}</code>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Spotify requires HTTPS, or HTTP with <code className="rounded bg-muted px-1">127.0.0.1</code> / <code className="rounded bg-muted px-1">[::1]</code>.{' '}
                  <code className="rounded bg-muted px-1">localhost</code> is not allowed.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => saveConfig.mutate()}
                  disabled={!clientId.trim() || !clientSecret.trim() || saveConfig.isPending}
                >
                  {saveConfig.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Save Credentials
                </Button>
                {showForm && (
                  <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Connection Status ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Connection Status</CardTitle>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : status?.connected ? (
              <span className="flex items-center gap-1.5 text-xs text-green-500">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Connected
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <XCircle className="h-3.5 w-3.5" />
                Not connected
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {status?.connected ? (
            <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {status.displayName ?? status.email ?? 'Spotify Account'}
                </p>
                {status.email && status.displayName && (
                  <p className="truncate text-xs text-muted-foreground">{status.email}</p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => disconnect.mutate()}
                disabled={disconnect.isPending}
              >
                {disconnect.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Disconnect
              </Button>
            </div>
          ) : configured ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-muted-foreground">
                Connect your Spotify account to display now-playing info and control playback.
              </p>
              <a
                href="/api/spotify/login"
                className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-500"
              >
                <ExternalLink className="h-3 w-3" />
                Connect Spotify
              </a>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Enter your Spotify app credentials above to enable account linking.
            </p>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Spotify Premium is required for playback control. Free accounts can view what&apos;s playing.
      </p>
    </div>
  );
}

// ─── Sonos panel ────────────────────────────────────────────────────────────

function SonosPanel() {
  const { data: status, isLoading } = useSonosStatus();
  const disconnect = useSonosDisconnect();
  const configQuery = useSonosConfig();
  const { data: householdsData } = useSonosHouseholds(status?.connected ?? false);
  const { data: modeData } = useSonosMode();
  const setMode = useSetSonosMode();
  const currentMode = modeData?.mode ?? 'cloud';
  const { data: discoverData } = useSonosDiscover(currentMode === 'local');
  const householdId = status?.householdId ?? householdsData?.households[0]?.id;
  const { data: servicesData } = useSonosServices(
    householdId,
    currentMode === 'local' || Boolean(status?.connected),
  );
  const { data: labelsData } = useServiceLabels();
  const updateLabels = useUpdateServiceLabels();

  const [editingLabels, setEditingLabels] = useState<Record<string, string> | null>(null);

  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [redirectUri, setRedirectUri] = useState('');
  const [showForm, setShowForm] = useState(false);

  const origin = window.location.origin;
  const safeOrigin = origin.replace('://localhost', '://127.0.0.1');
  const defaultRedirect = `${safeOrigin}/api/sonos/callback`;

  const saveConfig = useMutation({
    mutationFn: () =>
      apiClient.put('/api/sonos/config', {
        clientId,
        clientSecret,
        redirectUri: redirectUri || defaultRedirect,
      }),
    onSuccess: () => {
      toast.success('Sonos credentials saved');
      void queryClient.invalidateQueries({ queryKey: ['sonos-config'] });
      setShowForm(false);
      setClientSecret('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const configured = configQuery.data?.configured ?? false;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Sonos</h3>
        <p className="text-sm text-muted-foreground">
          Control Sonos speakers — volume, playback, room grouping
        </p>
      </div>

      {/* ── Connection Mode ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connection Mode</CardTitle>
          <CardDescription>
            Choose how to communicate with your Sonos speakers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <button
              onClick={() => setMode.mutate('local')}
              className={`flex-1 rounded-lg border p-3 text-left transition ${
                currentMode === 'local'
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border hover:border-muted-foreground/30'
              }`}
            >
              <p className="text-sm font-medium">Local (LAN)</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                UPnP discovery — no internet needed
              </p>
              {currentMode === 'local' && discoverData && (
                <p className="mt-1 text-xs text-primary">
                  {discoverData.speakers.length} speaker{discoverData.speakers.length !== 1 ? 's' : ''} found
                </p>
              )}
            </button>
            <button
              onClick={() => setMode.mutate('cloud')}
              className={`flex-1 rounded-lg border p-3 text-left transition ${
                currentMode === 'cloud'
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border hover:border-muted-foreground/30'
              }`}
            >
              <p className="text-sm font-medium">Cloud API</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                OAuth — works remotely, needs internet
              </p>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Cloud-only: App Credentials + OAuth */}
      {currentMode === 'cloud' && (<>

      {/* ── App Credentials ───────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">App Credentials</CardTitle>
              <CardDescription>
                Create a Control Integration at{' '}
                <a
                  href="https://developer.sonos.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  developer.sonos.com
                </a>
                , set the redirect URI, then enter the credentials below.
              </CardDescription>
            </div>
            {configured && !showForm && (
              <span className="flex items-center gap-1.5 text-xs text-green-500">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Configured
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {configured && !showForm ? (
            <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted-foreground">
                  Client ID:{' '}
                  <span className="font-mono text-foreground">{configQuery.data?.clientId}</span>
                </p>
                {configQuery.data?.redirectUri && (
                  <p className="truncate text-xs text-muted-foreground">
                    Redirect: {configQuery.data.redirectUri}
                  </p>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Edit
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Client ID (Key)
                </label>
                <Input
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="e.g. a1b2c3d4-e5f6-7890-…"
                  className="font-mono text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Client Secret
                </label>
                <Input
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder="Enter client secret"
                  className="font-mono text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Redirect URI
                </label>
                <Input
                  value={redirectUri}
                  onChange={(e) => setRedirectUri(e.target.value)}
                  placeholder={defaultRedirect}
                  className="font-mono text-sm"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Add this exact URI to your Sonos app&apos;s Redirect URIs:{' '}
                  <code className="rounded bg-muted px-1">{defaultRedirect}</code>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Sonos requires HTTPS for redirect URIs. Use a reverse proxy or tunnel for
                  development.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => saveConfig.mutate()}
                  disabled={!clientId.trim() || !clientSecret.trim() || saveConfig.isPending}
                >
                  {saveConfig.isPending && (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  )}
                  Save Credentials
                </Button>
                {showForm && (
                  <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Connection Status ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Connection Status</CardTitle>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : status?.connected ? (
              <span className="flex items-center gap-1.5 text-xs text-green-500">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Connected
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <XCircle className="h-3.5 w-3.5" />
                Not connected
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {status?.connected ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Sonos Account</p>
                  {householdsData?.households && (
                    <p className="text-xs text-muted-foreground">
                      {householdsData.households.length} household
                      {householdsData.households.length !== 1 ? 's' : ''} found
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => disconnect.mutate()}
                  disabled={disconnect.isPending}
                >
                  {disconnect.isPending && (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  )}
                  Disconnect
                </Button>
              </div>
            </div>
          ) : configured ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-muted-foreground">
                Connect your Sonos account to control speakers, volume, and room grouping.
              </p>
              <a
                href="/api/sonos/login"
                className="inline-flex items-center gap-1.5 rounded-md bg-orange-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-orange-500"
              >
                <ExternalLink className="h-3 w-3" />
                Connect Sonos
              </a>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Enter your Sonos app credentials above to enable account linking.
            </p>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Sonos integration uses the official Cloud Control API. Speaker control works over the
        internet — no local network access needed from the server.
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        Switch to local mode for full speaker details including model, version, serial, and
        stereo pairs.
      </p>
      </>)}

      {currentMode === 'local' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Discovered Speakers</CardTitle>
            <CardDescription>
              Speakers found on your local network via UPnP
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {discoverData && discoverData.speakers.length > 0 ? (
              <div className="space-y-2">
                {discoverData.speakers.map((s) => (
                  <details key={s.uuid} className="group rounded-md border border-border">
                    <summary className="flex cursor-pointer items-center justify-between px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="text-sm font-medium">
                            {s.name}
                            {s.stereoPair && (
                              <span className="ml-1.5 inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
                                <Link2 className="h-3 w-3" aria-hidden="true" />
                                {s.stereoPair.role === 'left' ? 'Left channel' : 'Right channel'}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {s.ip}{s.model ? ` · ${s.model}` : ''}
                          </p>
                        </div>
                      </div>
                      <span className="h-2 w-2 rounded-full bg-green-500" />
                    </summary>
                    <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground space-y-0.5">
                      {s.modelNumber && <p>Model: {s.modelNumber}</p>}
                      {s.softwareVersion && <p>Software: {s.softwareVersion}</p>}
                      {s.serialNumber && <p>Serial: {s.serialNumber}</p>}
                      {s.hardwareVersion && <p>Hardware: {s.hardwareVersion}</p>}
                      {s.stereoPair && (
                        <p>
                          Stereo partner:{' '}
                          {s.stereoPair.partnerName ?? s.stereoPair.partnerUuid}
                        </p>
                      )}
                      {!s.modelNumber && !s.softwareVersion && !s.serialNumber && !s.hardwareVersion && (
                        <p className="italic">No extended details available</p>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No speakers discovered yet. Ensure HomeDash is on the same network as your Sonos speakers.
              </p>
            )}
            <div className="border-t border-border pt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Household music services
              </p>
              {servicesData?.services.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {servicesData.services.map((service) => (
                    <span
                      key={service.id}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs"
                    >
                      <Music className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                      {service.name}
                      {service.accounts.length > 0 && (
                        <span className="text-muted-foreground">
                          {service.accounts.length} account
                          {service.accounts.length === 1 ? '' : 's'}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  No linked services have been observed yet.
                </p>
              )}
              {servicesData?.completeness === 'observed' && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Sonos did not expose a complete account inventory, so this list is based on
                  favorites and recent playback.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Account Labels ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account Labels</CardTitle>
          <CardDescription>
            Name your streaming accounts (e.g. &ldquo;Dad&apos;s Spotify&rdquo;). Labels appear on now-playing badges.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(() => {
            const savedLabels = labelsData?.labels ?? {};
            const labels = editingLabels ?? savedLabels;
            const accountDetails = new Map<
              string,
              { serviceName: string; nickname?: string }
            >();
            for (const service of servicesData?.services ?? []) {
              for (const account of service.accounts) {
                accountDetails.set(`sn:${account.serialNumber}`, {
                  serviceName: service.name,
                  ...(account.nickname && { nickname: account.nickname }),
                });
              }
            }
            const keys = [...new Set([...Object.keys(labels), ...accountDetails.keys()])].sort(
              (a, b) => Number(a.slice(3)) - Number(b.slice(3)),
            );

            if (keys.length === 0 && !editingLabels) {
              return (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground italic">
                    No streaming accounts have been observed yet.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Add a Sonos Favorite or play music from an account, then return here.
                  </p>
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {keys.map((key) => {
                  const snNum = key.replace('sn:', '');
                  const details = accountDetails.get(key);
                  return (
                    <div key={key} className="grid gap-2 sm:grid-cols-[minmax(9rem,1fr)_minmax(12rem,2fr)] sm:items-center">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {details?.serviceName ?? `Account ${snNum}`}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {details?.nickname ? `${details.nickname} · ` : ''}
                          Account {snNum}
                        </p>
                      </div>
                      <Input
                        value={labels[key] ?? ''}
                        aria-label={`Label for ${details?.serviceName ?? 'Sonos'} account ${snNum}`}
                        placeholder={details?.nickname ?? `${details?.serviceName ?? 'Sonos'} account`}
                        maxLength={100}
                        className="h-8 text-sm"
                        onChange={(e) => {
                          const next = { ...labels, [key]: e.target.value };
                          setEditingLabels(next);
                        }}
                      />
                    </div>
                  );
                })}
                {servicesData?.completeness === 'observed' && (
                  <p className="text-xs text-muted-foreground">
                    This list is inferred from favorites and recent playback; Sonos did not expose a
                    complete account inventory.
                  </p>
                )}
                {editingLabels && (
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => {
                        // Strip empty values before saving
                        const cleaned: Record<string, string> = {};
                        for (const [k, v] of Object.entries(editingLabels)) {
                          if (v.trim()) cleaned[k] = v.trim();
                        }
                        updateLabels.mutate(cleaned, {
                          onSuccess: () => setEditingLabels(null),
                        });
                      }}
                      disabled={updateLabels.isPending}
                    >
                      {updateLabels.isPending ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                      )}
                      Save Labels
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingLabels(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Calendars panel ────────────────────────────────────────────────────────

function CalendarsPanel() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Calendars</h3>
        <p className="text-sm text-muted-foreground">Manage calendar feeds and synced sources</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Calendar Sources</CardTitle>
          <CardDescription>iCal feeds and synced calendars.</CardDescription>
        </CardHeader>
        <CardContent>
          <CalendarSourceList />
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Todo panel ─────────────────────────────────────────────────────────────

function TodoPanel() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Todo</h3>
        <p className="text-sm text-muted-foreground">Connect todo accounts and sync task lists</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Todo Providers</CardTitle>
          <CardDescription>Microsoft To Do and other task services.</CardDescription>
        </CardHeader>
        <CardContent>
          <TodoAccountManager />
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Docker panel ───────────────────────────────────────────────────────────

function DockerPanel() {
  const connectionsQuery = useDockerConnections();
  const { data: connections } = connectionsQuery;
  const [showForm, setShowForm] = useState<string | null>(null);

  const editingConnection = showForm && showForm !== 'new'
    ? connections?.find((c) => c.id === showForm)
    : undefined;

  if (connectionsQuery.isLoading) {
    return <SettingsLoadingState label="Loading Docker connections…" />;
  }

  if (connectionsQuery.isError) {
    return (
      <SettingsErrorState
        message="Docker connections could not be loaded."
        onRetry={() => {
          void connectionsQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Docker</h3>
          <p className="text-sm text-muted-foreground">Container management and monitoring</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowForm('new')}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add
        </Button>
      </div>

      <div className="space-y-3">
        {connections?.map((conn) => (
          <DockerConnectionRow
            key={conn.id}
            connection={conn}
            onEdit={() => setShowForm(conn.id)}
          />
        ))}

        {showForm && (
          <DockerConnectionForm
            {...(editingConnection ? { connection: editingConnection } : {})}
            onClose={() => setShowForm(null)}
          />
        )}

        {!connections?.length && !showForm && (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <Container className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No Docker connections configured.
            </p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => setShowForm('new')}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Docker Host
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function DockerConnectionRow({
  connection,
  onEdit,
}: {
  connection: DockerConnection;
  onEdit: () => void;
}) {
  const deleteMutation = useDeleteDockerConnection();
  const testMutation = useTestDockerConnection();
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  function handleTest() {
    setTestStatus('testing');
    testMutation.mutate(
      { id: connection.id },
      {
        onSuccess: (result) => {
          setTestStatus(result.success ? 'success' : 'error');
          if (result.success) {
            toast.success('Connection test passed');
          } else {
            toast.error(result.message ?? 'Connection test failed');
          }
        },
        onError: (err) => {
          setTestStatus('error');
          toast.error(err instanceof Error ? err.message : 'Connection test failed');
        },
      },
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <StatusDot status={testStatus} />
          <span className="text-sm font-medium">{connection.name}</span>
        </div>
        <p className="truncate text-xs text-muted-foreground">{connection.dockerUrl}</p>
        {connection.linkedWidgets > 0 && (
          <p className="text-[10px] text-muted-foreground">
            {connection.linkedWidgets} linked widget{connection.linkedWidgets !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      <div className="flex gap-1.5">
        <Button
          variant="outline"
          size="icon"
          className="h-11 w-11 sm:h-9 sm:w-9"
          onClick={handleTest}
          disabled={testMutation.isPending}
          title="Test"
          aria-label={`Test ${connection.name}`}
        >
          {testMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : testStatus === 'success' ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          ) : testStatus === 'error' ? (
            <XCircle className="h-3.5 w-3.5 text-red-500" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-11 w-11 sm:h-9 sm:w-9"
          onClick={onEdit}
          title="Edit"
          aria-label={`Edit ${connection.name}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11 sm:h-9 sm:w-9"
              disabled={deleteMutation.isPending}
              title="Remove"
              aria-label={`Remove ${connection.name}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Docker Connection</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove &ldquo;{connection.name}&rdquo; and unlink any associated widgets.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteMutation.mutate(connection.id)}>
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

// ─── Status dot helper ──────────────────────────────────────────────────────

function StatusDot({ status }: { status: 'idle' | 'testing' | 'success' | 'error' }) {
  const colors: Record<typeof status, string> = {
    idle: 'bg-muted-foreground/40',
    testing: 'bg-yellow-400 animate-pulse',
    success: 'bg-green-500',
    error: 'bg-red-500',
  };
  return <span className={`inline-block h-2 w-2 rounded-full ${colors[status]}`} />;
}

// ─── Photo Sources panel ────────────────────────────────────────────────────

interface PhotoSource {
  id: string;
  name: string;
  type: string;
  config: {
    path?: string | undefined;
    recursive?: boolean | undefined;
  };
  imageCount: number;
  lastScannedAt: string | null;
}

function usePhotoSources() {
  return useQuery<PhotoSource[]>({
    queryKey: ['admin', 'photoSources'],
    queryFn: async () => {
      const data = await apiClient.get<{ sources: PhotoSource[] }>('/api/admin/photos/sources');
      return data.sources;
    },
  });
}

function PhotoSourcesPanel() {
  const sourcesQuery = usePhotoSources();
  const { data: sources } = sourcesQuery;
  const [newName, setNewName] = useState('');
  const [newPath, setNewPath] = useState('');
  const [showBrowser, setShowBrowser] = useState(false);
  const [browsePath, setBrowsePath] = useState('');
  const [browseResult, setBrowseResult] = useState<{
    basePath: string;
    currentPath: string;
    directories: string[];
    imageCount: number;
  } | null>(null);
  const [browseLoading, setBrowseLoading] = useState(false);

  const browseFolder = useCallback(async (relativePath?: string) => {
    setBrowseLoading(true);
    try {
      const params = relativePath ? `?path=${encodeURIComponent(relativePath)}` : '';
      const data = await apiClient.get<{
        basePath: string;
        currentPath: string;
        directories: string[];
        imageCount: number;
      }>(`/api/admin/photos/browse${params}`);
      setBrowseResult(data);
      setBrowsePath(data.currentPath);
    } catch {
      toast.error('Failed to browse folders');
    } finally {
      setBrowseLoading(false);
    }
  }, []);

  const handleOpenBrowser = useCallback(() => {
    setShowBrowser(true);
    void browseFolder();
  }, [browseFolder]);

  const handleSelectFolder = useCallback((dir: string) => {
    const nextPath = browsePath === browseResult?.basePath
      ? dir
      : `${browsePath.replace(browseResult?.basePath ?? '', '').replace(/^\//, '')}/${dir}`;
    void browseFolder(nextPath);
  }, [browsePath, browseResult, browseFolder]);

  const handlePickCurrent = useCallback(() => {
    setNewPath(browsePath);
    setShowBrowser(false);
    setBrowseResult(null);
  }, [browsePath]);

  const handleBrowseUp = useCallback(() => {
    if (!browseResult || browsePath === browseResult.basePath) return;
    const relative = browsePath.replace(browseResult.basePath, '').replace(/^\//, '');
    const parent = relative.split('/').slice(0, -1).join('/');
    void browseFolder(parent || undefined);
  }, [browsePath, browseResult, browseFolder]);

  const addSource = useMutation({
    mutationFn: async (data: { name: string; type: string; config: { path: string; recursive: boolean } }) => {
      await apiClient.post('/api/admin/photos/sources', data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'photoSources'] });
      setNewName('');
      setNewPath('');
      toast.success('Photo source added');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to add source'),
  });

  const deleteSource = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/admin/photos/sources/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'photoSources'] });
      toast.success('Source removed');
    },
    onError: () => toast.error('Failed to remove source'),
  });

  const rescanSource = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.post(`/api/admin/photos/sources/${id}/scan`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'photoSources'] });
      toast.success('Source re-scanned');
    },
    onError: () => toast.error('Failed to re-scan source'),
  });

  const handleAddSource = useCallback(() => {
    if (!newName.trim() || !newPath.trim()) return;
    addSource.mutate({
      name: newName.trim(),
      type: 'folder',
      config: { path: newPath.trim(), recursive: true },
    });
  }, [newName, newPath, addSource]);

  if (sourcesQuery.isLoading) {
    return <SettingsLoadingState label="Loading photo sources…" />;
  }

  if (sourcesQuery.isError) {
    return (
      <SettingsErrorState
        message="Photo sources could not be loaded."
        onRetry={() => {
          void sourcesQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Photo Sources</h3>
        <p className="text-sm text-muted-foreground">
          Manage folders containing photos for the screensaver and photo frame widget.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Folder Sources</CardTitle>
          <CardDescription>
            Add server filesystem paths. Network/NAS shares work if mounted.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(sources ?? []).map((source) => (
            <div
              key={source.id}
              className="flex items-center gap-3 rounded-md border border-border/40 bg-muted/20 px-3 py-2"
            >
              <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{source.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {source.config.path} · {source.imageCount} images
                  {source.lastScannedAt && (
                    <> · Scanned {new Date(source.lastScannedAt).toLocaleDateString()}</>
                  )}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 sm:h-9 sm:w-9"
                onClick={() => rescanSource.mutate(source.id)}
                disabled={rescanSource.isPending}
                aria-label={`Re-scan ${source.name}`}
              >
                {rescanSource.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 sm:h-9 sm:w-9"
                onClick={() => deleteSource.mutate(source.id)}
                disabled={deleteSource.isPending}
                aria-label={`Delete ${source.name}`}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}

          {(sources ?? []).length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-6 text-center">
              <ImageIcon className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No photo sources configured.
              </p>
            </div>
          )}

          <div className="space-y-2 rounded-md border border-dashed border-border/60 p-3">
            <p className="text-sm font-medium">Add folder source</p>
            <p className="text-xs text-muted-foreground">
              Browse mounted folders or enter a path manually.
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              <Input
                placeholder="Name (e.g., Family Photos)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <div className="flex gap-2 sm:col-span-2">
                <Input
                  placeholder="Server path (e.g., /photos/family)"
                  value={newPath}
                  onChange={(e) => setNewPath(e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-11 w-11"
                  onClick={handleOpenBrowser}
                  title="Browse folders"
                  aria-label="Browse photo source folders"
                  type="button"
                >
                  <Folder className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Folder browser */}
            {showBrowser && (
              <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground truncate flex-1">
                    {browsePath}
                  </p>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={handleBrowseUp} disabled={browsePath === browseResult?.basePath}>
                      ↑ Up
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handlePickCurrent}>
                      Select this folder
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { setShowBrowser(false); setBrowseResult(null); }}>
                      ✕
                    </Button>
                  </div>
                </div>
                {browseLoading ? (
                  <div className="flex items-center gap-2 py-4 justify-center">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-xs text-muted-foreground">Loading…</span>
                  </div>
                ) : browseResult ? (
                  <div className="space-y-1">
                    {browseResult.imageCount > 0 && (
                      <p className="text-xs text-muted-foreground">{browseResult.imageCount} images in this folder</p>
                    )}
                    {browseResult.directories.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No subdirectories</p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 max-h-48 overflow-y-auto">
                        {browseResult.directories.map((dir) => (
                          <button
                            key={dir}
                            type="button"
                            className="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-left hover:bg-muted transition-colors"
                            onClick={() => handleSelectFolder(dir)}
                          >
                            <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate">{dir}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )}

            <Button
              size="sm"
              onClick={handleAddSource}
              disabled={!newName.trim() || !newPath.trim() || addSource.isPending}
            >
              {addSource.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="mr-1.5 h-3.5 w-3.5" />
              )}
              Add Source
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Connected Accounts panel ───────────────────────────────────────────────

function AccountsPanel() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Accounts</h3>
        <p className="text-sm text-muted-foreground">OAuth and service accounts for all integrations</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <ConnectedAccounts />
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Service panel renderer ─────────────────────────────────────────────────

function ServicePanel({ serviceId }: { serviceId: ServiceId }) {
  switch (serviceId) {
    case 'pihole': return <PiholePanel />;
    case 'spotify': return <SpotifyPanel />;
    case 'sonos': return <SonosPanel />;
    case 'photos': return <PhotoSourcesPanel />;
    case 'calendars': return <CalendarsPanel />;
    case 'todo': return <TodoPanel />;
    case 'docker': return <DockerPanel />;
    case 'accounts': return <AccountsPanel />;
  }
}

// ─── Main tab ───────────────────────────────────────────────────────────────

export function IntegrationsTab() {
  const [activeService, setActiveService] = useState<ServiceId>('docker');

  return (
    <div className="flex flex-col md:flex-row gap-4 md:gap-6 md:min-h-[480px]">
      <MobileSectionSelect
        label="Integration"
        value={activeService}
        options={serviceItems.map((item) => ({ value: item.id, label: item.label }))}
        onValueChange={setActiveService}
      />

      {/* Service nav — desktop */}
      <nav className="hidden shrink-0 md:block md:w-44 md:border-r md:border-border md:pr-4" aria-label="Integration sections">
        <div className="flex flex-col gap-4">
          {serviceGroups.map((group) => (
            <div key={group.label} className="flex flex-col gap-0.5 shrink-0">
              <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                {group.label}
              </p>
              {group.items.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setActiveService(item.id)}
                  className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                    activeService === item.id
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </nav>

      {/* Right content panel */}
      <div className="min-w-0 flex-1">
        <ServicePanel serviceId={activeService} />
      </div>
    </div>
  );
}
