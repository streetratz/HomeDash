/**
 * T042 (US1): Integration tests for login, logout, and /me flows.
 *
 * Covers:
 * - Successful login sets session cookie + returns user + csrfToken.
 * - Login with wrong credentials returns 401.
 * - GET /me with session returns user + fresh csrfToken.
 * - GET /me without session returns 401.
 * - POST /logout with valid session + CSRF clears session.
 * - POST /logout without session returns 401.
 * - POST /logout without CSRF token returns 403.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createTestApp,
  extractCookies,
  extractCsrfToken,
  csrfHeader,
  type TestApp,
} from '../helpers/http.js';

/** Register an admin user and return the test app. */
async function setupAdmin(
  testApp: TestApp,
  username = 'admin',
  password = 'supersecurepass1',
) {
  await testApp.request
    .post('/api/first-run/admin')
    .send({ username, displayName: 'Admin', password })
    .set('Content-Type', 'application/json');
}

describe('POST /api/auth/login', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
    await setupAdmin(testApp);
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('returns 200 with user and csrfToken on valid credentials', async () => {
    const res = await testApp.request
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'supersecurepass1' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('user');
    expect(res.body.user).toMatchObject({ username: 'admin', role: 'admin' });
    expect(res.body).toHaveProperty('csrfToken');
  });

  it('sets a session cookie on successful login', async () => {
    const res = await testApp.request
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'supersecurepass1' })
      .set('Content-Type', 'application/json');

    const cookies = extractCookies(res.headers);
    expect(cookies).toContain('homedash_session');
  });

  it('returns 401 for wrong password', async () => {
    const res = await testApp.request
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'wrongpassword' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 401 for non-existent user', async () => {
    const res = await testApp.request
      .post('/api/auth/login')
      .send({ username: 'nobody', password: 'irrelevant123' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(401);
  });

  it('returns 422 for missing fields', async () => {
    const res = await testApp.request
      .post('/api/auth/login')
      .send({})
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(422);
  });
});

describe('GET /api/auth/me', () => {
  let testApp: TestApp;
  let sessionCookie: string;
  let csrfToken: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    await setupAdmin(testApp);

    const loginRes = await testApp.request
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'supersecurepass1' })
      .set('Content-Type', 'application/json');

    sessionCookie = extractCookies(loginRes.headers);
    csrfToken = extractCsrfToken(loginRes.body as Record<string, unknown>);
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('returns 200 with user info when authenticated', async () => {
    const res = await testApp.request
      .get('/api/auth/me')
      .set('Cookie', sessionCookie);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('user');
    expect(res.body.user).toMatchObject({ username: 'admin', role: 'admin' });
    expect(res.body).toHaveProperty('csrfToken');
  });

  it('returns 401 without a session cookie', async () => {
    const res = await testApp.request.get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 with an invalid session cookie value', async () => {
    const res = await testApp.request
      .get('/api/auth/me')
      .set('Cookie', 'homedash_session=not-a-valid-session-id');

    expect(res.status).toBe(401);
  });

  // csrfToken is available for use by other tests
  it('includes a valid csrfToken in response', () => {
    expect(typeof csrfToken).toBe('string');
    expect(csrfToken.split('.').length).toBe(3);
  });
});

describe('POST /api/auth/logout', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
    await setupAdmin(testApp);
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('returns 401 without a session', async () => {
    const res = await testApp.request.post('/api/auth/logout');
    expect(res.status).toBe(401);
  });

  it('returns 403 when CSRF token is missing', async () => {
    const loginRes = await testApp.request
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'supersecurepass1' })
      .set('Content-Type', 'application/json');

    const sessionCookie = extractCookies(loginRes.headers);

    const res = await testApp.request
      .post('/api/auth/logout')
      .set('Cookie', sessionCookie);

    expect(res.status).toBe(403);
  });

  it('returns 204 and clears session on valid logout', async () => {
    const loginRes = await testApp.request
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'supersecurepass1' })
      .set('Content-Type', 'application/json');

    const sessionCookie = extractCookies(loginRes.headers);
    const csrf = extractCsrfToken(loginRes.body as Record<string, unknown>);

    const logoutRes = await testApp.request
      .post('/api/auth/logout')
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrf));

    expect(logoutRes.status).toBe(204);

    // Verify session is destroyed — ME should now return 401
    const meRes = await testApp.request
      .get('/api/auth/me')
      .set('Cookie', sessionCookie);

    expect(meRes.status).toBe(401);
  });

  it('returns 403 with wrong CSRF token', async () => {
    const loginRes = await testApp.request
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'supersecurepass1' })
      .set('Content-Type', 'application/json');

    const sessionCookie = extractCookies(loginRes.headers);

    const res = await testApp.request
      .post('/api/auth/logout')
      .set('Cookie', sessionCookie)
      .set('x-csrf-token', 'definitely-invalid-token');

    expect(res.status).toBe(403);
  });
});
