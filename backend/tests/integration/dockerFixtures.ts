/**
 * Shared fixtures for the Docker route integration tests (043).
 *
 * These insert rows directly rather than driving the dashboard API: the tests
 * are about *authorization and endpoint resolution*, and building a widget
 * through the UI routes would make them fail for unrelated reasons whenever
 * dashboard validation changes.
 */

import { randomUUID } from 'node:crypto';
import { getDb } from '../../src/db/drizzle.js';
import {
  dashboards,
  placeholderWidgets,
  appWidgetInstances,
  dockerConnections,
  widgetConnections,
} from '../../src/db/schema/index.js';
import { extractCookies, extractCsrfToken, type TestApp } from '../helpers/http.js';

export const ADMIN_CREDS = {
  username: 'admin',
  displayName: 'Admin',
  password: 'Pass1234!',
} as const;

export interface Session {
  cookie: string;
  csrfToken: string;
}

export async function setupAdmin(testApp: TestApp): Promise<Session> {
  await testApp.request
    .post('/api/first-run/admin')
    .send(ADMIN_CREDS)
    .set('Content-Type', 'application/json');
  return login(testApp, ADMIN_CREDS.username, ADMIN_CREDS.password);
}

export async function login(
  testApp: TestApp,
  username: string,
  password: string,
): Promise<Session> {
  const res = await testApp.request
    .post('/api/auth/login')
    .send({ username, password })
    .set('Content-Type', 'application/json');
  if (res.status !== 200) {
    throw new Error(`login failed for ${username}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return {
    cookie: extractCookies(res.headers),
    csrfToken: extractCsrfToken(res.body as Record<string, unknown>),
  };
}

/** Create a non-admin user through the admin API and log in as them. */
export async function createStandardUser(
  testApp: TestApp,
  admin: Session,
  username = 'regular',
): Promise<Session> {
  const password = 'Pass1234!';
  const res = await testApp.request
    .post('/api/admin/users')
    .set('Cookie', admin.cookie)
    .set('X-CSRF-Token', admin.csrfToken)
    .send({ username, displayName: 'Regular', password, role: 'standard' })
    .set('Content-Type', 'application/json');
  if (res.status >= 400) {
    throw new Error(`could not create user: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return login(testApp, username, password);
}

/**
 * Insert a Docker widget.
 *
 * @param dockerUrl when given, a `docker_connections` row is created and linked.
 *   When omitted the widget exists but has no Docker connection — the
 *   `endpoint_not_configured` case.
 */
export function seedDockerWidget(options: {
  dockerUrl?: string;
  /** Written inline into `config_json` to exercise the adoption pass. */
  legacyDockerUrl?: string;
  /** Link a row of this type instead of 'docker', to prove the type filter. */
  connectionType?: string;
}): { widgetInstanceId: string; connectionId: string | null } {
  const db = getDb();
  const now = new Date().toISOString();

  const dashboardId = randomUUID();
  db.insert(dashboards)
    .values({ id: dashboardId, name: 'Docker test', createdAt: now, updatedAt: now })
    .run();

  const placeholderId = randomUUID();
  db.insert(placeholderWidgets)
    .values({
      id: placeholderId,
      dashboardId,
      stableKey: `k-${placeholderId.slice(0, 8)}`,
      x: 0,
      y: 0,
      w: 4,
      h: 4,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  const widgetInstanceId = randomUUID();
  const config = options.legacyDockerUrl ? { dockerUrl: options.legacyDockerUrl } : {};
  db.insert(appWidgetInstances)
    .values({
      id: widgetInstanceId,
      placeholderId,
      type: 'docker',
      configJson: JSON.stringify(config),
      createdAt: now,
      updatedAt: now,
    })
    .run();

  let connectionId: string | null = null;
  if (options.dockerUrl !== undefined) {
    connectionId = randomUUID();
    db.insert(dockerConnections)
      .values({
        id: connectionId,
        name: 'Test host',
        dockerUrl: options.dockerUrl,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    db.insert(widgetConnections)
      .values({
        widgetInstanceId,
        connectionType: options.connectionType ?? 'docker',
        connectionId,
        sortOrder: 0,
      })
      .run();
  }

  return { widgetInstanceId, connectionId };
}

export function addDockerConnectionToWidget(
  widgetInstanceId: string,
  options: { dockerUrl: string; name: string; sortOrder: number },
): string {
  const db = getDb();
  const now = new Date().toISOString();
  const connectionId = randomUUID();
  db.insert(dockerConnections)
    .values({
      id: connectionId,
      name: options.name,
      dockerUrl: options.dockerUrl,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  db.insert(widgetConnections)
    .values({
      widgetInstanceId,
      connectionType: 'docker',
      connectionId,
      sortOrder: options.sortOrder,
    })
    .run();
  return connectionId;
}
