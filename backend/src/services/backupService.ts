/**
 * T009/T014/T015: Backup & restore service.
 * Handles full system backup export and atomic restore.
 */

import { getDb } from '../db/drizzle.js';
import * as schema from '../db/schema/index.js';
import {
  BACKUP_VERSION,
  BACKUP_FORMAT,
  SENSITIVE_FIELDS,
  SENSITIVE_INTEGRATION_CONFIG_KEYS,
  backupFileSchema,
  type BackupFile,
  type BackupData,
  type BackupSummary,
  type RestorePreview,
} from './backupTypes.js';
import { Errors } from '../lib/errors.js';
import { getAppLogger } from '../lib/logger.js';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Strip sensitive fields from rows. */
function stripSensitive(
  tableName: string,
  rows: Record<string, unknown>[],
): Record<string, unknown>[] {
  const portableRows =
    tableName === 'integrationConfigs'
      ? rows.filter(
          (row) =>
            typeof row['key'] !== 'string' ||
            !SENSITIVE_INTEGRATION_CONFIG_KEYS.has(row['key']),
        )
      : rows;
  const fields = SENSITIVE_FIELDS[tableName];
  if (!fields) return portableRows;
  return portableRows.map((row) => {
    const cleaned = { ...row };
    for (const f of fields) delete cleaned[f];
    return cleaned;
  });
}

/** Read all rows from a Drizzle table reference. */
function readTable(table: SQLiteTable): Record<string, unknown>[] {
  const db = getDb();
  return db.select().from(table).all();
}

// ── State ────────────────────────────────────────────────────────────────────

let restoreInProgress = false;

// ── Mapping from backup key → Drizzle table ──────────────────────────────────

/** Ordered for FK-safe deletion (children first) then insertion (parents first). */
const TABLE_MAP: Record<keyof BackupData, SQLiteTable> = {
  users: schema.users,
  userPreferences: schema.userPreferences,
  appShellSettings: schema.appShellSettings,
  dashboards: schema.dashboards,
  placeholderWidgets: schema.placeholderWidgets,
  placeholderBreakpointLayouts: schema.placeholderBreakpointLayouts,
  appWidgetInstances: schema.appWidgetInstances,
  linksListItems: schema.linksListItems,
  calendarSources: schema.calendarSources,
  calendarBirthdays: schema.calendarBirthdays,
  todoLists: schema.todoLists,
  todoItems: schema.todoItems,
  groups: schema.groups,
  groupPermissions: schema.groupPermissions,
  userGroupMemberships: schema.userGroupMemberships,
  dashboardAccessRules: schema.dashboardAccessRules,
  shortcutGroups: schema.shortcutGroups,
  appShortcuts: schema.appShortcuts,
  piholeInstances: schema.piholeInstances,
  unifiInstances: schema.unifiInstances,
  dockerConnections: schema.dockerConnections,
  widgetConnections: schema.widgetConnections,
  integrationConfigs: schema.integrationConfigs,
  photoSources: schema.photoSources,
  scheduledJobs: schema.scheduledJobs,
  caldavAccounts: schema.caldavAccounts,
  oauthAccounts: schema.oauthAccounts,
};

/** FK-safe insertion order: parents before children. */
const INSERT_ORDER: (keyof BackupData)[] = [
  'users',
  'groups',
  'dashboards',
  'photoSources',
  'oauthAccounts',
  'caldavAccounts',
  'userPreferences',
  'appShellSettings',
  'groupPermissions',
  'userGroupMemberships',
  'dashboardAccessRules',
  'placeholderWidgets',
  'placeholderBreakpointLayouts',
  'appWidgetInstances',
  'linksListItems',
  'shortcutGroups',
  'appShortcuts',
  'piholeInstances',
  'unifiInstances',
  'dockerConnections',
  'widgetConnections',
  'integrationConfigs',
  'calendarSources',
  'calendarBirthdays',
  'todoLists',
  'todoItems',
  'scheduledJobs',
];

/** FK-safe deletion order: exact reverse of parent-first insertion. */
const DELETE_ORDER: (keyof BackupData)[] = [...INSERT_ORDER].reverse();

const REAUTH_REQUIRED_MESSAGE = 'Re-authentication required after portable restore';

interface RestoringAdmin {
  username: string;
  displayName: string;
  passwordHash: string;
}

function isSqliteConstraintError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string' &&
    (error as { code: string }).code.startsWith('SQLITE_CONSTRAINT')
  );
}

function hasString(row: Record<string, unknown>, key: string): boolean {
  return typeof row[key] === 'string' && row[key] !== '';
}

