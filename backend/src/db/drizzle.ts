/**
 * T023: Drizzle ORM initialization.
 * Returns a singleton Drizzle instance wrapping the SQLite connection.
 */

import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { getSqliteDb } from './sqlite.js';
import * as schema from './schema/index.js';

export type Db = BetterSQLite3Database<typeof schema>;

let _drizzle: Db | undefined;

/** Returns the singleton Drizzle database instance. */
export function getDb(): Db {
  if (_drizzle) return _drizzle;
  _drizzle = drizzle(getSqliteDb(), { schema });
  return _drizzle;
}

/** Reset cached Drizzle instance — only for tests. */
export function _resetDbCache(): void {
  _drizzle = undefined;
}
