/**
 * T016 (005): Microsoft To Do sync integration tests.
 *
 * Tests the Graph API client, sync orchestration, and route endpoints
 * with mocked fetch for Graph API calls.
 */

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach, afterEach } from 'vitest';
import {
  createTestApp,
  csrfHeader,
  type TestApp,
} from '../helpers/http.js';
import { getDb } from '../../src/db/drizzle.js';
import {
  oauthAccounts,
  todoLists,
  todoItems,
  users,
} from '../../src/db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { encryptToken } from '../../src/lib/token-encryption.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

const originalFetch = globalThis.fetch;

function makeGraphTaskList(overrides: Record<string, unknown> = {}) {
  return {
    id: 'list-1',
    displayName: 'My Tasks',
    isOwner: true,
    ...overrides,
  };
}

function makeGraphTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    title: 'Buy groceries',
    body: { content: 'Milk, eggs, bread', contentType: 'text' },
    dueDateTime: { dateTime: '2024-07-01T00:00:00.0000000', timeZone: 'UTC' },
    importance: 'normal',
    status: 'notStarted',
    completedDateTime: null,
    createdDateTime: '2024-06-15T10:00:00Z',
    lastModifiedDateTime: '2024-06-15T10:00:00Z',
    ...overrides,
  };
}

