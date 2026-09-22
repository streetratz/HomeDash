/**
 * 017: Sonos Cloud Control API service — OAuth, token management, authenticated API wrapper.
 *
 * Uses the official Sonos Control API (api.ws.sonos.com/control/api/v1).
 * Mirrors the spotify-service.ts pattern: tokens in oauth_accounts, auto-refresh on 401.
 */

import { eq, and } from 'drizzle-orm';
import { getDb } from '../db/drizzle.js';
import { oauthAccounts } from '../db/schema/index.js';
import { encryptToken, decryptToken } from '../lib/token-encryption.js';
import { Errors } from '../lib/errors.js';
import { getIntegrationConfigs } from './integrationConfigService.js';

// ─── Constants ──────────────────────────────────────────────────────────────

const SONOS_AUTH_URL = 'https://api.sonos.com/login/v3/oauth';
const SONOS_TOKEN_URL = 'https://api.sonos.com/login/v3/oauth/access';
const SONOS_API_BASE = 'https://api.ws.sonos.com/control/api/v1';
const SONOS_SCOPE = 'playback-control-all';

// ─── Credential resolution ──────────────────────────────────────────────────

/** Resolve Sonos client credentials from DB (integration_configs table). */
export function getSonosClientCreds(): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
} | null {
  const dbConfig = getIntegrationConfigs('sonos');
  const clientId = dbConfig['clientId'] ?? '';
  const clientSecret = dbConfig['clientSecret'] ?? '';
  const redirectUri = dbConfig['redirectUri'] ?? '';
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, redirectUri };
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SonosAccount {
  id: string;
  userId: string;
  providerAccountId: string;
  displayName: string | null;
  status: 'active' | 'error';
  tokenExpiresAt: string | null;
}

interface SonosTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

// Sonos API response types
export interface SonosHousehold {
  id: string;
  name: string;
}

export interface SonosPlayer {
  id: string;
  name: string;
  websocketUrl?: string;
  softwareVersion?: string;
  apiVersion?: string;
  minApiVersion?: string;
  capabilities?: string[];
  deviceIds?: string[];
}

export interface SonosGroup {
  id: string;
  name: string;
  coordinatorId: string;
  playbackState?: string;
  playerIds: string[];
}

export interface SonosGroupsResponse {
  groups: SonosGroup[];
  players: SonosPlayer[];
}

export interface SonosPlaybackState {
  playbackState: string; // PLAYBACK_STATE_IDLE, PLAYBACK_STATE_PLAYING, PLAYBACK_STATE_PAUSED, etc.
  positionMillis?: number;
  itemId?: string;
}

export interface SonosVolumeState {
  volume: number;
  muted: boolean;
  fixed?: boolean;
}

export interface SonosMetadata {
  container?: Record<string, unknown>;
  currentItem?: {
    track?: {
      name?: string;
      artist?: { name?: string };
      album?: { name?: string };
      imageUrl?: string;
      durationMillis?: number;
      service?: { name?: string; sn?: number; accountLabel?: string };
      type?: string;
    };
  };
}

// ─── Account lookup ─────────────────────────────────────────────────────────

export function getSonosAccount(userId: string): SonosAccount | null {
  const db = getDb();
  const row = db
    .select({
      id: oauthAccounts.id,
      userId: oauthAccounts.userId,
      providerAccountId: oauthAccounts.providerAccountId,
      displayName: oauthAccounts.displayName,
      status: oauthAccounts.status,
      tokenExpiresAt: oauthAccounts.tokenExpiresAt,
    })
    .from(oauthAccounts)
    .where(and(eq(oauthAccounts.userId, userId), eq(oauthAccounts.provider, 'sonos')))
    .get();

  return row ?? null;
}

// ─── Token management ───────────────────────────────────────────────────────

/** Build the Basic auth header for Sonos token requests. */
function buildBasicAuth(): string {
  const creds = getSonosClientCreds();
  if (!creds) throw Errors.badRequest('Sonos OAuth is not configured');
  const encoded = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString('base64');
  return `Basic ${encoded}`;
}

/** Get a valid access token, auto-refreshing if expired. */
export async function getSonosAccessToken(userId: string): Promise<string> {
  const db = getDb();
  const account = db
    .select()
    .from(oauthAccounts)
    .where(and(eq(oauthAccounts.userId, userId), eq(oauthAccounts.provider, 'sonos')))
    .get();

  if (!account) {
    throw Errors.notFound('No Sonos account connected');
  }

  // If token hasn't expired, return it
  if (account.tokenExpiresAt && new Date(account.tokenExpiresAt) > new Date()) {
    return decryptToken(account.accessTokenEnc);
  }

  // Token expired — refresh
  return refreshSonosToken(account.id);
}

