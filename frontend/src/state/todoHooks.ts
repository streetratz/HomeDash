/**
 * T008 (005): TanStack Query hooks for todo data.
 *
 * Queries: lists, items (single list + multi-list).
 * Mutations: create/update/delete lists, create/update/delete/reorder items.
 */

import { useQuery, useMutation, useQueryClient, useQueries } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient.js';
import type { TodoList, TodoItem } from '../types/todo.js';

// ── Types ─────────────────────────────────────────────────────────────────────

interface MicrosoftSyncResult {
  listsCreated: number;
  listsUpdated: number;
  listsDeleted: number;
  itemsCreated: number;
  itemsUpdated: number;
  itemsDeleted: number;
}

interface MicrosoftTodoList {
  id: string;
  displayName: string;
  isOwner: boolean;
  accountId: string;
  accountEmail: string | null;
}

interface MicrosoftTodoListsResponse {
  lists: MicrosoftTodoList[];
  accounts: Array<{ id: string; email: string | null }>;
}

// ── Query keys ────────────────────────────────────────────────────────────────

export const todoKeys = {
  lists: ['todo-lists'] as const,
  items: (listId: string, includeCompleted?: boolean) =>
    ['todo-items', listId, includeCompleted ?? true] as const,
  allItems: ['todo-items'] as const,
  microsoftLists: ['todo-microsoft-lists'] as const,
};

// ── Queries ───────────────────────────────────────────────────────────────────

export function useTodoLists() {
  return useQuery({
    queryKey: todoKeys.lists,
    queryFn: () => apiClient.get<TodoList[]>('/api/admin/todo/lists'),
  });
}

export function useTodoItems(listId: string, includeCompleted = true) {
  return useQuery({
    queryKey: todoKeys.items(listId, includeCompleted),
    queryFn: () =>
      apiClient.get<TodoItem[]>(
        `/api/admin/todo/lists/${listId}/items${includeCompleted ? '' : '?includeCompleted=false'}`,
      ),
    enabled: !!listId,
  });
}

export function useAllTodoItems(listIds: string[], includeCompleted = true) {
  const results = useQueries({
    queries: listIds.map((listId) => ({
      queryKey: todoKeys.items(listId, includeCompleted),
      queryFn: () =>
        apiClient.get<TodoItem[]>(
          `/api/admin/todo/lists/${listId}/items${includeCompleted ? '' : '?includeCompleted=false'}`,
        ),
      enabled: !!listId,
    })),
  });

  const isLoading = results.some((r) => r.isLoading);
  const error = results.find((r) => r.error)?.error ?? null;
  const items = results.flatMap((r) => r.data ?? []);

  return { items, isLoading, error };
}

// ── List mutations ────────────────────────────────────────────────────────────

export function useCreateList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; color?: string }) =>
      apiClient.post<TodoList>('/api/admin/todo/lists', data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: todoKeys.lists });
    },
  });
}

export function useUpdateList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; color?: string | null }) =>
      apiClient.put<TodoList>(`/api/admin/todo/lists/${id}`, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: todoKeys.lists });
    },
  });
}

export function useDeleteList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/admin/todo/lists/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: todoKeys.lists });
      void qc.invalidateQueries({ queryKey: todoKeys.allItems });
    },
  });
}

// ── Item mutations ────────────────────────────────────────────────────────────

export function useCreateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      listId,
      ...data
    }: {
      listId: string;
      title: string;
      notes?: string;
      dueDate?: string;
      priority?: number;
    }) => apiClient.post<TodoItem>(`/api/admin/todo/lists/${listId}/items`, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: todoKeys.allItems });
    },
  });
}

export function useUpdateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      title?: string;
      notes?: string;
      dueDate?: string;
      priority?: number;
      completed?: boolean;
    }) => apiClient.put<TodoItem>(`/api/admin/todo/items/${id}`, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: todoKeys.allItems });
    },
  });
}

export function useDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/admin/todo/items/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: todoKeys.allItems });
    },
  });
}

export function useReorderItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      listId,
      items,
    }: {
      listId: string;
      items: { id: string; orderIndex: number }[];
    }) => apiClient.put(`/api/admin/todo/lists/${listId}/reorder`, { items }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: todoKeys.allItems });
    },
  });
}

// ── Microsoft To Do sync ──────────────────────────────────────────────────────

export function useSyncMicrosoftTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiClient.post<MicrosoftSyncResult>('/api/admin/todo/sync/microsoft', {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: todoKeys.lists });
      void qc.invalidateQueries({ queryKey: todoKeys.allItems });
      void qc.invalidateQueries({ queryKey: todoKeys.microsoftLists });
    },
  });
}

export function useMicrosoftTodoLists() {
  return useQuery({
    queryKey: todoKeys.microsoftLists,
    queryFn: () =>
      apiClient.get<MicrosoftTodoListsResponse>('/api/admin/todo/providers/microsoft/lists'),
  });
}
