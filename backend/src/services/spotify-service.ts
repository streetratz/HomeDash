/**
 * T003 (010): Spotify service — token management, authenticated API wrapper.
 */

import { eq, and } from 'drizzle-orm';
import { getDb } from '../db/drizzle.js';
import { oauthAccounts } from '../db/schema/index.js';
import { encryptToken, decryptToken } from '../lib/token-encryption.js';
import { Errors } from '../lib/errors.js';
import { getEnv } from '../config/env.js';
import { getIntegrationConfigs } from './integrationConfigService.js';

/** Resolve Spotify client credentials: DB overrides env vars. */
function getSpotifyClientCreds(): { clientId: string; clientSecret: string; redirectUri: string } {
  const dbConfig = getIntegrationConfigs('spotify');
  const env = getEnv();
  return {
    clientId: dbConfig['clientId'] ?? env.SPOTIFY_CLIENT_ID ?? '',
    clientSecret: dbConfig['clientSecret'] ?? env.SPOTIFY_CLIENT_SECRET ?? '',
    redirectUri: dbConfig['redirectUri'] ?? env.SPOTIFY_REDIRECT_URI ?? '',
  };
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SpotifyAccount {
  id: string;
  userId: string;
  providerAccountId: string;
  email: string | null;
  displayName: string | null;
  status: 'active' | 'error';
  tokenExpiresAt: string | null;
}

export interface SpotifyTokens {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type: string;
}

export interface SpotifyProfile {
  id: string;
  display_name: string | null;
  email: string;
  product?: string;
  images?: Array<{ url: string }>;
}

// ─── Account lookup ─────────────────────────────────────────────────────────

export function getSpotifyAccount(userId: string): SpotifyAccount | null {
  const db = getDb();
  const row = db
    .select({
      id: oauthAccounts.id,
      userId: oauthAccounts.userId,
      providerAccountId: oauthAccounts.providerAccountId,
      email: oauthAccounts.email,
      displayName: oauthAccounts.displayName,
      status: oauthAccounts.status,
      tokenExpiresAt: oauthAccounts.tokenExpiresAt,
    })
    .from(oauthAccounts)
    .where(and(eq(oauthAccounts.userId, userId), eq(oauthAccounts.provider, 'spotify')))
    .get();

  return row ?? null;
}

// ─── Token management ───────────────────────────────────────────────────────

/** Get a valid access token, auto-refreshing if expired. */
export async function getAccessToken(userId: string): Promise<string> {
  const db = getDb();
  const account = db
    .select()
    .from(oauthAccounts)
    .where(and(eq(oauthAccounts.userId, userId), eq(oauthAccounts.provider, 'spotify')))
    .get();

  if (!account) {
    throw Errors.notFound('No Spotify account connected');
  }

  // If token hasn't expired, return it
  if (account.tokenExpiresAt && new Date(account.tokenExpiresAt) > new Date()) {
    return decryptToken(account.accessTokenEnc);
  }

  // Token expired — refresh
  return refreshSpotifyToken(account.id);
}

/** Refresh Spotify access token using the refresh token. */
export async function refreshSpotifyToken(accountId: string): Promise<string> {
  const db = getDb();
  const account = db.select().from(oauthAccounts).where(eq(oauthAccounts.id, accountId)).get();

  if (!account) {
    throw Errors.notFound('OAuth account not found');
  }

  const refreshToken = decryptToken(account.refreshTokenEnc);
  const creds = getSpotifyClientCreds();

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
  });

  let tokenData: SpotifyTokens;
  try {
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text);
    }

    tokenData = (await res.json()) as SpotifyTokens;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Token refresh failed';
    const now = new Date().toISOString();
    db.update(oauthAccounts)
      .set({ status: 'error', lastError: message, updatedAt: now })
      .where(eq(oauthAccounts.id, accountId))
      .run();
    throw Errors.badRequest(`Spotify token refresh failed: ${message}`);
  }

  const now = new Date().toISOString();
  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : undefined;

  db.update(oauthAccounts)
    .set({
      accessTokenEnc: encryptToken(tokenData.access_token),
      ...(tokenData.refresh_token
        ? { refreshTokenEnc: encryptToken(tokenData.refresh_token) }
        : {}),
      ...(expiresAt ? { tokenExpiresAt: expiresAt } : {}),
      status: 'active' as const,
      lastError: null,
      updatedAt: now,
    })
    .where(eq(oauthAccounts.id, accountId))
    .run();

  return tokenData.access_token;
}

// ─── Authenticated Spotify API fetch ────────────────────────────────────────

/**
 * Make an authenticated request to the Spotify Web API.
 * Auto-refreshes the token on 401 and retries once.
 */
