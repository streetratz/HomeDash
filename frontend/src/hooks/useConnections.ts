/**
 * useConnections — TanStack Query hooks for Pi-hole and Docker connection management.
 * CRUD operations + connection testing for the Integrations Hub.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '../lib/apiClient.js';
import { dockerKeys, type DockerHost } from './useDocker.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PiholeConnection {
  id: string;
  name: string;
  baseUrl: string;
  pollIntervalSec: number;
  hasToken: boolean;
  linkedWidgets: number;
}

export interface DockerConnection {
  id: string;
  name: string;
  dockerUrl: string;
  linkedWidgets: number;
}

export interface AllConnections {
  pihole: PiholeConnection[];
  docker: DockerConnection[];
}

interface TestResult {
  success: boolean;
  ok?: boolean;
  message?: string;
}

// ─── Query keys ─────────────────────────────────────────────────────────────

export const connectionKeys = {
  all: ['connections'] as const,
  pihole: ['connections', 'pihole'] as const,
  docker: ['connections', 'docker'] as const,
};

// ─── Queries ────────────────────────────────────────────────────────────────

export function useAllConnections() {
  return useQuery<AllConnections>({
    queryKey: connectionKeys.all,
    queryFn: () => apiClient.get<AllConnections>('/api/admin/connections'),
    staleTime: 30_000,
  });
}

export function usePiholeConnections() {
  return useQuery<PiholeConnection[]>({
    queryKey: connectionKeys.pihole,
    queryFn: () => apiClient.get<PiholeConnection[]>('/api/admin/connections/pihole'),
    staleTime: 30_000,
  });
}

export function useDockerConnections() {
  return useQuery<DockerConnection[]>({
    queryKey: connectionKeys.docker,
    queryFn: () => apiClient.get<DockerConnection[]>('/api/admin/connections/docker'),
    staleTime: 30_000,
  });
}

// ─── Pi-hole mutations ──────────────────────────────────────────────────────

export function useCreatePiholeConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; baseUrl: string; apiToken?: string; pollIntervalSec?: number }) =>
      apiClient.post<PiholeConnection>('/api/admin/connections/pihole', body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: connectionKeys.pihole });
      void qc.invalidateQueries({ queryKey: connectionKeys.all });
      toast.success('Pi-hole connection created');
    },
    onError: (err: Error) => {
      toast.error(`Failed to create connection: ${err.message}`);
    },
  });
}

export function useUpdatePiholeConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; baseUrl?: string; apiToken?: string; pollIntervalSec?: number }) =>
      apiClient.put<PiholeConnection>(`/api/admin/connections/pihole/${id}`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: connectionKeys.pihole });
      void qc.invalidateQueries({ queryKey: connectionKeys.all });
      toast.success('Pi-hole connection updated');
    },
    onError: (err: Error) => {
      toast.error(`Failed to update connection: ${err.message}`);
    },
  });
}

export function useDeletePiholeConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`/api/admin/connections/pihole/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: connectionKeys.pihole });
      void qc.invalidateQueries({ queryKey: connectionKeys.all });
      toast.success('Pi-hole connection removed');
    },
    onError: (err: Error) => {
      toast.error(`Failed to remove connection: ${err.message}`);
    },
  });
}

export function useTestPiholeConnection() {
  return useMutation({
    mutationFn: (params: { id: string } | { baseUrl: string; apiToken: string }) => {
      if ('id' in params) {
        return apiClient.post<TestResult>(`/api/admin/connections/pihole/${params.id}/test`);
      }
      return apiClient.post<TestResult>('/api/admin/connections/pihole/test', params);
    },
  });
}

// ─── Docker mutations ───────────────────────────────────────────────────────

export function useCreateDockerConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; dockerUrl: string }) =>
      apiClient.post<DockerConnection>('/api/admin/connections/docker', body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: connectionKeys.docker });
      void qc.invalidateQueries({ queryKey: connectionKeys.all });
      toast.success('Docker connection created');
    },
    onError: (err: Error) => {
      toast.error(`Failed to create connection: ${err.message}`);
    },
  });
}

export function useUpdateDockerConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; dockerUrl?: string }) =>
      apiClient.put<DockerConnection>(`/api/admin/connections/docker/${id}`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: connectionKeys.docker });
      void qc.invalidateQueries({ queryKey: connectionKeys.all });
      toast.success('Docker connection updated');
    },
    onError: (err: Error) => {
      toast.error(`Failed to update connection: ${err.message}`);
    },
  });
}

export function useDeleteDockerConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`/api/admin/connections/docker/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: connectionKeys.docker });
      void qc.invalidateQueries({ queryKey: connectionKeys.all });
      toast.success('Docker connection removed');
    },
    onError: (err: Error) => {
      toast.error(`Failed to remove connection: ${err.message}`);
    },
  });
}

export function useTestDockerConnection() {
  return useMutation({
    mutationFn: (params: { id: string } | { dockerUrl: string }) => {
      if ('id' in params) {
        return apiClient.post<TestResult>(`/api/admin/connections/docker/${params.id}/test`);
      }
      return apiClient.post<TestResult>('/api/admin/connections/docker/test', params);
    },
  });
}

export function useReplaceDockerWidgetConnections() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { widgetInstanceId: string; connectionIds: string[] }) =>
      apiClient.put<{ hosts: DockerHost[] }>(
        '/api/admin/connections/docker-links',
        body,
      ),
    onSuccess: (data, variables) => {
      qc.setQueryData(dockerKeys.hosts(variables.widgetInstanceId), data);
      void qc.invalidateQueries({ queryKey: connectionKeys.docker });
      void qc.invalidateQueries({ queryKey: connectionKeys.all });
      toast.success('Docker hosts updated');
    },
    onError: (err: Error) => toast.error(`Failed to update Docker hosts: ${err.message}`),
  });
}

// ─── Widget linking ─────────────────────────────────────────────────────────

export function useLinkedConnection(widgetInstanceId: string | undefined, connectionType: 'pihole' | 'docker') {
  return useQuery<{ connectionId: string | null }>({
    queryKey: ['connections', 'resolve', widgetInstanceId, connectionType] as const,
    queryFn: () =>
      apiClient.get<{ connectionId: string | null }>(
        `/api/admin/connections/resolve?widgetInstanceId=${widgetInstanceId}&connectionType=${connectionType}`,
      ),
    enabled: !!widgetInstanceId,
    staleTime: 30_000,
  });
}

export function useLinkWidgetConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { widgetInstanceId: string; connectionType: 'pihole' | 'docker'; connectionId: string }) =>
      apiClient.post('/api/admin/connections/link', body),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: ['connections', 'resolve', variables.widgetInstanceId] });
      void qc.invalidateQueries({ queryKey: connectionKeys.all });
      void qc.invalidateQueries({ queryKey: connectionKeys[variables.connectionType] });
      toast.success('Connection linked');
    },
    onError: (err: Error) => toast.error(`Failed to link: ${err.message}`),
  });
}

export function useUnlinkWidgetConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { widgetInstanceId: string; connectionType: 'pihole' | 'docker' }) =>
      apiClient.post('/api/admin/connections/unlink', body),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: ['connections', 'resolve', variables.widgetInstanceId] });
      void qc.invalidateQueries({ queryKey: connectionKeys.all });
      void qc.invalidateQueries({ queryKey: connectionKeys[variables.connectionType] });
      toast.success('Connection unlinked');
    },
    onError: (err: Error) => toast.error(`Failed to unlink: ${err.message}`),
  });
}
