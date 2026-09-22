/**
 * T060 (US1): Auth state + bootstrap loading.
 * Fetches GET /api/public/bootstrap and GET /api/auth/me (if authenticated).
 * Manages CSRF token lifecycle in the API client.
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient, setCsrfToken } from '../lib/apiClient.js';
import type { ApiRequestError } from '../lib/apiClient.js';

// ── Types (aligned with OpenAPI spec) ─────────────────────────────────────────

/** Per-clock display configuration (all fields optional). */
export interface ClockDisplayConfig {
  /** Custom label override (e.g. overrides default 'Home' for the home clock). */
  label?: string;
  /** 'column' = stacked (default), 'row' = single horizontal line. */
  layout?: 'column' | 'row';
  /** Show GMT±XX numeric offset. Default false. */
  showOffset?: boolean;
  /** Side of the home house icon (row layout). Default 'left'. */
  homeIconSide?: 'left' | 'right';
  /** Side of the day/night icon (row layout). Default 'right'. */
  dayNightSide?: 'left' | 'right';
}

export interface Clock {
  label: string;
  timezone: string;
  isHome: boolean;
  /** Optional per-clock display configuration. */
  config?: ClockDisplayConfig;
}

export interface ShellSettings {
  titleText: string;
  titleFont: string;
  titleFontSizePx: number;
  bodyFont: string;
  headerHeightPx: number;
  logoUrl: string | null;
  clockStripEnabled: boolean;
  clockStripAlignment: 'left' | 'center' | 'right';
  clockDisplayConfig: Record<string, unknown>;
  clocks: Clock[];
  footerText: string | null;
  repoUrl: string | null;
  screensaverEnabled: boolean;
  screensaverIdleMinutes: number;
  screensaverSourceId: string | null;
  screensaverIntervalSeconds: number;
  screensaverWeatherLat: number | null;
  screensaverWeatherLon: number | null;
  screensaverWeatherLocation: string | null;
  screensaverWeatherUnit: 'C' | 'F';
  screensaverClockFormat: '12h' | '24h';
  screensaverTransition: 'fade' | 'slide' | 'kenburns' | 'crossfade';
  headerStyle: 'none' | 'gradient-shift' | 'aurora' | 'aurora-australis' | 'glass-glow' | 'gradient-underline';
  headerGlassEffect: boolean;
  headerTitleStyle: 'none' | 'gradient-shift' | 'aurora' | 'aurora-australis' | 'glass-glow' | 'gradient-underline';
}

import type { DashboardView } from './dashboards.js';

export interface PublicBootstrap {
  firstRunRequired: boolean;
  shell: ShellSettings | null;
  deviceContext: 'web' | 'mobile';
  dashboard: DashboardView | null;
}

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: 'admin' | 'user';
  /** True if user is a member of the Administrators built-in group. */
  isAdmin: boolean;
  /** Group IDs the user belongs to. */
  groupIds: string[];
  /** Effective permission strings (e.g. 'dashboards:manage', 'settings:view'). */
  permissions: string[];
}

export interface AuthMe {
  user: AuthUser;
  csrfToken: string;
}

// ── Query keys ────────────────────────────────────────────────────────────────

export const bootstrapKeys = {
  public: ['public-bootstrap'] as const,
  me: ['auth-me'] as const,
};

// ── Hooks ─────────────────────────────────────────────────────────────────────

/**
 * Fetch /api/public/bootstrap.
 * Always enabled — determines if first-run is required.
 */
export function usePublicBootstrap() {
  return useQuery({
    queryKey: bootstrapKeys.public,
    queryFn: () => apiClient.get<PublicBootstrap>('/api/public/bootstrap'),
    staleTime: 60_000,
  });
}

/**
 * Fetch /api/auth/me to get the current user + fresh CSRF token.
 * Only enabled when the server is NOT in first-run mode.
 */
export function useAuthMe(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: bootstrapKeys.me,
    queryFn: async () => {
      const data = await apiClient.get<AuthMe>('/api/auth/me');
      // Keep CSRF token in sync with the API client
      setCsrfToken(data.csrfToken);
      return data;
    },
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60_000,
    // 401 = unauthenticated; don't retry — this is expected for anon users
    retry: (failureCount, error) => {
      const apiErr = error as ApiRequestError;
      if (apiErr?.status === 401 || apiErr?.status === 403) return false;
      return failureCount < 2;
    },
  });
}

/**
 * Combined hook that loads public bootstrap data + auth state.
 *
 * Returns:
 *  - `bootstrap`     — PublicBootstrap response (or undefined while loading)
 *  - `authMe`        — AuthMe response (or undefined when unauthenticated)
 *  - `isReady`       — true once bootstrap has loaded
 *  - `isFirstRun`    — true if no admin account exists yet
 *  - `isAuthenticated` — true if a valid session exists
 *  - `user`          — current AuthUser (or null)
 */
export function useBootstrap() {
  const bootstrapQuery = usePublicBootstrap();
  const bootstrap = bootstrapQuery.data;

  const authMeQuery = useAuthMe({
    // Only attempt /me after bootstrap loaded + not first-run
    enabled: bootstrapQuery.isSuccess && !(bootstrap?.firstRunRequired ?? true),
  });

  const isReady = bootstrapQuery.isSuccess;
  const isFirstRun = bootstrap?.firstRunRequired ?? false;
  const isAuthenticated = authMeQuery.isSuccess && authMeQuery.data !== undefined;
  // True while the auth-me query is enabled but hasn't settled yet
  const isAuthLoading = authMeQuery.isLoading && authMeQuery.fetchStatus !== 'idle';

  return {
    bootstrapQuery,
    authMeQuery,
    bootstrap,
    authMe: authMeQuery.data,
    isReady,
    isFirstRun,
    isAuthenticated,
    isAuthLoading,
    user: authMeQuery.data?.user ?? null,
  };
}

/**
 * Site-wide clock format preference (12h or 24h).
 * Reads from shell settings (screensaverClockFormat field).
 * Returns { hour12: boolean } for use with Intl.DateTimeFormat.
 */
export function useClockFormat(): { hour12: boolean; format: '12h' | '24h' } {
  const { data } = usePublicBootstrap();
  const format = data?.shell?.screensaverClockFormat ?? '12h';
  return { hour12: format === '12h', format };
}
