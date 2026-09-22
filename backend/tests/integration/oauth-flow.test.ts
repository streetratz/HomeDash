/**
 * T010 (004): OAuth flow integration tests.
 *
 * Tests OAuth route auth/CSRF guards, account listing/deletion,
 * provider availability, and service-level token exchange with mocked fetch.
 */

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import {
  createTestApp,
  extractCookies,
  extractCsrfToken,
  csrfHeader,
  type TestApp,
} from '../helpers/http.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

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

async function loginAdmin(
  testApp: TestApp,
  password = 'supersecurepass1',
): Promise<{ sessionCookie: string; csrfToken: string }> {
  const res = await testApp.request
    .post('/api/auth/login')
    .send({ username: 'admin', password })
    .set('Content-Type', 'application/json');

  return {
    sessionCookie: extractCookies(res.headers),
    csrfToken: extractCsrfToken(res.body as Record<string, unknown>),
  };
}

// ─── Route-level auth/CSRF checks ───────────────────────────────────────────

describe('OAuth route auth guards', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
    await setupAdmin(testApp);
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('GET /api/auth/oauth/microsoft without auth returns 401', async () => {
    const res = await testApp.request.get('/api/auth/oauth/microsoft');
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/oauth/google without auth returns 401', async () => {
    const res = await testApp.request.get('/api/auth/oauth/google');
    expect(res.status).toBe(401);
  });

  it('GET /api/user/oauth/accounts without auth returns 401', async () => {
    const res = await testApp.request.get('/api/user/oauth/accounts');
    expect(res.status).toBe(401);
  });

  it('GET /api/user/oauth/providers without auth returns 401', async () => {
    const res = await testApp.request.get('/api/user/oauth/providers');
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/oauth/microsoft with auth returns 400 when provider not configured', async () => {
    const { sessionCookie } = await loginAdmin(testApp);
    const res = await testApp.request
      .get('/api/auth/oauth/microsoft')
      .set('Cookie', sessionCookie);

    // Not configured → should return 400 (provider not set up)
    expect(res.status).toBe(400);
  });

  it('GET /api/auth/oauth/google with auth returns 400 when provider not configured', async () => {
    const { sessionCookie } = await loginAdmin(testApp);
    const res = await testApp.request
      .get('/api/auth/oauth/google')
      .set('Cookie', sessionCookie);

    expect(res.status).toBe(400);
  });
});

// ─── Account listing / providers ────────────────────────────────────────────

