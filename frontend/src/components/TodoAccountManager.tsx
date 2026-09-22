/**
 * T024 (005): TodoAccountManager — Connected todo provider accounts with sync controls.
 *
 * Shows Microsoft accounts (from oauth_accounts with Tasks scope), allows
 * connecting new accounts and triggering sync. CalDAV section deferred.
 */

import { useState } from 'react';
import { RefreshCw, Unplug, Plug } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button.js';
import { Badge } from './ui/badge.js';
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
} from './ui/alert-dialog.js';
import {
  useOAuthAccounts,
  useOAuthProviders,
  useDeleteOAuthAccount,
} from '../state/calendarHooks.js';
import { useSyncMicrosoftTodo, useMicrosoftTodoLists } from '../state/todoHooks.js';

export function TodoAccountManager() {
  const accountsQuery = useOAuthAccounts();
  const providersQuery = useOAuthProviders();
  const deleteMutation = useDeleteOAuthAccount();
  const syncMutation = useSyncMicrosoftTodo();
  const microsoftListsQuery = useMicrosoftTodoLists();

  const accounts = accountsQuery.data ?? [];
  const providers = providersQuery.data;
  const microsoftAccounts = accounts.filter((a) => a.provider === 'microsoft');

  const [syncingId, setSyncingId] = useState<string | null>(null);

  function handleDisconnect(id: string) {
    deleteMutation.mutate(id, {
      onSuccess: () => toast.success('Account disconnected'),
      onError: (err) =>
        toast.error(`Failed to disconnect: ${err instanceof Error ? err.message : 'Unknown error'}`),
    });
  }

  function handleSync() {
    setSyncingId('microsoft');
    syncMutation.mutate(undefined, {
      onSuccess: (result) => {
        const msg = `Synced ${result.listsCreated + result.listsUpdated} lists, ${result.itemsCreated + result.itemsUpdated} items`;
        toast.success(msg);
        setSyncingId(null);
      },
      onError: (err) => {
        toast.error(`Sync failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setSyncingId(null);
      },
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Todo Accounts</h3>
      </div>

      {/* Microsoft accounts */}
      {microsoftAccounts.length > 0 ? (
        <div className="space-y-2">
          {microsoftAccounts.map((account) => (
            <div
              key={account.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <MicrosoftIcon className="h-4 w-4 shrink-0" />
                  <span className="text-sm font-medium">Microsoft To Do</span>
                  {account.status === 'active' ? (
                    <Badge variant="success" className="text-[10px]">Active</Badge>
                  ) : (
                    <Badge variant="danger" className="text-[10px]">Error</Badge>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {account.email ?? account.displayName ?? 'Unknown'}
                </p>
                {microsoftListsQuery.data && (
                  <p className="text-[10px] text-muted-foreground">
                    {microsoftListsQuery.data.lists.length} task list(s)
                  </p>
                )}
              </div>

              <div className="flex gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSync}
                  disabled={syncingId === 'microsoft'}
                  title="Sync now"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${syncingId === 'microsoft' ? 'animate-spin' : ''}`} />
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" disabled={deleteMutation.isPending} title="Disconnect">
                      <Unplug className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Disconnect Microsoft To Do</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove the account and all synced todo lists/items. This action cannot be undone.
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
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No todo providers connected.
        </p>
      )}

      {/* Connect buttons */}
      <div className="flex flex-wrap gap-2">
        {providers?.microsoft && microsoftAccounts.length === 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              window.location.href = '/api/auth/oauth/microsoft';
            }}
          >
            <Plug className="mr-1.5 h-3.5 w-3.5" />
            Connect Microsoft To Do
          </Button>
        )}
      </div>
    </div>
  );
}

// Simple Microsoft icon SVG
function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 21 21" className={className} aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}