function mockListResponse(lists: unknown[]) {
  return new Response(
    JSON.stringify({ value: lists }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

function mockTaskResponse(tasks: unknown[], nextLink?: string) {
  return new Response(
    JSON.stringify({
      value: tasks,
      ...(nextLink ? { '@odata.nextLink': nextLink } : {}),
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

async function setupAdmin(testApp: TestApp) {
  await testApp.request
    .post('/api/first-run/admin')
    .send({ username: 'admin', displayName: 'Admin', password: 'supersecurepass1' })
    .set('Content-Type', 'application/json');
}

async function loginAdmin(testApp: TestApp) {
  const loginRes = await testApp.request
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'supersecurepass1' })
    .set('Content-Type', 'application/json');

  const setCookie = loginRes.headers['set-cookie'];
  const sessionCookie = Array.isArray(setCookie) ? setCookie.join('; ') : setCookie ?? '';
  const csrfToken = (loginRes.body as Record<string, unknown>)['csrfToken'] as string;
  return { sessionCookie, csrfToken };
}

function getUserId(): string {
  const db = getDb();
  const user = db.select({ id: users.id }).from(users).get();
  return user!.id;
}

function createOAuthAccount(userId: string): string {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const futureExpiry = new Date(Date.now() + 3600_000).toISOString();

  db.insert(oauthAccounts)
    .values({
      id,
      userId,
      provider: 'microsoft',
      providerAccountId: `ms-test-${crypto.randomUUID()}`,
      accessTokenEnc: encryptToken('mock-access-token'),
      refreshTokenEnc: encryptToken('mock-refresh-token'),
      tokenExpiresAt: futureExpiry,
      email: 'test@example.com',
      displayName: 'Test User',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return id;
}

// ─── Microsoft To Do Service tests ──────────────────────────────────────────

describe('Microsoft To Do Service', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
    await setupAdmin(testApp);
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(() => {
    const db = getDb();
    db.delete(todoItems).run();
    db.delete(todoLists).where(eq(todoLists.providerType, 'microsoft')).run();
    db.delete(oauthAccounts).run();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('getMicrosoftTaskLists returns mapped lists', async () => {
    const userId = getUserId();
    const accountId = createOAuthAccount(userId);

    globalThis.fetch = vi.fn().mockResolvedValue(
      mockListResponse([
        makeGraphTaskList({ id: 'list-1', displayName: 'My Tasks' }),
        makeGraphTaskList({ id: 'list-2', displayName: 'Work', isOwner: false }),
      ]),
    );

    const { getMicrosoftTaskLists } = await import(
      '../../src/services/microsoftTodoService.js'
    );
    const lists = await getMicrosoftTaskLists(accountId);

    expect(lists).toHaveLength(2);
    expect(lists[0]).toEqual({ id: 'list-1', displayName: 'My Tasks', isOwner: true });
    expect(lists[1]).toEqual({ id: 'list-2', displayName: 'Work', isOwner: false });
  });

  it('getMicrosoftTasks maps fields correctly', async () => {
    const userId = getUserId();
    const accountId = createOAuthAccount(userId);

    globalThis.fetch = vi.fn().mockResolvedValue(
      mockTaskResponse([
        makeGraphTask({
          id: 'task-1',
          title: 'Buy groceries',
          importance: 'high',
          status: 'notStarted',
        }),
        makeGraphTask({
          id: 'task-2',
          title: 'Call dentist',
          importance: 'low',
          status: 'completed',
          completedDateTime: { dateTime: '2024-06-20T12:00:00.0000000', timeZone: 'UTC' },
          dueDateTime: null,
          body: null,
        }),
      ]),
    );

    const { getMicrosoftTasks } = await import(
      '../../src/services/microsoftTodoService.js'
    );
    const tasks = await getMicrosoftTasks(accountId, 'list-1');

    expect(tasks).toHaveLength(2);
    expect(tasks[0]!.title).toBe('Buy groceries');
    expect(tasks[0]!.importance).toBe('high');
    expect(tasks[0]!.status).toBe('notStarted');
    expect(tasks[1]!.title).toBe('Call dentist');
    expect(tasks[1]!.status).toBe('completed');
    expect(tasks[1]!.completedDateTime).toBeTruthy();
    expect(tasks[1]!.dueDateTime).toBeNull();
  });

  it('getMicrosoftTasks handles pagination', async () => {
    const userId = getUserId();
    const accountId = createOAuthAccount(userId);

    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve(
          mockTaskResponse(
            [makeGraphTask({ id: 'task-1' })],
            'https://graph.microsoft.com/v1.0/me/todo/lists/list-1/tasks?$skiptoken=abc',
          ),
        );
      }
      return Promise.resolve(mockTaskResponse([makeGraphTask({ id: 'task-2' })]));
    });

    const { getMicrosoftTasks } = await import(
      '../../src/services/microsoftTodoService.js'
    );
    const tasks = await getMicrosoftTasks(accountId, 'list-1');

    expect(tasks).toHaveLength(2);
    expect(callCount).toBe(2);
  });

  it('handles 401 with token refresh retry', async () => {
    const userId = getUserId();
    const accountId = createOAuthAccount(userId);

    // First call returns 401, second (after refresh) returns success
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      callCount++;
      // The oauth-service refresh call
      if (typeof url === 'string' && url.includes('login.microsoftonline.com')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ access_token: 'new-token', expires_in: 3600 }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }
      // First Graph call fails with 401
      if (callCount === 1) {
        return Promise.resolve(new Response('Unauthorized', { status: 401 }));
      }
      // Retried call succeeds
      return Promise.resolve(mockListResponse([makeGraphTaskList()]));
    });

    const { getMicrosoftTaskLists } = await import(
      '../../src/services/microsoftTodoService.js'
    );

    // Set token as expired to trigger refresh
    const db = getDb();
    db.update(oauthAccounts)
      .set({ tokenExpiresAt: new Date(Date.now() - 1000).toISOString() })
      .where(eq(oauthAccounts.id, accountId))
      .run();

    const lists = await getMicrosoftTaskLists(accountId);
    expect(lists).toHaveLength(1);
  });

  it('updateMicrosoftTaskStatus sends correct PATCH for completing', async () => {
    const userId = getUserId();
    const accountId = createOAuthAccount(userId);

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );

    const { updateMicrosoftTaskStatus } = await import(
      '../../src/services/microsoftTodoService.js'
    );
    await updateMicrosoftTaskStatus(accountId, 'list-1', 'task-1', true);

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    const lastCall = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
    const url = lastCall![0] as string;
    const opts = lastCall![1] as RequestInit;

    expect(url).toContain('/me/todo/lists/list-1/tasks/task-1');
    expect(opts.method).toBe('PATCH');
    const body = JSON.parse(opts.body as string);
    expect(body.status).toBe('completed');
    expect(body.completedDateTime).toBeDefined();
    expect(body.completedDateTime.timeZone).toBe('UTC');
  });

  it('updateMicrosoftTaskStatus sends correct PATCH for uncompleting', async () => {
    const userId = getUserId();
    const accountId = createOAuthAccount(userId);

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );

    const { updateMicrosoftTaskStatus } = await import(
      '../../src/services/microsoftTodoService.js'
    );
    await updateMicrosoftTaskStatus(accountId, 'list-1', 'task-1', false);

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    const lastCall = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
    const opts = lastCall![1] as RequestInit;

    const body = JSON.parse(opts.body as string);
    expect(body.status).toBe('notStarted');
    expect(body.completedDateTime).toBeUndefined();
  });
});

// ─── Sync Service tests ────────────────────────────────────────────────────

