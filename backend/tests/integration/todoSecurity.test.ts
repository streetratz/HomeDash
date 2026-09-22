/**
 * T029 (005): Security and validation tests for todo endpoints.
 *
 * Verifies:
 * - All mutating endpoints require authentication (401 without session)
 * - All mutating endpoints require CSRF token (403 without CSRF)
 * - Input validation rejects oversized/invalid payloads
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  createTestApp,
  extractCookies,
  extractCsrfToken,
  csrfHeader,
  type TestApp,
} from '../helpers/http.js';
import { todoLists, todoItems } from '../../src/db/schema/index.js';
import { getDb } from '../../src/db/drizzle.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

async function setupAdmin(testApp: TestApp) {
  await testApp.request
    .post('/api/first-run/admin')
    .send({ username: 'admin', displayName: 'Admin', password: 'supersecurepass1' })
    .set('Content-Type', 'application/json');
}

async function loginAdmin(testApp: TestApp) {
  const res = await testApp.request
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'supersecurepass1' })
    .set('Content-Type', 'application/json');

  return {
    cookies: extractCookies(res.headers),
    csrfToken: extractCsrfToken(res.body),
  };
}

// ─── Auth enforcement ───────────────────────────────────────────────────────

describe('Todo security — auth enforcement', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
    await setupAdmin(testApp);
  });

  afterAll(async () => {
    await testApp.close();
  });

  const mutatingEndpoints = [
    { method: 'post' as const, url: '/api/admin/todo/lists' },
    { method: 'put' as const, url: '/api/admin/todo/lists/fake-id' },
    { method: 'delete' as const, url: '/api/admin/todo/lists/fake-id' },
    { method: 'post' as const, url: '/api/admin/todo/lists/fake-id/items' },
    { method: 'put' as const, url: '/api/admin/todo/items/fake-id' },
    { method: 'delete' as const, url: '/api/admin/todo/items/fake-id' },
    { method: 'put' as const, url: '/api/admin/todo/lists/fake-id/reorder' },
    { method: 'post' as const, url: '/api/admin/todo/sync/microsoft' },
  ];

  for (const ep of mutatingEndpoints) {
    it(`${ep.method.toUpperCase()} ${ep.url} returns 401 without session`, async () => {
      const res = await testApp.request[ep.method](ep.url)
        .set('Content-Type', 'application/json')
        .send({});

      expect(res.status).toBe(401);
    });
  }

  it('GET /api/admin/todo/lists returns 401 without session', async () => {
    const res = await testApp.request.get('/api/admin/todo/lists');
    expect(res.status).toBe(401);
  });
});

// ─── CSRF enforcement ───────────────────────────────────────────────────────

describe('Todo security — CSRF enforcement', () => {
  let testApp: TestApp;
  let cookies: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    await setupAdmin(testApp);
    const auth = await loginAdmin(testApp);
    cookies = auth.cookies;
  });

  afterAll(async () => {
    await testApp.close();
  });

  const csrfEndpoints = [
    { method: 'post' as const, url: '/api/admin/todo/lists', body: { name: 'test' } },
    { method: 'put' as const, url: '/api/admin/todo/lists/fake-id', body: { name: 'test' } },
    { method: 'delete' as const, url: '/api/admin/todo/lists/fake-id', body: {} },
    { method: 'post' as const, url: '/api/admin/todo/lists/fake-id/items', body: { title: 'test' } },
    { method: 'put' as const, url: '/api/admin/todo/items/fake-id', body: { title: 'test' } },
    { method: 'delete' as const, url: '/api/admin/todo/items/fake-id', body: {} },
  ];

  for (const ep of csrfEndpoints) {
    it(`${ep.method.toUpperCase()} ${ep.url} returns 403 without CSRF`, async () => {
      const res = await testApp.request[ep.method](ep.url)
        .set('Cookie', cookies)
        .set('Content-Type', 'application/json')
        .send(ep.body);

      expect(res.status).toBe(403);
    });
  }
});

// ─── Input validation ───────────────────────────────────────────────────────

describe('Todo security — input validation', () => {
  let testApp: TestApp;
  let cookies: string;
  let csrfToken: string;
  let testListId: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    await setupAdmin(testApp);
    const auth = await loginAdmin(testApp);
    cookies = auth.cookies;
    csrfToken = auth.csrfToken;
  });

  beforeEach(() => {
    const db = getDb();
    db.delete(todoItems).run();
    db.delete(todoLists).run();
  });

  afterAll(async () => {
    await testApp.close();
  });

  async function createList(name = 'Test List') {
    const res = await testApp.request
      .post('/api/admin/todo/lists')
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .set('Content-Type', 'application/json')
      .send({ name });
    testListId = res.body.id;
    return res;
  }

  it('rejects list name > 100 chars with 400', async () => {
    const res = await testApp.request
      .post('/api/admin/todo/lists')
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .set('Content-Type', 'application/json')
      .send({ name: 'x'.repeat(101) });

    expect(res.status).toBe(422);
  });

  it('rejects empty list name with 400', async () => {
    const res = await testApp.request
      .post('/api/admin/todo/lists')
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .set('Content-Type', 'application/json')
      .send({ name: '' });

    expect(res.status).toBe(422);
  });

  it('rejects invalid list color with 400', async () => {
    const res = await testApp.request
      .post('/api/admin/todo/lists')
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .set('Content-Type', 'application/json')
      .send({ name: 'Test', color: 'red' });

    expect(res.status).toBe(422);
  });

  it('rejects item title > 500 chars with 400', async () => {
    await createList();
    const res = await testApp.request
      .post(`/api/admin/todo/lists/${testListId}/items`)
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .set('Content-Type', 'application/json')
      .send({ title: 'x'.repeat(501) });

    expect(res.status).toBe(422);
  });

  it('rejects empty item title with 400', async () => {
    await createList();
    const res = await testApp.request
      .post(`/api/admin/todo/lists/${testListId}/items`)
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .set('Content-Type', 'application/json')
      .send({ title: '' });

    expect(res.status).toBe(422);
  });

  it('rejects item notes > 5000 chars with 400', async () => {
    await createList();
    const res = await testApp.request
      .post(`/api/admin/todo/lists/${testListId}/items`)
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .set('Content-Type', 'application/json')
      .send({ title: 'Valid', notes: 'x'.repeat(5001) });

    expect(res.status).toBe(422);
  });

  it('rejects priority > 3 with 400', async () => {
    await createList();
    const res = await testApp.request
      .post(`/api/admin/todo/lists/${testListId}/items`)
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .set('Content-Type', 'application/json')
      .send({ title: 'Valid', priority: 5 });

    expect(res.status).toBe(422);
  });

  it('accepts valid list at boundary (100 chars)', async () => {
    const res = await testApp.request
      .post('/api/admin/todo/lists')
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .set('Content-Type', 'application/json')
      .send({ name: 'x'.repeat(100) });

    expect(res.status).toBe(201);
  });

  it('accepts valid item at boundary (500 char title, 5000 char notes)', async () => {
    await createList();
    const res = await testApp.request
      .post(`/api/admin/todo/lists/${testListId}/items`)
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .set('Content-Type', 'application/json')
      .send({ title: 'x'.repeat(500), notes: 'y'.repeat(5000) });

    expect(res.status).toBe(201);
  });
});
