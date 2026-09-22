/**
 * Pi-hole v6 backend service — proxies all Pi-hole API calls.
 * Stores connection config with encrypted API token.
 * Uses Pi-hole v6 session-based auth: POST /api/auth → SID.
 */

import crypto from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import { getDb } from '../db/drizzle.js';
import { piholeInstances, widgetConnections } from '../db/schema/index.js';
import { encryptToken, decryptToken } from '../lib/token-encryption.js';
import { Errors } from '../lib/errors.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PiholeConfigPublic {
  id: string;
  widgetInstanceId: string;
  baseUrl: string;
  pollIntervalSec: number;
  hasToken: boolean;
}

export interface PiholeStats {
  totalQueries: number;
  blockedQueries: number;
  percentBlocked: number;
  domainsOnBlocklist: number;
  uniqueClients: number;
  blocking: 'enabled' | 'disabled';
  timer: number | null;
}

export interface PiholeSystemHealth {
  cpu: number | null;
  memory: number | null;
  load: [number, number, number] | null;
  temp: number | null;
  uptime: number | null;
}

export interface PiholeConnectionTestResult {
  success: boolean;
  version?: string;
  message: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 8000;

// Session cache: connectionId → { sid, baseUrl, expiresAt }
const sessionCache = new Map<string, { sid: string; baseUrl: string; expiresAt: number }>();
const SESSION_TTL_MS = 4 * 60 * 1000; // 4 minutes (Pi-hole sessions last ~5 min)

// Dedup concurrent login attempts per connectionId
const loginInflight = new Map<string, Promise<{ sid: string; baseUrl: string }>>();

async function piFetch(
  baseUrl: string,
  path: string,
  sid: string,
  init?: RequestInit,
): Promise<Response> {
  const url = `${baseUrl}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        ...init?.headers,
        'X-FTL-SID': sid,
        'Content-Type': 'application/json',
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Logout a Pi-hole session to free up session slots. */
async function piholeLogout(baseUrl: string, sid: string): Promise<void> {
  try {
    await fetch(`${baseUrl}/api/auth`, {
      method: 'DELETE',
      headers: { 'X-FTL-SID': sid, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // best-effort logout, ignore errors
  }
}

/** Authenticate with Pi-hole v6 and get a session ID. */
async function piholeLogin(baseUrl: string, password: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(`${baseUrl}/api/auth`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      if (res.status === 401) {
        throw Errors.unauthorized('Pi-hole rejected the API password — check your token');
      }
      if (res.status === 429 || body.includes('api_seats_exceeded')) {
        throw Errors.badRequest(
          'Pi-hole has too many active sessions — restart Pi-hole FTL or increase webserver.api.max_sessions',
        );
      }
      throw Errors.badRequest(`Pi-hole auth failed with status ${res.status}`);
    }

    const data = (await res.json()) as { session?: { sid?: string } };
    const sid = data?.session?.sid;
    if (!sid) {
      throw Errors.badRequest('Pi-hole auth response missing session SID — is this v6+?');
    }
    return sid;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw Errors.badRequest(`Pi-hole unreachable at ${baseUrl} (timeout)`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve the Pi-hole connection for a widget instance.
 * Checks widget_connections first, falls back to legacy pihole_instances.widgetInstanceId.
 */
function resolveConnectionForWidget(widgetInstanceId: string): {
  connectionId: string;
  baseUrl: string;
  password: string;
} {
  const db = getDb();

  // Check the new join table first
  const link = db
    .select()
    .from(widgetConnections)
    .where(
      and(
        eq(widgetConnections.widgetInstanceId, widgetInstanceId),
        eq(widgetConnections.connectionType, 'pihole'),
      ),
    )
    .get();

  if (link) {
    const conn = db
      .select()
      .from(piholeInstances)
      .where(eq(piholeInstances.id, link.connectionId))
      .get();
    if (conn) {
      return {
        connectionId: conn.id,
        baseUrl: conn.baseUrl,
        password: decryptToken(conn.apiTokenEncrypted),
      };
    }
  }

  // Legacy fallback: pihole_instances.widgetInstanceId
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

  throw Errors.notFound('Pi-hole config not found for this widget');
}

/** Get a session ID — uses cache keyed by connectionId to share sessions across widgets. */
async function getSessionForInstance(
  widgetInstanceId: string,
): Promise<{ sid: string; baseUrl: string }> {
  const { connectionId, baseUrl, password } = resolveConnectionForWidget(widgetInstanceId);

  // Check cache first (keyed by connectionId)
  const cached = sessionCache.get(connectionId);
  if (cached && cached.expiresAt > Date.now()) {
    return { sid: cached.sid, baseUrl: cached.baseUrl };
  }

  // Coalesce concurrent login attempts
  const inflight = loginInflight.get(connectionId);
  if (inflight) {
    return inflight;
  }

  const loginPromise = (async () => {
    const sid = await piholeLogin(baseUrl, password);

    // Cache the session by connectionId
    sessionCache.set(connectionId, {
      sid,
      baseUrl,
      expiresAt: Date.now() + SESSION_TTL_MS,
    });

    return { sid, baseUrl };
  })();

  loginInflight.set(connectionId, loginPromise);
  try {
    return await loginPromise;
  } finally {
    loginInflight.delete(connectionId);
  }
}

/** Invalidate cached session by connectionId so next call re-authenticates. Also logs out from Pi-hole to free session slot. */
function invalidateSessionByConnectionId(connectionId: string): void {
  const cached = sessionCache.get(connectionId);
  if (cached) {
    void piholeLogout(cached.baseUrl, cached.sid);
  }
  sessionCache.delete(connectionId);
}

/** Invalidate cached session for a widget instance. Resolves to connectionId internally. */
function invalidateSession(widgetInstanceId: string): void {
  try {
    const { connectionId } = resolveConnectionForWidget(widgetInstanceId);
    invalidateSessionByConnectionId(connectionId);
  } catch {
    // Widget has no connection — nothing to invalidate
  }
}

// ─── Config CRUD ────────────────────────────────────────────────────────────

export function getPiholeConfig(widgetInstanceId: string): PiholeConfigPublic | null {
  const db = getDb();
  const row = db
    .select({
      id: piholeInstances.id,
      widgetInstanceId: piholeInstances.widgetInstanceId,
      baseUrl: piholeInstances.baseUrl,
      pollIntervalSec: piholeInstances.pollIntervalSec,
      apiTokenEncrypted: piholeInstances.apiTokenEncrypted,
    })
    .from(piholeInstances)
    .where(eq(piholeInstances.widgetInstanceId, widgetInstanceId))
    .get();

  if (!row) return null;

  return {
    id: row.id,
    widgetInstanceId: row.widgetInstanceId ?? '',
    baseUrl: row.baseUrl,
    pollIntervalSec: row.pollIntervalSec,
    hasToken: !!row.apiTokenEncrypted,
  };
}

export function savePiholeConfig(
  widgetInstanceId: string,
  baseUrl: string,
  apiToken: string | undefined,
  pollIntervalSec: number,
): PiholeConfigPublic {
  const db = getDb();
  const now = new Date().toISOString();
  const existing = db
    .select({ id: piholeInstances.id, apiTokenEncrypted: piholeInstances.apiTokenEncrypted })
    .from(piholeInstances)
    .where(eq(piholeInstances.widgetInstanceId, widgetInstanceId))
    .get();

  if (existing) {
    // Update — keep existing token if not provided
    const encrypted = apiToken ? encryptToken(apiToken) : existing.apiTokenEncrypted;
    db.update(piholeInstances)
      .set({ baseUrl, apiTokenEncrypted: encrypted, pollIntervalSec, updatedAt: now })
      .where(eq(piholeInstances.id, existing.id))
      .run();

    invalidateSession(widgetInstanceId);

    return {
      id: existing.id,
      widgetInstanceId,
      baseUrl,
      pollIntervalSec,
      hasToken: true,
    };
  }

  // Create — token is required
  if (!apiToken) {
    throw Errors.badRequest('API token/password is required for initial setup');
  }

  const id = crypto.randomUUID();
  db.insert(piholeInstances)
    .values({
      id,
      widgetInstanceId,
      baseUrl,
      apiTokenEncrypted: encryptToken(apiToken),
      pollIntervalSec,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return { id, widgetInstanceId, baseUrl, pollIntervalSec, hasToken: true };
}

export function deletePiholeConfig(widgetInstanceId: string): boolean {
  const db = getDb();
  const result = db
    .delete(piholeInstances)
    .where(eq(piholeInstances.widgetInstanceId, widgetInstanceId))
    .run();
  return result.changes > 0;
}

// ─── Connection Test ────────────────────────────────────────────────────────

export async function testConnection(
  baseUrl: string,
  apiToken: string,
): Promise<PiholeConnectionTestResult> {
  try {
    // Step 1: Authenticate
    const sid = await piholeLogin(baseUrl, apiToken);

    // Step 2: Check version to confirm v6
    const versionRes = await piFetch(baseUrl, '/api/info/version', sid);
    if (!versionRes.ok) {
      return { success: false, message: 'Authenticated but could not fetch version info' };
    }

    const versionData = (await versionRes.json()) as { version?: unknown };
    const ver = versionData?.version;
    const versionStr =
      typeof ver === 'string'
        ? ver
        : ver && typeof ver === 'object' && 'core' in ver
          ? ((ver as { core?: { local?: { version?: string } } }).core?.local?.version ?? 'unknown')
          : 'unknown';

    return {
      success: true,
      version: versionStr,
      message: `Connected to Pi-hole ${versionStr}`,
    };
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

// ─── Stats ──────────────────────────────────────────────────────────────────

export async function fetchStats(widgetInstanceId: string): Promise<PiholeStats> {
  const doFetch = async (): Promise<PiholeStats> => {
    const { sid, baseUrl } = await getSessionForInstance(widgetInstanceId);

    // Fetch summary + blocking status in parallel
    const [summaryRes, blockingRes] = await Promise.all([
      piFetch(baseUrl, '/api/stats/summary', sid),
      piFetch(baseUrl, '/api/dns/blocking', sid),
    ]);

    // Retry on 401 (stale session)
    if (summaryRes.status === 401 || blockingRes.status === 401) {
      invalidateSession(widgetInstanceId);
      throw Object.assign(new Error('session_expired'), { retry: true });
    }

    if (!summaryRes.ok) {
      throw Errors.badRequest(`Pi-hole stats request failed (HTTP ${summaryRes.status})`);
    }
    if (!blockingRes.ok) {
      throw Errors.badRequest(
        `Pi-hole blocking status request failed (HTTP ${blockingRes.status})`,
      );
    }

    const summary = (await summaryRes.json()) as Record<string, unknown>;
    const blockingData = (await blockingRes.json()) as Record<string, unknown>;

    // Extract stats — Pi-hole v6 shape (bracket notation for index signatures)
    const queries = summary['queries'] as Record<string, number> | undefined;
    const clients = summary['clients'] as Record<string, number> | undefined;
    const gravity = summary['gravity'] as Record<string, number> | undefined;

    return {
      totalQueries: queries?.['total'] ?? 0,
      blockedQueries: queries?.['blocked'] ?? 0,
      percentBlocked: queries?.['percent_blocked'] ?? 0,
      domainsOnBlocklist: gravity?.['domains_being_blocked'] ?? 0,
      uniqueClients: clients?.['total'] ?? 0,
      blocking: blockingData['blocking'] === 'enabled' ? 'enabled' : 'disabled',
      timer: typeof blockingData['timer'] === 'number' ? blockingData['timer'] : null,
    };
  };

  try {
    return await doFetch();
  } catch (err) {
    if (err && typeof err === 'object' && 'retry' in err) {
      return await doFetch();
    }
    throw err;
  }
}

// ─── System Health ──────────────────────────────────────────────────────────

export async function fetchSystemHealth(widgetInstanceId: string): Promise<PiholeSystemHealth> {
  const doFetch = async (): Promise<PiholeSystemHealth> => {
    const { sid, baseUrl } = await getSessionForInstance(widgetInstanceId);

    const res = await piFetch(baseUrl, '/api/info/system', sid);

    if (res.status === 401) {
      invalidateSession(widgetInstanceId);
      throw Object.assign(new Error('session_expired'), { retry: true });
    }
    if (!res.ok) {
      throw Errors.badRequest(`Pi-hole system info request failed (HTTP ${res.status})`);
    }

    const data = (await res.json()) as Record<string, unknown>;
    const sys = (data['system'] as Record<string, unknown> | undefined) ?? data;
    const cpuData = sys['cpu'] as Record<string, unknown> | undefined;
    const memData = sys['memory'] as Record<string, unknown> | undefined;
    const ramData = memData?.['ram'] as Record<string, number> | undefined;
    const loadData = cpuData?.['load'] as Record<string, unknown> | undefined;

    return {
      cpu: typeof cpuData?.['%cpu'] === 'number' ? cpuData['%cpu'] : null,
      memory: typeof ramData?.['%used'] === 'number' ? ramData['%used'] : null,
      load: Array.isArray(loadData?.['raw']) ? (loadData['raw'] as [number, number, number]) : null,
      temp: typeof sys['temp'] === 'number' ? sys['temp'] : null,
      uptime: typeof sys['uptime'] === 'number' ? sys['uptime'] : null,
    };
  };

  try {
    return await doFetch();
  } catch (err) {
    if (err && typeof err === 'object' && 'retry' in err) {
      return await doFetch();
    }
    throw err;
  }
}

// ─── Blocking Control ───────────────────────────────────────────────────────

export async function setBlocking(
  widgetInstanceId: string,
  action: 'enable' | 'disable',
  duration?: number | null,
): Promise<{ blocking: string; timer: number | null }> {
  const { sid, baseUrl } = await getSessionForInstance(widgetInstanceId);

  const body: Record<string, unknown> = {
    blocking: action === 'enable',
  };
  if (action === 'disable' && duration && duration > 0) {
    body['timer'] = duration;
  }

  const res = await piFetch(baseUrl, '/api/dns/blocking', sid, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw Errors.badRequest(`Pi-hole blocking control failed (HTTP ${res.status})`);
  }

  const data = (await res.json()) as Record<string, unknown>;
  return {
    blocking: data['blocking'] === true || data['blocking'] === 'enabled' ? 'enabled' : 'disabled',
    timer: typeof data['timer'] === 'number' ? data['timer'] : null,
  };
}
