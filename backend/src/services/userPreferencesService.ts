/**
 * T066 (US2): User preferences service.
 *
 * Handles get/update of per-user theme and dashboard mapping preferences.
 * User preferences rows are created at registration time (first-run or future
 * user creation). This service assumes the row exists.
 */

import { eq } from 'drizzle-orm';
import { getDb } from '../db/drizzle.js';
import { userPreferences } from '../db/schema/index.js';
import { Errors } from '../lib/errors.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UserPreferencesData {
  userId: string;
  themeMode: 'light' | 'dark';
  webDashboardId: string | null;
  mobileDashboardId: string | null;
}

export interface UpdateUserPreferencesInput {
  themeMode?: 'light' | 'dark';
  webDashboardId?: string | null;
  mobileDashboardId?: string | null;
}

// ── Service functions ─────────────────────────────────────────────────────────

/**
 * Return the preferences for a given user.
 * Throws 404 if no row exists (should not happen in normal operation).
 */
export function getUserPreferences(userId: string): UserPreferencesData {
  const db = getDb();
  const row = db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).get();

  if (!row) {
    throw Errors.notFound('User preferences not found');
  }

  return {
    userId: row.userId,
    themeMode: row.themeMode,
    webDashboardId: row.webDashboardId ?? null,
    mobileDashboardId: row.mobileDashboardId ?? null,
  };
}

/**
 * Update a subset of user preferences.
 * Only keys present in the update are changed; others are left as-is.
 * Throws 404 if no preferences row exists.
 */
export function updateUserPreferences(
  userId: string,
  updates: UpdateUserPreferencesInput,
): UserPreferencesData {
  const db = getDb();
  const now = new Date().toISOString();

  const existing = db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .get();

  if (!existing) {
    throw Errors.notFound('User preferences not found');
  }

  // Build set values only for keys that are explicitly provided
  const setValues: Partial<typeof userPreferences.$inferInsert> & {
    updatedAt: string;
  } = { updatedAt: now };

  if (updates.themeMode !== undefined) {
    setValues.themeMode = updates.themeMode;
  }
  if (updates.webDashboardId !== undefined) {
    setValues.webDashboardId = updates.webDashboardId;
  }
  if (updates.mobileDashboardId !== undefined) {
    setValues.mobileDashboardId = updates.mobileDashboardId;
  }

  db.update(userPreferences).set(setValues).where(eq(userPreferences.userId, userId)).run();

  return getUserPreferences(userId);
}
