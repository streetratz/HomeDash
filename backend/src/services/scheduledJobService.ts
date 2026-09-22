/**
 * T031 (US5): Scheduled job service — manages croner-based job scheduler.
 */

import { Cron } from 'croner';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../db/drizzle.js';
import { scheduledJobs } from '../db/schema/index.js';
import { getShellSettings } from './shellSettingsService.js';
import { actionParamSchemas } from './scheduledJobTypes.js';
import { getAppLogger } from '../lib/logger.js';
import type {
  ActionType,
  CreateScheduledJobInput,
  UpdateScheduledJobInput,
} from './scheduledJobTypes.js';

// ── Action Handlers ──────────────────────────────────────────────────────────

type ActionHandler = (params: Record<string, unknown>) => Promise<void>;

const actionParamsRecordSchema = z.record(z.unknown());

function parseActionParams(actionType: ActionType, rawJson: string): Record<string, unknown> {
  const raw: unknown = JSON.parse(rawJson);
  const validated: unknown = actionParamSchemas[actionType].parse(raw);
  return actionParamsRecordSchema.parse(validated);
}

const actionHandlers: Record<ActionType, ActionHandler> = {
  calendar_sync: async (_params) => {
    const { runScheduledSync } = await import('./calendar-sync-service.js');
    await runScheduledSync();
  },
  sonos_playback: async (params) => {
    const { loadFavorite, setGroupVolume, play } = await import('./sonos-adapter.js');
    const { userId, groupId, favoriteId, volume, playOnCompletion } = params as {
      userId: string;
      groupId: string;
      favoriteId: string;
      volume?: number;
      playOnCompletion?: boolean;
    };
    if (volume !== undefined) {
      await setGroupVolume(userId, groupId, volume);
    }
    await loadFavorite(userId, groupId, favoriteId, playOnCompletion ?? true);
    if (playOnCompletion !== false) {
      await play(userId, groupId);
    }
  },

  database_backup: async (params) => {
    const { getSqliteDb } = await import('../db/sqlite.js');
    const { getDataDir } = await import('../config/dataDir.js');

    const { retention = 7 } = params as { retention?: number };
    const backupsDir = path.join(getDataDir(), 'backups');
    fs.mkdirSync(backupsDir, { recursive: true });

    const destPath = path.join(backupsDir, `homedash_${getBackupTimestamp()}.db`);
    await getSqliteDb().backup(destPath);

    applyRetention(backupsDir, '.db', retention);
    writeRestoreReadme(backupsDir);

    const stats = fs.statSync(destPath);
    getAppLogger().info(
      {
        component: 'scheduler',
        backupType: 'database',
        filename: path.basename(destPath),
        sizeBytes: stats.size,
      },
      'Scheduled backup created',
    );
  },

  portable_backup: async (params) => {
    const { exportBackup } = await import('./backupService.js');
    const { getDataDir } = await import('../config/dataDir.js');

    const { retention = 7 } = params as { retention?: number };
    const backupsDir = path.join(getDataDir(), 'backups');
    fs.mkdirSync(backupsDir, { recursive: true });

    const backup = exportBackup();
    const destPath = path.join(backupsDir, `homedash_${getBackupTimestamp()}.json`);
    fs.writeFileSync(destPath, JSON.stringify(backup, null, 2));

    applyRetention(backupsDir, '.json', retention);
    writeRestoreReadme(backupsDir);

    const stats = fs.statSync(destPath);
    getAppLogger().info(
      {
        component: 'scheduler',
        backupType: 'portable',
        filename: path.basename(destPath),
        sizeBytes: stats.size,
      },
      'Scheduled backup created',
    );
  },
};

// ── Backup Helpers ───────────────────────────────────────────────────────────

function getBackupTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function applyRetention(dir: string, extension: string, keep: number): void {
  const files = fs
    .readdirSync(dir)
    .filter((f: string) => f.startsWith('homedash_') && f.endsWith(extension))
    .sort()
    .reverse();

  for (const file of files.slice(keep)) {
    try {
      fs.unlinkSync(path.join(dir, file));
      getAppLogger().info(
        { component: 'scheduler', filename: file },
        'Expired backup deleted',
      );
    } catch (err) {
      getAppLogger().warn(
        { component: 'scheduler', err, filename: file },
        'Failed to delete expired backup',
      );
    }
  }
}

function writeRestoreReadme(backupsDir: string): void {
  const content = `# HomeDash Backup & Restore Guide

## Backup Types

### Full Database Backup (.db files)
- Complete copy of the SQLite database
- Includes ALL data: users, passwords, OAuth tokens, integrations, settings
- Best for: Disaster recovery, Docker crashes, volume corruption
- ⚠️ Contains sensitive data — store securely

### Portable Backup (.json files)
- Sanitized JSON export of all HomeDash data
- Excludes: password hashes, OAuth tokens, CalDAV passwords
- Best for: Migrating to new hardware, sharing configs, version upgrades
- Safe to transfer over email or cloud storage

## File Naming
- \`homedash_YYYYMMDD_HHmmss.db\` — Full database backup
- \`homedash_YYYYMMDD_HHmmss.json\` — Portable JSON backup

## Retention Policy
By default, the 7 most recent files of each type are kept.
Configure retention in Settings → Scheduled Jobs.

## Restore Instructions

### Scenario 1: Docker container crashed (volume intact)
Just restart the container — no restore needed.
\`\`\`bash
docker compose up -d
\`\`\`

### Scenario 2: Volume corrupted (full backup available)
1. Stop the container:
   \`\`\`bash
   docker compose down
   \`\`\`
2. Copy the most recent .db backup to the data directory:
   \`\`\`bash
   cp /path/to/backups/homedash_YYYYMMDD_HHmmss.db /path/to/data/db/homedash.sqlite
   \`\`\`
3. Start the container:
   \`\`\`bash
   docker compose up -d
   \`\`\`
   Everything will be restored — users, passwords, integrations, all settings.

### Scenario 3: Moving to new hardware (portable backup)
1. Set up HomeDash on the new machine
2. Complete first-run setup (create admin account)
3. Go to Settings → Backup & Restore
4. Click "Restore from Backup" and upload the .json file
5. Re-enter passwords for OAuth and CalDAV integrations

## Backup Schedule
Both backup types run daily at 2:00 AM by default.
Adjust the schedule in Settings → Scheduled Jobs.

## Important Notes
- Full backups (.db) are NOT encrypted — store them securely
- Portable backups (.json) are safe to share but require re-authentication after restore
- The backups directory should ideally be on a separate volume from the main data
  (add a volume mount like \`-v /host/path:/app/data/backups\` in docker-compose.yml)

---
Generated by HomeDash. https://github.com/streetratz/HomeDash
`;

  fs.writeFileSync(path.join(backupsDir, 'RESTORE_README.md'), content);
}

// ── Scheduler State ──────────────────────────────────────────────────────────

const runningJobs = new Map<string, Cron>();

// ── Public API ───────────────────────────────────────────────────────────────

export function startScheduler(): void {
  const db = getDb();
  const jobs = db.select().from(scheduledJobs).all();
  const tz = getShellSettings()?.homeTimezone ?? undefined;

  for (const job of jobs) {
    if (job.enabled) {
      scheduleJob(job.id, job.cronExpression, job.actionType as ActionType, job.actionParams, tz);
    }
  }
  getAppLogger().info(
    { component: 'scheduler', jobCount: runningJobs.size },
    'Scheduler started',
  );
}

export function stopScheduler(): void {
  for (const [, cron] of runningJobs) {
    cron.stop();
  }
  runningJobs.clear();
  getAppLogger().info({ component: 'scheduler' }, 'Scheduler stopped');
}