/** Refresh Sonos access token using the refresh token. */
export async function refreshSonosToken(accountId: string): Promise<string> {
  const db = getDb();
  const account = db.select().from(oauthAccounts).where(eq(oauthAccounts.id, accountId)).get();

  if (!account) {
    throw Errors.notFound('Sonos OAuth account not found');
  }

  const refreshToken = decryptToken(account.refreshTokenEnc);

  let tokenData: SonosTokenResponse;
  try {
    const res = await fetch(SONOS_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
        Authorization: buildBasicAuth(),
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text);
    }

    tokenData = (await res.json()) as SonosTokenResponse;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Token refresh failed';
    const now = new Date().toISOString();
    db.update(oauthAccounts)
      .set({ status: 'error', lastError: message, updatedAt: now })
      .where(eq(oauthAccounts.id, accountId))
      .run();
    throw Errors.badRequest(`Sonos token refresh failed: ${message}`);
  }

  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

  db.update(oauthAccounts)
    .set({
      accessTokenEnc: encryptToken(tokenData.access_token),
      refreshTokenEnc: encryptToken(tokenData.refresh_token),
      tokenExpiresAt: expiresAt,
      status: 'active' as const,
      lastError: null,
      updatedAt: now,
    })
    .where(eq(oauthAccounts.id, accountId))
    .run();

  return tokenData.access_token;
}

// ─── Authenticated Sonos API fetch ──────────────────────────────────────────

/**
 * Make an authenticated request to the Sonos Control API.
 * Auto-refreshes the token on 401 and retries once.
 */
export async function sonosFetch<T>(
  userId: string,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getSonosAccessToken(userId);
  const url = `${SONOS_API_BASE}${path}`;

  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Content-Type', 'application/json');

  const res = await fetch(url, { ...options, headers });

  // 401 — token may have expired mid-flight, refresh and retry once
  if (res.status === 401) {
    const account = getSonosAccount(userId);
    if (!account) throw Errors.notFound('No Sonos account connected');

    const newToken = await refreshSonosToken(account.id);
    headers.set('Authorization', `Bearer ${newToken}`);

    const retryRes = await fetch(url, { ...options, headers });
    if (!retryRes.ok) {
      const text = await retryRes.text();
      throw Errors.badRequest(`Sonos API error (${retryRes.status}): ${text}`);
    }
    const contentType = retryRes.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      return (await retryRes.json()) as T;
    }
    return {} as T;
  }

  if (!res.ok) {
    const text = await res.text();
    throw Errors.badRequest(`Sonos API error (${res.status}): ${text}`);
  }

  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return (await res.json()) as T;
  }
  return {} as T;
}

/**
 * Make an authenticated POST command to the Sonos Control API (no response body expected).
 * Returns the status code.
 */