describe('GET /api/user/oauth/accounts', () => {
  let testApp: TestApp;
  let sessionCookie: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    await setupAdmin(testApp);
    const login = await loginAdmin(testApp);
    sessionCookie = login.sessionCookie;
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('returns empty array initially', async () => {
    const res = await testApp.request
      .get('/api/user/oauth/accounts')
      .set('Cookie', sessionCookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('GET /api/user/oauth/providers', () => {
  let testApp: TestApp;
  let sessionCookie: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    await setupAdmin(testApp);
    const login = await loginAdmin(testApp);
    sessionCookie = login.sessionCookie;
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('returns { microsoft: false, google: false, spotify: false } when env vars not set', async () => {
    const res = await testApp.request
      .get('/api/user/oauth/providers')
      .set('Cookie', sessionCookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ microsoft: false, google: false, spotify: false, sonos: false });
  });
});

// ─── DELETE account CSRF guard ──────────────────────────────────────────────

describe('DELETE /api/admin/oauth/accounts/:id', () => {
  let testApp: TestApp;
  let sessionCookie: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    await setupAdmin(testApp);
    const login = await loginAdmin(testApp);
    sessionCookie = login.sessionCookie;
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('returns 403 without CSRF token', async () => {
    const fakeId = '00000000-0000-4000-8000-000000000000';
    const res = await testApp.request
      .delete(`/api/admin/oauth/accounts/${fakeId}`)
      .set('Cookie', sessionCookie);

    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent account with valid CSRF', async () => {
    const { sessionCookie: cookie, csrfToken } = await loginAdmin(testApp);
    const fakeId = '00000000-0000-4000-8000-000000000000';
    const res = await testApp.request
      .delete(`/api/admin/oauth/accounts/${fakeId}`)
      .set('Cookie', cookie)
      .set(csrfHeader(csrfToken));

    expect(res.status).toBe(404);
  });
});

// ─── Service-level exchange + account CRUD with mocked fetch ────────────────

describe('OAuth service with mocked fetch', () => {
  let testApp: TestApp;
  let sessionCookie: string;
  let csrfToken: string;
  const originalFetch = globalThis.fetch;

  beforeAll(async () => {
    testApp = await createTestApp();
    await setupAdmin(testApp);
    const login = await loginAdmin(testApp);
    sessionCookie = login.sessionCookie;
    csrfToken = login.csrfToken;
  });

  afterAll(async () => {
    globalThis.fetch = originalFetch;
    await testApp.close();
  });

  beforeEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('exchangeMicrosoftCode creates an account visible in listing', async () => {
    // Set up env vars for this test via process.env
    const { _resetEnvCache } = await import('../../src/config/env.js');
    process.env['MICROSOFT_CLIENT_ID'] = 'test-client-id';
    process.env['MICROSOFT_CLIENT_SECRET'] = 'test-client-secret';
    process.env['MICROSOFT_REDIRECT_URI'] = 'http://localhost:3000/api/auth/oauth/microsoft/callback';
    _resetEnvCache();

    // Mock fetch to return token + profile responses
    globalThis.fetch = vi.fn().mockImplementation((url: string | URL) => {
      const urlStr = typeof url === 'string' ? url : url.toString();

      if (urlStr.includes('login.microsoftonline.com')) {
        return new Response(
          JSON.stringify({
            access_token: 'mock-access-token',
            refresh_token: 'mock-refresh-token',
            expires_in: 3600,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (urlStr.includes('graph.microsoft.com')) {
        return new Response(
          JSON.stringify({
            id: 'ms-user-123',
            mail: 'test@example.com',
            displayName: 'Test User',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      return new Response('Not found', { status: 404 });
    }) as typeof fetch;

    // Get the admin user ID from the ME endpoint
    const meRes = await testApp.request
      .get('/api/auth/me')
      .set('Cookie', sessionCookie);
    const userId = (meRes.body as { user: { id: string } }).user.id;

    // Call the service directly
    const { exchangeMicrosoftCode: exchange } = await import(
      '../../src/services/oauth-service.js'
    );
    const account = await exchange('mock-code', userId);

    expect(account.provider).toBe('microsoft');
    expect(account.email).toBe('test@example.com');
    expect(account.displayName).toBe('Test User');
    expect(account.status).toBe('active');

    // Verify the account appears in the listing
    const listRes = await testApp.request
      .get('/api/user/oauth/accounts')
      .set('Cookie', sessionCookie);

    expect(listRes.status).toBe(200);
    const accounts = listRes.body as Array<Record<string, unknown>>;
    expect(accounts.length).toBeGreaterThanOrEqual(1);

    const found = accounts.find((a) => a['provider'] === 'microsoft');
    expect(found).toBeDefined();
    expect(found!['email']).toBe('test@example.com');

    // Verify tokens are NOT exposed
    expect(found).not.toHaveProperty('accessTokenEnc');
    expect(found).not.toHaveProperty('refreshTokenEnc');
    expect(found).not.toHaveProperty('tokenExpiresAt');

    // Delete the account
    const deleteRes = await testApp.request
      .delete(`/api/admin/oauth/accounts/${account.id}`)
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrfToken));

    expect(deleteRes.status).toBe(204);

    // Verify it's gone
    const listRes2 = await testApp.request
      .get('/api/user/oauth/accounts')
      .set('Cookie', sessionCookie);

    const accounts2 = listRes2.body as Array<Record<string, unknown>>;
    const found2 = accounts2.find((a) => a['provider'] === 'microsoft');
    expect(found2).toBeUndefined();

    // Clean up env
    delete process.env['MICROSOFT_CLIENT_ID'];
    delete process.env['MICROSOFT_CLIENT_SECRET'];
    delete process.env['MICROSOFT_REDIRECT_URI'];
    _resetEnvCache();
  });

  it('account listing never includes encrypted token fields', async () => {
    const { _resetEnvCache } = await import('../../src/config/env.js');
    process.env['GOOGLE_CLIENT_ID'] = 'test-google-id';
    process.env['GOOGLE_CLIENT_SECRET'] = 'test-google-secret';
    process.env['GOOGLE_REDIRECT_URI'] = 'http://localhost:3000/api/auth/oauth/google/callback';
    _resetEnvCache();

    globalThis.fetch = vi.fn().mockImplementation((url: string | URL) => {
      const urlStr = typeof url === 'string' ? url : url.toString();

      if (urlStr.includes('oauth2.googleapis.com')) {
        return new Response(
          JSON.stringify({
            access_token: 'google-access-token',
            refresh_token: 'google-refresh-token',
            expires_in: 3600,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (urlStr.includes('googleapis.com/oauth2')) {
        return new Response(
          JSON.stringify({
            id: 'google-user-456',
            email: 'google@example.com',
            name: 'Google User',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      return new Response('Not found', { status: 404 });
    }) as typeof fetch;

    const meRes = await testApp.request
      .get('/api/auth/me')
      .set('Cookie', sessionCookie);
    const userId = (meRes.body as { user: { id: string } }).user.id;

    const { exchangeGoogleCode: exchangeGoogle } = await import(
      '../../src/services/oauth-service.js'
    );
    const account = await exchangeGoogle('mock-code', userId);

    const listRes = await testApp.request
      .get('/api/user/oauth/accounts')
      .set('Cookie', sessionCookie);

    const accounts = listRes.body as Array<Record<string, unknown>>;
    for (const a of accounts) {
      expect(a).not.toHaveProperty('accessTokenEnc');
      expect(a).not.toHaveProperty('refreshTokenEnc');
    }

    // Clean up
    const deleteRes = await testApp.request
      .delete(`/api/admin/oauth/accounts/${account.id}`)
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrfToken));
    expect(deleteRes.status).toBe(204);

    delete process.env['GOOGLE_CLIENT_ID'];
    delete process.env['GOOGLE_CLIENT_SECRET'];
    delete process.env['GOOGLE_REDIRECT_URI'];
    _resetEnvCache();
  });
});

// ─── Callback redirect tests ────────────────────────────────────────────────

describe('OAuth callback routes', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
    await setupAdmin(testApp);
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('Microsoft callback with missing state redirects with error', async () => {
    const res = await testApp.request
      .get('/api/auth/oauth/microsoft/callback?code=abc');

    // Should redirect
    expect(res.status).toBe(302);
    expect(res.headers['location']).toContain('error=oauth_invalid');
  });

  it('Microsoft callback with invalid state redirects with error', async () => {
    const res = await testApp.request
      .get('/api/auth/oauth/microsoft/callback?code=abc&state=invalid');

    expect(res.status).toBe(302);
    expect(res.headers['location']).toContain('error=oauth_state_invalid');
  });

  it('Google callback with error param redirects with denied error', async () => {
    const res = await testApp.request
      .get('/api/auth/oauth/google/callback?error=access_denied');

    expect(res.status).toBe(302);
    expect(res.headers['location']).toContain('error=oauth_denied');
  });
});