describe('Microsoft To Do Sync Service', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
    await setupAdmin(testApp);
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(() => {
    // Clean sync-related tables between tests for isolation
    const db = getDb();
    db.delete(todoItems).run();
    db.delete(todoLists).where(eq(todoLists.providerType, 'microsoft')).run();
    db.delete(oauthAccounts).run();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('sync creates lists and items from mocked API response', async () => {
    const userId = getUserId();
    const accountId = createOAuthAccount(userId);

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/me/todo/lists') && !url.includes('/tasks')) {
        return Promise.resolve(
          mockListResponse([makeGraphTaskList({ id: 'remote-list-1', displayName: 'My Tasks' })]),
        );
      }
      if (url.includes('/tasks')) {
        return Promise.resolve(
          mockTaskResponse([
            makeGraphTask({ id: 'remote-task-1', title: 'Task A', importance: 'high' }),
            makeGraphTask({ id: 'remote-task-2', title: 'Task B', importance: 'low', status: 'completed', completedDateTime: { dateTime: '2024-06-20T12:00:00.0000000', timeZone: 'UTC' } }),
          ]),
        );
      }
      return Promise.resolve(new Response('Not Found', { status: 404 }));
    });

    const { syncMicrosoftTodoForUser } = await import(
      '../../src/services/todoSyncService.js'
    );
    const result = await syncMicrosoftTodoForUser(userId);

    expect(result.listsSynced).toBe(1);
    expect(result.itemsSynced).toBe(2);
    expect(result.errors).toHaveLength(0);

    // Verify DB state
    const db = getDb();
    const lists = db
      .select()
      .from(todoLists)
      .where(
        and(
          eq(todoLists.userId, userId),
          eq(todoLists.providerType, 'microsoft'),
        ),
      )
      .all();

    expect(lists).toHaveLength(1);
    expect(lists[0]!.name).toBe('My Tasks');
    expect(lists[0]!.providerListId).toBe('remote-list-1');
    expect(lists[0]!.oauthAccountId).toBe(accountId);

    const items = db
      .select()
      .from(todoItems)
      .where(eq(todoItems.listId, lists[0]!.id))
      .all();

    expect(items).toHaveLength(2);
    const taskA = items.find((i) => i.providerItemId === 'remote-task-1');
    const taskB = items.find((i) => i.providerItemId === 'remote-task-2');

    expect(taskA!.title).toBe('Task A');
    expect(taskA!.priority).toBe(3); // high → 3
    expect(taskA!.completed).toBe(0);

    expect(taskB!.title).toBe('Task B');
    expect(taskB!.priority).toBe(1); // low → 1
    expect(taskB!.completed).toBe(1);
  });

  it('sync updates existing items when API response changes', async () => {
    const userId = getUserId();
    const accountId = createOAuthAccount(userId);

    // Initial sync
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/me/todo/lists') && !url.includes('/tasks')) {
        return Promise.resolve(
          mockListResponse([makeGraphTaskList({ id: 'list-u1', displayName: 'Sync Test' })]),
        );
      }
      return Promise.resolve(
        mockTaskResponse([makeGraphTask({ id: 'task-u1', title: 'Original Title' })]),
      );
    });

    const { syncMicrosoftTodoForUser } = await import(
      '../../src/services/todoSyncService.js'
    );
    await syncMicrosoftTodoForUser(userId);

    // Re-sync with changed title
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/me/todo/lists') && !url.includes('/tasks')) {
        return Promise.resolve(
          mockListResponse([makeGraphTaskList({ id: 'list-u1', displayName: 'Sync Test' })]),
        );
      }
      return Promise.resolve(
        mockTaskResponse([makeGraphTask({ id: 'task-u1', title: 'Updated Title' })]),
      );
    });

    await syncMicrosoftTodoForUser(userId);

    const db = getDb();
    const lists = db
      .select()
      .from(todoLists)
      .where(
        and(
          eq(todoLists.userId, userId),
          eq(todoLists.providerType, 'microsoft'),
          eq(todoLists.oauthAccountId, accountId),
        ),
      )
      .all();

    expect(lists).toHaveLength(1);

    const items = db
      .select()
      .from(todoItems)
      .where(eq(todoItems.listId, lists[0]!.id))
      .all();

    expect(items).toHaveLength(1);
    expect(items[0]!.title).toBe('Updated Title');
  });

  it('sync deletes items removed from Microsoft', async () => {
    const userId = getUserId();
    createOAuthAccount(userId);

    // Initial sync with 2 tasks
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/me/todo/lists') && !url.includes('/tasks')) {
        return Promise.resolve(
          mockListResponse([makeGraphTaskList({ id: 'list-d1', displayName: 'Delete Test' })]),
        );
      }
      return Promise.resolve(
        mockTaskResponse([
          makeGraphTask({ id: 'task-d1', title: 'Keep Me' }),
          makeGraphTask({ id: 'task-d2', title: 'Delete Me' }),
        ]),
      );
    });

    const { syncMicrosoftTodoForUser } = await import(
      '../../src/services/todoSyncService.js'
    );
    await syncMicrosoftTodoForUser(userId);

    // Re-sync with only 1 task
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/me/todo/lists') && !url.includes('/tasks')) {
        return Promise.resolve(
          mockListResponse([makeGraphTaskList({ id: 'list-d1', displayName: 'Delete Test' })]),
        );
      }
      return Promise.resolve(
        mockTaskResponse([makeGraphTask({ id: 'task-d1', title: 'Keep Me' })]),
      );
    });

    await syncMicrosoftTodoForUser(userId);

    const db = getDb();
    const lists = db
      .select()
      .from(todoLists)
      .where(
        and(
          eq(todoLists.userId, userId),
          eq(todoLists.providerType, 'microsoft'),
        ),
      )
      .all();

    const items = db
      .select()
      .from(todoItems)
      .where(eq(todoItems.listId, lists[0]!.id))
      .all();

    expect(items).toHaveLength(1);
    expect(items[0]!.providerItemId).toBe('task-d1');
  });

  it('sync returns error for no connected accounts', async () => {
    const userId = getUserId();
    // No OAuth account created — beforeEach cleaned them all

    const { syncMicrosoftTodoForUser } = await import(
      '../../src/services/todoSyncService.js'
    );
    const result = await syncMicrosoftTodoForUser(userId);

    expect(result.errors).toContain('No Microsoft account connected');
    expect(result.listsSynced).toBe(0);
  });

  it('importance maps correctly', async () => {
    const { mapImportanceToPriority } = await import(
      '../../src/services/microsoftTodoService.js'
    );

    expect(mapImportanceToPriority('high')).toBe(3);
    expect(mapImportanceToPriority('low')).toBe(1);
    expect(mapImportanceToPriority('normal')).toBe(0);
  });
});

