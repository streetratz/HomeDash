/**
 * T007 (004): OAuth service — token exchange, refresh, account management.
 */

import { eq, and } from 'drizzle-orm';
import { getDb } from '../db/drizzle.js';
import { oauthAccounts, calendarSources } from '../db/schema/index.js';
import { encryptToken, decryptToken } from '../lib/token-encryption.js';
import { Errors } from '../lib/errors.js';
import { getEnv } from '../config/env.js';
import { getIntegrationConfigs } from './integrationConfigService.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface OAuthAccount {
  id: string;
  userId: string;
  provider: 'microsoft' | 'google' | 'spotify' | 'sonos';
  providerAccountId: string;
  email: string | null;
  displayName: string | null;
  status: 'active' | 'error';
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OAuthAccountView {
  id: string;
  provider: 'microsoft' | 'google' | 'spotify' | 'sonos';
  email: string | null;
  displayName: string | null;
  status: 'active' | 'error';
  lastError: string | null;
  createdAt: string;
}

// ─── Microsoft token exchange ───────────────────────────────────────────────

export async function exchangeMicrosoftCode(code: string, userId: string): Promise<OAuthAccount> {
  const env = getEnv();
  if (!env.MICROSOFT_CLIENT_ID || !env.MICROSOFT_CLIENT_SECRET) {
    throw Errors.badRequest('Microsoft OAuth is not configured');
  }

  const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.MICROSOFT_CLIENT_ID,
      client_secret: env.MICROSOFT_CLIENT_SECRET,
      code,
      redirect_uri: env.MICROSOFT_REDIRECT_URI ?? '',
      grant_type: 'authorization_code',
      scope: 'Calendars.Read Tasks.ReadWrite offline_access openid profile email',
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw Errors.badRequest(`Microsoft token exchange failed: ${text}`);
  }

  const tokenData = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  // Fetch user profile
  const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!profileRes.ok) {
    throw Errors.badRequest('Failed to fetch Microsoft profile');
  }

  const profile = (await profileRes.json()) as {
    id: string;
    mail?: string;
    userPrincipalName?: string;
    displayName?: string;
  };

  const email = profile.mail ?? profile.userPrincipalName ?? null;
  const displayName = profile.displayName ?? null;
  const providerAccountId = profile.id;

  return upsertAccount({
    userId,
    provider: 'microsoft',
    providerAccountId,
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token ?? '',
    expiresIn: tokenData.expires_in,
    email,
    displayName,
  });
}

// ─── Google token exchange ──────────────────────────────────────────────────

export async function exchangeGoogleCode(code: string, userId: string): Promise<OAuthAccount> {
  const env = getEnv();
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw Errors.badRequest('Google OAuth is not configured');
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      code,
      redirect_uri: env.GOOGLE_REDIRECT_URI ?? '',
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw Errors.badRequest(`Google token exchange failed: ${text}`);
  }

  const tokenData = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!profileRes.ok) {
    throw Errors.badRequest('Failed to fetch Google profile');
  }

  const profile = (await profileRes.json()) as {
    id: string;
    email?: string;
    name?: string;
  };

  return upsertAccount({
    userId,
    provider: 'google',
    providerAccountId: profile.id,
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token ?? '',
    expiresIn: tokenData.expires_in,
    email: profile.email ?? null,
    displayName: profile.name ?? null,
  });
}

// ─── Refresh access token ───────────────────────────────────────────────────