function prepareRestoreData(
  backup: BackupFile,
  restoringUserId: string,
): BackupData {
  const db = getDb();
  const restoringAdmin = db
    .select({
      username: schema.users.username,
      displayName: schema.users.displayName,
      passwordHash: schema.users.passwordHash,
    })
    .from(schema.users)
    .where(eq(schema.users.id, restoringUserId))
    .get() satisfies RestoringAdmin | undefined;

  if (!restoringAdmin) {
    throw Errors.unauthorized('The restoring administrator no longer exists.');
  }

  const restoredUsers = backup.data.users.map((row) => ({ ...row }));
  if (restoredUsers.length === 0) {
    throw Errors.badRequest('Backup must contain at least one user.');
  }

  let restoringAdminIndex = restoredUsers.findIndex(
    (row) => row['username'] === restoringAdmin.username,
  );
  if (restoringAdminIndex < 0) {
    restoringAdminIndex = restoredUsers.findIndex((row) => row['role'] === 'admin');
  }
  if (restoringAdminIndex < 0) {
    throw Errors.badRequest('Backup must contain at least one administrator.');
  }

  const disabledPasswordHash = `restore-required:${crypto.randomUUID()}`;
  const restoringAdminUserId = restoredUsers[restoringAdminIndex]!['id'];
  if (typeof restoringAdminUserId !== 'string') {
    throw Errors.badRequest('Restored administrator is missing a valid user ID.');
  }

  const administratorsGroup = backup.data.groups.find(
    (row) => row['slug'] === 'administrators',
  );
  const administratorsGroupId = administratorsGroup?.['id'];
  if (typeof administratorsGroupId !== 'string') {
    throw Errors.badRequest('Backup is missing the Administrators group.');
  }

  const users = restoredUsers.map((row, index) =>
    index === restoringAdminIndex
      ? {
          ...row,
          username: restoringAdmin.username,
          displayName: restoringAdmin.displayName,
          role: 'admin',
          passwordHash: restoringAdmin.passwordHash,
        }
      : { ...row, passwordHash: disabledPasswordHash },
  );
  const userGroupMemberships = backup.data.userGroupMemberships.map((row) => ({ ...row }));
  const hasAdministratorsMembership = userGroupMemberships.some(
    (row) =>
      row['userId'] === restoringAdminUserId &&
      row['groupId'] === administratorsGroupId,
  );
  if (!hasAdministratorsMembership) {
    userGroupMemberships.push({
      id: crypto.randomUUID(),
      userId: restoringAdminUserId,
      groupId: administratorsGroupId,
      createdAt: new Date().toISOString(),
    });
  }

  const existingAssetIds = new Set(
    db.select({ id: schema.uploadedAssets.id }).from(schema.uploadedAssets).all().map((row) => row.id),
  );
  const keepExistingAsset = (value: unknown): string | null =>
    typeof value === 'string' && existingAssetIds.has(value) ? value : null;

  return {
    ...backup.data,
    users,
    userGroupMemberships,
    oauthAccounts: backup.data.oauthAccounts.map((row) => ({
      ...row,
      accessTokenEnc: '',
      refreshTokenEnc: '',
      tokenExpiresAt: null,
      status: 'error',
      lastError: REAUTH_REQUIRED_MESSAGE,
    })),
    caldavAccounts: backup.data.caldavAccounts.map((row) => ({
      ...row,
      encryptedPassword: '',
    })),
    piholeInstances: backup.data.piholeInstances.map((row) => ({
      ...row,
      apiTokenEncrypted: '',
    })),
    unifiInstances: backup.data.unifiInstances.map((row) => ({
      ...row,
      usernameEncrypted: '',
      passwordEncrypted: '',
    })),
    integrationConfigs: backup.data.integrationConfigs.filter(
      (row) =>
        typeof row['key'] !== 'string' ||
        !SENSITIVE_INTEGRATION_CONFIG_KEYS.has(row['key']),
    ),
    appShellSettings: backup.data.appShellSettings.map((row) => ({
      ...row,
      logoAssetId: keepExistingAsset(row['logoAssetId']),
    })),
    dashboards: backup.data.dashboards.map((row) => ({
      ...row,
      backgroundAssetId: keepExistingAsset(row['backgroundAssetId']),
    })),
    appShortcuts: backup.data.appShortcuts.map((row) => ({
      ...row,
      iconAssetId: keepExistingAsset(row['iconAssetId']),
      iconOverrideAssetId: keepExistingAsset(row['iconOverrideAssetId']),
    })),
  };
}

// ── Export ────────────────────────────────────────────────────────────────────

/** Read package.json version at import time. */
function getAppVersion(): string {
  // Fallback; overridden in tests if needed
  return process.env['APP_VERSION'] ?? '1.0.0';
}

