/**
 * T035: Supertest integration test base helper.
 * Provides a factory for spinning up an in-process Fastify server
 * and making typed HTTP requests in tests.
 *
 * Each test FILE gets its own isolated temp dir via setup.ts's beforeAll.
 * Within a file, describe blocks each call createTestApp() which resets all
 * singletons so subsequent calls open the SAME SQLite file fresh.
 */

import supertest from 'supertest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/server.js';
import { runMigrations } from '../../src/db/migrate.js';
import { seedDatabase } from '../../src/db/seed.js';
import { closeSqliteDb } from '../../src/db/sqlite.js';
import { _resetDbCache } from '../../src/db/drizzle.js';
import { _resetEnvCache } from '../../src/config/env.js';
import { _resetDataDirCache } from '../../src/config/dataDir.js';

/** The type returned by `supertest(server)` — an agent with HTTP method helpers. */
export type TestRequest = ReturnType<typeof supertest>;

export interface TestApp {
  app: FastifyInstance;
  request: TestRequest;
  close: () => Promise<void>;
}

/**
 * Create an in-process Fastify test app with migrations run.
 * Resets all singletons (env, data dir, DB) before building so each TestApp
 * starts from a clean in-process state while sharing the per-file temp directory.
 * Call `close()` in afterAll/afterEach to clean up.
 */
export async function createTestApp(): Promise<TestApp> {
  // Reset singletons so each call gets a fresh DB connection
  _resetEnvCache();
  _resetDataDirCache();
  _resetDbCache();

  const app = await buildServer();
  // Run migrations + seed BEFORE .ready() so onReady hooks (e.g. scheduler)
  // find all tables already created.
  runMigrations(app.log);
  seedDatabase();
  await app.ready();

  const request = supertest(app.server);

  const close = async () => {
    await app.close();
    closeSqliteDb();
    _resetDbCache();
  };

  return { app, request, close };
}

/**
 * Helper to extract the Set-Cookie header from a response.
 */
export function extractCookies(headers: Record<string, string | string[]>): string {
  const setCookie = headers['set-cookie'];
  if (!setCookie) return '';
  if (Array.isArray(setCookie)) return setCookie.join('; ');
  return setCookie;
}

/**
 * Extract the CSRF token from a login / me JSON response body.
 */
export function extractCsrfToken(body: Record<string, unknown>): string {
  const token = body['csrfToken'];
  if (typeof token !== 'string') throw new Error('No csrfToken in response body');
  return token;
}

/**
 * Build headers object containing the CSRF token header.
 */
export function csrfHeader(csrfToken: string): Record<string, string> {
  return { 'x-csrf-token': csrfToken };
}