export async function refreshAccessToken(accountId: string, forceRefresh = false): Promise<string> {
  const db = getDb();
  const account = db.select().from(oauthAccounts).where(eq(oauthAccounts.id, accountId)).get();

  if (!account) {
    throw Errors.notFound('OAuth account not found');
  }

  const accessToken = decryptToken(account.accessTokenEnc);

  // If token hasn't expired yet and we're not forcing, return it directly
  if (!forceRefresh && account.tokenExpiresAt && new Date(account.tokenExpiresAt) > new Date()) {
    return accessToken;
  }

  // Token is expired — refresh it
  const refreshToken = decryptToken(account.refreshTokenEnc);
  const env = getEnv();

  let tokenUrl: string;
  const params: Record<string, string> = {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  };

  if (account.provider === 'microsoft') {
    tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
    params['client_id'] = env.MICROSOFT_CLIENT_ID ?? '';
    params['client_secret'] = env.MICROSOFT_CLIENT_SECRET ?? '';
    params['scope'] = 'Calendars.Read Tasks.ReadWrite offline_access openid profile email';
  } else if (account.provider === 'spotify') {
    tokenUrl = 'https://accounts.spotify.com/api/token';
    params['client_id'] = env.SPOTIFY_CLIENT_ID ?? '';
    params['client_secret'] = env.SPOTIFY_CLIENT_SECRET ?? '';
  } else {
    tokenUrl = 'https://oauth2.googleapis.com/token';
    params['client_id'] = env.GOOGLE_CLIENT_ID ?? '';
    params['client_secret'] = env.GOOGLE_CLIENT_SECRET ?? '';
  }

  let tokenData: { access_token: string; refresh_token?: string; expires_in?: number };
  try {
    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      throw new Error(text);
    }

    tokenData = (await tokenRes.json()) as typeof tokenData;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Token refresh failed';
    const now = new Date().toISOString();
    db.update(oauthAccounts)
      .set({ status: 'error', lastError: message, updatedAt: now })
      .where(eq(oauthAccounts.id, accountId))
      .run();
    throw Errors.badRequest(`Token refresh failed: ${message}`);
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

// ─── Account listing ────────────────────────────────────────────────────────

export function getAccountsForUser(userId: string): OAuthAccountView[] {
  const db = getDb();
  const rows = db
    .select({
      id: oauthAccounts.id,
      provider: oauthAccounts.provider,
      email: oauthAccounts.email,
      displayName: oauthAccounts.displayName,
      status: oauthAccounts.status,
      lastError: oauthAccounts.lastError,
      createdAt: oauthAccounts.createdAt,
    })
    .from(oauthAccounts)
    .where(eq(oauthAccounts.userId, userId))
    .all();

  return rows;
}

// ─── Account deletion ───────────────────────────────────────────────────────

export function deleteAccount(accountId: string, userId: string, asAdmin = false): void {
  const db = getDb();
  const account = db
    .select({ id: oauthAccounts.id, userId: oauthAccounts.userId })
    .from(oauthAccounts)
    .where(eq(oauthAccounts.id, accountId))
    .get();

  if (!account) {
    throw Errors.notFound('OAuth account not found');
  }
  if (!asAdmin && account.userId !== userId) {
    throw Errors.forbidden("Cannot delete another user's OAuth account");
  }

  db.delete(oauthAccounts).where(eq(oauthAccounts.id, accountId)).run();
}

// ─── Available providers ────────────────────────────────────────────────────

export function getAvailableProviders(): {
  microsoft: boolean;
  google: boolean;
  spotify: boolean;
  sonos: boolean;
} {
  const env = getEnv();
  const spotifyDbConfig = getIntegrationConfigs('spotify');
  const sonosDbConfig = getIntegrationConfigs('sonos');
  return {
    microsoft: Boolean(env.MICROSOFT_CLIENT_ID),
    google: Boolean(env.GOOGLE_CLIENT_ID),
    spotify: Boolean(spotifyDbConfig['clientId'] || env.SPOTIFY_CLIENT_ID),
    sonos: Boolean(sonosDbConfig['clientId']),
  };
}

// ─── Internal helpers ───────────────────────────────────────────────────────

interface UpsertInput {
  userId: string;
  provider: 'microsoft' | 'google' | 'spotify' | 'sonos';
  providerAccountId: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number | undefined;
  email: string | null;
  displayName: string | null;
  /** If true, skip auto-creating a calendar source (e.g. for Spotify). */
  skipCalendarSource?: boolean;
}

function upsertAccount(input: UpsertInput): OAuthAccount {
  const db = getDb();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const accessTokenEnc = encryptToken(input.accessToken);
  const refreshTokenEnc = encryptToken(input.refreshToken);
  const tokenExpiresAt = input.expiresIn
    ? new Date(Date.now() + input.expiresIn * 1000).toISOString()
    : undefined;

  const existing = db
    .select({ id: oauthAccounts.id })
    .from(oauthAccounts)
    .where(
      and(
        eq(oauthAccounts.provider, input.provider),
        eq(oauthAccounts.providerAccountId, input.providerAccountId),
      ),
    )
    .get();

  let accountId: string;

  if (existing) {
    accountId = existing.id;
    db.update(oauthAccounts)
      .set({
        accessTokenEnc,
        refreshTokenEnc,
        ...(tokenExpiresAt ? { tokenExpiresAt } : {}),
        email: input.email,
        displayName: input.displayName,
        status: 'active' as const,
        lastError: null,
        updatedAt: now,
      })
      .where(eq(oauthAccounts.id, existing.id))
      .run();
  } else {
    accountId = id;
    db.insert(oauthAccounts)
      .values({
        id,
        userId: input.userId,
        provider: input.provider,
        providerAccountId: input.providerAccountId,
        accessTokenEnc,
        refreshTokenEnc,
        ...(tokenExpiresAt ? { tokenExpiresAt } : {}),
        email: input.email,
        displayName: input.displayName,
        status: 'active' as const,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    // Auto-create a calendar source for the new account (skip for non-calendar providers)
    if (!input.skipCalendarSource) {
      const sourceName = input.displayName ?? input.email ?? `${input.provider} calendar`;
      db.insert(calendarSources)
        .values({
          id: crypto.randomUUID(),
          userId: input.userId,
          oauthAccountId: accountId,
          type: input.provider as 'microsoft' | 'google',
          name: sourceName,
          color: '#3b82f6',
          syncIntervalSeconds: 300,
          enabled: true,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }
  }

  const account = db.select().from(oauthAccounts).where(eq(oauthAccounts.id, accountId)).get()!;

  return {
    id: account.id,
    userId: account.userId,
    provider: account.provider,
    providerAccountId: account.providerAccountId,
    email: account.email,
    displayName: account.displayName,
    status: account.status,
    lastError: account.lastError,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}
