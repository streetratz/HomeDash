/**
 * T005: Shared backup types and Zod schemas.
 * Defines the backup file envelope, data section, and validation.
 */

import { z } from 'zod';

// ── Constants ────────────────────────────────────────────────────────────────

export const BACKUP_VERSION = 1;
export const BACKUP_FORMAT = 'homedash-backup' as const;

/** Tables included in backup (in FK-safe insertion order). */
export const INCLUDED_TABLES = [
  'users',
  'userPreferences',
  'appShellSettings',
  'groups',
  'groupPermissions',
  'userGroupMemberships',
  'dashboards',
  'dashboardAccessRules',
  'placeholderWidgets',
  'placeholderBreakpointLayouts',
  'appWidgetInstances',
  'linksListItems',
  'calendarSources',
  'calendarBirthdays',
  'todoLists',
  'todoItems',
  'shortcutGroups',
  'appShortcuts',
  'piholeInstances',
  'unifiInstances',
  'dockerConnections',
  'widgetConnections',
  'integrationConfigs',
  'photoSources',
  'scheduledJobs',
  'caldavAccounts',
  'oauthAccounts',
] as const;

/** Tables explicitly excluded from backup. */
export const EXCLUDED_TABLES = [
  'sessions',
  'calendarEvents',
  'shortcutPingResults',
  'iconCacheEntries',
  'uploadedAssets',
] as const;

/** Fields stripped from specific tables during export. */
export const SENSITIVE_FIELDS: Record<string, string[]> = {
  users: ['passwordHash'],
  oauthAccounts: ['accessTokenEnc', 'refreshTokenEnc', 'tokenExpiresAt'],
  caldavAccounts: ['encryptedPassword'],
  piholeInstances: ['apiTokenEncrypted'],
  unifiInstances: ['usernameEncrypted', 'passwordEncrypted'],
};

/** Integration config rows whose values are credentials rather than portable metadata. */
export const SENSITIVE_INTEGRATION_CONFIG_KEYS = new Set(['clientSecret']);

// ── Types ────────────────────────────────────────────────────────────────────

export interface BackupSummary {
  users: number;
  dashboards: number;
  widgets: number;
  groups: number;
  scheduledJobs: number;
  calendarSources: number;
  todoLists: number;
  integrations: number;
  photoSources: number;
}

export interface BackupData {
  users: Record<string, unknown>[];
  userPreferences: Record<string, unknown>[];
  appShellSettings: Record<string, unknown>[];
  dashboards: Record<string, unknown>[];
  placeholderWidgets: Record<string, unknown>[];
  placeholderBreakpointLayouts: Record<string, unknown>[];
  appWidgetInstances: Record<string, unknown>[];
  linksListItems: Record<string, unknown>[];
  calendarSources: Record<string, unknown>[];
  calendarBirthdays: Record<string, unknown>[];
  todoLists: Record<string, unknown>[];
  todoItems: Record<string, unknown>[];
  groups: Record<string, unknown>[];
  groupPermissions: Record<string, unknown>[];
  userGroupMemberships: Record<string, unknown>[];
  dashboardAccessRules: Record<string, unknown>[];
  shortcutGroups: Record<string, unknown>[];
  appShortcuts: Record<string, unknown>[];
  piholeInstances: Record<string, unknown>[];
  unifiInstances: Record<string, unknown>[];
  dockerConnections: Record<string, unknown>[];
  widgetConnections: Record<string, unknown>[];
  integrationConfigs: Record<string, unknown>[];
  photoSources: Record<string, unknown>[];
  scheduledJobs: Record<string, unknown>[];
  caldavAccounts: Record<string, unknown>[];
  oauthAccounts: Record<string, unknown>[];
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  appVersion: string;
  exportedAt: string;
  summary: BackupSummary;
  data: BackupData;
}

export interface RestorePreview {
  summary: BackupSummary;
  appVersion: string;
  exportedAt: string;
  warnings: string[];
}

// ── Zod Schemas ──────────────────────────────────────────────────────────────

const backupSummarySchema = z.object({
  users: z.number(),
  dashboards: z.number(),
  widgets: z.number(),
  groups: z.number(),
  scheduledJobs: z.number(),
  calendarSources: z.number(),
  todoLists: z.number(),
  integrations: z.number(),
  photoSources: z.number(),
});

const backupDataSchema = z.object({
  users: z.array(z.record(z.unknown())),
  userPreferences: z.array(z.record(z.unknown())),
  appShellSettings: z.array(z.record(z.unknown())),
  dashboards: z.array(z.record(z.unknown())),
  placeholderWidgets: z.array(z.record(z.unknown())),
  placeholderBreakpointLayouts: z.array(z.record(z.unknown())),
  appWidgetInstances: z.array(z.record(z.unknown())),
  linksListItems: z.array(z.record(z.unknown())),
  calendarSources: z.array(z.record(z.unknown())),
  calendarBirthdays: z.array(z.record(z.unknown())).optional().default([]),
  todoLists: z.array(z.record(z.unknown())),
  todoItems: z.array(z.record(z.unknown())),
  groups: z.array(z.record(z.unknown())),
  groupPermissions: z.array(z.record(z.unknown())),
  userGroupMemberships: z.array(z.record(z.unknown())),
  dashboardAccessRules: z.array(z.record(z.unknown())),
  shortcutGroups: z.array(z.record(z.unknown())),
  appShortcuts: z.array(z.record(z.unknown())),
  piholeInstances: z.array(z.record(z.unknown())),
  unifiInstances: z.array(z.record(z.unknown())),
  dockerConnections: z.array(z.record(z.unknown())),
  widgetConnections: z.array(z.record(z.unknown())),
  integrationConfigs: z.array(z.record(z.unknown())),
  photoSources: z.array(z.record(z.unknown())),
  scheduledJobs: z.array(z.record(z.unknown())),
  caldavAccounts: z.array(z.record(z.unknown())),
  oauthAccounts: z.array(z.record(z.unknown())),
});

export const backupFileSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.number().int().min(1).max(BACKUP_VERSION),
  appVersion: z.string(),
  exportedAt: z.string(),
  summary: backupSummarySchema,
  data: backupDataSchema,
});
