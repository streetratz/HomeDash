/**
 * T034: Global Vitest test setup.
 * Sets test environment variables and performs per-suite teardown.
 */

import { afterAll, beforeAll } from 'vitest';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { _resetEnvCache } from '../src/config/env.js';
import { _resetDataDirCache } from '../src/config/dataDir.js';
import { closeSqliteDb } from '../src/db/sqlite.js';
import { _resetDbCache } from '../src/db/drizzle.js';

let testDataDir: string;

beforeAll(() => {
  // Isolated temp data dir per test run
  testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'homedash-test-'));

  process.env['NODE_ENV'] = 'test';
  process.env['HOMEDASH_DATA_DIR'] = testDataDir;
  process.env['SESSION_SECRET'] = 'test-secret-at-least-32-characters-long!';
  process.env['LOG_LEVEL'] = 'silent';
  process.env['PORT'] = '0'; // random port

  // Clear cached singletons so tests get fresh instances
  _resetEnvCache();
  _resetDataDirCache();
  _resetDbCache();
});

afterAll(() => {
  closeSqliteDb();
  // Clean up temp data dir
  try {
    fs.rmSync(testDataDir, { recursive: true, force: true });
  } catch {
    // best-effort
  }
});
