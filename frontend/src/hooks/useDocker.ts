/**
 * useDocker — TanStack Query hook for Docker container data.
 * Polls GET /api/docker/containers at a configurable interval.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiRequestError } from '../lib/apiClient.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface DockerContainer {
  id: string;
  name: string;
  state: 'running' | 'paused' | 'exited' | 'dead' | 'created' | 'restarting' | 'removing';
  status: string;
  image: string;
  ports: Array<{
    ip?: string;
    privatePort: number;
    publicPort?: number;
    type: string;
  }>;
  created: number;
}

interface DockerContainersResponse {
  containers: DockerContainer[];
}

export interface DockerHost {
  connectionId: string;
  name: string;
}

interface DockerHostsResponse {
  hosts: DockerHost[];
}

/**
 * The server's Docker failure categories (043 / FR-010, FR-011).
 *
 * Kept distinct on purpose: "this widget has no connection" is something the
 * user fixes in settings, while "the host did not answer" is something they
 * fix on the host. Collapsing them into one message is what made #181 hard to
 * diagnose.
 */
export type DockerErrorKind =
  | 'not_configured'
  | 'invalid_endpoint'
  | 'unreachable'
  | 'ssh_auth'
  | 'ssh_host_key'
  | 'ssh_client_missing'
  | 'api_version'
  | 'unauthorized'
  | 'unknown';

const ERROR_KIND_BY_CODE: Record<string, DockerErrorKind> = {
  DOCKER_ENDPOINT_NOT_CONFIGURED: 'not_configured',
  DOCKER_INVALID_ENDPOINT: 'invalid_endpoint',
  DOCKER_ENDPOINT_UNREACHABLE: 'unreachable',
  DOCKER_SSH_AUTH_FAILED: 'ssh_auth',
  DOCKER_SSH_HOST_KEY_FAILED: 'ssh_host_key',
  DOCKER_SSH_CLIENT_MISSING: 'ssh_client_missing',
  DOCKER_REMOTE_UNAVAILABLE: 'unreachable',
  DOCKER_API_VERSION_UNSUPPORTED: 'api_version',
  UNAUTHORIZED: 'unauthorized',
};

/** Classify a thrown error into a category the widget can render. */
export function classifyDockerError(err: unknown): { kind: DockerErrorKind; message: string } {
  if (err instanceof ApiRequestError) {
    return {
      kind: ERROR_KIND_BY_CODE[err.body.error] ?? 'unknown',
      message: err.body.message,
    };
  }
  return { kind: 'unknown', message: err instanceof Error ? err.message : 'Docker unavailable' };
}

// ── Query keys ───────────────────────────────────────────────────────────────

export const dockerKeys = {
  hosts: (widgetInstanceId: string) => ['docker-hosts', widgetInstanceId] as const,
  containers: (widgetInstanceId: string, connectionId: string) =>
    ['docker-containers', widgetInstanceId, connectionId] as const,
};

// ── Hooks ────────────────────────────────────────────────────────────────────

/**
 * The endpoint is resolved server-side from the widget's stored connection
 * (043 / FR-014) — the client identifies the *widget*, never the destination.
 */
export function useDockerHosts(widgetInstanceId: string, enabled = true) {
  return useQuery<DockerHostsResponse>({
    queryKey: dockerKeys.hosts(widgetInstanceId),
    queryFn: () => {
      const params = new URLSearchParams({ widgetInstanceId });
      return apiClient.get<DockerHostsResponse>(`/api/docker/hosts?${params.toString()}`);
    },
    enabled: enabled && !!widgetInstanceId,
    staleTime: 30_000,
  });
}

export function useDockerContainers(
  widgetInstanceId: string,
  connectionId: string,
  pollIntervalSeconds = 30,
  enabled = true,
) {
  return useQuery<DockerContainersResponse>({
    queryKey: dockerKeys.containers(widgetInstanceId, connectionId),
    queryFn: () => {
      // Through apiClient, not bare fetch: it carries the session cookie and
      // parses the server's typed error body, which classifyDockerError needs.
      const params = new URLSearchParams({ all: 'true', widgetInstanceId, connectionId });
      return apiClient.get<DockerContainersResponse>(`/api/docker/containers?${params.toString()}`);
    },
    refetchInterval: pollIntervalSeconds * 1000,
    enabled: enabled && !!widgetInstanceId && !!connectionId,
    staleTime: 5_000,
    retry: 1,
  });
}

export function useDockerAction(widgetInstanceId: string, connectionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      containerId,
      action,
    }: {
      containerId: string;
      action: 'start' | 'stop' | 'restart';
    }) => {
      // No endpoint in the body: the server resolves it from the widget. The
      // old shape sent `dockerUrl`, which meant a widget linked to a remote
      // host still dispatched its actions to the *local* daemon.
      return apiClient.post('/api/docker/action', {
        widgetInstanceId,
        connectionId,
        containerId,
        action,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: dockerKeys.containers(widgetInstanceId, connectionId),
      });
    },
  });
}
