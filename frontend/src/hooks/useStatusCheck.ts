/**
 * T033 (US7): useStatusCheck — TanStack Query hook for system status polling.
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient.js';
import type { ServiceEntry, StatusCheckResult } from '../state/dashboards.js';

interface StatusCheckResponse {
  results: StatusCheckResult[];
}

/**
 * Polls POST /api/admin/status-check with the given services list.
 * Enabled only when services is non-empty.
 */
export function useStatusCheck(
  services: ServiceEntry[],
  pollIntervalSeconds: number,
  enabled = true,
) {
  return useQuery<StatusCheckResponse>({
    queryKey: ['status-check', services],
    queryFn: async () => {
      const res = await apiClient.post<StatusCheckResponse>('/api/admin/status-check', {
        body: JSON.stringify({ services }),
      });
      return res;
    },
    refetchInterval: pollIntervalSeconds * 1000,
    enabled: enabled && services.length > 0,
    staleTime: (pollIntervalSeconds * 1000) / 2,
  });
}
