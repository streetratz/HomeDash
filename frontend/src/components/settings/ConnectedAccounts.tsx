/**
 * Connected accounts management.
 *
 * Lists all OAuth/service accounts with connect/disconnect actions.
 */

import { toast } from 'sonner';
import { Button } from '../ui/button.js';
import { Badge } from '../ui/badge.js';
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
import {
  useOAuthAccounts,
  useOAuthProviders,
  useDeleteOAuthAccount,
} from '../../state/calendarHooks.js';
import { SettingsErrorState, SettingsLoadingState } from './SettingsDataState.js';

const PROVIDER_LABELS: Record<string, string> = {
  microsoft: 'Microsoft',
  google: 'Google',
  spotify: 'Spotify',
  sonos: 'Sonos',
};

const PROVIDER_DESCRIPTIONS: Record<string, string> = {
  microsoft: 'Calendar sync & events',
  google: 'Calendar sync & events',
  spotify: 'Now playing & playback control',
  sonos: 'Multi-room audio control',
};

const PROVIDER_SETUP_HINTS: Record<string, string> = {
  microsoft: 'Not configured — requires server environment variables',
  google: 'Not configured — requires server environment variables',
  spotify: 'Not configured — set up credentials in the Spotify panel',
  sonos: 'Not configured — set up credentials in the Sonos panel',
};

const PROVIDER_CONNECT_URLS: Record<string, string> = {
  microsoft: '/api/auth/oauth/microsoft',
  google: '/api/auth/oauth/google',
  spotify: '/api/spotify/login',
  sonos: '/api/sonos/login',
};

export function ConnectedAccounts() {
  const accountsQuery = useOAuthAccounts();
  const providersQuery = useOAuthProviders();
  const deleteMutation = useDeleteOAuthAccount();

  const accounts = accountsQuery.data ?? [];
  const providers = providersQuery.data;
  const connectedProviders = new Set<string>(accounts.map((a) => a.provider));

  if (accountsQuery.isLoading || providersQuery.isLoading) {
    return <SettingsLoadingState label="Loading connected accounts…" />;
  }

  if (accountsQuery.isError || providersQuery.isError) {
    return (
      <SettingsErrorState
        message="Connected accounts could not be loaded."
        onRetry={() => {
          void accountsQuery.refetch();
          void providersQuery.refetch();
        }}
      />
    );
  }

  function handleDisconnect(id: string) {
    deleteMutation.mutate(id, {
      onSuccess: () => toast.success('Account disconnected'),
      onError: (err) =>
        toast.error(`Failed to disconnect: ${err instanceof Error ? err.message : 'Unknown error'}`),
    });
  }

  // All known providers — always show them regardless of server config
  const ALL_PROVIDERS = ['microsoft', 'google', 'spotify', 'sonos'] as const;

  // Providers not yet connected
  const unconnectedProviders = ALL_PROVIDERS.filter((p) => !connectedProviders.has(p));

  return (
    <div className="flex flex-col gap-3">
      {accounts.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No accounts connected yet. Use the buttons below to connect a service.
        </p>
      )}

      {accounts.map((account) => (
        <div
          key={account.id}
          className="flex items-center justify-between gap-3 rounded-md border border-border p-3"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {PROVIDER_LABELS[account.provider] ?? account.provider}
              </span>
              {account.status === 'active' ? (
                <Badge variant="success" className="text-[10px]">Active</Badge>
              ) : (
                <Badge variant="danger" className="text-[10px]">Error</Badge>
              )}
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {account.email ?? account.displayName ?? PROVIDER_DESCRIPTIONS[account.provider] ?? ''}
            </p>
            {account.status === 'error' && account.lastError && (
              <p className="mt-0.5 truncate text-xs text-destructive">{account.lastError}</p>
            )}
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={deleteMutation.isPending}>
                Disconnect
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Disconnect {PROVIDER_LABELS[account.provider] ?? account.provider}</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove the account connection. You can reconnect later.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleDisconnect(account.id)}>
                  Disconnect
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ))}

      {/* Unconnected providers — show connect or not-configured status */}
      {unconnectedProviders.length > 0 && (
        <div className="flex flex-col gap-2 pt-1">
          {unconnectedProviders.map((provider) => {
            const isConfigured = providers?.[provider] ?? false;
            return (
              <div
                key={provider}
                className="flex items-center justify-between gap-3 rounded-md border border-dashed border-border p-3"
              >
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium">
                    {PROVIDER_LABELS[provider] ?? provider}
                  </span>
                  <p className="text-xs text-muted-foreground">
                    {isConfigured
                      ? PROVIDER_DESCRIPTIONS[provider] ?? ''
                      : PROVIDER_SETUP_HINTS[provider] ?? 'Not configured'}
                  </p>
                </div>
                {isConfigured ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      window.location.href = PROVIDER_CONNECT_URLS[provider] ?? '#';
                    }}
                  >
                    Connect
                  </Button>
                ) : (
                  <Badge variant="secondary" className="text-[10px] whitespace-nowrap">Not configured</Badge>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
