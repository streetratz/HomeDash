/**
 * 015-integrations-hub: Centralized connection resolution service.
 * Manages Pi-hole and Docker connection CRUD, widget linking,
 * and connection resolution (new join table + legacy fallback).
 */

import crypto from 'node:crypto';
import { asc, eq, and, inArray, sql } from 'drizzle-orm';
import { getDb } from '../db/drizzle.js';
import {
  piholeInstances,
  dockerConnections,
  widgetConnections,
  appWidgetInstances,
} from '../db/schema/index.js';
import { encryptToken, decryptToken } from '../lib/token-encryption.js';
import { DockerErrors, Errors } from '../lib/errors.js';
import { testDockerListing } from './dockerService.js';
import { parseDockerEndpoint } from '../lib/validation.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PiholeConnectionPublic {
  id: string;
  name: string;
  baseUrl: string;
  pollIntervalSec: number;
  hasToken: boolean;
  linkedWidgets: number;
  createdAt: string;
  updatedAt: string;
}

export interface DockerConnectionPublic {
  id: string;
  name: string;
  dockerUrl: string;
  linkedWidgets: number;
  createdAt: string;
  updatedAt: string;
}

export interface DockerWidgetHost {
  connectionId: string;
  name: string;
  sortOrder: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function countLinkedWidgets(connectionType: string, connectionId: string): number {
  const db = getDb();
  const row = db
    .select({ count: sql<number>`count(*)` })
    .from(widgetConnections)
    .where(
      and(
        eq(widgetConnections.connectionType, connectionType),
        eq(widgetConnections.connectionId, connectionId),
      ),
    )
    .get();
  return row?.count ?? 0;
}

function toPiholePublic(row: {
  id: string;
  name: string;
  baseUrl: string;
  pollIntervalSec: number;
  apiTokenEncrypted: string;
  createdAt: string;
  updatedAt: string;
}): PiholeConnectionPublic {
  return {
    id: row.id,
    name: row.name,
    baseUrl: row.baseUrl,
    pollIntervalSec: row.pollIntervalSec,
    hasToken: !!row.apiTokenEncrypted,
    linkedWidgets: countLinkedWidgets('pihole', row.id),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toDockerPublic(row: {
  id: string;
  name: string;
  dockerUrl: string;
  createdAt: string;
  updatedAt: string;
}): DockerConnectionPublic {
  return {
    id: row.id,
    name: row.name,
    dockerUrl: row.dockerUrl,
    linkedWidgets: countLinkedWidgets('docker', row.id),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ─── Connection Resolution ──────────────────────────────────────────────────

/**
 * Resolve a connection for a widget instance.
 * Checks widget_connections first, falls back to legacy pihole_instances.widgetInstanceId.
 */
export function resolveConnection(
  widgetInstanceId: string,
  type: 'pihole' | 'docker',
): { connectionId: string; baseUrl: string; password?: string } | null {
  const db = getDb();

  // Check the new join table first
  const link = db
    .select()
    .from(widgetConnections)
    .where(
      and(
        eq(widgetConnections.widgetInstanceId, widgetInstanceId),
        eq(widgetConnections.connectionType, type),
      ),
    )
    .orderBy(asc(widgetConnections.sortOrder))
    .get();

  if (link) {
    if (type === 'pihole') {
      const conn = db
        .select()
        .from(piholeInstances)
        .where(eq(piholeInstances.id, link.connectionId))
        .get();
      if (!conn) return null;
      return {
        connectionId: conn.id,
        baseUrl: conn.baseUrl,
        password: decryptToken(conn.apiTokenEncrypted),
      };
    }
    if (type === 'docker') {
      const conn = db
        .select()
        .from(dockerConnections)
        .where(eq(dockerConnections.id, link.connectionId))
        .get();
      if (!conn) return null;
      return { connectionId: conn.id, baseUrl: conn.dockerUrl };
    }
  }

  // Legacy fallback: pihole_instances.widgetInstanceId
  if (type === 'pihole') {
    const legacy = db
      .select()
      .from(piholeInstances)
      .where(eq(piholeInstances.widgetInstanceId, widgetInstanceId))
      .get();
    if (legacy) {
      return {
        connectionId: legacy.id,
        baseUrl: legacy.baseUrl,
        password: decryptToken(legacy.apiTokenEncrypted),
      };
    }
  }

  return null;
}

// ─── Pi-hole Connection CRUD ────────────────────────────────────────────────

export function listPiholeConnections(): PiholeConnectionPublic[] {
  const db = getDb();
  const rows = db.select().from(piholeInstances).all();
  return rows.map(toPiholePublic);
}

export function getPiholeConnection(id: string): PiholeConnectionPublic | null {
  const db = getDb();
  const row = db.select().from(piholeInstances).where(eq(piholeInstances.id, id)).get();
  if (!row) return null;
  return toPiholePublic(row);
}

export function createPiholeConnection(
  name: string,
  baseUrl: string,
  apiToken: string,
  pollIntervalSec = 30,
): PiholeConnectionPublic {
  const db = getDb();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  db.insert(piholeInstances)
    .values({
      id,
      name,
      baseUrl,
      apiTokenEncrypted: encryptToken(apiToken),
      pollIntervalSec,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return {
    id,
    name,
    baseUrl,
    pollIntervalSec,
    hasToken: true,
    linkedWidgets: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function updatePiholeConnection(
  id: string,
  updates: {
    name?: string | undefined;
    baseUrl?: string | undefined;
    apiToken?: string | undefined;
    pollIntervalSec?: number | undefined;
  },
): PiholeConnectionPublic {
  const db = getDb();
  const existing = db.select().from(piholeInstances).where(eq(piholeInstances.id, id)).get();
  if (!existing) throw Errors.notFound('Pi-hole connection not found');

  const now = new Date().toISOString();
  const setClause: Record<string, unknown> = { updatedAt: now };

  if (updates.name !== undefined) setClause['name'] = updates.name;
  if (updates.baseUrl !== undefined) setClause['baseUrl'] = updates.baseUrl;
  if (updates.apiToken !== undefined)
    setClause['apiTokenEncrypted'] = encryptToken(updates.apiToken);
  if (updates.pollIntervalSec !== undefined) setClause['pollIntervalSec'] = updates.pollIntervalSec;

  db.update(piholeInstances).set(setClause).where(eq(piholeInstances.id, id)).run();

  const updated = db.select().from(piholeInstances).where(eq(piholeInstances.id, id)).get();
  if (!updated) throw Errors.notFound('Pi-hole connection not found');
  return toPiholePublic(updated);
}

export function deletePiholeConnection(id: string): void {
  const db = getDb();
  const existing = db.select().from(piholeInstances).where(eq(piholeInstances.id, id)).get();
  if (!existing) throw Errors.notFound('Pi-hole connection not found');

  const linked = countLinkedWidgets('pihole', id);
  if (linked > 0) {
    throw Errors.badRequest(`Cannot delete — ${linked} widget(s) are using this connection`);
  }

  db.delete(piholeInstances).where(eq(piholeInstances.id, id)).run();
}

export async function testPiholeConnection(
  baseUrl: string,
  apiToken: string,
): Promise<{ success: boolean; version?: string; message: string }> {
  const TIMEOUT_MS = 8000;
  try {
    // Step 1: Authenticate
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let sid: string;
    try {
      const res = await fetch(`${baseUrl}/api/auth`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: apiToken }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          return {
            success: false,
            message: 'Pi-hole rejected the API password — check your token',
          };
        }
        return { success: false, message: `Pi-hole auth failed with status ${res.status}` };
      }

      const data = (await res.json()) as { session?: { sid?: string } };
      sid = data?.session?.sid ?? '';
      if (!sid) {
        return {
          success: false,
          message: 'Pi-hole auth response missing session SID — is this v6+?',
        };
      }
    } finally {
      clearTimeout(timer);
    }

    // Step 2: Fetch version
    const versionController = new AbortController();
    const versionTimer = setTimeout(() => versionController.abort(), TIMEOUT_MS);
    try {
      const versionRes = await fetch(`${baseUrl}/api/info/version`, {
        signal: versionController.signal,
        headers: { 'X-FTL-SID': sid, 'Content-Type': 'application/json' },
      });

      if (!versionRes.ok) {
        return { success: false, message: 'Authenticated but could not fetch version info' };
      }

      const versionData = (await versionRes.json()) as { version?: unknown };
      const ver = versionData?.version;
      const versionStr =
        typeof ver === 'string'
          ? ver
          : ver && typeof ver === 'object' && 'core' in ver
            ? ((ver as { core?: { local?: { version?: string } } }).core?.local?.version ??
              'unknown')
            : 'unknown';
      return { success: true, version: versionStr, message: `Connected to Pi-hole ${versionStr}` };
    } finally {
      clearTimeout(versionTimer);
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { success: false, message: `Pi-hole unreachable at ${baseUrl} (timeout)` };
    }
    if (err instanceof Error) {
      return { success: false, message: err.message };
    }
    return { success: false, message: 'Unknown error' };
  }
}

// ─── Docker Connection CRUD ─────────────────────────────────────────────────

export function listDockerConnections(): DockerConnectionPublic[] {
  const db = getDb();
  const rows = db.select().from(dockerConnections).all();
  return rows.map(toDockerPublic);
}

export function getDockerConnection(id: string): DockerConnectionPublic | null {
  const db = getDb();
  const row = db.select().from(dockerConnections).where(eq(dockerConnections.id, id)).get();
  if (!row) return null;
  return toDockerPublic(row);
}

export function createDockerConnection(name: string, dockerUrl: string): DockerConnectionPublic {
  const db = getDb();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  db.insert(dockerConnections)
    .values({ id, name, dockerUrl, createdAt: now, updatedAt: now })
    .run();

  return {
    id,
    name,
    dockerUrl,
    linkedWidgets: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function updateDockerConnection(
  id: string,
  updates: { name?: string | undefined; dockerUrl?: string | undefined },
): DockerConnectionPublic {
  const db = getDb();
  const existing = db.select().from(dockerConnections).where(eq(dockerConnections.id, id)).get();
  if (!existing) throw Errors.notFound('Docker connection not found');

  const now = new Date().toISOString();
  const setClause: Record<string, unknown> = { updatedAt: now };

  if (updates.name !== undefined) setClause['name'] = updates.name;
  if (updates.dockerUrl !== undefined) setClause['dockerUrl'] = updates.dockerUrl;

  db.update(dockerConnections).set(setClause).where(eq(dockerConnections.id, id)).run();

  const updated = db.select().from(dockerConnections).where(eq(dockerConnections.id, id)).get();
  if (!updated) throw Errors.notFound('Docker connection not found');
  return toDockerPublic(updated);
}

export function deleteDockerConnection(id: string): void {
  const db = getDb();
  const existing = db.select().from(dockerConnections).where(eq(dockerConnections.id, id)).get();
  if (!existing) throw Errors.notFound('Docker connection not found');

  const linked = countLinkedWidgets('docker', id);
  if (linked > 0) {
    throw Errors.badRequest(`Cannot delete — ${linked} widget(s) are using this connection`);
  }

  db.delete(dockerConnections).where(eq(dockerConnections.id, id)).run();
}

/**
 * Test a Docker connection by listing containers at the negotiated API version.
 *
 * Previously a `/_ping`, which is unversioned and therefore answered 200 even
 * when the versioned listing the widget actually performs returned 400 — a
 * green test with an empty widget (#181, FR-028, SC-009).
 */
export async function testDockerConnection(
  dockerUrl: string,
): Promise<{ success: boolean; message?: string }> {
  const result = await testDockerListing(dockerUrl);
  return result.success
    ? { success: true, message: 'Connected to Docker' }
    : { success: false, message: result.message };
}

// ─── Widget Linking ─────────────────────────────────────────────────────────

export function linkWidgetToConnection(
  widgetInstanceId: string,
  connectionType: 'pihole' | 'docker',
  connectionId: string,
): void {
  const db = getDb();

  // Verify the widget exists
  const widget = db
    .select({ id: appWidgetInstances.id })
    .from(appWidgetInstances)
    .where(eq(appWidgetInstances.id, widgetInstanceId))
    .get();
  if (!widget) throw Errors.notFound('Widget instance not found');

  // Verify the connection exists
  if (connectionType === 'pihole') {
    const conn = db
      .select({ id: piholeInstances.id })
      .from(piholeInstances)
      .where(eq(piholeInstances.id, connectionId))
      .get();
    if (!conn) throw Errors.notFound('Pi-hole connection not found');
  } else {
    const conn = db
      .select({ id: dockerConnections.id })
      .from(dockerConnections)
      .where(eq(dockerConnections.id, connectionId))
      .get();
    if (!conn) throw Errors.notFound('Docker connection not found');
  }

  // Upsert: delete existing link for this widget+type, then insert
  db.delete(widgetConnections)
    .where(
      and(
        eq(widgetConnections.widgetInstanceId, widgetInstanceId),
        eq(widgetConnections.connectionType, connectionType),
      ),
    )
    .run();

  db.insert(widgetConnections)
    .values({ widgetInstanceId, connectionType, connectionId, sortOrder: 0 })
    .run();
}

export function listDockerWidgetHosts(widgetInstanceId: string): DockerWidgetHost[] {
  const db = getDb();
  return db
    .select({
      connectionId: widgetConnections.connectionId,
      name: dockerConnections.name,
      sortOrder: widgetConnections.sortOrder,
    })
    .from(widgetConnections)
    .innerJoin(dockerConnections, eq(dockerConnections.id, widgetConnections.connectionId))
    .where(
      and(
        eq(widgetConnections.widgetInstanceId, widgetInstanceId),
        eq(widgetConnections.connectionType, 'docker'),
      ),
    )
    .orderBy(asc(widgetConnections.sortOrder), asc(dockerConnections.name))
    .all();
}

export function replaceDockerWidgetConnections(
  widgetInstanceId: string,
  connectionIds: string[],
): DockerWidgetHost[] {
  if (new Set(connectionIds).size !== connectionIds.length) {
    throw Errors.validationError('connectionIds must not contain duplicates');
  }

  const db = getDb();
  const widget = db
    .select({ id: appWidgetInstances.id, type: appWidgetInstances.type })
    .from(appWidgetInstances)
    .where(eq(appWidgetInstances.id, widgetInstanceId))
    .get();
  if (!widget) throw Errors.notFound('Widget instance not found');
  if (widget.type !== 'docker') {
    throw Errors.badRequest('Widget instance is not a Docker widget');
  }

  if (connectionIds.length > 0) {
    const connections = db
      .select({ id: dockerConnections.id })
      .from(dockerConnections)
      .where(inArray(dockerConnections.id, connectionIds))
      .all();
    if (connections.length !== connectionIds.length) {
      throw Errors.notFound('One or more Docker connections were not found');
    }
  }

  db.transaction((tx) => {
    tx.delete(widgetConnections)
      .where(
        and(
          eq(widgetConnections.widgetInstanceId, widgetInstanceId),
          eq(widgetConnections.connectionType, 'docker'),
        ),
      )
      .run();

    if (connectionIds.length > 0) {
      tx.insert(widgetConnections)
        .values(
          connectionIds.map((connectionId, sortOrder) => ({
            widgetInstanceId,
            connectionType: 'docker',
            connectionId,
            sortOrder,
          })),
        )
        .run();
    }
  });

  return listDockerWidgetHosts(widgetInstanceId);
}

export function resolveDockerWidgetEndpoint(
  widgetInstanceId: string,
  connectionId: string,
): string {
  const db = getDb();
  const conn = db
    .select({ dockerUrl: dockerConnections.dockerUrl })
    .from(widgetConnections)
    .innerJoin(dockerConnections, eq(dockerConnections.id, widgetConnections.connectionId))
    .where(
      and(
        eq(widgetConnections.widgetInstanceId, widgetInstanceId),
        eq(widgetConnections.connectionType, 'docker'),
        eq(widgetConnections.connectionId, connectionId),
      ),
    )
    .get();
  if (!conn?.dockerUrl) {
    throw DockerErrors.notConfigured(
      'That Docker connection is not linked to this widget.',
    );
  }

  const parsed = parseDockerEndpoint(conn.dockerUrl);
  if (!parsed.ok) {
    throw DockerErrors.invalidEndpoint(
      `The Docker connection linked to this widget is not a valid endpoint: ${parsed.error}`,
    );
  }

  return conn.dockerUrl;
}

export function unlinkWidgetConnection(
  widgetInstanceId: string,
  connectionType: 'pihole' | 'docker',
): void {
  const db = getDb();
  db.delete(widgetConnections)
    .where(
      and(
        eq(widgetConnections.widgetInstanceId, widgetInstanceId),
        eq(widgetConnections.connectionType, connectionType),
      ),
    )
    .run();
}

export function getLinkedWidgets(connectionType: string, connectionId: string): string[] {
  const db = getDb();
  const rows = db
    .select({ widgetInstanceId: widgetConnections.widgetInstanceId })
    .from(widgetConnections)
    .where(
      and(
        eq(widgetConnections.connectionType, connectionType),
        eq(widgetConnections.connectionId, connectionId),
      ),
    )
    .all();
  return rows.map((r) => r.widgetInstanceId);
}

// ─── Aggregated Listing ─────────────────────────────────────────────────────

export function listAllConnections(): {
  pihole: PiholeConnectionPublic[];
  docker: DockerConnectionPublic[];
} {
  return {
    pihole: listPiholeConnections(),
    docker: listDockerConnections(),
  };
}
