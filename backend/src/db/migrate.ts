/**
 * T025: DB migration runner invoked on startup.
 * Uses Drizzle Kit migrations from backend/drizzle/ directory.
 */

import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import path from 'node:path';
import { getSqliteDb } from './sqlite.js';
import { getDb } from './drizzle.js';
import type { FastifyBaseLogger } from 'fastify';

/**
 * Resolved path to the Drizzle migration files.
 * Works in both compiled CJS output (dist/db/ → ../../drizzle = drizzle/)
 * and when Vitest runs TypeScript source directly (src/db/ → ../../drizzle = drizzle/).
 */
const MIGRATIONS_DIR = path.resolve(__dirname, '../../drizzle');

/**
 * Run all pending Drizzle migrations.
 * Throws on failure — caller should abort startup.
 */
export function runMigrations(log?: FastifyBaseLogger): void {
  log?.info({ migrationsDir: MIGRATIONS_DIR }, 'Running DB migrations…');

  const raw = getSqliteDb();
  const foreignKeysWereEnabled = raw.pragma('foreign_keys', { simple: true }) === 1;
  const latestAppliedMigration = getLatestAppliedMigrationTimestamp(raw);
  const pendingMigrations = readMigrationFiles({ migrationsFolder: MIGRATIONS_DIR }).filter(
    (migration) => migration.folderMillis > latestAppliedMigration,
  );
  const requiresForeignKeysDisabled = pendingMigrations.some((migration) =>
    migration.sql.some((statement) =>
      /^\s*PRAGMA\s+foreign_keys\s*=\s*OFF\s*;?\s*$/i.test(statement),
    ),
  );

  // Drizzle wraps all pending migrations in BEGIN before executing their SQL.
  // SQLite ignores PRAGMA foreign_keys changes inside a transaction, so the
  // guards generated around table rebuilds would otherwise be ineffective and
  // DROP TABLE could cascade-delete child rows (#209).
  if (requiresForeignKeysDisabled) {
    raw.pragma('foreign_keys = OFF');
  }
  try {
    migrate(getDb(), { migrationsFolder: MIGRATIONS_DIR });
  } finally {
    if (requiresForeignKeysDisabled) {
      raw.pragma(`foreign_keys = ${foreignKeysWereEnabled ? 'ON' : 'OFF'}`);
    }
  }

  if (pendingMigrations.length > 0) {
    const violations: unknown = raw.pragma('foreign_key_check');
    if (Array.isArray(violations) && violations.length > 0) {
      throw new Error(
        `Database migrations introduced ${violations.length} foreign key violation(s)`,
      );
    }
  }

  log?.info('DB migrations complete');
}

function getLatestAppliedMigrationTimestamp(raw: ReturnType<typeof getSqliteDb>): number {
  const migrationTableExists = raw
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'")
    .get();
  if (migrationTableExists === undefined) return 0;

  const row: unknown = raw
    .prepare('SELECT created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1')
    .get();
  if (row === undefined) return 0;
  if (
    typeof row !== 'object' ||
    row === null ||
    !('created_at' in row) ||
    typeof row.created_at !== 'number'
  ) {
    throw new Error('Could not read the latest database migration timestamp');
  }
  return row.created_at;
}

/**
 * Check whether migrations have run successfully by querying a known table.
 * Returns true if the DB is usable, false otherwise.
 * Used by /readyz to determine readiness.
 */
export function isMigrationHealthy(): boolean {
  try {
    const raw = getSqliteDb();
    // Query drizzle migrations table which is created by the migrate() call
    raw.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='users'").get();
    return true;
  } catch {
    return false;
  }
}
