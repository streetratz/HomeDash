/**
 * T022: SQLite connection factory.
 * Returns a singleton better-sqlite3 Database instance.
 */

import Database from 'better-sqlite3';
import path from 'node:path';
import { getDataSubDir } from '../config/dataDir.js';

let _db: Database.Database | undefined;

/** Returns the singleton SQLite database connection, creating it if needed. */
export function getSqliteDb(): Database.Database {
  if (_db) return _db;

  const dbPath = path.join(getDataSubDir('db'), 'homedash.sqlite');

  _db = new Database(dbPath);

  // Performance and reliability pragmas
  _db.pragma('journal_mode = WAL');
  _db.pragma('synchronous = NORMAL');
  _db.pragma('foreign_keys = ON');
  _db.pragma('busy_timeout = 5000');

  return _db;
}

/**
 * Close the database connection (used in tests and graceful shutdown).
 */
export function closeSqliteDb(): void {
  if (_db) {
    _db.close();
    _db = undefined;
  }
}

/** Override the db instance — only for tests. */
export function _setSqliteDbForTest(db: Database.Database): void {
  _db = db;
}
