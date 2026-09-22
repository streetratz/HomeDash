/**
 * T013 (US2): Integration tests for restore execution.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import { and, asc, eq } from 'drizzle-orm';
import {
  createTestApp,
  extractCookies,
  extractCsrfToken,
  csrfHeader,
  type TestApp,
} from '../helpers/http.js';
import { getDb } from '../../src/db/drizzle.js';
import {
  calendarSources,
  dashboards,
  integrationConfigs,
  oauthAccounts,
  piholeInstances,
  unifiInstances,
  userPreferences,
  users,
  widgetConnections,
} from '../../src/db/schema/index.js';
import { addDockerConnectionToWidget, seedDockerWidget } from './dockerFixtures.js';

async function setupAdminAndLogin(testApp: TestApp) {
  await testApp.request
    .post('/api/first-run/admin')
    .send({ username: 'admin', displayName: 'Admin', password: 'supersecurepass1' })
    .set('Content-Type', 'application/json');

  const loginRes = await testApp.request
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'supersecurepass1' })
    .set('Content-Type', 'application/json');

  return {
    cookie: extractCookies(loginRes.headers),
    csrf: extractCsrfToken(loginRes.body as Record<string, unknown>),
  };
}

describe('POST /api/admin/backup/restore', () => {
  let testApp: TestApp;
  let cookie: string;
  let csrf: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    const auth = await setupAdminAndLogin(testApp);
    cookie = auth.cookie;
    csrf = auth.csrf;
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('restores an exported backup with dashboard and OAuth foreign keys intact', async () => {
    const db = getDb();
    const admin = db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, 'admin'))
      .get();
    const dashboard = db.select({ id: dashboards.id }).from(dashboards).get();
    expect(admin).toBeDefined();
    expect(dashboard).toBeDefined();

    db.update(userPreferences)
      .set({
        webDashboardId: dashboard!.id,
        mobileDashboardId: dashboard!.id,
      })
      .where(eq(userPreferences.userId, admin!.id))
      .run();

    const oauthId = crypto.randomUUID();
    const calendarSourceId = crypto.randomUUID();
    const now = new Date().toISOString();
    db.insert(oauthAccounts)
      .values({
        id: oauthId,
        userId: admin!.id,
        provider: 'google',
        providerAccountId: 'restore-test-account',
        accessTokenEnc: 'encrypted-access-token',
        refreshTokenEnc: 'encrypted-refresh-token',
        tokenExpiresAt: now,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      })
      .run();
    db.insert(calendarSources)
      .values({
        id: calendarSourceId,
        userId: admin!.id,
        oauthAccountId: oauthId,
        type: 'google',
        name: 'Restore test calendar',
        color: '#3b82f6',
        syncIntervalSeconds: 300,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    db.insert(integrationConfigs)
      .values([
        { provider: 'spotify', key: 'clientId', value: 'spotify-client', updatedAt: now },
        { provider: 'spotify', key: 'clientSecret', value: 'spotify-secret', updatedAt: now },
      ])
      .run();
    const piholeId = crypto.randomUUID();
    db.insert(piholeInstances)
      .values({
        id: piholeId,
        name: 'Restore Pi-hole',
        baseUrl: 'https://pihole.example.test',
        apiTokenEncrypted: 'encrypted-pihole-token',
        pollIntervalSec: 30,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    const unifiId = crypto.randomUUID();
    db.insert(unifiInstances)
      .values({
        id: unifiId,
        name: 'Restore UniFi',
        baseUrl: 'https://unifi.example.test',
        usernameEncrypted: 'encrypted-unifi-user',
        passwordEncrypted: 'encrypted-unifi-password',
        siteName: 'default',
        pollIntervalSec: 30,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    const docker = seedDockerWidget({
      dockerUrl: 'unix:///tmp/homedash-restore-primary.sock',
    });
    const secondDockerConnectionId = addDockerConnectionToWidget(docker.widgetInstanceId, {
      name: 'Restore secondary host',
      dockerUrl: 'unix:///tmp/homedash-restore-secondary.sock',
      sortOrder: 1,
    });

    const backupRes = await testApp.request
      .get('/api/admin/backup')
      .set('Cookie', cookie);
    expect(backupRes.status).toBe(200);
    const backup = backupRes.body as Record<string, unknown>;
    const backupData = backup['data'] as Record<string, Record<string, unknown>[]>;
    expect(backupData['users']![0]).not.toHaveProperty('passwordHash');
    expect(backupData['oauthAccounts']![0]).not.toHaveProperty('accessTokenEnc');
    expect(backupData['oauthAccounts']![0]).not.toHaveProperty('refreshTokenEnc');
    expect(backupData['integrationConfigs']).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ key: 'clientSecret' })]),
    );
    expect(backupData['piholeInstances']![0]).not.toHaveProperty('apiTokenEncrypted');
    expect(backupData['unifiInstances']![0]).not.toHaveProperty('usernameEncrypted');
    expect(backupData['unifiInstances']![0]).not.toHaveProperty('passwordEncrypted');
    const backedUpDockerLinks = backupData['widgetConnections'] ?? [];
    expect(
      backedUpDockerLinks
        .filter((row) => row['widgetInstanceId'] === docker.widgetInstanceId)
        .map((row) => ({
          connectionId: row['connectionId'],
          sortOrder: row['sortOrder'],
        })),
    ).toEqual([
      { connectionId: docker.connectionId, sortOrder: 0 },
      { connectionId: secondDockerConnectionId, sortOrder: 1 },
    ]);

    backupData['users']![0]!['username'] = 'backup-admin';

    const res = await testApp.request
      .post('/api/admin/backup/restore')
      .set('Cookie', cookie)
      .set('Content-Type', 'application/json')
      .set(csrfHeader(csrf))
      .send({ backup, confirmationWord: 'RESTORE' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('summary');
    expect((res.body as Record<string, unknown>)['summary']).toHaveProperty('users');

    const restoredPreferences = db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, admin!.id))
      .get();
    expect(restoredPreferences?.webDashboardId).toBe(dashboard!.id);
    expect(restoredPreferences?.mobileDashboardId).toBe(dashboard!.id);

    const restoredOauth = db
      .select()
      .from(oauthAccounts)
      .where(eq(oauthAccounts.id, oauthId))
      .get();
    expect(restoredOauth?.accessTokenEnc).toBe('');
    expect(restoredOauth?.refreshTokenEnc).toBe('');
    expect(restoredOauth?.status).toBe('error');

    const restoredSource = db
      .select()
      .from(calendarSources)
      .where(eq(calendarSources.id, calendarSourceId))
      .get();
    expect(restoredSource?.oauthAccountId).toBe(oauthId);

    const restoredPihole = db
      .select()
      .from(piholeInstances)
      .where(eq(piholeInstances.id, piholeId))
      .get();
    expect(restoredPihole?.apiTokenEncrypted).toBe('');

    const restoredUnifi = db
      .select()
      .from(unifiInstances)
      .where(eq(unifiInstances.id, unifiId))
      .get();
    expect(restoredUnifi?.usernameEncrypted).toBe('');
    expect(restoredUnifi?.passwordEncrypted).toBe('');

    const restoredDockerLinks = db
      .select({
        connectionId: widgetConnections.connectionId,
        sortOrder: widgetConnections.sortOrder,
      })
      .from(widgetConnections)
      .where(
        and(
          eq(widgetConnections.widgetInstanceId, docker.widgetInstanceId),
          eq(widgetConnections.connectionType, 'docker'),
        ),
      )
      .orderBy(asc(widgetConnections.sortOrder))
      .all();
    expect(restoredDockerLinks).toEqual([
      { connectionId: docker.connectionId, sortOrder: 0 },
      { connectionId: secondDockerConnectionId, sortOrder: 1 },
    ]);

    const restoredClientSecret = db
      .select()
      .from(integrationConfigs)
      .where(eq(integrationConfigs.key, 'clientSecret'))
      .get();
    expect(restoredClientSecret).toBeUndefined();

    const restoredAdminLogin = await testApp.request
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'supersecurepass1' })
      .set('Content-Type', 'application/json');
    expect(restoredAdminLogin.status).toBe(200);
    const restoredAdminCookie = extractCookies(restoredAdminLogin.headers);
    const adminBackupRes = await testApp.request
      .get('/api/admin/backup')
      .set('Cookie', restoredAdminCookie);
    expect(adminBackupRes.status).toBe(200);

    const backupUsernameLogin = await testApp.request
      .post('/api/auth/login')
      .send({ username: 'backup-admin', password: 'supersecurepass1' })
      .set('Content-Type', 'application/json');
    expect(backupUsernameLogin.status).toBe(401);
  });

  it('requires password reset for other restored users', async () => {
    const loginRes = await testApp.request
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'supersecurepass1' })
      .set('Content-Type', 'application/json');
    const freshCookie = extractCookies(loginRes.headers);
    const freshCsrf = extractCsrfToken(loginRes.body as Record<string, unknown>);

    const createUserRes = await testApp.request
      .post('/api/admin/users')
      .set('Cookie', freshCookie)
      .set('Content-Type', 'application/json')
      .set(csrfHeader(freshCsrf))
      .send({
        username: 'restored-user',
        displayName: 'Restored User',
        password: 'temporary-password',
        role: 'standard',
      });
    expect(createUserRes.status).toBe(201);

    const backupRes = await testApp.request
      .get('/api/admin/backup')
      .set('Cookie', freshCookie);

    const restoreRes = await testApp.request
      .post('/api/admin/backup/restore')
      .set('Cookie', freshCookie)
      .set('Content-Type', 'application/json')
      .set(csrfHeader(freshCsrf))
      .send({ backup: backupRes.body, confirmationWord: 'RESTORE' });
    expect(restoreRes.status).toBe(200);

    const restoredUserLogin = await testApp.request
      .post('/api/auth/login')
      .send({ username: 'restored-user', password: 'temporary-password' })
      .set('Content-Type', 'application/json');
    expect(restoredUserLogin.status).toBe(401);
  });

  it('returns 400 for wrong confirmation word', async () => {
    // Fresh login since prior restore invalidated sessions
    const loginRes = await testApp.request
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'supersecurepass1' })
      .set('Content-Type', 'application/json');
    const freshCookie = extractCookies(loginRes.headers);
    const freshCsrf = extractCsrfToken(loginRes.body as Record<string, unknown>);

    const backupRes = await testApp.request
      .get('/api/admin/backup')
      .set('Cookie', freshCookie);
    const backup = backupRes.body as Record<string, unknown>;

    const res = await testApp.request
      .post('/api/admin/backup/restore')
      .set('Cookie', freshCookie)
      .set('Content-Type', 'application/json')
      .set(csrfHeader(freshCsrf))
      .send({ backup, confirmationWord: 'WRONG' });

    expect(res.status).toBe(400);
  });

  it('returns 400 for missing confirmation word', async () => {
    const loginRes = await testApp.request
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'supersecurepass1' })
      .set('Content-Type', 'application/json');
    const freshCookie = extractCookies(loginRes.headers);
    const freshCsrf = extractCsrfToken(loginRes.body as Record<string, unknown>);

    const backupRes = await testApp.request
      .get('/api/admin/backup')
      .set('Cookie', freshCookie);
    const backup = backupRes.body as Record<string, unknown>;

    const res = await testApp.request
      .post('/api/admin/backup/restore')
      .set('Cookie', freshCookie)
      .set('Content-Type', 'application/json')
      .set(csrfHeader(freshCsrf))
      .send({ backup });

    expect(res.status).toBe(400);
  });

  it('invalidates sessions after restore — old cookie returns 401 on /me', async () => {
    // Fresh login to get a valid session
    const loginRes = await testApp.request
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'supersecurepass1' })
      .set('Content-Type', 'application/json');
    const preRestoreCookie = extractCookies(loginRes.headers);
    const preRestoreCsrf = extractCsrfToken(loginRes.body as Record<string, unknown>);

    // Verify session works before restore
    const meBeforeRes = await testApp.request
      .get('/api/auth/me')
      .set('Cookie', preRestoreCookie);
    expect(meBeforeRes.status).toBe(200);

    // Get backup and execute restore
    const backupRes = await testApp.request
      .get('/api/admin/backup')
      .set('Cookie', preRestoreCookie);
    const backup = backupRes.body as Record<string, unknown>;

    const restoreRes = await testApp.request
      .post('/api/admin/backup/restore')
      .set('Cookie', preRestoreCookie)
      .set('Content-Type', 'application/json')
      .set(csrfHeader(preRestoreCsrf))
      .send({ backup, confirmationWord: 'RESTORE' });
    expect(restoreRes.status).toBe(200);

    // Old session cookie should now be invalid
    const meAfterRes = await testApp.request
      .get('/api/auth/me')
      .set('Cookie', preRestoreCookie);
    expect(meAfterRes.status).toBe(401);
  });

  it('returns 422 and rolls back when backup relationships are invalid', async () => {
    const loginRes = await testApp.request
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'supersecurepass1' })
      .set('Content-Type', 'application/json');
    const freshCookie = extractCookies(loginRes.headers);
    const freshCsrf = extractCsrfToken(loginRes.body as Record<string, unknown>);

    const backupRes = await testApp.request
      .get('/api/admin/backup')
      .set('Cookie', freshCookie);
    const backup = backupRes.body as Record<string, unknown>;
    const data = backup['data'] as Record<string, Record<string, unknown>[]>;
    data['userPreferences']![0]!['webDashboardId'] = crypto.randomUUID();

    const restoreRes = await testApp.request
      .post('/api/admin/backup/restore')
      .set('Cookie', freshCookie)
      .set('Content-Type', 'application/json')
      .set(csrfHeader(freshCsrf))
      .send({ backup, confirmationWord: 'RESTORE' });

    expect(restoreRes.status).toBe(422);
    expect(restoreRes.body).toMatchObject({
      error: 'VALIDATION_ERROR',
      message: 'Backup data violates database integrity constraints and could not be restored.',
    });

    const meRes = await testApp.request
      .get('/api/auth/me')
      .set('Cookie', freshCookie);
    expect(meRes.status).toBe(200);
  });

  it('returns 401 for non-admin (no session)', async () => {
    const res = await testApp.request
      .post('/api/admin/backup/restore')
      .set('Content-Type', 'application/json')
      .send({ backup: {}, confirmationWord: 'RESTORE' });

    expect(res.status).toBe(401);
  });
});
