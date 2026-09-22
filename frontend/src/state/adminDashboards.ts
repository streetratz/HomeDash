/**
 * Phase R6: Admin dashboard management — TanStack Query hooks.
 *
 * Provides list/create/update/delete hooks for the admin dashboard CRUD API.
 * Each mutation invalidates the admin list, bootstrap, and relevant detail caches.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { apiClient } from '../lib/apiClient.js';
import { dashboardKeys } from './dashboards.js';
import { bootstrapKeys } from './bootstrap.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DashboardListItem {
  id: string;
  name: string;
  applicability: 'web' | 'mobile' | 'both';
  backgroundType: 'solid' | 'image';
  backgroundColor: string | null;
  backgroundAssetId: string | null;
  backgroundDisplayMode: 'fill' | 'stretch' | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDashboardInput {
  name: string;
  applicability?: 'web' | 'mobile' | 'both';
}

export interface UpdateDashboardInput {
  name?: string;
  applicability?: 'web' | 'mobile' | 'both';
  backgroundType?: 'solid' | 'image';
  backgroundColor?: string | null;
  backgroundAssetId?: string | null;
  backgroundDisplayMode?: 'fill' | 'stretch' | null;
}

// ── Query keys ────────────────────────────────────────────────────────────────

export const adminDashboardKeys = {
  list: ['admin-dashboards'] as const,
};

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useAdminDashboards(enabled: boolean) {
  return useQuery({
    queryKey: adminDashboardKeys.list,
    queryFn: async () => {
      const res = await apiClient.get('/api/admin/dashboards');
      return res as DashboardListItem[];
    },
    enabled,
  });
}

function invalidateRelated(queryClient: ReturnType<typeof useQueryClient>, dashboardId?: string) {
  void queryClient.invalidateQueries({ queryKey: adminDashboardKeys.list });
  void queryClient.invalidateQueries({ queryKey: bootstrapKeys.public });
  if (dashboardId) {
    void queryClient.invalidateQueries({ queryKey: dashboardKeys.detail(dashboardId) });
  }
}

export function useCreateDashboard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateDashboardInput) => {
      return apiClient.post<DashboardListItem>('/api/admin/dashboards', input);
    },
    onSuccess: (data) => {
      toast.success(`Dashboard "${data.name}" created`);
      invalidateRelated(queryClient);
    },
    onError: (err: Error) => {
      toast.error(`Create failed: ${err.message}`);
    },
  });
}

export function useUpdateDashboard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateDashboardInput & { id: string }) => {
      return apiClient.put<DashboardListItem>(`/api/admin/dashboards/${id}`, input);
    },
    onSuccess: (data) => {
      toast.success(`Dashboard "${data.name}" updated`);
      invalidateRelated(queryClient, data.id);
    },
    onError: (err: Error) => {
      toast.error(`Update failed: ${err.message}`);
    },
  });
}

export function useDeleteDashboard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/admin/dashboards/${id}`);
      return id;
    },
    onSuccess: (_deletedId) => {
      toast.success('Dashboard deleted');
      invalidateRelated(queryClient);
    },
    onError: (err: Error) => {
      toast.error(`Delete failed: ${err.message}`);
    },
  });
}

export function useDashboardExport() {
  const [isExporting, setIsExporting] = useState(false);

  const exportDashboard = useCallback(async (dashboardId: string, dashboardName: string) => {
    setIsExporting(true);
    try {
      const response = await fetch(`/api/admin/dashboards/${dashboardId}/export`, {
        credentials: 'same-origin',
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${dashboardName.replace(/[^a-zA-Z0-9-_]/g, '_')}-export.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Dashboard exported');
    } catch (err) {
      toast.error(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  }, []);

  return { exportDashboard, isExporting };
}

export function useDuplicateDashboard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dashboardId: string) => {
      return apiClient.post<DashboardListItem>(
        `/api/admin/dashboards/${dashboardId}/duplicate`,
        {},
      );
    },
    onSuccess: (data) => {
      toast.success(`Dashboard duplicated as "${data.name}"`);
      invalidateRelated(queryClient);
    },
    onError: (err: Error) => {
      toast.error(`Duplicate failed: ${err.message}`);
    },
  });
}

export function useImportDashboard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      return apiClient.post<DashboardListItem>('/api/admin/dashboards/import', payload);
    },
    onSuccess: (data) => {
      toast.success(`Dashboard "${data.name}" imported`);
      invalidateRelated(queryClient);
    },
  });
}