export async function spotifyFetch<T>(
  userId: string,
  path: string,
  options: RequestInit = {},
): Promise<T | null> {
  const token = await getAccessToken(userId);
  const url = `https://api.spotify.com/v1${path}`;

  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(url, { ...options, headers });

  // 204 No Content — nothing playing, empty result
  if (res.status === 204) return null;

  // 401 — token may have expired mid-flight, refresh and retry once
  if (res.status === 401) {
    const account = getSpotifyAccount(userId);
    if (!account) throw Errors.notFound('No Spotify account connected');

    const newToken = await refreshSpotifyToken(account.id);
    headers.set('Authorization', `Bearer ${newToken}`);

    const retryRes = await fetch(url, { ...options, headers });
    if (retryRes.status === 204) return null;
    if (!retryRes.ok) {
      const text = await retryRes.text();
      throw Errors.badRequest(`Spotify API error (${retryRes.status}): ${text}`);
    }
    return (await retryRes.json()) as T;
  }

  if (!res.ok) {
    const text = await res.text();
    // Surface specific Spotify error reasons for the frontend
    const errorInfo = parseSpotifyError(res.status, text);
    throw Errors.badRequest(errorInfo);
  }

  return (await res.json()) as T;
}

/** Parse Spotify error responses to surface meaningful messages. */
function parseSpotifyError(status: number, text: string): string {
  try {
    const parsed = JSON.parse(text) as { error?: { reason?: string; message?: string } };
    const reason = parsed.error?.reason;
    const message = parsed.error?.message;

    if (status === 403 && reason === 'PREMIUM_REQUIRED') {
      return 'PREMIUM_REQUIRED: Spotify Premium is required for playback control';
    }
    if (
      status === 403 &&
      (reason === 'RESTRICTED_DEVICE' || message?.includes('Restricted device'))
    ) {
      return 'RESTRICTED_DEVICE: This device cannot be controlled via the Web API. Transfer playback to a different device first.';
    }
    if (status === 404 && reason === 'NO_ACTIVE_DEVICE') {
      return 'NO_ACTIVE_DEVICE: No active Spotify device found. Open Spotify on a device first.';
    }
    if (status === 429) {
      return 'RATE_LIMITED: Too many requests. Please wait a moment.';
    }
    return `Spotify API error (${status}): ${message ?? text}`;
  } catch {
    return `Spotify API error (${status}): ${text}`;
  }
}

/**
 * Make an authenticated request that returns no body (PUT/POST control commands).
 * Returns the status code.
 */
export async function spotifyCommand(
  userId: string,
  path: string,
  options: RequestInit = {},
): Promise<number> {
  const token = await getAccessToken(userId);
  const url = `https://api.spotify.com/v1${path}`;

  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(url, { ...options, headers });

  // 401 — retry once after refresh
  if (res.status === 401) {
    const account = getSpotifyAccount(userId);
    if (!account) throw Errors.notFound('No Spotify account connected');

    const newToken = await refreshSpotifyToken(account.id);
    headers.set('Authorization', `Bearer ${newToken}`);

    const retryRes = await fetch(url, { ...options, headers });
    if (!retryRes.ok && retryRes.status !== 204) {
      const text = await retryRes.text();
      throw Errors.badRequest(`Spotify API error (${retryRes.status}): ${text}`);
    }
    return retryRes.status;
  }

  if (!res.ok && res.status !== 204) {
    const text = await res.text();
    const errorInfo = parseSpotifyError(res.status, text);
    throw Errors.badRequest(errorInfo);
  }

  return res.status;
}

// ─── Code exchange ──────────────────────────────────────────────────────────

/** Exchange an authorization code for tokens and upsert the Spotify account. */
export async function exchangeSpotifyCode(code: string, userId: string): Promise<void> {
  const creds = getSpotifyClientCreds();
  if (!creds.clientId || !creds.clientSecret) {
    throw Errors.badRequest('Spotify OAuth is not configured');
  }

  // Exchange code for tokens
  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: creds.redirectUri,
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw Errors.badRequest(`Spotify token exchange failed: ${text}`);
  }

  const tokenData = (await tokenRes.json()) as SpotifyTokens;

  // Fetch user profile
  const profileRes = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!profileRes.ok) {
    throw Errors.badRequest('Failed to fetch Spotify profile');
  }

  const profile = (await profileRes.json()) as SpotifyProfile;

  // Upsert the account into oauth_accounts
  const db = getDb();
  const now = new Date().toISOString();
  const accessTokenEnc = encryptToken(tokenData.access_token);
  const refreshTokenEnc = encryptToken(tokenData.refresh_token ?? '');
  const tokenExpiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : undefined;

  const existing = db
    .select({ id: oauthAccounts.id })
    .from(oauthAccounts)
    .where(
      and(eq(oauthAccounts.provider, 'spotify'), eq(oauthAccounts.providerAccountId, profile.id)),
    )
    .get();

  if (existing) {
    db.update(oauthAccounts)
      .set({
        accessTokenEnc,
        refreshTokenEnc,
        ...(tokenExpiresAt ? { tokenExpiresAt } : {}),
        email: profile.email ?? null,
        displayName: profile.display_name ?? null,
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
        provider: 'spotify',
        providerAccountId: profile.id,
        accessTokenEnc,
        refreshTokenEnc,
        ...(tokenExpiresAt ? { tokenExpiresAt } : {}),
        email: profile.email ?? null,
        displayName: profile.display_name ?? null,
        status: 'active' as const,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }
}

// ─── Account deletion ───────────────────────────────────────────────────────

export function deleteSpotifyAccount(userId: string): void {
  const db = getDb();
  db.delete(oauthAccounts)
    .where(and(eq(oauthAccounts.userId, userId), eq(oauthAccounts.provider, 'spotify')))
    .run();
}
