/**
 * T008 / T009 (004): OAuth redirect routes and account management API.
 */

import type { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import { requireAuth } from '../auth/requireRole.js';
import { requireAdmin } from '../auth/requireRole.js';
import { assertCsrf } from '../auth/csrf.js';
import { validate, UuidSchema } from '../lib/validation.js';
import { Errors } from '../lib/errors.js';
import { getEnv } from '../config/env.js';
import {
  exchangeMicrosoftCode,
  exchangeGoogleCode,
  getAccountsForUser,
  deleteAccount,
  getAvailableProviders,
} from '../services/oauth-service.js';

// ─── In-memory OAuth state storage (expires after 10 minutes) ───────────────

interface OAuthState {
  userId: string;
  createdAt: number;
}

const STATE_TTL_MS = 10 * 60 * 1000;
const pendingStates = new Map<string, OAuthState>();

function cleanExpiredStates(): void {
  const now = Date.now();
  for (const [key, state] of pendingStates) {
    if (now - state.createdAt > STATE_TTL_MS) {
      pendingStates.delete(key);
    }
  }
}

function createState(userId: string): string {
  cleanExpiredStates();
  const state = crypto.randomBytes(32).toString('hex');
  pendingStates.set(state, { userId, createdAt: Date.now() });
  return state;
}

function consumeState(state: string): string | null {
  const entry = pendingStates.get(state);
  if (!entry) return null;
  pendingStates.delete(state);
  if (Date.now() - entry.createdAt > STATE_TTL_MS) return null;
  return entry.userId;
}

/** Exported for tests only — clear all pending states. */
export function _clearPendingStates(): void {
  pendingStates.clear();
}

// ─── Route registration ─────────────────────────────────────────────────────

export function registerAuthOAuthRoutes(app: FastifyInstance): void {
  // ── T008: GET /api/auth/oauth/microsoft — redirect to Microsoft ──────────
  app.get('/api/auth/oauth/microsoft', async (request, reply) => {
    requireAuth(request, reply);

    const env = getEnv();
    if (!env.MICROSOFT_CLIENT_ID) {
      throw Errors.badRequest('Microsoft OAuth is not configured');
    }

    const state = createState(request.user!.id);
    const redirectUri = env.MICROSOFT_REDIRECT_URI ?? '';

    const params = new URLSearchParams({
      client_id: env.MICROSOFT_CLIENT_ID,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: 'Calendars.Read Tasks.ReadWrite offline_access openid profile email',
      response_mode: 'query',
      state,
    });

    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
    return reply.redirect(authUrl);
  });

  // ── T008: GET /api/auth/oauth/microsoft/callback ─────────────────────────
  app.get('/api/auth/oauth/microsoft/callback', async (request, reply) => {
    const query = request.query as { code?: string; state?: string; error?: string };

    if (query.error) {
      return reply.redirect('/settings?tab=accounts&error=oauth_denied');
    }

    if (!query.code || !query.state) {
      return reply.redirect('/settings?tab=accounts&error=oauth_invalid');
    }

    const userId = consumeState(query.state);
    if (!userId) {
      return reply.redirect('/settings?tab=accounts&error=oauth_state_invalid');
    }

    try {
      await exchangeMicrosoftCode(query.code, userId);
      return reply.redirect('/settings?tab=accounts&provider=microsoft');
    } catch (err) {
      request.log.error({ err }, 'Microsoft OAuth token exchange failed');
      return reply.redirect('/settings?tab=accounts&error=oauth_exchange_failed');
    }
  });

  // ── T008: GET /api/auth/oauth/google — redirect to Google ────────────────
  app.get('/api/auth/oauth/google', async (request, reply) => {
    requireAuth(request, reply);

    const env = getEnv();
    if (!env.GOOGLE_CLIENT_ID) {
      throw Errors.badRequest('Google OAuth is not configured');
    }

    const state = createState(request.user!.id);
    const redirectUri = env.GOOGLE_REDIRECT_URI ?? '';

    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: 'https://www.googleapis.com/auth/calendar.readonly email profile',
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    return reply.redirect(authUrl);
  });

  // ── T008: GET /api/auth/oauth/google/callback ────────────────────────────
  app.get('/api/auth/oauth/google/callback', async (request, reply) => {
    const query = request.query as { code?: string; state?: string; error?: string };

    if (query.error) {
      return reply.redirect('/settings?tab=accounts&error=oauth_denied');
    }

    if (!query.code || !query.state) {
      return reply.redirect('/settings?tab=accounts&error=oauth_invalid');
    }

    const userId = consumeState(query.state);
    if (!userId) {
      return reply.redirect('/settings?tab=accounts&error=oauth_state_invalid');
    }

    try {
      await exchangeGoogleCode(query.code, userId);
      return reply.redirect('/settings?tab=accounts&provider=google');
    } catch (err) {
      request.log.error({ err }, 'Google OAuth token exchange failed');
      return reply.redirect('/settings?tab=accounts&error=oauth_exchange_failed');
    }
  });

  // ── T009: GET /api/user/oauth/accounts ───────────────────────────────────
  app.get('/api/user/oauth/accounts', async (request, reply) => {
    requireAuth(request, reply);
    const accounts = getAccountsForUser(request.user!.id);
    return reply.status(200).send(accounts);
  });

  // ── T009: DELETE /api/admin/oauth/accounts/:id ───────────────────────────
  app.delete('/api/admin/oauth/accounts/:id', async (request, reply) => {
    await requireAdmin(request, reply);
    await assertCsrf(request, reply);

    const params = request.params as { id: string };
    const accountId = validate(UuidSchema, params.id);

    deleteAccount(accountId, request.user!.id, true);
    return reply.status(204).send();
  });

  // ── T009: GET /api/user/oauth/providers ──────────────────────────────────
  app.get('/api/user/oauth/providers', async (request, reply) => {
    requireAuth(request, reply);
    const providers = getAvailableProviders();
    return reply.status(200).send(providers);
  });
}