export function restartScheduler(): void {
  stopScheduler();
  startScheduler();
}

export function listJobs() {
  const db = getDb();
  return db.select().from(scheduledJobs).all();
}

export function getJob(id: string) {
  const db = getDb();
  return db.select().from(scheduledJobs).where(eq(scheduledJobs.id, id)).get();
}

export function createJob(input: CreateScheduledJobInput) {
  const db = getDb();

  // Validate action params against schema
  const parsedParams = parseActionParams(input.actionType, input.actionParams);

  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  db.insert(scheduledJobs)
    .values({
      id,
      name: input.name,
      actionType: input.actionType,
      actionParams: JSON.stringify(parsedParams),
      cronExpression: input.cronExpression,
      enabled: input.enabled ? 1 : 0,
      isSystem: 0,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  // If enabled, start the cron
  if (input.enabled) {
    const tz = getShellSettings()?.homeTimezone ?? undefined;
    scheduleJob(id, input.cronExpression, input.actionType, JSON.stringify(parsedParams), tz);
  }

  return getJob(id)!;
}

export function updateJob(id: string, input: UpdateScheduledJobInput) {
  const db = getDb();
  const existing = getJob(id);
  if (!existing) return null;

  // System jobs: only allow enable/disable and cron changes, not action_type
  if (existing.isSystem && input.actionType && input.actionType !== existing.actionType) {
    throw new Error('Cannot change action type of system job');
  }

  // If actionParams provided, validate
  if (input.actionParams) {
    const actionType = (input.actionType ?? existing.actionType) as ActionType;
    const parsedParams = parseActionParams(actionType, input.actionParams);
    input.actionParams = JSON.stringify(parsedParams);
  }

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { updatedAt: now };
  if (input.name !== undefined) updates['name'] = input.name;
  if (input.actionType !== undefined) updates['actionType'] = input.actionType;
  if (input.actionParams !== undefined) updates['actionParams'] = input.actionParams;
  if (input.cronExpression !== undefined) updates['cronExpression'] = input.cronExpression;
  if (input.enabled !== undefined) updates['enabled'] = input.enabled ? 1 : 0;

  db.update(scheduledJobs).set(updates).where(eq(scheduledJobs.id, id)).run();

  // Update live scheduler
  const updated = getJob(id)!;
  unscheduleJob(id);
  if (updated.enabled) {
    const tz = getShellSettings()?.homeTimezone ?? undefined;
    scheduleJob(
      id,
      updated.cronExpression,
      updated.actionType as ActionType,
      updated.actionParams,
      tz,
    );
  }

  return updated;
}

export function deleteJob(id: string): boolean {
  const db = getDb();
  const existing = getJob(id);
  if (!existing) return false;
  if (existing.isSystem) throw new Error('Cannot delete system job');

  unscheduleJob(id);
  db.delete(scheduledJobs).where(eq(scheduledJobs.id, id)).run();
  return true;
}

export async function runJobNow(id: string): Promise<{ status: string; error?: string }> {
  const job = getJob(id);
  if (!job) throw new Error('Job not found');
  return executeJob(job.id, job.actionType as ActionType, job.actionParams);
}

export function seedSystemJobs(): void {
  const db = getDb();
  const existing = db
    .select()
    .from(scheduledJobs)
    .where(eq(scheduledJobs.actionType, 'calendar_sync'))
    .get();

  if (existing) {
    getAppLogger().debug(
      { component: 'scheduler', actionType: 'calendar_sync' },
      'System job already exists',
    );
  } else {
    const now = new Date().toISOString();
    db.insert(scheduledJobs)
      .values({
        id: crypto.randomUUID(),
        name: 'Calendar Sync',
        actionType: 'calendar_sync',
        actionParams: '{}',
        cronExpression: '* * * * *',
        enabled: 1,
        isSystem: 1,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    getAppLogger().info(
      { component: 'scheduler', actionType: 'calendar_sync' },
      'System job seeded',
    );
  }

  const dbBackup = db
    .select()
    .from(scheduledJobs)
    .where(eq(scheduledJobs.actionType, 'database_backup'))
    .get();

  if (dbBackup) {
    getAppLogger().debug(
      { component: 'scheduler', actionType: 'database_backup' },
      'System job already exists',
    );
  } else {
    const now = new Date().toISOString();
    db.insert(scheduledJobs)
      .values({
        id: crypto.randomUUID(),
        name: 'Database Backup',
        actionType: 'database_backup',
        actionParams: JSON.stringify({ retention: 7 }),
        cronExpression: '0 2 * * *',
        enabled: 1,
        isSystem: 1,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    getAppLogger().info(
      { component: 'scheduler', actionType: 'database_backup' },
      'System job seeded',
    );
  }

  const portableBackup = db
    .select()
    .from(scheduledJobs)
    .where(eq(scheduledJobs.actionType, 'portable_backup'))
    .get();

  if (portableBackup) {
    getAppLogger().debug(
      { component: 'scheduler', actionType: 'portable_backup' },
      'System job already exists',
    );
  } else {
    const now = new Date().toISOString();
    db.insert(scheduledJobs)
      .values({
        id: crypto.randomUUID(),
        name: 'Portable Backup',
        actionType: 'portable_backup',
        actionParams: JSON.stringify({ retention: 7 }),
        cronExpression: '0 2 * * *',
        enabled: 1,
        isSystem: 1,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    getAppLogger().info(
      { component: 'scheduler', actionType: 'portable_backup' },
      'System job seeded',
    );
  }
}

// ── Internal ─────────────────────────────────────────────────────────────────

function scheduleJob(
  id: string,
  cron: string,
  actionType: ActionType,
  actionParams: string,
  timezone?: string,
) {
  try {
    const opts: Record<string, unknown> = {
      catch: (err: unknown) => {
        getAppLogger().error(
          { component: 'scheduler', err, jobId: id, actionType },
          'Scheduled job cron callback failed',
        );
      },
    };
    if (timezone) opts['timezone'] = timezone;
    const cronInstance = new Cron(cron, opts, () => {
      void executeJob(id, actionType, actionParams);
    });
    runningJobs.set(id, cronInstance);
  } catch (err) {
    getAppLogger().error(
      { component: 'scheduler', err, jobId: id, actionType },
      'Failed to schedule job',
    );
  }
}

function unscheduleJob(id: string) {
  const cron = runningJobs.get(id);
  if (cron) {
    cron.stop();
    runningJobs.delete(id);
  }
}

async function executeJob(
  id: string,
  actionType: ActionType,
  actionParams: string,
): Promise<{ status: string; error?: string }> {
  const db = getDb();
  const handler = actionHandlers[actionType];
  if (!handler) {
    const error = `No handler for action type: ${actionType}`;
    db.update(scheduledJobs)
      .set({
        lastRunAt: new Date().toISOString(),
        lastRunStatus: 'error',
        lastRunError: error,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(scheduledJobs.id, id))
      .run();
    return { status: 'error', error };
  }

  try {
    const params = parseActionParams(actionType, actionParams);
    await handler(params);
    db.update(scheduledJobs)
      .set({
        lastRunAt: new Date().toISOString(),
        lastRunStatus: 'success',
        lastRunError: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(scheduledJobs.id, id))
      .run();
    return { status: 'success' };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    db.update(scheduledJobs)
      .set({
        lastRunAt: new Date().toISOString(),
        lastRunStatus: 'error',
        lastRunError: error,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(scheduledJobs.id, id))
      .run();
    getAppLogger().error(
      { component: 'scheduler', err, jobId: id, actionType },
      'Scheduled job execution failed',
    );
    return { status: 'error', error };
  }
}
