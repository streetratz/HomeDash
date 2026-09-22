/**
 * T055 (US1): Dashboard selection logic.
 *
 * Determines which dashboard to show based on:
 * - Device context (web vs mobile)
 * - Auth state (authenticated vs unauthenticated)
 * - User preferences (for authenticated users)
 * - Admin-configured unauth defaults (for unauthenticated users)
 *
 * Rules:
 * - Unauthenticated users ONLY see dashboards explicitly configured as defaults by admin.
 *   If no default is set, no dashboard is selected (null).
 * - Authenticated users see their personal preference, falling back to admin defaults,
 *   falling back to null.
 */

import { eq } from 'drizzle-orm';
import { getDb } from '../db/drizzle.js';
import { appShellSettings, userPreferences, dashboards } from '../db/schema/index.js';
import type { DeviceContext } from '../lib/deviceContext.js';

export interface SelectedDashboard {
  id: string;
  name: string;
  applicability: 'web' | 'mobile' | 'both';
  backgroundType: 'solid' | 'image';
  backgroundColor: string | null;
  backgroundAssetId: string | null;
  backgroundDisplayMode: 'fill' | 'stretch' | null;
}

/**
 * Select the appropriate dashboard for an unauthenticated request.
 * Returns null if no public default has been configured by an admin.
 */
export function selectUnauthDashboard(device: DeviceContext): SelectedDashboard | null {
  const db = getDb();
  const shell = db.select().from(appShellSettings).where(eq(appShellSettings.id, 'global')).get();
  if (!shell) return null;

  const dashboardId =
    device === 'mobile' ? shell.unauthMobileDashboardId : shell.unauthWebDashboardId;

  if (!dashboardId) return null;
  return fetchDashboard(dashboardId);
}

/**
 * Select the appropriate dashboard for an authenticated user.
 * Falls back: user preference → admin unauth default → null.
 */
export function selectUserDashboard(
  userId: string,
  device: DeviceContext,
): SelectedDashboard | null {
  const db = getDb();

  // Try user preferences first
  const prefs = db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).get();
  const prefDashboardId = device === 'mobile' ? prefs?.mobileDashboardId : prefs?.webDashboardId;
  if (prefDashboardId) {
    const dashboard = fetchDashboard(prefDashboardId);
    if (dashboard) return dashboard;
  }

  // Fall back to unauth defaults
  return selectUnauthDashboard(device);
}

// ─── Internal ─────────────────────────────────────────────────────────────────

function fetchDashboard(dashboardId: string): SelectedDashboard | null {
  const db = getDb();
  const row = db.select().from(dashboards).where(eq(dashboards.id, dashboardId)).get();
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    applicability: row.applicability,
    backgroundType: row.backgroundType,
    backgroundColor: row.backgroundColor ?? null,
    backgroundAssetId: row.backgroundAssetId ?? null,
    backgroundDisplayMode: row.backgroundDisplayMode ?? null,
  };
}
