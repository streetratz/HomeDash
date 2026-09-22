/**
 * T053 (043 / US1): the legacy `config.dockerUrl` adoption pass.
 *
 * Two properties matter more than the happy path: it must be safe to run on
 * every boot, and it must not destroy a value it cannot understand (RK-7).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, and } from 'drizzle-orm';
import { createTestApp, type TestApp } from '../helpers/http.js';
import { getDb } from '../../src/db/drizzle.js';
import {
  appWidgetInstances,
  dockerConnections,
  widgetConnections,
} from '../../src/db/schema/index.js';
import { adoptLegacyDockerWidgets } from '../../src/services/dockerWidgetAdoption.js';
import { seedDockerWidget } from './dockerFixtures.js';

function config(widgetInstanceId: string): Record<string, unknown> {
  const row = getDb()
    .select({ configJson: appWidgetInstances.configJson })
    .from(appWidgetInstances)
    .where(eq(appWidgetInstances.id, widgetInstanceId))
    .get();
  return JSON.parse(row!.configJson) as Record<string, unknown>;
}

function dockerLink(widgetInstanceId: string) {
  return getDb()
    .select({ connectionId: widgetConnections.connectionId })
    .from(widgetConnections)
    .where(
      and(
        eq(widgetConnections.widgetInstanceId, widgetInstanceId),
        eq(widgetConnections.connectionType, 'docker'),
      ),
    )
    .get();
}

describe('Docker widget adoption', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('adopts a conforming legacy URL into a connection row and links it', () => {
    const { widgetInstanceId } = seedDockerWidget({ legacyDockerUrl: 'tcp://192.168.1.10:2375' });

    const result = adoptLegacyDockerWidgets();
    expect(result.adopted).toContain(widgetInstanceId);

    const link = dockerLink(widgetInstanceId);
    expect(link).toBeDefined();

    const conn = getDb()
      .select({ dockerUrl: dockerConnections.dockerUrl })
      .from(dockerConnections)
      .where(eq(dockerConnections.id, link!.connectionId))
      .get();
    expect(conn?.dockerUrl).toBe('tcp://192.168.1.10:2375');

    // The inline copy is gone, so the two cannot drift.
    expect(config(widgetInstanceId)).not.toHaveProperty('dockerUrl');
  });

  it('normalizes and adopts a legacy absolute Unix socket path', () => {
    const { widgetInstanceId } = seedDockerWidget({ legacyDockerUrl: '/var/run/docker.sock' });

    const result = adoptLegacyDockerWidgets();
    expect(result.adopted).toContain(widgetInstanceId);

    const connectionId = dockerLink(widgetInstanceId)!.connectionId;
    const conn = getDb()
      .select({ dockerUrl: dockerConnections.dockerUrl })
      .from(dockerConnections)
      .where(eq(dockerConnections.id, connectionId))
      .get();
    expect(conn?.dockerUrl).toBe('unix:///var/run/docker.sock');
    expect(config(widgetInstanceId)).not.toHaveProperty('dockerUrl');
  });

  it('is idempotent across repeated runs', () => {
    const { widgetInstanceId } = seedDockerWidget({ legacyDockerUrl: 'tcp://192.168.1.11:2375' });

    adoptLegacyDockerWidgets();
    const first = dockerLink(widgetInstanceId)!.connectionId;

    const second = adoptLegacyDockerWidgets();
    expect(second.adopted).not.toContain(widgetInstanceId);
    expect(dockerLink(widgetInstanceId)!.connectionId).toBe(first);

    const rows = getDb()
      .select({ id: dockerConnections.id })
      .from(dockerConnections)
      .where(eq(dockerConnections.dockerUrl, 'tcp://192.168.1.11:2375'))
      .all();
    expect(rows).toHaveLength(1);
  });

  it('leaves a non-conforming value untouched and reports it (RK-7)', () => {
    const { widgetInstanceId } = seedDockerWidget({ legacyDockerUrl: 'ftp://nope' });

    const result = adoptLegacyDockerWidgets();

    expect(result.adopted).not.toContain(widgetInstanceId);
    expect(result.skipped.map((s) => s.widgetInstanceId)).toContain(widgetInstanceId);

    // Not imported…
    expect(dockerLink(widgetInstanceId)).toBeUndefined();
    // …and not destroyed either. This is the only copy of what the user typed.
    expect(config(widgetInstanceId)['dockerUrl']).toBe('ftp://nope');
  });

  it('reports a non-conforming value on every run without ever adopting it', () => {
    const { widgetInstanceId } = seedDockerWidget({ legacyDockerUrl: 'ftp://still-nope' });
    adoptLegacyDockerWidgets();
    const second = adoptLegacyDockerWidgets();
    expect(second.skipped.map((s) => s.widgetInstanceId)).toContain(widgetInstanceId);
    expect(dockerLink(widgetInstanceId)).toBeUndefined();
  });

  it('prefers an existing link over the inline value and drops the stale copy', () => {
    const { widgetInstanceId, connectionId } = seedDockerWidget({
      dockerUrl: 'tcp://192.168.1.20:2375',
      legacyDockerUrl: 'tcp://192.168.1.99:2375',
    });

    adoptLegacyDockerWidgets();

    expect(dockerLink(widgetInstanceId)!.connectionId).toBe(connectionId);
    expect(config(widgetInstanceId)).not.toHaveProperty('dockerUrl');
  });

  it('ignores widgets with no legacy URL', () => {
    const { widgetInstanceId } = seedDockerWidget({});
    const result = adoptLegacyDockerWidgets();
    expect(result.adopted).not.toContain(widgetInstanceId);
    expect(result.skipped.map((s) => s.widgetInstanceId)).not.toContain(widgetInstanceId);
  });
});
