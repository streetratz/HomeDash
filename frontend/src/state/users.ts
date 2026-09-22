/**
 * Admin user management state hooks.
 * TanStack Query wrappers for user CRUD and password reset operations.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient.js';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AdminUser {
  id: string;
  username: string;
  displayName: string;
  role: 'admin' | 'standard';
  lastLoginAt: string | null;
  createdAt: string;
  groups: Array<{ id: string; name: string }>;
}

export interface CreateUserInput {
  username: string;
  displayName: string;
  password: string;
  role: 'admin' | 'standard';
  groupIds?: string[];
}

export interface UpdateUserInput {
  userId: string;
  displayName?: string;
  role?: 'admin' | 'standard';
  groupIds?: string[];
}

// ─── Query keys ──────────────────────────────────────────────────────────────

export const adminUserKeys = {
  all: ['admin', 'users'] as const,
};

// ─── Queries ─────────────────────────────────────────────────────────────────

export function useAdminUsers() {
  return useQuery({
    queryKey: adminUserKeys.all,
    queryFn: () => apiClient.get<{ users: AdminUser[] }>('/api/admin/users'),
    select: (data) => data.users,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUserInput) =>
      apiClient.post<AdminUser>('/api/admin/users', input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminUserKeys.all });
      toast.success('User created');
    },
    onError: () => toast.error('Failed to create user'),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, ...input }: UpdateUserInput) =>
      apiClient.put<AdminUser>(`/api/admin/users/${userId}`, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminUserKeys.all });
      toast.success('User updated');
    },
    onError: () => toast.error('Failed to update user'),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      apiClient.delete(`/api/admin/users/${userId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminUserKeys.all });
      toast.success('User deleted');
    },
    onError: () => toast.error('Failed to delete user'),
  });
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: ({ userId, password }: { userId: string; password: string }) =>
      apiClient.put<{ message: string }>(`/api/admin/users/${userId}/password`, { password }),
    onSuccess: () => {
      toast.success('Password reset successfully. All user sessions have been invalidated.');
    },
    onError: () => toast.error('Failed to reset password'),
  });
}