// ─── Route tests ────────────────────────────────────────────────────────────

describe('Microsoft To Do Sync Routes', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
    await setupAdmin(testApp);
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(() => {
    const db = getDb();
    db.delete(todoItems).run();
    db.delete(todoLists).where(eq(todoLists.providerType, 'microsoft')).run();
    db.delete(oauthAccounts).run();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('POST /api/admin/todo/sync/microsoft returns 401 without auth', async () => {
    const res = await testApp.request
      .post('/api/admin/todo/sync/microsoft')
      .send({});

    expect(res.status).toBe(401);
  });

  it('POST /api/admin/todo/sync/microsoft returns 403 without CSRF', async () => {
    const { sessionCookie } = await loginAdmin(testApp);

    const res = await testApp.request
      .post('/api/admin/todo/sync/microsoft')
      .set('Cookie', sessionCookie)
      .send({});

    expect(res.status).toBe(403);
  });

  it('POST /api/admin/todo/sync/microsoft triggers sync and returns result', async () => {
    const { sessionCookie, csrfToken } = await loginAdmin(testApp);
    const userId = getUserId();
    createOAuthAccount(userId);

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/me/todo/lists') && !url.includes('/tasks')) {
        return Promise.resolve(
          mockListResponse([makeGraphTaskList({ id: 'route-list-1', displayName: 'Route Test' })]),
        );
      }
      if (typeof url === 'string' && url.includes('/tasks')) {
        return Promise.resolve(
          mockTaskResponse([makeGraphTask({ id: 'route-task-1', title: 'Route Task' })]),
        );
      }
      return Promise.resolve(new Response('Not Found', { status: 404 }));
    });

    const res = await testApp.request
      .post('/api/admin/todo/sync/microsoft')
      .set('Cookie', sessionCookie)
      .set(csrfHeader(csrfToken))
      .send({});

    expect(res.status).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body['listsSynced']).toBe(1);
    expect(body['itemsSynced']).toBe(1);
  });

  it('GET /api/admin/todo/providers/microsoft/lists returns 401 without auth', async () => {
    const res = await testApp.request.get(
      '/api/admin/todo/providers/microsoft/lists',
    );

    expect(res.status).toBe(401);
  });

  it('GET /api/admin/todo/providers/microsoft/lists returns empty when no accounts', async () => {
    const { sessionCookie } = await loginAdmin(testApp);

    const res = await testApp.request
      .get('/api/admin/todo/providers/microsoft/lists')
      .set('Cookie', sessionCookie);

    expect(res.status).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body['lists']).toEqual([]);
  });
});
