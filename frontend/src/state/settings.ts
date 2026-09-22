/**
 * T077 (US2): Shell settings + user preferences state.
 *
 * Provides TanStack Query hooks for:
 * - Admin shell settings (GET/PUT /api/admin/shell)
 * - User preferences (GET/PUT /api/user/preferences)
 * - Theme mode management with localStorage fallback for unauthenticated users
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { apiClient } from '../lib/apiClient.js';
import type { ClockDisplayConfig } from './bootstrap.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ClockView {
  timezone: string;
  label: string;
  isHome: boolean;
  config?: ClockDisplayConfig;
}

/** Full admin view returned by GET /api/admin/shell */
export interface ShellSettingsAdmin {
  titleText: string;
  titleFont: string;
  titleFontSizePx: number;
  bodyFont: string;
  headerHeightPx: number;
  logoAssetId: string | null;
  logoUrl: string | null;
  clockStripEnabled: boolean;
  clockStripAlignment: 'left' | 'center' | 'right';
  homeTimezone: string | null;
  homeClockConfig: ClockDisplayConfig | null;
  timezones: ClockView[];
  footerText: string | null;
  repoUrl: string | null;
  unauthWebDashboardId: string | null;
  unauthMobileDashboardId: string | null;
  headerStyle: 'none' | 'gradient-shift' | 'aurora' | 'aurora-australis' | 'glass-glow' | 'gradient-underline';
  headerStyleTarget: 'background' | 'border' | 'title';
  headerGlassEffect: boolean;
  headerTitleStyle: 'none' | 'gradient-shift' | 'aurora' | 'aurora-australis' | 'glass-glow' | 'gradient-underline';
  updatedAt: string;
}

export interface ShellSettingsUpdateInput {
  titleText?: string;
  titleFont?: string;
  titleFontSizePx?: number;
  bodyFont?: string;
  headerHeightPx?: number;
  clockStripEnabled?: boolean;
  clockStripAlignment?: 'left' | 'center' | 'right';
  homeTimezone?: string | null;
  homeClockConfig?: ClockDisplayConfig | null;
  timezones?: Array<{ label: string; timezone: string; config?: ClockDisplayConfig }>;
  footerText?: string | null;
  repoUrl?: string | null;
  unauthWebDashboardId?: string | null;
  unauthMobileDashboardId?: string | null;
  headerStyle?: 'none' | 'gradient-shift' | 'aurora' | 'aurora-australis' | 'glass-glow' | 'gradient-underline';
  headerStyleTarget?: 'background' | 'border' | 'title';
  headerGlassEffect?: boolean;
  headerTitleStyle?: 'none' | 'gradient-shift' | 'aurora' | 'aurora-australis' | 'glass-glow' | 'gradient-underline';
}

export interface UserPreferences {
  userId: string;
  themeMode: 'light' | 'dark';
  webDashboardId: string | null;
  mobileDashboardId: string | null;
}

export interface UserPreferencesUpdateInput {
  themeMode?: 'light' | 'dark';
  webDashboardId?: string | null;
  mobileDashboardId?: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const THEME_STORAGE_KEY = 'homedash_theme';

// ── Query keys ────────────────────────────────────────────────────────────────

export const settingsKeys = {
  adminShell: ['admin-shell'] as const,
  userPrefs: ['user-preferences'] as const,
};

// ── Theme helpers ─────────────────────────────────────────────────────────────

export type ThemeMode = 'light' | 'dark';

/**
 * Read the current theme from localStorage (used for unauthenticated visitors).
 * Defaults to 'dark' if not set.
 */
export function getStoredTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    return 'dark';
  } catch {
    return 'dark';
  }
}

/**
 * Persist the theme preference to localStorage.
 */
export function storeTheme(mode: ThemeMode): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // ignore Safari private mode errors
  }
}

/**
 * Apply a theme mode to the document root element.
 * - 'light': no classes
 * - 'dark': adds .dark
 */
export function applyTheme(mode: ThemeMode): void {
  const html = document.documentElement;
  html.classList.remove('dark');

  if (mode === 'dark') {
    html.classList.add('dark');
  }
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

/**
 * Fetch admin shell settings.
 * Only call when the current user is an admin — returns 403 otherwise.
 */
export function useAdminShellSettings(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: settingsKeys.adminShell,
    queryFn: () => apiClient.get<ShellSettingsAdmin>('/api/admin/shell'),
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}

/**
 * Mutation to update admin shell settings.
 * Invalidates the admin shell query and the public bootstrap on success.
 */
export function useUpdateShellSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (updates: ShellSettingsUpdateInput) =>
      apiClient.put<ShellSettingsAdmin>('/api/admin/shell', updates),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: settingsKeys.adminShell });
      // Refresh public bootstrap so header/footer/clocks update immediately
      void qc.invalidateQueries({ queryKey: ['public-bootstrap'] });
    },
  });
}

/**
 * Fetch user preferences for the authenticated user.
 */
export function useUserPreferences(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: settingsKeys.userPrefs,
    queryFn: () => apiClient.get<UserPreferences>('/api/user/preferences'),
    enabled: options?.enabled ?? true,
    staleTime: 60_000,
  });
}

/**
 * Mutation to update user preferences.
 * Automatically applies the new theme mode to the document on success.
 */
export function useUpdateUserPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (updates: UserPreferencesUpdateInput) =>
      apiClient.put<UserPreferences>('/api/user/preferences', updates),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: settingsKeys.userPrefs });
      if (data.themeMode) {
        applyTheme(data.themeMode);
        storeTheme(data.themeMode);
      }
    },
  });
}

/**
 * Hook that initialises the document theme on mount.
 *
 * For authenticated users: applies the server-persisted theme mode.
 * For unauthenticated users: applies the localStorage theme.
 *
 * Should be called once near the root of the app.
 *
 * @param themeMode  Theme from user preferences (if authenticated), or null.
 */
export function useInitTheme(themeMode: ThemeMode | null | undefined) {
  useEffect(() => {
    const effective = themeMode ?? getStoredTheme();
    applyTheme(effective);
  }, [themeMode]);
}

// ── Profile & Password hooks ─────────────────────────────────────────────────

/**
 * Mutation to update the authenticated user's display name.
 * Invalidates the auth/me query so the user menu updates.
 */
export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { displayName: string }) =>
      apiClient.put<{ id: string; username: string; displayName: string; role: string }>(
        '/api/user/profile',
        data,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['auth-me'] });
    },
  });
}

/**
 * Mutation to change the authenticated user's password.
 * Handles 401 (wrong current password) distinctly.
 */
export function useChangePassword() {
  return useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const res = await apiClient.put<{ message: string }>('/api/user/password', data);
      return res;
    },
  });
}
