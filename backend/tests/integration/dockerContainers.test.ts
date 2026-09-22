/**
 * T051 (043 / US1): server-side endpoint resolution for the container list.
 *
 * The distinction these tests defend: a **4xx** means the widget is
 * misconfigured and the user must fix something; a **502** means the
 * configuration is fine and the daemon did not answer. Collapsing the two is
 * what made #181 hard to diagnose.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, type TestApp } from '../helpers/http.js';
import { getDb } from '../../src/db/drizzle.js';
import { dockerConnections } from '../../src/db/schema/index.js';
import { eq } from 'drizzle-orm';
import { setupAdmin, seedDockerWidget, type Session } from './dockerFixtures.js';

const UNREACHABLE_SOCKET = 'unix:///tmp/homedash-test-no-such-docker.sock';

describe('GET /api/docker/containers — endpoint resolution', () => {
  let testApp: TestApp;
  let admin: Session;

  beforeAll(async () => {
    testApp = await createTestApp();
    admin = await setupAdmin(testApp);
  });

  afterAll(async () => {
    await testApp.close();
  });

  function get(widgetInstanceId: string, connectionId = 'missing-connection') {
    return testApp.request
      .get(
        `/api/docker/containers?widgetInstanceId=${widgetInstanceId}&connectionId=${connectionId}`,
      )
      .set('Cookie', admin.cookie);
  }

  it('requires widgetInstanceId', async () => {
    const res = await testApp.request.get('/api/docker/containers').set('Cookie', admin.cookie);
    expect(res.status).toBe(422);
  });

  it('returns 409 when the widget has no Docker connection linked', async () => {
    const { widgetInstanceId } = seedDockerWidget({});
    const res = await get(widgetInstanceId);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ error: 'DOCKER_ENDPOINT_NOT_CONFIGURED' });
  });

  it('returns 409 for an unknown widget rather than falling back to the local socket', async () => {
    const res = await get('00000000-0000-4000-8000-00000000dead');
    expect(res.status).toBe(409);
    // The critical assertion: no containers, from anywhere.
    expect(res.body).not.toHaveProperty('containers');
  });

  it('ignores a link of another connection type (the widget_connections key bug)', async () => {
    // A widget with only a Pi-hole link used to resolve that row's
    // connectionId and look it up in docker_connections — a silent mismatch.
    const { widgetInstanceId, connectionId } = seedDockerWidget({
      dockerUrl: UNREACHABLE_SOCKET,
      connectionType: 'pihole',
    });
    const res = await get(widgetInstanceId, connectionId!);
    expect(res.status).toBe(409);
  });

  it('returns 502, not 409, when the endpoint is valid but unreachable', async () => {
    const { widgetInstanceId, connectionId } = seedDockerWidget({
      dockerUrl: UNREACHABLE_SOCKET,
    });
    const res = await get(widgetInstanceId, connectionId!);
    expect(res.status).toBe(502);
    expect(res.body).toMatchObject({ error: 'DOCKER_ENDPOINT_UNREACHABLE' });
  });

  it('returns 400 when a stored endpoint no longer parses', async () => {
    const { widgetInstanceId, connectionId } = seedDockerWidget({ dockerUrl: UNREACHABLE_SOCKET });
    // Simulate a row written before the grammar tightened.
    getDb()
      .update(dockerConnections)
      .set({ dockerUrl: 'not a docker endpoint at all' })
      .where(eq(dockerConnections.id, connectionId!))
      .run();

    const res = await get(widgetInstanceId, connectionId!);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'DOCKER_INVALID_ENDPOINT' });
  });

  it('never silently falls back to unix:///var/run/docker.sock', async () => {
    // Every failure path above is asserted individually; this guards the shape
    // of the whole set — no response may mention the default socket, which is
    // the only way a fallback could surface.
    const wrongType = seedDockerWidget({
      dockerUrl: UNREACHABLE_SOCKET,
      connectionType: 'pihole',
    });
    const cases = [
      { widgetInstanceId: seedDockerWidget({}).widgetInstanceId, connectionId: 'missing' },
      {
        widgetInstanceId: '00000000-0000-4000-8000-00000000dead',
        connectionId: 'missing',
      },
      {
        widgetInstanceId: wrongType.widgetInstanceId,
        connectionId: wrongType.connectionId!,
      },
    ];
    for (const item of cases) {
      const res = await get(item.widgetInstanceId, item.connectionId);
      expect(JSON.stringify(res.body)).not.toContain('/var/run/docker.sock');
    }
  });

  it('accepts a unix:// endpoint and reports it verbatim on failure', async () => {
    const { widgetInstanceId, connectionId } = seedDockerWidget({
      dockerUrl: UNREACHABLE_SOCKET,
    });
    const res = await get(widgetInstanceId, connectionId!);
    expect(res.body.message).toContain('/tmp/homedash-test-no-such-docker.sock');
  });

  it('accepts a tcp:// endpoint and reports it as unreachable, not invalid', async () => {
    // Port 1 on loopback: syntactically fine, nothing listening.
    const { widgetInstanceId, connectionId } = seedDockerWidget({
      dockerUrl: 'tcp://127.0.0.1:1',
    });
    const res = await get(widgetInstanceId, connectionId!);
    expect(res.status).toBe(502);
  });
});
