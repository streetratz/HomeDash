/**
 * T052 (043 / US1): the container-action route.
 *
 * The defect this closes: the action body carried `dockerUrl`, and the widget
 * sent `explicitUrl || 'unix:///var/run/docker.sock'` — so a widget wired to a
 * remote host displayed that host's containers but **dispatched start/stop to
 * the local daemon**. The endpoint now comes from the same server-side
 * resolution the listing uses.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, type TestApp } from '../helpers/http.js';
import {
  setupAdmin,
  createStandardUser,
  seedDockerWidget,
  type Session,
} from './dockerFixtures.js';

const REMOTE = 'unix:///tmp/homedash-test-remote-docker.sock';

describe('POST /api/docker/action', () => {
  let testApp: TestApp;
  let admin: Session;
  let user: Session;
  let widgetInstanceId: string;
  let connectionId: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    admin = await setupAdmin(testApp);
    user = await createStandardUser(testApp, admin);
    const seeded = seedDockerWidget({ dockerUrl: REMOTE });
    widgetInstanceId = seeded.widgetInstanceId;
    connectionId = seeded.connectionId!;
  });

  afterAll(async () => {
    await testApp.close();
  });

  function act(body: Record<string, unknown>, session: Session = admin) {
    return testApp.request
      .post('/api/docker/action')
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .send(body)
      .set('Content-Type', 'application/json');
  }

  it('dispatches to the resolved endpoint, not the local socket', async () => {
    const res = await act({
      widgetInstanceId,
      connectionId,
      containerId: 'abc123',
      action: 'stop',
    });
    expect(res.status).toBe(502);
    // The error names the widget's own endpoint. If the local-socket default
    // were still in play, this would name /var/run/docker.sock instead.
    expect(res.body.message).toContain('/tmp/homedash-test-remote-docker.sock');
    expect(res.body.message).not.toContain('/var/run/docker.sock');
  });

  it('ignores a dockerUrl supplied in the body', async () => {
    const res = await act({
      widgetInstanceId,
      connectionId,
      containerId: 'abc123',
      action: 'stop',
      dockerUrl: 'unix:///tmp/homedash-test-attacker.sock',
    });
    expect(res.body.message).not.toContain('attacker');
    expect(res.body.message).toContain('/tmp/homedash-test-remote-docker.sock');
  });

  it('rejects a body without widgetInstanceId', async () => {
    const res = await act({ containerId: 'abc123', action: 'stop' });
    expect(res.status).toBe(422);
  });

  it('rejects an unknown action', async () => {
    const res = await act({
      widgetInstanceId,
      connectionId,
      containerId: 'abc123',
      action: 'destroy',
    });
    expect(res.status).toBe(422);
  });

  it('returns 409 when the widget has no Docker connection', async () => {
    const { widgetInstanceId: bare } = seedDockerWidget({});
    const res = await act({
      widgetInstanceId: bare,
      connectionId,
      containerId: 'abc123',
      action: 'start',
    });
    expect(res.status).toBe(409);
  });

  it('rejects a connection linked to another widget before dispatch', async () => {
    const other = seedDockerWidget({
      dockerUrl: 'unix:///tmp/homedash-test-other-owner.sock',
    });
    const res = await act({
      widgetInstanceId,
      connectionId: other.connectionId,
      containerId: 'abc123',
      action: 'restart',
    });
    expect(res.status).toBe(409);
    expect(JSON.stringify(res.body)).not.toContain('homedash-test-other-owner.sock');
  });

  it('still requires admin (RK-8)', async () => {
    const res = await act(
      { widgetInstanceId, connectionId, containerId: 'abc123', action: 'stop' },
      user,
    );
    expect(res.status).toBe(403);
  });

  it('still requires CSRF (RK-8)', async () => {
    const res = await testApp.request
      .post('/api/docker/action')
      .set('Cookie', admin.cookie)
      .send({ widgetInstanceId, connectionId, containerId: 'abc123', action: 'stop' })
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(403);
  });
});
