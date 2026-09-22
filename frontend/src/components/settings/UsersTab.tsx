/**
 * Admin Users settings tab — User management.
 * Admin-only. List, create, edit, delete users, and reset passwords.
 */

import { useState } from 'react';
import { Plus, Pencil, Trash2, KeyRound, Shield, User } from 'lucide-react';
import { Button } from '../ui/button.js';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card.js';
import { Badge } from '../ui/badge.js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '../ui/dialog.js';
import { Input } from '../ui/input.js';
import { Label } from '../ui/label.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select.js';
import {
  useAdminUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useResetUserPassword,
  type AdminUser,
} from '../../state/users.js';
import { useGroups, type GroupSummary } from '../../state/rbac.js';
import { useBootstrap } from '../../state/bootstrap.js';
import { ApiRequestError } from '../../lib/apiClient.js';
import { SettingsErrorState, SettingsLoadingState } from './SettingsDataState.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'Never';
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// ─── Create User Dialog ──────────────────────────────────────────────────────

function CreateUserDialog({
  open,
  onClose,
  groups,
}: {
  open: boolean;
  onClose: () => void;
  groups: GroupSummary[];
}) {
  const createMut = useCreateUser();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'standard'>('standard');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setUsername('');
    setDisplayName('');
    setPassword('');
    setRole('standard');
    setSelectedGroupIds([]);
    setError(null);
    onClose();
  };

  const handleSubmit = () => {
    setError(null);
    if (!username.trim() || !displayName.trim() || !password) {
      setError('All fields are required.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    createMut.mutate(
      {
        username: username.trim(),
        displayName: displayName.trim(),
        password,
        role,
        ...(selectedGroupIds.length > 0 ? { groupIds: selectedGroupIds } : {}),
      },
      {
        onSuccess: () => {
          handleClose();
        },
        onError: (err) => {
          if (err instanceof ApiRequestError && err.status === 409) {
            setError('Username is already taken.');
          } else {
            setError('Failed to create user.');
          }
        },
      },
    );
  };

  const toggleGroup = (groupId: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId],
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create User</DialogTitle>
          <DialogDescription>Create a new user account.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="create-username">Username</Label>
            <Input
              id="create-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. jdoe"
              maxLength={32}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-displayname">Display Name</Label>
            <Input
              id="create-displayname"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. John Doe"
              maxLength={64}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-password">Password</Label>
            <Input
              id="create-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-role">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as 'admin' | 'standard')}>
              <SelectTrigger id="create-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {groups.length > 0 && (
            <div className="space-y-2">
              <Label>Groups</Label>
              <div className="rounded border p-2 space-y-1 max-h-32 overflow-y-auto">
                {groups.map((g) => (
                  <label key={g.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedGroupIds.includes(g.id)}
                      onChange={() => toggleGroup(g.id)}
                      className="h-4 w-4 rounded"
                    />
                    {g.name}
                  </label>
                ))}
              </div>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={createMut.isPending}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={createMut.isPending}>
            {createMut.isPending ? 'Creating…' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit User Dialog ────────────────────────────────────────────────────────

function EditUserDialog({
  open,
  user,
  onClose,
  groups,
}: {
  open: boolean;
  user: AdminUser | null;
  onClose: () => void;
  groups: GroupSummary[];
}) {
  const updateMut = useUpdateUser();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [role, setRole] = useState<'admin' | 'standard'>(user?.role ?? 'standard');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(
    user?.groups.map((g) => g.id) ?? [],
  );
  const [error, setError] = useState<string | null>(null);

  // Reset form when user changes
  const userKey = user?.id ?? '';

  const handleClose = () => {
    setDisplayName(user?.displayName ?? '');
    setRole(user?.role ?? 'standard');
    setSelectedGroupIds(user?.groups.map((group) => group.id) ?? []);
    setError(null);
    onClose();
  };

  const handleSubmit = () => {
    if (!user) return;
    setError(null);
    updateMut.mutate(
      {
        userId: user.id,
        ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
        role,
        groupIds: selectedGroupIds,
      },
      {
        onSuccess: () => {
          handleClose();
        },
        onError: (err) => {
          if (err instanceof ApiRequestError && err.status === 409) {
            setError(err.body.message);
          } else {
            setError('Failed to update user.');
          }
        },
      },
    );
  };

  const toggleGroup = (groupId: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId],
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>Update user details and group assignments.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor={`edit-username-${userKey}`}>Username</Label>
            <Input id={`edit-username-${userKey}`} value={user?.username ?? ''} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`edit-displayname-${userKey}`}>Display Name</Label>
            <Input
              id={`edit-displayname-${userKey}`}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={64}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`edit-role-${userKey}`}>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as 'admin' | 'standard')}>
              <SelectTrigger id={`edit-role-${userKey}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {groups.length > 0 && (
            <div className="space-y-2">
              <Label>Groups</Label>
              <div className="rounded border p-2 space-y-1 max-h-32 overflow-y-auto">
                {groups.map((g) => (
                  <label key={g.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedGroupIds.includes(g.id)}
                      onChange={() => toggleGroup(g.id)}
                      className="h-4 w-4 rounded"
                    />
                    {g.name}
                  </label>
                ))}
              </div>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={updateMut.isPending}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={updateMut.isPending}>
            {updateMut.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Reset Password Dialog ───────────────────────────────────────────────────

function ResetPasswordDialog({
  open,
  user,
  onClose,
}: {
  open: boolean;
  user: AdminUser | null;
  onClose: () => void;
}) {
  const resetMut = useResetUserPassword();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setPassword('');
    setConfirmPassword('');
    setError(null);
    onClose();
  };

  const handleSubmit = () => {
    if (!user) return;
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    resetMut.mutate(
      { userId: user.id, password },
      {
        onSuccess: () => {
          handleClose();
        },
        onError: () => setError('Failed to reset password.'),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>
            Reset password for <strong>{user?.username}</strong>. All their sessions will be invalidated.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="reset-password">New Password</Label>
            <Input
              id="reset-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reset-confirm">Confirm New Password</Label>
            <Input
              id="reset-confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={resetMut.isPending}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={resetMut.isPending}>
            {resetMut.isPending ? 'Resetting…' : 'Reset Password'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete User Dialog ──────────────────────────────────────────────────────

function DeleteUserDialog({
  open,
  user,
  onClose,
  currentUserId,
}: {
  open: boolean;
  user: AdminUser | null;
  onClose: () => void;
  currentUserId: string;
}) {
  const deleteMut = useDeleteUser();
  const [error, setError] = useState<string | null>(null);
  const isSelf = user?.id === currentUserId;

  const handleClose = () => {
    setError(null);
    onClose();
  };

  const handleDelete = () => {
    if (!user) return;
    setError(null);
    deleteMut.mutate(user.id, {
      onSuccess: () => {
        handleClose();
      },
      onError: (err) => {
        if (err instanceof ApiRequestError && err.status === 409) {
          setError(err.body.message);
        } else {
          setError('Failed to delete user.');
        }
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete User</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <strong>{user?.displayName}</strong> (@{user?.username})?
            This action cannot be undone. All their sessions and data will be removed.
          </DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={deleteMut.isPending}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteMut.isPending || isSelf}
            title={isSelf ? 'Cannot delete your own account' : undefined}
          >
            {deleteMut.isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Tab ────────────────────────────────────────────────────────────────

export function UsersTab() {
  const usersQuery = useAdminUsers();
  const { data: usersList, isLoading } = usersQuery;
  const groupsQuery = useGroups();
  const { data: groupsList } = groupsQuery;
  const { user: currentUser } = useBootstrap();
  const groups = groupsList ?? [];

  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [resetUser, setResetUser] = useState<AdminUser | null>(null);
  const [deleteUser, setDeleteUserState] = useState<AdminUser | null>(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Users</h2>
          <p className="text-sm text-muted-foreground">
            Manage user accounts, roles, and group assignments.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Create User
        </Button>
      </div>

      {/* User list */}
      {isLoading || groupsQuery.isLoading ? (
        <SettingsLoadingState label="Loading users…" />
      ) : usersQuery.isError || groupsQuery.isError ? (
        <SettingsErrorState
          message="Users and group assignments could not be loaded."
          onRetry={() => {
            void usersQuery.refetch();
            void groupsQuery.refetch();
          }}
        />
      ) : (
        <div className="grid gap-4">
          {usersList?.map((u) => (
            <Card key={u.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                  {u.role === 'admin' ? (
                    <Shield className="h-5 w-5 text-primary" />
                  ) : (
                    <User className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <CardTitle className="text-base">{u.displayName}</CardTitle>
                    <span className="text-xs text-muted-foreground">@{u.username}</span>
                  </div>
                  <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
                    {u.role}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 sm:h-9 sm:w-9"
                    onClick={() => setEditUser(u)}
                    title="Edit user"
                    aria-label={`Edit ${u.displayName}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 sm:h-9 sm:w-9"
                    onClick={() => setResetUser(u)}
                    title="Reset password"
                    aria-label={`Reset password for ${u.displayName}`}
                  >
                    <KeyRound className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 sm:h-9 sm:w-9"
                    onClick={() => setDeleteUserState(u)}
                    title="Delete user"
                    aria-label={`Delete ${u.displayName}`}
                    disabled={u.id === currentUser?.id}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {u.groups.length > 0 && (
                    <span>Groups: {u.groups.map((g) => g.name).join(', ')}</span>
                  )}
                  <span>Last login: {formatRelativeTime(u.lastLoginAt)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialogs */}
      <CreateUserDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        groups={groups}
      />
      <EditUserDialog
        key={editUser?.id ?? 'none'}
        open={!!editUser}
        user={editUser}
        onClose={() => setEditUser(null)}
        groups={groups}
      />
      <ResetPasswordDialog
        open={!!resetUser}
        user={resetUser}
        onClose={() => setResetUser(null)}
      />
      <DeleteUserDialog
        open={!!deleteUser}
        user={deleteUser}
        onClose={() => setDeleteUserState(null)}
        currentUserId={currentUser?.id ?? ''}
      />
    </div>
  );
}
