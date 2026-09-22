/**
 * Regression coverage for #208: v3.1.0 tightened the Docker endpoint grammar
 * without normalizing absolute Unix socket paths already stored in
 * docker_connections.
 */

import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { getDb } from '../../src/db/drizzle.js';
import { dockerConnections, widgetConnections } from '../../src/db/schema/index.js';
import { normalizeLegacyDockerConnections } from '../../src/services/dockerConnectionUpgrade.js';
import { seedDockerWidget } from './dockerFixtures.js';
import { createTestApp, type TestApp } from '../helpers/http.js';

describe('Docker connection startup upgrade', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('normalizes an absolute socket path without replacing its connection or widget link', () => {
    const { widgetInstanceId, connectionId } = seedDockerWidget({
      dockerUrl: ' /var/run/docker.sock ',
    });

    const result = normalizeLegacyDockerConnections();

    expect(result.normalized).toEqual([connectionId]);
    expect(
      getDb()
        .select({ dockerUrl: dockerConnections.dockerUrl })
        .from(dockerConnections)
        .where(eq(dockerConnections.id, connectionId!))
        .get()?.dockerUrl,
    ).toBe('unix:///var/run/docker.sock');
    expect(
      getDb()
        .select({ connectionId: widgetConnections.connectionId })
        .from(widgetConnections)
        .where(eq(widgetConnections.widgetInstanceId, widgetInstanceId))
        .get()?.connectionId,
    ).toBe(connectionId);
  });

  it('is idempotent after the endpoint has been normalized', () => {
    const { connectionId } = seedDockerWidget({ dockerUrl: '/tmp/docker-208.sock' });

    expect(normalizeLegacyDockerConnections().normalized).toContain(connectionId);
    const afterFirstRun = getDb()
      .select()
      .from(dockerConnections)
      .where(eq(dockerConnections.id, connectionId!))
      .get();

    expect(normalizeLegacyDockerConnections().normalized).not.toContain(connectionId);
    expect(
      getDb().select().from(dockerConnections).where(eq(dockerConnections.id, connectionId!)).get(),
    ).toEqual(afterFirstRun);
  });

  it.each([
    'unix:///var/run/docker.sock',
    'tcp://192.168.1.13:2375',
    'http://192.168.1.13:2375',
    '192.168.1.13:2375',
    'relative/docker.sock',
  ])('leaves non-legacy endpoint %s unchanged', (dockerUrl) => {
    const { connectionId } = seedDockerWidget({ dockerUrl });

    expect(normalizeLegacyDockerConnections().normalized).not.toContain(connectionId);
    expect(
      getDb()
        .select({ dockerUrl: dockerConnections.dockerUrl })
        .from(dockerConnections)
        .where(eq(dockerConnections.id, connectionId!))
        .get()?.dockerUrl,
    ).toBe(dockerUrl);
  });
});
