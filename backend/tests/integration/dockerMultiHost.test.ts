import { and, asc, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from '../helpers/http.js';
import { getDb } from '../../src/db/drizzle.js';
import { widgetConnections } from '../../src/db/schema/index.js';
import {
  linkWidgetToConnection,
  replaceDockerWidgetConnections,
} from '../../src/services/connectionService.js';
import {
  addDockerConnectionToWidget,
  createStandardUser,
  seedDockerWidget,
  setupAdmin,
  type Session,
} from './dockerFixtures.js';

describe('Docker multi-host links and routing', () => {
  let testApp: TestApp;
  let admin: Session;
  let user: Session;

  beforeAll(async () => {
    testApp = await createTestApp();
    admin = await setupAdmin(testApp);
    user = await createStandardUser(testApp, admin);
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('lists linked hosts in deterministic order without endpoint URLs', async () => {
    const first = seedDockerWidget({
      dockerUrl: 'unix:///tmp/homedash-host-a.sock',
    });
    const secondId = addDockerConnectionToWidget(first.widgetInstanceId, {
      dockerUrl: 'unix:///tmp/homedash-host-b.sock',
      name: 'Basement host',
      sortOrder: 1,
    });

    const res = await testApp.request
      .get(`/api/docker/hosts?widgetInstanceId=${first.widgetInstanceId}`)
      .set('Cookie', admin.cookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      hosts: [
        { connectionId: first.connectionId, name: 'Test host' },
        { connectionId: secondId, name: 'Basement host' },
      ],
    });
    expect(JSON.stringify(res.body)).not.toContain('docker.sock');
  });

  it('resolves each linked host independently', async () => {
    const first = seedDockerWidget({
      dockerUrl: 'unix:///tmp/homedash-host-c.sock',
    });
    const secondId = addDockerConnectionToWidget(first.widgetInstanceId, {
      dockerUrl: 'unix:///tmp/homedash-host-d.sock',
      name: 'Second host',
      sortOrder: 1,
    });

    const firstRes = await testApp.request
      .get(
        `/api/docker/containers?widgetInstanceId=${first.widgetInstanceId}&connectionId=${first.connectionId}`,
      )
      .set('Cookie', admin.cookie);
    const secondRes = await testApp.request
      .get(
        `/api/docker/containers?widgetInstanceId=${first.widgetInstanceId}&connectionId=${secondId}`,
      )
      .set('Cookie', admin.cookie);

    expect(firstRes.status).toBe(502);
    expect(firstRes.body.message).toContain('homedash-host-c.sock');
    expect(secondRes.status).toBe(502);
    expect(secondRes.body.message).toContain('homedash-host-d.sock');
  });

  it('rejects a connection linked to another widget', async () => {
    const first = seedDockerWidget({
      dockerUrl: 'unix:///tmp/homedash-owner-a.sock',
    });
    const second = seedDockerWidget({
      dockerUrl: 'unix:///tmp/homedash-owner-b.sock',
    });

    const res = await testApp.request
      .get(
        `/api/docker/containers?widgetInstanceId=${first.widgetInstanceId}&connectionId=${second.connectionId}`,
      )
      .set('Cookie', admin.cookie);

    expect(res.status).toBe(409);
    expect(JSON.stringify(res.body)).not.toContain('homedash-owner-b.sock');
  });

  it('atomically replaces and reorders Docker links', async () => {
    const seeded = seedDockerWidget({
      dockerUrl: 'unix:///tmp/homedash-order-a.sock',
    });
    const secondId = addDockerConnectionToWidget(seeded.widgetInstanceId, {
      dockerUrl: 'unix:///tmp/homedash-order-b.sock',
      name: 'Second',
      sortOrder: 1,
    });

    const res = await testApp.request
      .put('/api/admin/connections/docker-links')
      .set('Cookie', admin.cookie)
      .set('X-CSRF-Token', admin.csrfToken)
      .send({
        widgetInstanceId: seeded.widgetInstanceId,
        connectionIds: [secondId, seeded.connectionId],
      })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.hosts.map((host: { connectionId: string }) => host.connectionId)).toEqual([
      secondId,
      seeded.connectionId,
    ]);

    const rows = getDb()
      .select({
        connectionId: widgetConnections.connectionId,
        sortOrder: widgetConnections.sortOrder,
      })
      .from(widgetConnections)
      .where(
        and(
          eq(widgetConnections.widgetInstanceId, seeded.widgetInstanceId),
          eq(widgetConnections.connectionType, 'docker'),
        ),
      )
      .orderBy(asc(widgetConnections.sortOrder))
      .all();
    expect(rows).toEqual([
      { connectionId: secondId, sortOrder: 0 },
      { connectionId: seeded.connectionId, sortOrder: 1 },
    ]);
  });

  it('protects Docker link replacement with admin authorization and CSRF', async () => {
    const seeded = seedDockerWidget({
      dockerUrl: 'unix:///tmp/homedash-protected-links.sock',
    });
    const body = {
      widgetInstanceId: seeded.widgetInstanceId,
      connectionIds: [seeded.connectionId],
    };

    const unauthenticated = await testApp.request
      .put('/api/admin/connections/docker-links')
      .send(body)
      .set('Content-Type', 'application/json');
    expect(unauthenticated.status).toBe(401);

    const nonAdmin = await testApp.request
      .put('/api/admin/connections/docker-links')
      .set('Cookie', user.cookie)
      .set('X-CSRF-Token', user.csrfToken)
      .send(body)
      .set('Content-Type', 'application/json');
    expect(nonAdmin.status).toBe(403);

    const missingCsrf = await testApp.request
      .put('/api/admin/connections/docker-links')
      .set('Cookie', admin.cookie)
      .send(body)
      .set('Content-Type', 'application/json');
    expect(missingCsrf.status).toBe(403);
  });

  it('keeps the generic link operation replace-only', () => {
    const seeded = seedDockerWidget({
      dockerUrl: 'unix:///tmp/homedash-replace-a.sock',
    });
    const secondId = addDockerConnectionToWidget(seeded.widgetInstanceId, {
      dockerUrl: 'unix:///tmp/homedash-replace-b.sock',
      name: 'Replacement',
      sortOrder: 1,
    });

    linkWidgetToConnection(seeded.widgetInstanceId, 'docker', secondId);

    const rows = getDb()
      .select({ connectionId: widgetConnections.connectionId })
      .from(widgetConnections)
      .where(
        and(
          eq(widgetConnections.widgetInstanceId, seeded.widgetInstanceId),
          eq(widgetConnections.connectionType, 'docker'),
        ),
      )
      .all();
    expect(rows).toEqual([{ connectionId: secondId }]);
  });

  it('rejects duplicate replacement IDs without changing existing links', () => {
    const seeded = seedDockerWidget({
      dockerUrl: 'unix:///tmp/homedash-duplicate.sock',
    });

    expect(() =>
      replaceDockerWidgetConnections(seeded.widgetInstanceId, [
        seeded.connectionId!,
        seeded.connectionId!,
      ]),
    ).toThrow('connectionIds must not contain duplicates');

    const rows = getDb()
      .select({ connectionId: widgetConnections.connectionId })
      .from(widgetConnections)
      .where(
        and(
          eq(widgetConnections.widgetInstanceId, seeded.widgetInstanceId),
          eq(widgetConnections.connectionType, 'docker'),
        ),
      )
      .all();
    expect(rows).toEqual([{ connectionId: seeded.connectionId }]);
  });
});