export function exportBackup(): BackupFile {
  const log = getAppLogger();
  log.info({ component: 'backup' }, 'Portable backup export started');
  const data: Record<string, Record<string, unknown>[]> = {};

  for (const [key, table] of Object.entries(TABLE_MAP)) {
    const rows = readTable(table);
    data[key] = stripSensitive(key, rows);
  }

  const backupData = data as unknown as BackupData;

  const summary: BackupSummary = {
    users: backupData.users.length,
    dashboards: backupData.dashboards.length,
    widgets: backupData.appWidgetInstances.length,
    groups: backupData.groups.length,
    scheduledJobs: backupData.scheduledJobs.length,
    calendarSources: backupData.calendarSources.length,
    todoLists: backupData.todoLists.length,
    integrations: backupData.integrationConfigs.length,
    photoSources: backupData.photoSources.length,
  };

  log.info({ component: 'backup', summary }, 'Portable backup export complete');

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    appVersion: getAppVersion(),
    exportedAt: new Date().toISOString(),
    summary,
    data: backupData,
  };
}

// ── Preview ──────────────────────────────────────────────────────────────────

export function previewRestore(raw: unknown): RestorePreview {
  getAppLogger().info({ component: 'backup' }, 'Restore preview requested');
  const result = backupFileSchema.safeParse(raw);
  if (!result.success) {
    throw Errors.badRequest(
      `Invalid backup file: ${result.error.errors.map((e) => e.message).join(', ')}`,
    );
  }
  const backup = result.data;

  if (backup.version > BACKUP_VERSION) {
    throw Errors.badRequest(
      `Backup version ${backup.version} is newer than supported version ${BACKUP_VERSION}. Please upgrade HomeDash.`,
    );
  }

  const warnings: string[] = [];

  if (backup.data.oauthAccounts.length > 0) {
    warnings.push(
      'OAuth tokens are excluded from backups — integrations will need re-authentication after restore.',
    );
  }
  if (backup.data.caldavAccounts.length > 0) {
    warnings.push(
      'CalDAV passwords are excluded — CalDAV accounts will need passwords re-entered after restore.',
    );
  }
  if (
    backup.data.piholeInstances.length > 0 ||
    backup.data.unifiInstances.length > 0 ||
    backup.data.integrationConfigs.some(
      (row) =>
        typeof row['key'] === 'string' &&
        SENSITIVE_INTEGRATION_CONFIG_KEYS.has(row['key']),
    )
  ) {
    warnings.push(
      'Integration credentials are excluded — Pi-hole, UniFi, Spotify, and Sonos may require reconfiguration.',
    );
  }
  if (
    backup.data.appShellSettings.some((row) => hasString(row, 'logoAssetId')) ||
    backup.data.dashboards.some((row) => hasString(row, 'backgroundAssetId')) ||
    backup.data.appShortcuts.some(
      (row) => hasString(row, 'iconAssetId') || hasString(row, 'iconOverrideAssetId'),
    )
  ) {
    warnings.push(
      'Uploaded assets are excluded — unavailable logos, backgrounds, and shortcut icons will be cleared.',
    );
  }
  warnings.push(
    'Your current administrator username and password will be preserved. Other restored users will require a password reset.',
  );
  warnings.push('All current sessions will be invalidated — all users will need to log in again.');
  warnings.push('All existing data will be replaced with the backup contents.');

  return {
    summary: backup.summary,
    appVersion: backup.appVersion,
    exportedAt: backup.exportedAt,
    warnings,
  };
}

// ── Restore ──────────────────────────────────────────────────────────────────

export function executeRestore(backup: BackupFile, restoringUserId: string): BackupSummary {
  if (restoreInProgress) {
    throw Errors.conflict('A restore operation is already in progress.');
  }

  restoreInProgress = true;
  const log = getAppLogger();
  log.info(
    { component: 'restore', tableCount: Object.keys(backup.data).length },
    'Restore started',
  );
  try {
    const db = getDb();
    const restoreData = prepareRestoreData(backup, restoringUserId);

    db.transaction((tx) => {
      // 1. Delete all sessions first (always excluded from backup)
      tx.delete(schema.sessions).run();

      // 2. Delete all data tables in FK-safe order
      for (const key of DELETE_ORDER) {
        const table = TABLE_MAP[key];
        tx.delete(table).run();
      }

      // 3. Insert backup data in FK-safe order
      for (const key of INSERT_ORDER) {
        const rows = restoreData[key];
        if (rows.length === 0) continue;
        const table = TABLE_MAP[key];
        for (const row of rows) {
          tx.insert(table).values(row).run();
        }
        log.debug(
          { component: 'restore', table: key, rowCount: rows.length },
          'Restore table inserted',
        );
      }
    });

    log.info({ component: 'restore', summary: backup.summary }, 'Restore complete');
    return backup.summary;
  } catch (err) {
    log.error({ component: 'restore', err }, 'Restore failed; transaction rolled back');
    if (isSqliteConstraintError(err)) {
      throw Errors.validationError(
        'Backup data violates database integrity constraints and could not be restored.',
      );
    }
    throw err;
  } finally {
    restoreInProgress = false;
  }
}
