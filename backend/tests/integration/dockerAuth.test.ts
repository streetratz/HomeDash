/**
 * T050 (043 / US1): the #189 negative matrix.
 *
 * Every assertion here is about what a caller *cannot* do. The positive paths
 * live in `dockerContainers.test.ts` and `dockerAction.test.ts`.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, type TestApp } from '../helpers/http.js';
import {
  setupAdmin,
  createStandardUser,
  seedDockerWidget,
  type Session,
} from './dockerFixtures.js';

describe('Docker routes — authorization (#189)', () => {
  let testApp: TestApp;
  let admin: Session;
  let user: Session;
  let widgetInstanceId: string;
  let connectionId: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    admin = await setupAdmin(testApp);
    user = await createStandardUser(testApp, admin);
    // A socket path that cannot exist: these tests must never reach the real
    // daemon on the machine running them, and an unreachable endpoint fails
    // fast with a connect error.
    const seeded = seedDockerWidget({
      dockerUrl: 'unix:///tmp/homedash-test-no-such-docker.sock',
    });
    widgetInstanceId = seeded.widgetInstanceId;
    connectionId = seeded.connectionId!;
  });

  afterAll(async () => {
    await testApp.close();
  });

  describe('GET /api/docker/containers', () => {
    it('rejects an unauthenticated caller with 401', async () => {
      const res = await testApp.request.get(
        `/api/docker/containers?widgetInstanceId=${widgetInstanceId}`,
      );
      expect(res.status).toBe(401);
      expect(res.body).not.toHaveProperty('containers');
    });

    it('rejects before resolving the endpoint, so an unknown widget is also 401', async () => {
      // If resolution ran first this would be 409 (not configured), which would
      // leak whether a widget has a Docker connection to an anonymous caller.
      const res = await testApp.request.get(
        '/api/docker/containers?widgetInstanceId=00000000-0000-4000-8000-00000000dead',
      );
      expect(res.status).toBe(401);
    });

    it('returns a byte-identical 401 body regardless of the widget named', async () => {
      const a = await testApp.request.get(
        `/api/docker/containers?widgetInstanceId=${widgetInstanceId}`,
      );
      const b = await testApp.request.get(
        '/api/docker/containers?widgetInstanceId=00000000-0000-4000-8000-00000000dead',
      );
      const c = await testApp.request.get('/api/docker/containers?widgetInstanceId=x');
      expect(JSON.stringify(a.body)).toBe(JSON.stringify(b.body));
      expect(JSON.stringify(b.body)).toBe(JSON.stringify(c.body));
    });

    it('ignores a caller-supplied url parameter entirely (FR-014)', async () => {
      // The old route honoured ?url=. It must now be inert: the response comes
      // from the widget's own connection, and supplying a url cannot redirect it.
      const res = await testApp.request
        .get(
          `/api/docker/containers?widgetInstanceId=${widgetInstanceId}&connectionId=${connectionId}&url=${encodeURIComponent('tcp://evil.example:2375')}`,
        )
        .set('Cookie', user.cookie);
      // 401 is the one thing it must not be — the user is authenticated.
      expect(res.status).not.toBe(401);
      // And the failure, if any, must not mention the caller's destination.
      expect(JSON.stringify(res.body)).not.toContain('evil.example');
    });
  });

  describe('POST /api/docker/ping', () => {
    it('no longer exists (FR-013)', async () => {
      const res = await testApp.request
        .post('/api/docker/ping')
        .send({ url: 'unix:///tmp/homedash-test-no-such-docker.sock' })
        .set('Content-Type', 'application/json');
      expect(res.status).toBe(404);
    });

    it('is not merely auth-guarded — it is gone even for an admin', async () => {
      const res = await testApp.request
        .post('/api/docker/ping')
        .set('Cookie', admin.cookie)
        .set('X-CSRF-Token', admin.csrfToken)
        .send({ url: 'unix:///tmp/homedash-test-no-such-docker.sock' })
        .set('Content-Type', 'application/json');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/docker/action', () => {
    const body = { containerId: 'abc123', action: 'stop' as const };

    it('rejects an unauthenticated caller', async () => {
      const res = await testApp.request
        .post('/api/docker/action')
        .send({ ...body, widgetInstanceId })
        .set('Content-Type', 'application/json');
      expect(res.status).toBe(401);
    });

    it('rejects an authenticated non-admin with 403', async () => {
      const res = await testApp.request
        .post('/api/docker/action')
        .set('Cookie', user.cookie)
        .set('X-CSRF-Token', user.csrfToken)
        .send({ ...body, widgetInstanceId })
        .set('Content-Type', 'application/json');
      expect(res.status).toBe(403);
    });

    it('rejects an admin with a missing CSRF token', async () => {
      const res = await testApp.request
        .post('/api/docker/action')
        .set('Cookie', admin.cookie)
        .send({ ...body, widgetInstanceId })
        .set('Content-Type', 'application/json');
      expect(res.status).toBe(403);
    });

    it('rejects an admin with an invalid CSRF token', async () => {
      const res = await testApp.request
        .post('/api/docker/action')
        .set('Cookie', admin.cookie)
        .set('X-CSRF-Token', 'not-the-token')
        .send({ ...body, widgetInstanceId })
        .set('Content-Type', 'application/json');
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/admin/connections/docker/test', () => {
    it('rejects an unauthenticated caller', async () => {
      const res = await testApp.request
        .post('/api/admin/connections/docker/test')
        .send({ dockerUrl: 'unix:///tmp/homedash-test-no-such-docker.sock' })
        .set('Content-Type', 'application/json');
      expect(res.status).toBe(401);
    });

    it('rejects an authenticated non-admin', async () => {
      const res = await testApp.request
        .post('/api/admin/connections/docker/test')
        .set('Cookie', user.cookie)
        .set('X-CSRF-Token', user.csrfToken)
        .send({ dockerUrl: 'unix:///tmp/homedash-test-no-such-docker.sock' })
        .set('Content-Type', 'application/json');
      expect(res.status).toBe(403);
    });

    it('rejects a malformed endpoint before dialling anything', async () => {
      const res = await testApp.request
        .post('/api/admin/connections/docker/test')
        .set('Cookie', admin.cookie)
        .set('X-CSRF-Token', admin.csrfToken)
        .send({ dockerUrl: 'http://not-a-docker-scheme' })
        .set('Content-Type', 'application/json');
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ success: false });
    });

    it('rejects a link-local address even from an admin (SSRF pivot)', async () => {
      const res = await testApp.request
        .post('/api/admin/connections/docker/test')
        .set('Cookie', admin.cookie)
        .set('X-CSRF-Token', admin.csrfToken)
        .send({ dockerUrl: 'tcp://169.254.169.254:2375' })
        .set('Content-Type', 'application/json');
      expect(res.status).toBe(400);
    });

    it('still permits loopback, which is a legitimate Docker deployment', async () => {
      const res = await testApp.request
        .post('/api/admin/connections/docker/test')
        .set('Cookie', admin.cookie)
        .set('X-CSRF-Token', admin.csrfToken)
        .send({ dockerUrl: 'tcp://127.0.0.1:2375' })
        .set('Content-Type', 'application/json');
      // Nothing is listening, so the test reports failure — but with 200 and a
      // connectivity result, not a 400 rejection.
      expect(res.status).toBe(200);
    });
  });
});
