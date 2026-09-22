/**
 * T025 (US4): Integration tests for remember-me login.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createTestApp,
  extractCookies,
  extractCsrfToken,
  csrfHeader,
  type TestApp,
} from '../helpers/http.js';

async function setupAdmin(testApp: TestApp) {
  await testApp.request
    .post('/api/first-run/admin')
    .send({ username: 'admin', displayName: 'Admin', password: 'supersecurepass1' })
    .set('Content-Type', 'application/json');
}

function getSessionCookieString(headers: Record<string, string | string[]>): string | undefined {
  const setCookie = headers['set-cookie'];
  if (!setCookie) return undefined;
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  return cookies.find((c) => c.includes('homedash_session'));
}

describe('Remember-me login', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
    await setupAdmin(testApp);
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('sets Max-Age=2592000 when rememberMe is true', async () => {
    const res = await testApp.request
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'supersecurepass1', rememberMe: true })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    const sessionCookie = getSessionCookieString(res.headers);
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie!.toLowerCase()).toContain('max-age=2592000');
  });

  it('does NOT set Max-Age when rememberMe is false', async () => {
    const res = await testApp.request
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'supersecurepass1', rememberMe: false })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    const sessionCookie = getSessionCookieString(res.headers);
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie!.toLowerCase()).not.toContain('max-age');
  });

  it('defaults to session cookie (no Max-Age) when rememberMe is omitted', async () => {
    const res = await testApp.request
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'supersecurepass1' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    const sessionCookie = getSessionCookieString(res.headers);
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie!.toLowerCase()).not.toContain('max-age');
  });

  it('logout destroys remember-me session so /me returns 401', async () => {
    const loginRes = await testApp.request
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'supersecurepass1', rememberMe: true })
      .set('Content-Type', 'application/json');

    expect(loginRes.status).toBe(200);
    const cookie = extractCookies(loginRes.headers);
    const csrf = extractCsrfToken(loginRes.body as Record<string, unknown>);

    const logoutRes = await testApp.request
      .post('/api/auth/logout')
      .set('Cookie', cookie)
      .set(csrfHeader(csrf));

    expect(logoutRes.status).toBe(204);

    const meRes = await testApp.request
      .get('/api/auth/me')
      .set('Cookie', cookie);

    expect(meRes.status).toBe(401);
  });
});
