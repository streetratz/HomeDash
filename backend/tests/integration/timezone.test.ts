/**
 * T020 (US3): Integration tests for timezone endpoint.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createTestApp,
  extractCookies,
  extractCsrfToken,
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

describe('GET /api/admin/timezones', () => {
  let testApp: TestApp;
  let cookie: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    const session = await setupAdminAndLogin(testApp);
    cookie = session.cookie;
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('returns 200 with timezones array for authenticated admin', async () => {
    const res = await testApp.request
      .get('/api/admin/timezones')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('timezones');
    expect(Array.isArray(res.body.timezones)).toBe(true);
  });

  it('returns at least 400 timezone entries', async () => {
    const res = await testApp.request
      .get('/api/admin/timezones')
      .set('Cookie', cookie);

    expect(res.body.timezones.length).toBeGreaterThanOrEqual(400);
  });

  it('includes well-known IANA timezones', async () => {
    const res = await testApp.request
      .get('/api/admin/timezones')
      .set('Cookie', cookie);

    const timezones: string[] = res.body.timezones;
    expect(timezones).toContain('America/New_York');
    expect(timezones).toContain('Europe/London');
    expect(timezones).toContain('Asia/Tokyo');
  });

  it('returns 401 for unauthenticated request', async () => {
    const res = await testApp.request.get('/api/admin/timezones');
    expect(res.status).toBe(401);
  });
});
