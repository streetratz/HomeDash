/**
 * T038: TanStack Query client and provider.
 * Configures the global QueryClient with HomeDash-appropriate defaults.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ApiRequestError } from '../lib/apiClient.js';

/** Shared QueryClient instance — do not mutate after creation. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30 seconds — suitable for LAN
      gcTime: 5 * 60_000, // 5 minutes
      retry: (failureCount, error) => {
        // Don't retry on 4xx client errors
        if (error instanceof ApiRequestError && error.status < 500) {
          return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
      refetchIntervalInBackground: false,
    },
    mutations: {
      retry: false,
    },
  },
});

/** Wrap app with QueryClientProvider. */
export function QueryProvider({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
