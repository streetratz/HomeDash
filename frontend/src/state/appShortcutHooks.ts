/**
 * 013-app-shortcuts: TanStack Query hooks for shortcut and group CRUD.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient.js';
import type { ShortcutView, GroupView, ShortcutListResponse } from './dashboards.js';

// ── Query keys ────────────────────────────────────────────────────────────────

export const appShortcutKeys = {
  shortcuts: (widgetId: string) => ['app-shortcuts', widgetId] as const,
  groups: (widgetId: string) => ['app-shortcut-groups', widgetId] as const,
  all: ['app-shortcuts'] as const,
};

// ── Queries ───────────────────────────────────────────────────────────────────

export function useShortcuts(widgetId: string) {
  return useQuery({
    queryKey: appShortcutKeys.shortcuts(widgetId),
    queryFn: () =>
      apiClient.get<ShortcutListResponse>(
        `/api/app-shortcuts/${widgetId}/shortcuts`,
      ),
    enabled: !!widgetId,
  });
}

// ── Shortcut mutations ────────────────────────────────────────────────────────

export function useCreateShortcut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      widgetId,
      ...data
    }: {
      widgetId: string;
      name: string;
      url: string;
      groupId?: string | null;
      pingEnabled?: boolean;
      iconKey?: string | null;
    }) =>
      apiClient.post<ShortcutView>(
        `/api/admin/app-shortcuts/${widgetId}/shortcuts`,
        data,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: appShortcutKeys.all });
    },
  });
}

export function useUpdateShortcut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      widgetId,
      shortcutId,
      ...data
    }: {
      widgetId: string;
      shortcutId: string;
      name?: string;
      url?: string;
      groupId?: string | null;
      pingEnabled?: boolean;
      iconKey?: string | null;
    }) =>
      apiClient.put<ShortcutView>(
        `/api/admin/app-shortcuts/${widgetId}/shortcuts/${shortcutId}`,
        data,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: appShortcutKeys.all });
    },
  });
}

export function useDeleteShortcut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ widgetId, shortcutId }: { widgetId: string; shortcutId: string }) =>
      apiClient.delete(`/api/admin/app-shortcuts/${widgetId}/shortcuts/${shortcutId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: appShortcutKeys.all });
    },
  });
}

export function useReorderShortcuts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ widgetId, orderedIds }: { widgetId: string; orderedIds: string[] }) =>
      apiClient.post<ShortcutListResponse>(
        `/api/admin/app-shortcuts/${widgetId}/shortcuts/reorder`,
        { orderedIds },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: appShortcutKeys.all });
    },
  });
}

// ── Group mutations ───────────────────────────────────────────────────────────

export function useGroups(widgetId: string) {
  return useQuery({
    queryKey: appShortcutKeys.groups(widgetId),
    queryFn: () =>
      apiClient.get<GroupView[]>(`/api/admin/app-shortcuts/${widgetId}/groups`),
    enabled: !!widgetId,
  });
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ widgetId, name }: { widgetId: string; name: string }) =>
      apiClient.post<GroupView>(`/api/admin/app-shortcuts/${widgetId}/groups`, { name }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: appShortcutKeys.all });
    },
  });
}

export function useUpdateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      widgetId,
      groupId,
      name,
    }: {
      widgetId: string;
      groupId: string;
      name: string;
    }) =>
      apiClient.put<GroupView>(
        `/api/admin/app-shortcuts/${widgetId}/groups/${groupId}`,
        { name },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: appShortcutKeys.all });
    },
  });
}

export function useDeleteGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ widgetId, groupId }: { widgetId: string; groupId: string }) =>
      apiClient.delete(`/api/admin/app-shortcuts/${widgetId}/groups/${groupId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: appShortcutKeys.all });
    },
  });
}

export function useReorderGroups() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ widgetId, orderedIds }: { widgetId: string; orderedIds: string[] }) =>
      apiClient.post<GroupView[]>(
        `/api/admin/app-shortcuts/${widgetId}/groups/reorder`,
        { orderedIds },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: appShortcutKeys.all });
    },
  });
}
