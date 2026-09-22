/**
 * Phase R4: Dashboard state — types and TanStack Query hooks.
 *
 * DashboardView is the unified shape returned by both:
 *   - GET /api/public/bootstrap (unauth default)
 *   - GET /api/dashboards/:id (authenticated read)
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient.js';
import type { PublicVisibility } from './widgetVisibility.js';

// ── Types (aligned with backend DashboardView) ───────────────────────────────

export interface LinkView {
  id: string;
  orderIndex: number;
  title: string;
  url: string;
  iconKey: string | null;
  iconOverrideKey: string | null;
}

export interface WidgetView {
  id: string;
  type: string;
  orderIndex: number;
  config: unknown;
  links: LinkView[];
  publicVisibility?: PublicVisibility;
}

export interface BreakpointLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PlaceholderView {
  id: string;
  stableKey: string;
  x: number;
  y: number;
  w: number;
  h: number;
  borderColor: string;
  borderSize: number;
  showBorder: boolean;
  title: string | null;
  showTitle: boolean;
  titleStyle: 'header' | 'pill';
  childLayout: 'stacked' | 'side-by-side';
  opacity: number;
  backgroundStyle: 'solid' | 'aurora' | 'aurora-australis';
  backgroundColor: string | null;
  widgets: WidgetView[];
  layouts?: Partial<Record<string, BreakpointLayout>> | undefined;
}

export interface DashboardView {
  id: string;
  name: string;
  applicability: 'web' | 'mobile' | 'both';
  backgroundType: 'solid' | 'image';
  backgroundColor: string | null;
  backgroundUrl: string | null;
  backgroundDisplayMode: 'fill' | 'stretch' | null;
  placeholders: PlaceholderView[];
}

/** Config shape for links_list widget type. */
export interface LinksListConfig {
  layout?: 'vertical' | 'horizontal';
}

// ── Per-widget-type config interfaces (002-widget-management) ─────────────────

export interface ClockConfig {
  timezone?: string | null | undefined;
  format: '12h' | '24h';
  showDate: boolean;
  showSeconds: boolean;
}

export interface MarkdownConfig {
  content: string;
}

export interface IframeConfig {
  url: string;
  aspectRatio: '16:9' | '4:3' | '1:1' | 'auto';
}

export interface WeatherConfig {
  latitude?: number;
  longitude?: number;
  locationName?: string;
  temperatureUnit: 'C' | 'F';
}

export interface ServiceEntry {
  name: string;
  url: string;
  expectedStatus: number;
  timeoutSeconds: number;
}

export interface SystemStatusConfig {
  services: ServiceEntry[];
  pollIntervalSeconds: number;
}

export interface DockerConfig {
  // No dockerUrl: the endpoint lives on the widget's linked Docker connection
  // and is resolved server-side (043 / FR-014). Legacy inline values are moved
  // into connection rows by the startup adoption pass.
  pollIntervalSeconds?: number;
  maxContainers?: number;
  allowControls?: boolean;
}

export interface PhotoFrameConfig {
  sourceId?: string | undefined;
  intervalSeconds?: number | undefined;
  transition?: 'crossfade' | 'none' | undefined;
  fitMode?: 'cover' | 'contain' | 'fill' | undefined;
  shuffle?: boolean | undefined;
  showCaption?: boolean | undefined;
}

// ── App Shortcuts config (013-app-shortcuts) ─────────────────────────────────

export interface AppShortcutsConfig {
  columns: number;
  iconSize: 'sm' | 'md' | 'lg';
  showLabels: boolean;
}

export interface ShortcutView {
  id: string;
  widgetInstanceId: string;
  groupId: string | null;
  name: string;
  url: string;
  iconKey: string | null;
  iconUrl: string | null;
  pingEnabled: boolean;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}

export interface GroupView {
  id: string;
  widgetInstanceId: string;
  name: string;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}

export interface ShortcutListResponse {
  groups: GroupView[];
  shortcuts: ShortcutView[];
}

// ── Single-Link widget config (030-shortcuts-single-link) ─────────────────────

export interface SingleLinkConfig {
  url: string;
  label: string;
  iconKey: string | null;
  subtitle: string | null;
  /** Hex colour (#rrggbb), gradient preset key (gradient-*), or null for default */
  background: string | null;
}

// ── Ephemeral response types ──────────────────────────────────────────────────

export interface StatusCheckResult {
  name: string;
  status: 'up' | 'down' | 'unknown';
  responseTimeMs: number | null;
  checkedAt: string;
  error?: string;
}

export interface WeatherResponse {
  temperature: number;
  temperatureUnit: 'C';
  weatherCode: number;
  humidity: number;
  windSpeed: number;
  precipitation: number;
  isDay: boolean;
  timestamp: string;
  fetchedAt: string;
}

export interface GeocodingResult {
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  timezone: string;
  population?: number;
}

// ── Query keys ────────────────────────────────────────────────────────────────

export const dashboardKeys = {
  all: ['dashboards'] as const,
  detail: (id: string) => ['dashboards', id] as const,
};

// ── Hooks ─────────────────────────────────────────────────────────────────────

/**
 * Fetch a single dashboard with full nested children.
 * Used by authenticated users to load their preferred dashboard.
 */
export function useDashboard(id: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: dashboardKeys.detail(id ?? ''),
    queryFn: () => apiClient.get<DashboardView>(`/api/dashboards/${id}`),
    enabled: (options?.enabled ?? true) && !!id,
    staleTime: 30_000,
  });
}
