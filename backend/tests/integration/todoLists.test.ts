/**
 * T005 (005): Integration tests for todo list CRUD.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createTestApp,
  extractCookies,
  extractCsrfToken,
  csrfHeader,
  type TestApp,
} from '../helpers/http.js';

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

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Todo list CRUD', () => {
  let testApp: TestApp;
  let cookies: string;
  let csrfToken: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    await setupAdmin(testApp);
    const auth = await loginAdmin(testApp);
    cookies = auth.cookies;
    csrfToken = auth.csrfToken;
  });

  afterAll(async () => {
    await testApp.close();
  });

  // ── Auth ────────────────────────────────────────────────────────────────

  it('GET /api/admin/todo/lists returns 401 without auth', async () => {
    const res = await testApp.request.get('/api/admin/todo/lists');
    expect(res.status).toBe(401);
  });

  it('POST /api/admin/todo/lists returns 403 without CSRF', async () => {
    const res = await testApp.request
      .post('/api/admin/todo/lists')
      .set('Cookie', cookies)
      .send({ name: 'Test' });
    expect(res.status).toBe(403);
  });

  // ── GET (empty) ─────────────────────────────────────────────────────────

  it('returns empty array initially', async () => {
    const res = await testApp.request
      .get('/api/admin/todo/lists')
      .set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  // ── POST ────────────────────────────────────────────────────────────────

  it('creates a list with valid body', async () => {
    const res = await testApp.request
      .post('/api/admin/todo/lists')
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({ name: 'My Tasks', color: '#ff0000' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('My Tasks');
    expect(res.body.color).toBe('#ff0000');
    expect(res.body.providerType).toBe('local');
    expect(res.body.id).toBeDefined();
  });

  it('creates a list without color', async () => {
    const res = await testApp.request
      .post('/api/admin/todo/lists')
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({ name: 'No Color List' });
    expect(res.status).toBe(201);
    expect(res.body.color).toBeNull();
  });

  it('rejects empty name', async () => {
    const res = await testApp.request
      .post('/api/admin/todo/lists')
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({ name: '' });
    expect(res.status).toBe(422);
  });

  it('rejects name > 100 chars', async () => {
    const res = await testApp.request
      .post('/api/admin/todo/lists')
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({ name: 'x'.repeat(101) });
    expect(res.status).toBe(422);
  });

  it('rejects invalid color format', async () => {
    const res = await testApp.request
      .post('/api/admin/todo/lists')
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({ name: 'Bad Color', color: 'red' });
    expect(res.status).toBe(422);
  });

  // ── GET (after creation) ────────────────────────────────────────────────

  it('returns created lists after POST', async () => {
    const res = await testApp.request
      .get('/api/admin/todo/lists')
      .set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    expect(res.body.some((l: { name: string }) => l.name === 'My Tasks')).toBe(true);
  });

  // ── PUT ─────────────────────────────────────────────────────────────────

  it('updates a list name', async () => {
    // Get list ID first
    const listsRes = await testApp.request
      .get('/api/admin/todo/lists')
      .set('Cookie', cookies);
    const listId = listsRes.body[0].id;

    const res = await testApp.request
      .put(`/api/admin/todo/lists/${listId}`)
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({ name: 'Renamed List' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Renamed List');
  });

  it('returns 404 for non-existent list ID', async () => {
    const res = await testApp.request
      .put('/api/admin/todo/lists/00000000-0000-0000-0000-000000000000')
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({ name: 'Ghost' });
    expect(res.status).toBe(404);
  });

  // ── DELETE ──────────────────────────────────────────────────────────────

  it('deletes a list and cascade-deletes items', async () => {
    // Create list + item
    const createListRes = await testApp.request
      .post('/api/admin/todo/lists')
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({ name: 'Delete Me' });
    const listId = createListRes.body.id;

    await testApp.request
      .post(`/api/admin/todo/lists/${listId}/items`)
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({ title: 'Orphan Item' });

    // Delete list
    const delRes = await testApp.request
      .delete(`/api/admin/todo/lists/${listId}`)
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken));
    expect(delRes.status).toBe(204);

    // Verify list gone
    const listsRes = await testApp.request
      .get('/api/admin/todo/lists')
      .set('Cookie', cookies);
    expect(listsRes.body.some((l: { id: string }) => l.id === listId)).toBe(false);

    // Verify items gone
    const itemsRes = await testApp.request
      .get(`/api/admin/todo/lists/${listId}/items`)
      .set('Cookie', cookies);
    expect(itemsRes.body).toEqual([]);
  });
});
