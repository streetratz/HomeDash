/**
 * 014-pihole-widget: TanStack Query hooks for Pi-hole DNS controls.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '../lib/apiClient.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PiholeConfigPublic {
  id: string;
  widgetInstanceId: string;
  baseUrl: string;
  pollIntervalSec: number;
  hasToken: boolean;
}

export interface PiholeStats {
  totalQueries: number;
  blockedQueries: number;
  percentBlocked: number;
  domainsOnBlocklist: number;
  uniqueClients: number;
  blocking: 'enabled' | 'disabled';
  timer: number | null;
}

export interface PiholeSystemHealth {
  cpu: number | null;
  memory: number | null;
  load: [number, number, number] | null;
  temp: number | null;
  uptime: number | null;
}

export interface PiholeConnectionTestResult {
  success: boolean;
  version?: string;
  message: string;
}

export interface PiholeBlockingResult {
  blocking: 'enabled' | 'disabled';
  timer: number | null;
}

// ─── Query keys ─────────────────────────────────────────────────────────────

export const piholeKeys = {
  config: (widgetId: string) => ['pihole', 'config', widgetId] as const,
  stats: (widgetId: string) => ['pihole', 'stats', widgetId] as const,
  system: (widgetId: string) => ['pihole', 'system', widgetId] as const,
  all: ['pihole'] as const,
};

// ─── Queries ────────────────────────────────────────────────────────────────

export function usePiholeConfig(widgetId: string) {
  return useQuery({
    queryKey: piholeKeys.config(widgetId),
    queryFn: () => apiClient.get<PiholeConfigPublic>(`/api/pihole/config/${widgetId}`),
    enabled: !!widgetId,
  });
}

export function usePiholeStats(widgetId: string, pollIntervalSec = 60) {
  return useQuery({
    queryKey: piholeKeys.stats(widgetId),
    queryFn: () => apiClient.get<PiholeStats>(`/api/pihole/stats/${widgetId}`),
    enabled: !!widgetId,
    refetchInterval: pollIntervalSec * 1000,
    staleTime: 30_000,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
  });
}

export function usePiholeSystemHealth(widgetId: string, pollIntervalSec = 60) {
  return useQuery({
    queryKey: piholeKeys.system(widgetId),
    queryFn: () => apiClient.get<PiholeSystemHealth>(`/api/pihole/system/${widgetId}`),
    enabled: !!widgetId && pollIntervalSec > 0,
    refetchInterval: pollIntervalSec > 0 ? pollIntervalSec * 1000 : false,
    staleTime: pollIntervalSec > 0 ? 30_000 : Infinity,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export function usePiholeSaveConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      widgetId,
      baseUrl,
      apiToken,
      pollIntervalSec,
    }: {
      widgetId: string;
      baseUrl: string;
      apiToken?: string;
      pollIntervalSec?: number;
    }) =>
      apiClient.put<PiholeConfigPublic>(`/api/pihole/config/${widgetId}`, {
        baseUrl,
        apiToken,
        pollIntervalSec,
      }),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: piholeKeys.config(vars.widgetId) });
      void qc.invalidateQueries({ queryKey: piholeKeys.stats(vars.widgetId) });
      void qc.invalidateQueries({ queryKey: piholeKeys.system(vars.widgetId) });
      toast.success('Pi-hole configuration saved');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to save config');
    },
  });
}

export function usePiholeDeleteConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (widgetId: string) =>
      apiClient.delete(`/api/pihole/config/${widgetId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: piholeKeys.all });
      toast.success('Pi-hole configuration removed');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to delete config');
    },
  });
}

export function usePiholeTestConnection() {
  return useMutation({
    mutationFn: ({ baseUrl, apiToken }: { baseUrl: string; apiToken: string }) =>
      apiClient.post<PiholeConnectionTestResult>('/api/pihole/test', {
        baseUrl,
        apiToken,
      }),
  });
}

export function usePiholeSetBlocking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      widgetId,
      action,
      duration,
    }: {
      widgetId: string;
      action: 'enable' | 'disable';
      duration?: number;
    }) =>
      apiClient.post<PiholeBlockingResult>(
        `/api/pihole/blocking/${widgetId}`,
        { action, duration },
      ),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: piholeKeys.stats(vars.widgetId) });
      toast.success(
        vars.action === 'enable' ? 'Blocking enabled' : 'Blocking disabled',
      );
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to update blocking');
    },
  });
}
