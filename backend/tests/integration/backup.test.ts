/**
 * T008 (US1): Integration tests for backup download.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createTestApp,
  extractCookies,
  extractCsrfToken,
  type TestApp,
} from '../helpers/http.js';
import { getDb } from '../../src/db/drizzle.js';
import {
  integrationConfigs,
  piholeInstances,
  unifiInstances,
} from '../../src/db/schema/index.js';

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

const EXPECTED_DATA_KEYS = [
  'users',
  'userPreferences',
  'appShellSettings',
  'dashboards',
  'placeholderWidgets',
  'placeholderBreakpointLayouts',
  'appWidgetInstances',
  'linksListItems',
  'calendarSources',
  'todoLists',
  'todoItems',
  'groups',
  'groupPermissions',
  'userGroupMemberships',
  'dashboardAccessRules',
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
];

const EXCLUDED_DATA_KEYS = [
  'sessions',
  'calendarEvents',
  'shortcutPingResults',
  'iconCacheEntries',
  'uploadedAssets',
];

describe('GET /api/admin/backup', () => {
  let testApp: TestApp;
  let cookie: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    const auth = await setupAdminAndLogin(testApp);
    cookie = auth.cookie;

    const db = getDb();
    const now = new Date().toISOString();
    db.insert(integrationConfigs)
      .values([
        { provider: 'spotify', key: 'clientId', value: 'spotify-client', updatedAt: now },
        { provider: 'spotify', key: 'clientSecret', value: 'spotify-secret', updatedAt: now },
        { provider: 'sonos_mode', key: 'mode', value: 'local', updatedAt: now },
      ])
      .run();
    db.insert(piholeInstances)
      .values({
        id: 'backup-test-pihole',
        name: 'Backup Pi-hole',
        baseUrl: 'https://pihole.example.test',
        apiTokenEncrypted: 'encrypted-pihole-token',
        pollIntervalSec: 30,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    db.insert(unifiInstances)
      .values({
        id: 'backup-test-unifi',
        name: 'Backup UniFi',
        baseUrl: 'https://unifi.example.test',
        usernameEncrypted: 'encrypted-unifi-user',
        passwordEncrypted: 'encrypted-unifi-password',
        siteName: 'default',
        pollIntervalSec: 30,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('returns 200 with valid JSON backup envelope', async () => {
    const res = await testApp.request
      .get('/api/admin/backup')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);

    const backup = res.body as Record<string, unknown>;
    expect(backup['format']).toBe('homedash-backup');
    expect(backup['version']).toBe(1);
    expect(backup).toHaveProperty('appVersion');
    expect(typeof backup['appVersion']).toBe('string');
    expect(backup).toHaveProperty('exportedAt');
    expect(typeof backup['exportedAt']).toBe('string');
    expect(backup).toHaveProperty('summary');
    expect(backup).toHaveProperty('data');
  });

  it('returns 401 for non-admin (no session)', async () => {
    const res = await testApp.request.get('/api/admin/backup');
    expect(res.status).toBe(401);
  });

  it('excludes passwordHash from users', async () => {
    const res = await testApp.request
      .get('/api/admin/backup')
      .set('Cookie', cookie);

    const backup = res.body as Record<string, unknown>;
    const data = backup['data'] as Record<string, unknown[]>;
    expect(data['users']!.length).toBeGreaterThan(0);
    for (const user of data['users']!) {
      expect(user).not.toHaveProperty('passwordHash');
    }
  });

  it('excludes encrypted OAuth credentials from oauthAccounts', async () => {
    const res = await testApp.request
      .get('/api/admin/backup')
      .set('Cookie', cookie);

    const backup = res.body as Record<string, unknown>;
    const data = backup['data'] as Record<string, unknown[]>;
    expect(data).toHaveProperty('oauthAccounts');
    expect(Array.isArray(data['oauthAccounts'])).toBe(true);
    for (const account of data['oauthAccounts']!) {
      expect(account).not.toHaveProperty('accessTokenEnc');
      expect(account).not.toHaveProperty('refreshTokenEnc');
      expect(account).not.toHaveProperty('tokenExpiresAt');
    }
  });

  it('excludes encrypted passwords from caldavAccounts', async () => {
    const res = await testApp.request
      .get('/api/admin/backup')
      .set('Cookie', cookie);

    const backup = res.body as Record<string, unknown>;
    const data = backup['data'] as Record<string, unknown[]>;
    expect(data).toHaveProperty('caldavAccounts');
    expect(Array.isArray(data['caldavAccounts'])).toBe(true);
    for (const account of data['caldavAccounts']!) {
      expect(account).not.toHaveProperty('encryptedPassword');
    }
  });

  it('excludes integration, Pi-hole, and UniFi credentials', async () => {
    const res = await testApp.request
      .get('/api/admin/backup')
      .set('Cookie', cookie);

    const backup = res.body as Record<string, unknown>;
    const data = backup['data'] as Record<string, Record<string, unknown>[]>;

    expect(data['integrationConfigs']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provider: 'spotify', key: 'clientId' }),
        expect.objectContaining({ provider: 'sonos_mode', key: 'mode' }),
      ]),
    );
    expect(data['integrationConfigs']).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provider: 'spotify', key: 'clientSecret' }),
      ]),
    );
    expect(data['piholeInstances']![0]).not.toHaveProperty('apiTokenEncrypted');
    expect(data['unifiInstances']![0]).not.toHaveProperty('usernameEncrypted');
    expect(data['unifiInstances']![0]).not.toHaveProperty('passwordEncrypted');
  });

  it('summary counts match actual data array lengths', async () => {
    const res = await testApp.request
      .get('/api/admin/backup')
      .set('Cookie', cookie);

    const backup = res.body as Record<string, unknown>;
    const summary = backup['summary'] as Record<string, number>;
    const data = backup['data'] as Record<string, unknown[]>;

    expect(summary['users']).toBe(data['users']!.length);
    expect(summary['dashboards']).toBe(data['dashboards']!.length);
    expect(summary['widgets']).toBe(data['appWidgetInstances']!.length);
    expect(summary['groups']).toBe(data['groups']!.length);
    expect(summary['scheduledJobs']).toBe(data['scheduledJobs']!.length);
    expect(summary['calendarSources']).toBe(data['calendarSources']!.length);
    expect(summary['todoLists']).toBe(data['todoLists']!.length);
    expect(summary['integrations']).toBe(data['integrationConfigs']!.length);
    expect(summary['photoSources']).toBe(data['photoSources']!.length);
  });

  it('does NOT contain excluded table keys', async () => {
    const res = await testApp.request
      .get('/api/admin/backup')
      .set('Cookie', cookie);

    const backup = res.body as Record<string, unknown>;
    const data = backup['data'] as Record<string, unknown>;

    for (const key of EXCLUDED_DATA_KEYS) {
      expect(data).not.toHaveProperty(key);
    }

    // Verify all expected keys are present
    for (const key of EXPECTED_DATA_KEYS) {
      expect(data).toHaveProperty(key);
    }
  });
});
