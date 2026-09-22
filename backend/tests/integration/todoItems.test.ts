/**
 * T006 (005): Integration tests for todo item CRUD.
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

describe('Todo item CRUD', () => {
  let testApp: TestApp;
  let cookies: string;
  let csrfToken: string;
  let listId: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    await setupAdmin(testApp);
    const auth = await loginAdmin(testApp);
    cookies = auth.cookies;
    csrfToken = auth.csrfToken;

    // Create a list for items
    const res = await testApp.request
      .post('/api/admin/todo/lists')
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({ name: 'Test Items List' });
    listId = res.body.id;
  });

  afterAll(async () => {
    await testApp.close();
  });

  // ── Auth ────────────────────────────────────────────────────────────────

  it('POST items returns 401 without auth', async () => {
    const res = await testApp.request
      .post(`/api/admin/todo/lists/${listId}/items`)
      .send({ title: 'Test' });
    expect(res.status).toBe(401);
  });

  it('POST items returns 403 without CSRF', async () => {
    const res = await testApp.request
      .post(`/api/admin/todo/lists/${listId}/items`)
      .set('Cookie', cookies)
      .send({ title: 'Test' });
    expect(res.status).toBe(403);
  });

  // ── Create items ────────────────────────────────────────────────────────

  it('creates an item with auto-incremented orderIndex', async () => {
    const res1 = await testApp.request
      .post(`/api/admin/todo/lists/${listId}/items`)
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({ title: 'First Task' });
    expect(res1.status).toBe(201);
    expect(res1.body.orderIndex).toBe(0);
    expect(res1.body.completed).toBe(0);

    const res2 = await testApp.request
      .post(`/api/admin/todo/lists/${listId}/items`)
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({ title: 'Second Task', priority: 3 });
    expect(res2.status).toBe(201);
    expect(res2.body.orderIndex).toBe(1);
    expect(res2.body.priority).toBe(3);
  });

  it('validates required title', async () => {
    const res = await testApp.request
      .post(`/api/admin/todo/lists/${listId}/items`)
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({});
    expect(res.status).toBe(422);
  });

  it('validates title max length (500)', async () => {
    const res = await testApp.request
      .post(`/api/admin/todo/lists/${listId}/items`)
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({ title: 'x'.repeat(501) });
    expect(res.status).toBe(422);
  });

  it('validates priority range (0-3)', async () => {
    const res = await testApp.request
      .post(`/api/admin/todo/lists/${listId}/items`)
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({ title: 'Bad Priority', priority: 5 });
    expect(res.status).toBe(422);
  });

  it('returns 404 when creating item for non-existent list', async () => {
    const res = await testApp.request
      .post('/api/admin/todo/lists/00000000-0000-0000-0000-000000000000/items')
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({ title: 'Ghost Item' });
    expect(res.status).toBe(404);
  });

  // ── Read items ──────────────────────────────────────────────────────────

  it('returns items sorted by orderIndex', async () => {
    const res = await testApp.request
      .get(`/api/admin/todo/lists/${listId}/items`)
      .set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < res.body.length; i++) {
      expect(res.body[i].orderIndex).toBeGreaterThanOrEqual(res.body[i - 1].orderIndex);
    }
  });

  it('respects includeCompleted=false filter', async () => {
    // Complete one item first
    const itemsRes = await testApp.request
      .get(`/api/admin/todo/lists/${listId}/items`)
      .set('Cookie', cookies);
    const firstItemId = itemsRes.body[0].id;

    await testApp.request
      .put(`/api/admin/todo/items/${firstItemId}`)
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({ completed: true });

    // Query with filter
    const filteredRes = await testApp.request
      .get(`/api/admin/todo/lists/${listId}/items?includeCompleted=false`)
      .set('Cookie', cookies);
    expect(filteredRes.body.every((i: { completed: number }) => i.completed === 0)).toBe(true);

    // Default includes completed
    const allRes = await testApp.request
      .get(`/api/admin/todo/lists/${listId}/items`)
      .set('Cookie', cookies);
    expect(allRes.body.some((i: { completed: number }) => i.completed === 1)).toBe(true);
  });

  // ── Update items ────────────────────────────────────────────────────────

  it('updates item fields', async () => {
    const itemsRes = await testApp.request
      .get(`/api/admin/todo/lists/${listId}/items`)
      .set('Cookie', cookies);
    const itemId = itemsRes.body.find((i: { completed: number }) => i.completed === 0)?.id;

    const res = await testApp.request
      .put(`/api/admin/todo/items/${itemId}`)
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({ title: 'Updated Title', notes: 'Some notes', priority: 2 });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated Title');
    expect(res.body.notes).toBe('Some notes');
    expect(res.body.priority).toBe(2);
  });

  it('sets completedAt when completing', async () => {
    // Create fresh item
    const createRes = await testApp.request
      .post(`/api/admin/todo/lists/${listId}/items`)
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({ title: 'Complete Me' });
    const itemId = createRes.body.id;

    const res = await testApp.request
      .put(`/api/admin/todo/items/${itemId}`)
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({ completed: true });
    expect(res.body.completed).toBe(1);
    expect(res.body.completedAt).toBeTruthy();
  });

  it('clears completedAt when uncompleting', async () => {
    const itemsRes = await testApp.request
      .get(`/api/admin/todo/lists/${listId}/items`)
      .set('Cookie', cookies);
    const completedItem = itemsRes.body.find(
      (i: { completed: number }) => i.completed === 1,
    );

    const res = await testApp.request
      .put(`/api/admin/todo/items/${completedItem.id}`)
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({ completed: false });
    expect(res.body.completed).toBe(0);
    expect(res.body.completedAt).toBeNull();
  });

  it('returns 404 for non-existent item', async () => {
    const res = await testApp.request
      .put('/api/admin/todo/items/00000000-0000-0000-0000-000000000000')
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({ title: 'Ghost' });
    expect(res.status).toBe(404);
  });

  // ── Delete items ────────────────────────────────────────────────────────

  it('deletes an item', async () => {
    const createRes = await testApp.request
      .post(`/api/admin/todo/lists/${listId}/items`)
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({ title: 'Delete Me' });
    const itemId = createRes.body.id;

    const delRes = await testApp.request
      .delete(`/api/admin/todo/items/${itemId}`)
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken));
    expect(delRes.status).toBe(204);

    // Verify item gone
    const res = await testApp.request
      .put(`/api/admin/todo/items/${itemId}`)
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken))
      .send({ title: 'Ghost' });
    expect(res.status).toBe(404);
  });

  it('returns 404 when deleting non-existent item', async () => {
    const res = await testApp.request
      .delete('/api/admin/todo/items/00000000-0000-0000-0000-000000000000')
      .set('Cookie', cookies)
      .set(csrfHeader(csrfToken));
    expect(res.status).toBe(404);
  });

  // ── Reorder items ───────────────────────────────────────────────────────

  it('reorders items', async () => {
    // Get current items
    const itemsRes = await testApp.request
      .get(`/api/admin/todo/lists/${listId}/items`)
      .set('Cookie', cookies);
    const items = itemsRes.body;

    if (items.length >= 2) {
      // Swap first two items' order
      const reorderRes = await testApp.request
        .put(`/api/admin/todo/lists/${listId}/reorder`)
        .set('Cookie', cookies)
        .set(csrfHeader(csrfToken))
        .send({
          items: [
            { id: items[0].id, orderIndex: 99 },
            { id: items[1].id, orderIndex: 0 },
          ],
        });
      expect(reorderRes.status).toBe(204);

      // Verify new order
      const verifyRes = await testApp.request
        .get(`/api/admin/todo/lists/${listId}/items`)
        .set('Cookie', cookies);
      const reordered = verifyRes.body;
      expect(reordered[0].id).toBe(items[1].id);
    }
  });

  it('PUT reorder returns 403 without CSRF', async () => {
    const res = await testApp.request
      .put(`/api/admin/todo/lists/${listId}/reorder`)
      .set('Cookie', cookies)
      .send({ items: [{ id: '00000000-0000-0000-0000-000000000000', orderIndex: 0 }] });
    expect(res.status).toBe(403);
  });
});
