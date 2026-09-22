/**
 * Groups & Access settings tab — Group/RBAC management.
 * Admin-only. Absorbs the former /admin/groups page.
 */

import { useState } from 'react';
import { Plus, Pencil, Trash2, Users, Shield, ShieldCheck } from 'lucide-react';
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
import {
  useGroups,
  useCreateGroup,
  useUpdateGroup,
  useDeleteGroup,
  useGroupMembers,
  useAddGroupMember,
  useRemoveGroupMember,
  type GroupSummary,
  type PermissionEntry,
} from '../../state/rbac.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { SettingsErrorState, SettingsLoadingState } from './SettingsDataState.js';
import { useAdminUsers, type AdminUser } from '../../state/users.js';

// ─── Permission grid constants ───────────────────────────────────────────────

const CATEGORIES = [
  { slug: 'dashboards', label: 'Dashboards' },
  { slug: 'widgets', label: 'Widgets' },
  { slug: 'settings', label: 'Settings' },
  { slug: 'users', label: 'Users' },
  { slug: 'integrations', label: 'Integrations' },
] as const;

const LEVELS = ['view', 'manage'] as const;

function permSummary(perms: PermissionEntry[]): string {
  if (perms.length === 0) return 'No permissions';
  return perms.map((p) => `${p.category}:${p.level}`).join(', ');
}

export function filterEligibleGroupUsers(
  users: AdminUser[],
  memberIds: string[],
  query: string,
): AdminUser[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const existingMembers = new Set(memberIds);
  return users.filter((user) => {
    if (existingMembers.has(user.id)) return false;
    if (!normalizedQuery) return true;
    return `${user.displayName} ${user.username}`.toLocaleLowerCase().includes(normalizedQuery);
  });
}

// ─── Permission Grid ─────────────────────────────────────────────────────────

