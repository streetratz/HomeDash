/**
 * T012 (US2): Integration tests for restore preview.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createTestApp,
  extractCookies,
  extractCsrfToken,
  csrfHeader,
  type TestApp,
} from '../helpers/http.js';

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

describe('POST /api/admin/backup/preview', () => {
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

  it('returns 200 with summary, appVersion, exportedAt, and warnings for valid backup', async () => {
    // First obtain a real backup
    const backupRes = await testApp.request
      .get('/api/admin/backup')
      .set('Cookie', cookie);
    expect(backupRes.status).toBe(200);
    const backup = backupRes.body;

    const res = await testApp.request
      .post('/api/admin/backup/preview')
      .set('Cookie', cookie)
      .set('Content-Type', 'application/json')
      .set(csrfHeader(csrf))
      .send(backup);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('summary');
    expect(res.body).toHaveProperty('appVersion');
    expect(res.body).toHaveProperty('exportedAt');
    expect(res.body).toHaveProperty('warnings');
    expect(Array.isArray(res.body.warnings)).toBe(true);
  });

  it('returns 400 for invalid format', async () => {
    const res = await testApp.request
      .post('/api/admin/backup/preview')
      .set('Cookie', cookie)
      .set('Content-Type', 'application/json')
      .set(csrfHeader(csrf))
      .send({ format: 'wrong' });

    expect(res.status).toBe(400);
  });

  it('returns 400 for version higher than supported', async () => {
    // Get a valid backup and override the version
    const backupRes = await testApp.request
      .get('/api/admin/backup')
      .set('Cookie', cookie);
    const backup = backupRes.body as Record<string, unknown>;
    backup['version'] = 999;

    const res = await testApp.request
      .post('/api/admin/backup/preview')
      .set('Cookie', cookie)
      .set('Content-Type', 'application/json')
      .set(csrfHeader(csrf))
      .send(backup);

    expect(res.status).toBe(400);
  });

  it('returns 401 for non-admin (no session)', async () => {
    const res = await testApp.request
      .post('/api/admin/backup/preview')
      .set('Content-Type', 'application/json')
      .send({ format: 'homedash-backup' });

    expect(res.status).toBe(401);
  });
});