export async function sonosCommand(
  userId: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<number> {
  const token = await getSonosAccessToken(userId);
  const url = `${SONOS_API_BASE}${path}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Content-Length': body ? String(JSON.stringify(body).length) : '0',
  };

  const fetchOptions: RequestInit = {
    method: 'POST',
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  };

  const res = await fetch(url, fetchOptions);

  // 401 — retry once after refresh
  if (res.status === 401) {
    const account = getSonosAccount(userId);
    if (!account) throw Errors.notFound('No Sonos account connected');

    const newToken = await refreshSonosToken(account.id);
    headers['Authorization'] = `Bearer ${newToken}`;

    const retryRes = await fetch(url, { ...fetchOptions, headers });
    if (!retryRes.ok && retryRes.status !== 200) {
      const text = await retryRes.text();
      throw Errors.badRequest(`Sonos API error (${retryRes.status}): ${text}`);
    }
    return retryRes.status;
  }

  if (!res.ok) {
    const text = await res.text();
    throw Errors.badRequest(`Sonos API error (${res.status}): ${text}`);
  }

  return res.status;
}

// ─── Code exchange ──────────────────────────────────────────────────────────

/** Build the authorization URL for Sonos OAuth. */
export function buildSonosAuthUrl(state: string): string {
  const creds = getSonosClientCreds();
  if (!creds) throw Errors.badRequest('Sonos OAuth is not configured');

  const params = new URLSearchParams({
    client_id: creds.clientId,
    response_type: 'code',
    state,
    scope: SONOS_SCOPE,
    redirect_uri: creds.redirectUri,
  });

  return `${SONOS_AUTH_URL}?${params.toString()}`;
}

/** Exchange an authorization code for tokens and upsert the Sonos account. */
export async function exchangeSonosCode(code: string, userId: string): Promise<void> {
  const creds = getSonosClientCreds();
  if (!creds) throw Errors.badRequest('Sonos OAuth is not configured');

  // Exchange code for tokens
  const tokenRes = await fetch(SONOS_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      Authorization: buildBasicAuth(),
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: creds.redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw Errors.badRequest(`Sonos token exchange failed: ${text}`);
  }

  const tokenData = (await tokenRes.json()) as SonosTokenResponse;

  // Fetch households to get a display name
  const householdsRes = await fetch(`${SONOS_API_BASE}/households`, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  let displayName = 'Sonos System';
  let householdId = 'unknown';
  if (householdsRes.ok) {
    const data = (await householdsRes.json()) as { households: SonosHousehold[] };
    if (data.households.length > 0) {
      householdId = data.households[0]!.id;
      displayName =
        data.households[0]!.name ||
        `Sonos (${data.households.length} household${data.households.length > 1 ? 's' : ''})`;
    }
  }

  // Upsert the account into oauth_accounts
  const db = getDb();
  const now = new Date().toISOString();
  const accessTokenEnc = encryptToken(tokenData.access_token);
  const refreshTokenEnc = encryptToken(tokenData.refresh_token);
  const tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

  const existing = db
    .select({ id: oauthAccounts.id })
    .from(oauthAccounts)
    .where(and(eq(oauthAccounts.provider, 'sonos'), eq(oauthAccounts.userId, userId)))
    .get();

  if (existing) {
    db.update(oauthAccounts)
      .set({
        providerAccountId: householdId,
        accessTokenEnc,
        refreshTokenEnc,
        tokenExpiresAt,
        displayName,
        status: 'active' as const,
        lastError: null,
        updatedAt: now,
      })
      .where(eq(oauthAccounts.id, existing.id))
      .run();
  } else {
    db.insert(oauthAccounts)
      .values({
        id: crypto.randomUUID(),
        userId,
        provider: 'sonos',
        providerAccountId: householdId,
        accessTokenEnc,
        refreshTokenEnc,
        tokenExpiresAt,
        displayName,
        status: 'active' as const,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }
}

// ─── Account deletion ───────────────────────────────────────────────────────

export function deleteSonosAccount(userId: string): void {
  const db = getDb();
  db.delete(oauthAccounts)
    .where(and(eq(oauthAccounts.userId, userId), eq(oauthAccounts.provider, 'sonos')))
    .run();
}

// ─── High-level API helpers ─────────────────────────────────────────────────

/** Get all households for the authenticated user. */
export async function getHouseholds(userId: string): Promise<SonosHousehold[]> {
  const data = await sonosFetch<{ households: SonosHousehold[] }>(userId, '/households');
  return data.households ?? [];
}

/** Get groups and players for a household. */
export async function getGroups(userId: string, householdId: string): Promise<SonosGroupsResponse> {
  return sonosFetch<SonosGroupsResponse>(
    userId,
    `/households/${encodeURIComponent(householdId)}/groups`,
  );
}

/** Get playback state for a group. */
export async function getPlaybackState(
  userId: string,
  groupId: string,
): Promise<SonosPlaybackState> {
  return sonosFetch<SonosPlaybackState>(userId, `/groups/${encodeURIComponent(groupId)}/playback`);
}

/** Get playback metadata for a group. */
export async function getPlaybackMetadata(userId: string, groupId: string): Promise<SonosMetadata> {
  return sonosFetch<SonosMetadata>(
    userId,
    `/groups/${encodeURIComponent(groupId)}/playbackMetadata`,
  );
}

/** Get group volume. */
export async function getGroupVolume(userId: string, groupId: string): Promise<SonosVolumeState> {
  return sonosFetch<SonosVolumeState>(userId, `/groups/${encodeURIComponent(groupId)}/groupVolume`);
}

/** Get player volume. */
export async function getPlayerVolume(userId: string, playerId: string): Promise<SonosVolumeState> {
  return sonosFetch<SonosVolumeState>(
    userId,
    `/players/${encodeURIComponent(playerId)}/playerVolume`,
  );
}

// ─── Favorites ──────────────────────────────────────────────────────────────

export interface SonosFavorite {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  service?: { name: string; id: string };
}

/** List favorites for a household (max 70 per Sonos API). */
export async function getFavorites(userId: string, householdId: string): Promise<SonosFavorite[]> {
  const data = await sonosFetch<{ items?: SonosFavorite[] }>(
    userId,
    `/households/${encodeURIComponent(householdId)}/favorites`,
  );
  return data.items ?? [];
}

/** Load a favorite on a group and optionally start playback. */
export async function loadFavorite(
  userId: string,
  groupId: string,
  favoriteId: string,
  playOnCompletion = true,
): Promise<number> {
  return sonosCommand(userId, `/groups/${encodeURIComponent(groupId)}/favorites`, {
    favoriteId,
    playOnCompletion,
    action: 'REPLACE',
  });
}
