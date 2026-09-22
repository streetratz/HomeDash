/**
 * T026-T031 (012-RBAC): Frontend state hooks for RBAC group management.
 * TanStack Query wrappers for group CRUD and membership operations.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient.js';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PermissionEntry {
  category: string;
  level: string;
}

export interface GroupSummary {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  isBuiltIn: boolean;
  createdAt: string;
  updatedAt: string;
  permissions: PermissionEntry[];
  memberCount: number;
}

export interface GroupMember {
  userId: string;
  username: string;
  displayName: string;
  joinedAt: string;
}

export interface UserGroup {
  groupId: string;
  groupName: string;
  groupSlug: string | null;
  isBuiltIn: boolean;
}

// ─── Query keys ──────────────────────────────────────────────────────────────

export const rbacKeys = {
  groups: ['rbac-groups'] as const,
  group: (id: string) => ['rbac-group', id] as const,
  groupMembers: (id: string) => ['rbac-group-members', id] as const,
  userGroups: (userId: string) => ['rbac-user-groups', userId] as const,
};

// ─── Group queries ───────────────────────────────────────────────────────────

export function useGroups() {
  return useQuery({
    queryKey: rbacKeys.groups,
    queryFn: () => apiClient.get<{ groups: GroupSummary[] }>('/api/admin/groups'),
    select: (data) => data.groups,
  });
}

export function useGroup(groupId: string) {
  return useQuery({
    queryKey: rbacKeys.group(groupId),
    queryFn: () => apiClient.get<{ group: GroupSummary }>(`/api/admin/groups/${groupId}`),
    select: (data) => data.group,
    enabled: !!groupId,
  });
}

// ─── Group mutations ─────────────────────────────────────────────────────────

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; description?: string; permissions?: PermissionEntry[] }) =>
      apiClient.post<{ group: GroupSummary }>('/api/admin/groups', input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: rbacKeys.groups });
      toast.success('Group created');
    },
    onError: () => toast.error('Failed to create group'),
  });
}

export function useUpdateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      groupId,
      ...input
    }: {
      groupId: string;
      name?: string;
      description?: string | null;
      permissions?: PermissionEntry[];
    }) => apiClient.patch<{ group: GroupSummary }>(`/api/admin/groups/${groupId}`, input),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: rbacKeys.groups });
      void qc.invalidateQueries({ queryKey: rbacKeys.group(vars.groupId) });
      toast.success('Group updated');
    },
    onError: () => toast.error('Failed to update group'),
  });
}

export function useDeleteGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) =>
      apiClient.delete(`/api/admin/groups/${groupId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: rbacKeys.groups });
      toast.success('Group deleted');
    },
    onError: () => toast.error('Failed to delete group'),
  });
}

// ─── Membership queries ──────────────────────────────────────────────────────

export function useGroupMembers(groupId: string) {
  return useQuery({
    queryKey: rbacKeys.groupMembers(groupId),
    queryFn: () =>
      apiClient.get<{ members: GroupMember[] }>(`/api/admin/groups/${groupId}/members`),
    select: (data) => data.members,
    enabled: !!groupId,
  });
}

export function useUserGroups(userId: string) {
  return useQuery({
    queryKey: rbacKeys.userGroups(userId),
    queryFn: () =>
      apiClient.get<{ groups: UserGroup[] }>(`/api/admin/users/${userId}/groups`),
    select: (data) => data.groups,
    enabled: !!userId,
  });
}

// ─── Membership mutations ────────────────────────────────────────────────────

export function useAddGroupMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) =>
      apiClient.post(`/api/admin/groups/${groupId}/members`, { userId }),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: rbacKeys.groupMembers(vars.groupId) });
      void qc.invalidateQueries({ queryKey: rbacKeys.groups });
      toast.success('Member added');
    },
    onError: () => toast.error('Failed to add member'),
  });
}

export function useRemoveGroupMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) =>
      apiClient.delete(`/api/admin/groups/${groupId}/members/${userId}`),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: rbacKeys.groupMembers(vars.groupId) });
      void qc.invalidateQueries({ queryKey: rbacKeys.groups });
      toast.success('Member removed');
    },
    onError: () => toast.error('Failed to remove member'),
  });
}