function PermissionGrid({
  permissions,
  onChange,
  disabled,
}: {
  permissions: PermissionEntry[];
  onChange: (perms: PermissionEntry[]) => void;
  disabled?: boolean;
}) {
  const hasLevel = (cat: string, lvl: string) =>
    permissions.some((p) => p.category === cat && p.level === lvl);

  const toggle = (cat: string, lvl: string) => {
    if (disabled) return;
    const has = hasLevel(cat, lvl);
    let next: PermissionEntry[];
    if (has) {
      next = permissions.filter((p) => !(p.category === cat && p.level === lvl));
    } else {
      next = permissions.filter((p) => p.category !== cat);
      if (lvl === 'manage') {
        next.push({ category: cat, level: 'manage' });
      } else {
        next.push({ category: cat, level: 'view' });
      }
    }
    onChange(next);
  };

  return (
    <div className="rounded border">
      <div className="grid grid-cols-3 gap-0 text-xs font-medium bg-muted px-3 py-2">
        <span>Category</span>
        <span className="text-center">View</span>
        <span className="text-center">Manage</span>
      </div>
      {CATEGORIES.map((cat) => (
        <div key={cat.slug} className="grid grid-cols-3 gap-0 px-3 py-1.5 border-t items-center text-sm">
          <span>{cat.label}</span>
          {LEVELS.map((lvl) => (
            <div key={lvl} className="flex justify-center">
              <input
                type="checkbox"
                checked={hasLevel(cat.slug, lvl)}
                onChange={() => toggle(cat.slug, lvl)}
                disabled={disabled}
                aria-label={`${cat.label} ${lvl} permission`}
                className="h-4 w-4 rounded"
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Group Form Dialog ───────────────────────────────────────────────────────

function GroupFormDialog({
  open,
  group,
  onClose,
}: {
  open: boolean;
  group: GroupSummary | null;
  onClose: () => void;
}) {
  const isEdit = !!group;
  const createMut = useCreateGroup();
  const updateMut = useUpdateGroup();

  const [name, setName] = useState(group?.name ?? '');
  const [description, setDescription] = useState(group?.description ?? '');
  const [permissions, setPermissions] = useState<PermissionEntry[]>(
    group?.permissions ?? [],
  );

  const isAdminGroup = group?.slug === 'administrators';

  const handleSubmit = () => {
    if (isEdit && group) {
      updateMut.mutate(
        {
          groupId: group.id,
          ...(name !== group.name ? { name } : {}),
          ...(description !== (group.description ?? '') ? { description: description || null } : {}),
          ...(!isAdminGroup ? { permissions } : {}),
        },
        { onSuccess: onClose },
      );
    } else {
      createMut.mutate(
        { name, ...(description ? { description } : {}), permissions },
        { onSuccess: onClose },
      );
    }
  };

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Group' : 'Create Group'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update group settings and permissions.' : 'Create a new user group with permissions.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="group-name">Name</Label>
            <Input
              id="group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Power Users"
              maxLength={50}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="group-desc">Description</Label>
            <Input
              id="group-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label>Permissions</Label>
            <PermissionGrid
              permissions={permissions}
              onChange={setPermissions}
              disabled={isAdminGroup}
            />
            {isAdminGroup && (
              <p className="text-xs text-muted-foreground">
                Administrators group always has full access.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !name.trim()}>
            {isEdit ? 'Save' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Members Dialog ──────────────────────────────────────────────────────────

function MembersDialog({
  open,
  group,
  onClose,
}: {
  open: boolean;
  group: GroupSummary | null;
  onClose: () => void;
}) {
  const membersQuery = useGroupMembers(group?.id ?? '');
  const { data: members } = membersQuery;
  const usersQuery = useAdminUsers();
  const removeMut = useRemoveGroupMember();
  const addMut = useAddGroupMember();
  const [userQuery, setUserQuery] = useState('');

  const isAdmin = group?.slug === 'administrators';
  const eligibleUsers = filterEligibleGroupUsers(
    usersQuery.data ?? [],
    members?.map((member) => member.userId) ?? [],
    userQuery,
  );

  const handleAdd = (userId: string) => {
    if (!group) return;
    addMut.mutate({ groupId: group.id, userId }, {
      onSuccess: () => setUserQuery(''),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Members — {group?.name}</DialogTitle>
          <DialogDescription>
            Manage group membership. {members?.length ?? 0} member(s).
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-64 space-y-3 overflow-y-auto py-2">
          {membersQuery.isLoading ? (
            <SettingsLoadingState label="Loading group members…" />
          ) : membersQuery.isError ? (
            <SettingsErrorState
              message="Group members could not be loaded."
              onRetry={() => {
                void membersQuery.refetch();
              }}
            />
          ) : members?.map((m) => (
            <div
              key={m.userId}
              className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted/50"
            >
              <div>
                <span className="text-sm font-medium">{m.displayName}</span>
                <span className="text-xs text-muted-foreground ml-2">@{m.username}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => group && removeMut.mutate({ groupId: group.id, userId: m.userId })}
                disabled={removeMut.isPending || (isAdmin && members != null && members.length <= 1)}
                title={isAdmin && members != null && members.length <= 1 ? 'Cannot remove last admin' : 'Remove'}
                aria-label={`Remove ${m.displayName} from ${group?.name ?? 'group'}`}
                className="min-h-11 min-w-11"
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
          {!membersQuery.isLoading && !membersQuery.isError && members?.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No members yet.</p>
          )}
        </div>

        <div className="space-y-2 border-t pt-3">
          <Label htmlFor="group-member-search">Add member</Label>
          <Input
            id="group-member-search"
            type="search"
            placeholder="Search by name or username"
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
          />
          {usersQuery.isLoading ? (
            <p className="py-2 text-sm text-muted-foreground" role="status">
              Loading users…
            </p>
          ) : usersQuery.isError ? (
            <SettingsErrorState
              message="Eligible users could not be loaded."
              onRetry={() => {
                void usersQuery.refetch();
              }}
            />
          ) : (
            <div
              className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-1"
              aria-label="Eligible users"
            >
              {eligibleUsers.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  className="flex min-h-11 w-full items-center justify-between rounded px-3 py-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => handleAdd(user.id)}
                  disabled={addMut.isPending}
                >
                  <span className="text-sm font-medium">{user.displayName}</span>
                  <span className="text-xs text-muted-foreground">@{user.username}</span>
                </button>
              ))}
              {eligibleUsers.length === 0 && (
                <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                  {userQuery ? 'No matching users.' : 'No eligible users.'}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Tab ────────────────────────────────────────────────────────────────

export function GroupsTab() {
  const groupsQuery = useGroups();
  const { data: groupsList, isLoading } = groupsQuery;
  const deleteMut = useDeleteGroup();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('users', 'manage');

  const [formOpen, setFormOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<GroupSummary | null>(null);
  const [membersGroup, setMembersGroup] = useState<GroupSummary | null>(null);
  const [deleteGroupState, setDeleteGroupState] = useState<GroupSummary | null>(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Groups &amp; Access</h2>
          <p className="text-sm text-muted-foreground">
            Manage user groups and their permissions.
          </p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => { setEditGroup(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> New Group
          </Button>
        )}
      </div>

      {/* Group list */}
      {isLoading ? (
        <SettingsLoadingState label="Loading groups…" />
      ) : groupsQuery.isError ? (
        <SettingsErrorState
          message="Groups could not be loaded."
          onRetry={() => {
            void groupsQuery.refetch();
          }}
        />
      ) : (
        <div className="grid gap-4">
          {groupsList?.map((g) => (
            <Card key={g.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                  {g.isBuiltIn ? (
                    <ShieldCheck className="h-5 w-5 text-primary" />
                  ) : (
                    <Shield className="h-5 w-5 text-muted-foreground" />
                  )}
                  <CardTitle className="text-base">{g.name}</CardTitle>
                  {g.isBuiltIn && <Badge variant="secondary">Built-in</Badge>}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 sm:h-9 sm:w-9"
                    onClick={() => setMembersGroup(g)}
                    title="Manage members"
                    aria-label={`Manage members of ${g.name}`}
                  >
                    <Users className="h-4 w-4" />
                    <span className="ml-1 text-xs">{g.memberCount}</span>
                  </Button>
                  {canManage && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 sm:h-9 sm:w-9"
                        onClick={() => { setEditGroup(g); setFormOpen(true); }}
                        title="Edit group"
                        aria-label={`Edit ${g.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {!g.isBuiltIn && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-11 w-11 sm:h-9 sm:w-9"
                          onClick={() => setDeleteGroupState(g)}
                          title="Delete group"
                          aria-label={`Delete ${g.name}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {g.description && (
                  <p className="text-sm text-muted-foreground mb-2">{g.description}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {permSummary(g.permissions)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialogs */}
      <GroupFormDialog
        key={editGroup?.id ?? 'new'}
        open={formOpen}
        group={editGroup}
        onClose={() => { setFormOpen(false); setEditGroup(null); }}
      />
      <MembersDialog
        open={!!membersGroup}
        group={membersGroup}
        onClose={() => setMembersGroup(null)}
      />
      <Dialog open={!!deleteGroupState} onOpenChange={(v) => { if (!v) setDeleteGroupState(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Group</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteGroupState?.name}&quot;? This will remove all members
              from this group. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteGroupState(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteGroupState) {
                  deleteMut.mutate(deleteGroupState.id, {
                    onSuccess: () => setDeleteGroupState(null),
                  });
                }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
