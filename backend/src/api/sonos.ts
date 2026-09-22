/**
 * 017: Sonos API routes — OAuth flow, household/group discovery, playback & volume control.
 *
 * Mirrors the spotify.ts route pattern: config CRUD, OAuth, control endpoints.
 */

import type { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import { z } from 'zod';
import { requireAuth, requireAdmin } from '../auth/requireRole.js';
import { assertCsrf } from '../auth/csrf.js';
import { Errors } from '../lib/errors.js';
import {
  getSonosClientCreds,
  buildSonosAuthUrl,
  exchangeSonosCode,
  deleteSonosAccount,
} from '../services/sonos-service.js';
import {
  getIntegrationConfig,
  setIntegrationConfig,
  setIntegrationConfigs,
} from '../services/integrationConfigService.js';
import {
  getHouseholds,
  getGroups,
  getPlaybackState,
  getPlaybackMetadata,
  play,
  pause,
  next,
  previous,
  getGroupVolume,
  setGroupVolume,
  setGroupMute,
  getPlayerVolume,
  setPlayerVolume,
  setPlayerMute,
  modifyGroup,
  resetGroup,
  getFavorites,
  getMusicServices,
  loadFavorite,
  getAdapterStatus,
  getSonosMode,
  setSonosMode,
  getDiscoveredSpeakers,
  getQueue,
  clearQueue,
  playFromQueue,
  addToQueue,
  playNext,
  addContainerToQueue,
  replaceQueueAndPlay,
  browseLibrary,
  browseContainer,
  searchLibrary,
  getSonosPlaylists,
  getPlayMode,
  setPlayMode,
  getRadioStations,
  playUri,
  runDiagnostics,
} from '../services/sonos-adapter.js';
import type { SonosMode, PlayModeState } from '../services/sonos-adapter.js';
import { isValidLibraryType } from '../services/sonos-local-service.js';
import { ArtFetchError, artHash, getArt } from '../services/artCacheService.js';
import { isAllowedArtUrl, validateArtRequest } from '../lib/url-validator.js';

// ─── Zod schemas for service label validation ───────────────────────────────

/** Key format: "sn:<number>" */
const serviceLabelKeySchema = z.string().regex(/^sn:\d+$/, 'Key must be "sn:<number>"');

/** Body for PUT /api/sonos/service-labels */
const serviceLabelsBodySchema = z
  .record(serviceLabelKeySchema, z.string().min(1).max(100))
  .refine((obj) => Object.keys(obj).length <= 50, 'Maximum 50 labels');

const servicesQuerySchema = z.object({
  householdId: z.string().trim().min(1).max(200).optional(),
});

const modifyGroupBodySchema = z.object({
  groupId: z.string().trim().min(1).max(200),
  playerIdsToAdd: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
  playerIdsToRemove: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
});

const containerQueueBodySchema = z
  .object({
    objectId: z.string().trim().min(1).max(1_000),
  })
  .strict();

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

function getSourceHost(sourceUrl: string): string | undefined {
  try {
    return new URL(sourceUrl).hostname;
  } catch {
    return undefined;
  }
}

// ─── Route registration ─────────────────────────────────────────────────────

export function registerSonosRoutes(app: FastifyInstance): void {
  // ── Config: Get Sonos setup status (admin only) ──────────────────────────
  app.get('/api/sonos/config', async (request, reply) => {
    await requireAdmin(request, reply);

    const creds = getSonosClientCreds();
    return reply.status(200).send({
      configured: creds !== null,
      clientId: creds?.clientId ? `${creds.clientId.slice(0, 8)}…` : null,
      redirectUri: creds?.redirectUri ?? null,
    });
  });

  // ── Config: Save Sonos credentials (admin only) ────────────────────────
  app.put('/api/sonos/config', async (request, reply) => {
    await requireAdmin(request, reply);
    await assertCsrf(request, reply);

    const body = request.body as {
      clientId?: string;
      clientSecret?: string;
      redirectUri?: string;
    };

    if (!body.clientId?.trim() || !body.clientSecret?.trim()) {
      throw Errors.badRequest('Client ID and Client Secret are required');
    }

    setIntegrationConfigs('sonos', {
      clientId: body.clientId.trim(),
      clientSecret: body.clientSecret.trim(),
      redirectUri: body.redirectUri?.trim() ?? '',
    });

    return reply.status(200).send({ ok: true });
  });

  // ── Service Labels: Read account labels (any authed user) ──────────────
  app.get('/api/sonos/service-labels', async (request, reply) => {
    requireAuth(request, reply);

    const raw = getIntegrationConfig('sonos', 'account_labels');
    let labels: Record<string, string> = {};
    if (raw) {
      try {
        labels = JSON.parse(raw) as Record<string, string>;
      } catch {
        /* corrupt data — return empty */
      }
    }
    return reply.status(200).send({ labels });
  });

  // ── Service Labels: Update account labels (admin only) ─────────────────
  app.put('/api/sonos/service-labels', async (request, reply) => {
    await requireAdmin(request, reply);
    await assertCsrf(request, reply);

    const result = serviceLabelsBodySchema.safeParse(request.body);
    if (!result.success) {
      throw Errors.badRequest(result.error.issues.map((i) => i.message).join('; '));
    }

    setIntegrationConfig('sonos', 'account_labels', JSON.stringify(result.data));
    return reply.status(200).send({ labels: result.data });
  });

  // ── OAuth: Login redirect ─────────────────────────────────────────────
  app.get('/api/sonos/login', async (request, reply) => {
    requireAuth(request, reply);

    const creds = getSonosClientCreds();
    if (!creds) {
      throw Errors.badRequest(
        'Sonos OAuth is not configured. Set credentials in Settings → Integrations.',
      );
    }

    const state = createState(request.user!.id);
    const authUrl = buildSonosAuthUrl(state);
    return reply.redirect(authUrl);
  });

  // ── OAuth: Callback ───────────────────────────────────────────────────
  app.get('/api/sonos/callback', async (request, reply) => {
    const query = request.query as {
      code?: string;
      state?: string;
      error?: string;
    };

    if (query.error) {
      return reply.redirect('/settings?tab=integrations&error=sonos_denied');
    }

    if (!query.code || !query.state) {
      return reply.redirect('/settings?tab=integrations&error=sonos_invalid');
    }

    const userId = consumeState(query.state);
    if (!userId) {
      return reply.redirect('/settings?tab=integrations&error=sonos_state_invalid');
    }

    try {
      await exchangeSonosCode(query.code, userId);
      return reply.redirect('/settings?tab=integrations&provider=sonos');
    } catch (err) {
      request.log.error({ err }, 'Sonos OAuth token exchange failed');
      return reply.redirect('/settings?tab=integrations&error=sonos_exchange_failed');
    }
  });

  // ── OAuth: Disconnect ─────────────────────────────────────────────────
  app.post('/api/sonos/disconnect', async (request, reply) => {
    requireAuth(request, reply);
    await assertCsrf(request, reply);

    deleteSonosAccount(request.user!.id);
    return reply.status(204).send();
  });

  // ── Connection status (mode-aware) ─────────────────────────────────────
  app.get('/api/sonos/status', async (request, reply) => {
    requireAuth(request, reply);
    const status = await getAdapterStatus(request.user!.id);
    return reply.status(200).send(status);
  });

  // ── Mode: Get/Set local vs cloud ──────────────────────────────────────
  app.get('/api/sonos/mode', async (request, reply) => {
    requireAuth(request, reply);
    return reply.status(200).send({ mode: getSonosMode() });
  });

  app.put('/api/sonos/mode', async (request, reply) => {
    await requireAdmin(request, reply);
    await assertCsrf(request, reply);
    const body = request.body as { mode: SonosMode };
    if (body.mode !== 'cloud' && body.mode !== 'local') {
      throw Errors.badRequest('mode must be "cloud" or "local"');
    }
    setSonosMode(body.mode);
    return reply.status(200).send({ mode: body.mode });
  });

  // ── Local-only: Discover speakers ─────────────────────────────────────
  app.get('/api/sonos/discover', async (request, reply) => {
    requireAuth(request, reply);
    const speakers = await getDiscoveredSpeakers();
    return reply.status(200).send({ speakers });
  });

  // ── Households: List ──────────────────────────────────────────────────
  app.get('/api/sonos/households', async (request, reply) => {
    requireAuth(request, reply);

    const households = await getHouseholds(request.user!.id);
    return reply.status(200).send({ households });
  });

  // ── Groups: List groups + players for a household ─────────────────────
  app.get('/api/sonos/households/:householdId/groups', async (request, reply) => {
    requireAuth(request, reply);

    const { householdId } = request.params as { householdId: string };
    const data = await getGroups(request.user!.id, householdId);

    return reply.status(200).send({
      groups: data.groups.map((g) => ({
        id: g.id,
        name: g.name,
        coordinatorId: g.coordinatorId,
        playbackState: g.playbackState,
        playerIds: g.playerIds,
      })),
      players: data.players.map((p) => ({
        id: p.id,
        name: p.name,
        capabilities: p.capabilities,
      })),
    });
  });

  // ── Playback: Get state for a group ───────────────────────────────────
  app.get('/api/sonos/groups/:groupId/playback', async (request, reply) => {
    requireAuth(request, reply);

    const { groupId } = request.params as { groupId: string };
    const state = await getPlaybackState(request.user!.id, groupId);
    return reply.status(200).send(state);
  });

  // ── Playback: Get metadata for a group ────────────────────────────────
  app.get('/api/sonos/groups/:groupId/metadata', async (request, reply) => {
    requireAuth(request, reply);

    const { groupId } = request.params as { groupId: string };
    const metadata = await getPlaybackMetadata(request.user!.id, groupId);
    return reply.status(200).send(metadata);
  });

  // ── Playback: Play ────────────────────────────────────────────────────
  app.post('/api/sonos/groups/:groupId/play', async (request, reply) => {
    requireAuth(request, reply);
    await assertCsrf(request, reply);

    const { groupId } = request.params as { groupId: string };
    await play(request.user!.id, groupId);
    return reply.status(204).send();
  });

  // ── Playback: Pause ───────────────────────────────────────────────────
  app.post('/api/sonos/groups/:groupId/pause', async (request, reply) => {
    requireAuth(request, reply);
    await assertCsrf(request, reply);

    const { groupId } = request.params as { groupId: string };
    await pause(request.user!.id, groupId);
    return reply.status(204).send();
  });

  // ── Playback: Skip to next ────────────────────────────────────────────
  app.post('/api/sonos/groups/:groupId/next', async (request, reply) => {
    requireAuth(request, reply);
    await assertCsrf(request, reply);

    const { groupId } = request.params as { groupId: string };
    await next(request.user!.id, groupId);
    return reply.status(204).send();
  });

  // ── Playback: Skip to previous ────────────────────────────────────────
  app.post('/api/sonos/groups/:groupId/previous', async (request, reply) => {
    requireAuth(request, reply);
    await assertCsrf(request, reply);

    const { groupId } = request.params as { groupId: string };
    await previous(request.user!.id, groupId);
    return reply.status(204).send();
  });

  // ── Volume: Get group volume ──────────────────────────────────────────
  app.get('/api/sonos/groups/:groupId/volume', async (request, reply) => {
    requireAuth(request, reply);

    const { groupId } = request.params as { groupId: string };
    const volume = await getGroupVolume(request.user!.id, groupId);
    return reply.status(200).send(volume);
  });

  // ── Volume: Set group volume ──────────────────────────────────────────
  app.post('/api/sonos/groups/:groupId/volume', async (request, reply) => {
    requireAuth(request, reply);
    await assertCsrf(request, reply);

    const { groupId } = request.params as { groupId: string };
    const body = request.body as { volume: number };
    const volume = Math.max(0, Math.min(100, Math.round(body.volume)));
    await setGroupVolume(request.user!.id, groupId, volume);
    return reply.status(204).send();
  });

  // ── Volume: Mute/unmute group ──────────────────────────────────────────
  app.post('/api/sonos/groups/:groupId/mute', async (request, reply) => {
    requireAuth(request, reply);
    await assertCsrf(request, reply);

    const { groupId } = request.params as { groupId: string };
    const body = request.body as { muted: boolean };
    await setGroupMute(request.user!.id, groupId, body.muted);
    return reply.status(204).send();
  });

  // ── Volume: Get player volume ─────────────────────────────────────────
  app.get('/api/sonos/players/:playerId/volume', async (request, reply) => {
    requireAuth(request, reply);

    const { playerId } = request.params as { playerId: string };
    const volume = await getPlayerVolume(request.user!.id, playerId);
    return reply.status(200).send(volume);
  });

  // ── Volume: Set player volume ─────────────────────────────────────────
  app.post('/api/sonos/players/:playerId/volume', async (request, reply) => {
    requireAuth(request, reply);
    await assertCsrf(request, reply);

    const { playerId } = request.params as { playerId: string };
    const body = request.body as { volume: number };
    const volume = Math.max(0, Math.min(100, Math.round(body.volume)));
    await setPlayerVolume(request.user!.id, playerId, volume);
    return reply.status(204).send();
  });

  // ── Volume: Mute/unmute player ────────────────────────────────────────
  app.post('/api/sonos/players/:playerId/mute', async (request, reply) => {
    requireAuth(request, reply);
    await assertCsrf(request, reply);

    const { playerId } = request.params as { playerId: string };
    const body = request.body as { muted: boolean };
    await setPlayerMute(request.user!.id, playerId, body.muted);
    return reply.status(204).send();
  });

  // ── Groups: Modify group (add/remove players) ─────────────────────────
  app.post('/api/sonos/groups/modify', async (request, reply) => {
    requireAuth(request, reply);
    await assertCsrf(request, reply);

    const parsed = modifyGroupBodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw Errors.badRequest('Invalid group modification request');
    }

    const result = await modifyGroup(
      request.user!.id,
      parsed.data.groupId,
      parsed.data.playerIdsToAdd ?? [],
      parsed.data.playerIdsToRemove ?? [],
    );
    return reply.status(200).send(result ?? { succeededPlayerIds: [], failures: [] });
  });

  app.post('/api/sonos/groups/:groupId/reset', async (request, reply) => {
    await requireAdmin(request, reply);
    await assertCsrf(request, reply);
    const { groupId } = request.params as { groupId: string };
    if (!groupId || groupId.length > 200) {
      throw Errors.badRequest('groupId is required');
    }
    const result = await resetGroup(request.user!.id, groupId);
    return reply.status(200).send(result);
  });

  // ─── Favorites ──────────────────────────────────────────────────────────────

  app.get('/api/sonos/households/:householdId/favorites', async (request, reply) => {
    requireAuth(request, reply);
    const { householdId } = request.params as { householdId: string };
    const favorites = await getFavorites(request.user!.id, householdId);
    return reply.send(favorites);
  });

  app.get('/api/sonos/services', async (request, reply) => {
    requireAuth(request, reply);
    const parsed = servicesQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid query parameters',
        details: parsed.error.flatten(),
      });
    }

    try {
      return reply.send(await getMusicServices(request.user!.id, parsed.data.householdId));
    } catch (err) {
      app.log.error({ err }, 'Failed to discover Sonos music services');
      return reply.status(502).send({ error: 'Failed to discover Sonos music services' });
    }
  });

  app.post('/api/sonos/groups/:groupId/favorites', async (request, reply) => {
    requireAuth(request, reply);
    await assertCsrf(request, reply);
    const { groupId } = request.params as { groupId: string };
    const body = request.body as { favoriteId: string; playOnCompletion?: boolean };
    if (!body.favoriteId) throw Errors.badRequest('favoriteId is required');
    await loadFavorite(request.user!.id, groupId, body.favoriteId, body.playOnCompletion ?? true);
    return reply.status(204).send();
  });

  // ─── Queue (local-only) ──────────────────────────────────────────────────

  app.get('/api/sonos/groups/:groupId/queue', async (request, reply) => {
    requireAuth(request, reply);
    const { groupId } = request.params as { groupId: string };
    const data = await getQueue(request.user!.id, groupId);
    return reply.send(data);
  });

  app.delete('/api/sonos/groups/:groupId/queue', async (request, reply) => {
    requireAuth(request, reply);
    await assertCsrf(request, reply);
    const { groupId } = request.params as { groupId: string };
    await clearQueue(request.user!.id, groupId);
    return reply.status(204).send();
  });

  app.post('/api/sonos/groups/:groupId/queue/play', async (request, reply) => {
    requireAuth(request, reply);
    await assertCsrf(request, reply);
    const { groupId } = request.params as { groupId: string };
    const body = request.body as { trackNumber: number };
    if (!body.trackNumber || body.trackNumber < 1) {
      throw Errors.badRequest('trackNumber (1-based) is required');
    }
    await playFromQueue(request.user!.id, groupId, body.trackNumber);
    return reply.status(204).send();
  });

  app.post('/api/sonos/groups/:groupId/queue/add', async (request, reply) => {
    requireAuth(request, reply);
    await assertCsrf(request, reply);
    const { groupId } = request.params as { groupId: string };
    const body = request.body as { uri: string; metadata?: string };
    if (!body.uri) throw Errors.badRequest('uri is required');
    await addToQueue(request.user!.id, groupId, body.uri, body.metadata);
    return reply.status(204).send();
  });

  app.post('/api/sonos/groups/:groupId/queue/next', async (request, reply) => {
    requireAuth(request, reply);
    await assertCsrf(request, reply);
    const { groupId } = request.params as { groupId: string };
    const body = request.body as { uri: string; metadata?: string };
    if (!body.uri) throw Errors.badRequest('uri is required');
    await playNext(request.user!.id, groupId, body.uri, body.metadata);
    return reply.status(204).send();
  });

  app.post('/api/sonos/groups/:groupId/queue/add-container', async (request, reply) => {
    requireAuth(request, reply);
    await assertCsrf(request, reply);
    const { groupId } = request.params as { groupId: string };
    const parsed = containerQueueBodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw Errors.badRequest('A valid objectId is required');
    }
    const result = await addContainerToQueue(request.user!.id, groupId, parsed.data.objectId);
    return reply.send(result);
  });

  app.post('/api/sonos/groups/:groupId/queue/replace', async (request, reply) => {
    requireAuth(request, reply);
    await assertCsrf(request, reply);
    const { groupId } = request.params as { groupId: string };
    const parsed = containerQueueBodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw Errors.badRequest('A valid objectId is required');
    }
    const result = await replaceQueueAndPlay(request.user!.id, groupId, parsed.data.objectId);
    return reply.send(result);
  });

  // ─── Music Library (local-only) ──────────────────────────────────────────

  app.get('/api/sonos/library/:type', async (request, reply) => {
    requireAuth(request, reply);
    const { type } = request.params as { type: string };
    if (!isValidLibraryType(type)) {
      throw Errors.badRequest(
        `Invalid library type: ${type}. Valid: artists, albumArtists, albums, genres, tracks, playlists, sonos_playlists, share`,
      );
    }
    const query = request.query as { start?: string; total?: string };
    const start = query.start ? parseInt(query.start, 10) : 0;
    const total = query.total ? parseInt(query.total, 10) : 100;
    const data = await browseLibrary(request.user!.id, type, { start, total });
    return reply.send(data);
  });

  app.get('/api/sonos/library/browse', async (request, reply) => {
    requireAuth(request, reply);
    const query = request.query as { objectId: string; start?: string; total?: string };
    if (!query.objectId) throw Errors.badRequest('objectId is required');
    const start = query.start ? parseInt(query.start, 10) : 0;
    const total = query.total ? parseInt(query.total, 10) : 100;
    const data = await browseContainer(request.user!.id, query.objectId, { start, total });
    return reply.send(data);
  });

  app.get('/api/sonos/library/:type/search', async (request, reply) => {
    requireAuth(request, reply);
    const { type } = request.params as { type: string };
    if (!isValidLibraryType(type)) {
      throw Errors.badRequest(`Invalid library type: ${type}`);
    }
    const query = request.query as { q: string; start?: string; total?: string };
    if (!query.q) throw Errors.badRequest('q is required');
    const start = query.start ? parseInt(query.start, 10) : 0;
    const total = query.total ? parseInt(query.total, 10) : 100;
    const data = await searchLibrary(request.user!.id, type, query.q, { start, total });
    return reply.send(data);
  });

  app.get('/api/sonos/playlists', async (request, reply) => {
    requireAuth(request, reply);
    const data = await getSonosPlaylists(request.user!.id);
    return reply.send(data);
  });

  // ─── Play Mode (local-only) ──────────────────────────────────────────────

  app.get('/api/sonos/groups/:groupId/playmode', async (request, reply) => {
    requireAuth(request, reply);
    const { groupId } = request.params as { groupId: string };
    const mode = await getPlayMode(request.user!.id, groupId);
    return reply.send(mode ?? { shuffle: false, repeat: false, repeatOne: false });
  });

  app.put('/api/sonos/groups/:groupId/playmode', async (request, reply) => {
    requireAuth(request, reply);
    await assertCsrf(request, reply);
    const { groupId } = request.params as { groupId: string };
    const body = request.body as PlayModeState;
    await setPlayMode(request.user!.id, groupId, {
      shuffle: !!body.shuffle,
      repeat: !!body.repeat,
      repeatOne: !!body.repeatOne,
    });
    return reply.status(204).send();
  });

  // ─── Radio Stations (local-only) ────────────────────────────────────────

  app.get('/api/sonos/radio/stations', async (request, reply) => {
    requireAuth(request, reply);
    const data = await getRadioStations(request.user!.id);
    return reply.send(data);
  });

  // ─── Play URI (spotify:, radio:, etc.) ──────────────────────────────────

  app.post('/api/sonos/groups/:groupId/play-uri', async (request, reply) => {
    requireAuth(request, reply);
    await assertCsrf(request, reply);
    const { groupId } = request.params as { groupId: string };
    const body = request.body as { uri: string; title?: string };
    if (!body.uri) throw Errors.badRequest('uri is required');
    await playUri(request.user!.id, groupId, body.uri, body.title);
    return reply.status(204).send();
  });

  // ── Album art proxy ──────────────────────────────────────────────────────
  app.get('/api/sonos/art/:hash', async (request, reply) => {
    requireAuth(request, reply);

    const { hash } = request.params as { hash: string };
    const { src } = request.query as { src?: string };
    if (!src) throw Errors.badRequest('src query param is required');

    let sourceUrl: string;
    try {
      sourceUrl = Buffer.from(src, 'base64url').toString('utf-8');
    } catch {
      throw Errors.badRequest('Invalid src encoding');
    }

    const expectedHash = artHash(sourceUrl);
    const requestValidation = validateArtRequest(hash, sourceUrl, expectedHash);
    if (!requestValidation.valid) {
      request.log.warn(
        {
          hash,
          expectedHash,
          reason: requestValidation.reason,
          sourceHost: getSourceHost(sourceUrl),
        },
        'Rejected Sonos art request',
      );
      throw Errors.badRequest('Invalid art request');
    }

    const allowedUrl = await isAllowedArtUrl(sourceUrl);
    if (!allowedUrl) {
      request.log.warn(
        {
          hash,
          expectedHash,
          reason: 'art_source_url_not_allowed',
          sourceHost: getSourceHost(sourceUrl),
        },
        'Rejected Sonos art request',
      );
      throw Errors.badRequest('Art source URL is not allowed');
    }

    try {
      const { buffer, contentType } = await getArt(sourceUrl, {
        maxBytes: 5 * 1024 * 1024,
        requireImage: true,
      });
      return reply
        .header('Content-Type', contentType)
        .header('Cache-Control', 'public, max-age=86400, immutable')
        .send(buffer);
    } catch (err) {
      if (err instanceof ArtFetchError) {
        request.log.warn(
          {
            hash,
            expectedHash,
            reason: err.reason,
            sourceHost: getSourceHost(sourceUrl),
            ...err.details,
          },
          'Rejected Sonos art request',
        );

        if (err.statusCode === 413) {
          throw Errors.assetTooLarge(err.message);
        }

        if (err.statusCode === 415) {
          throw Errors.assetTypeInvalid(err.message);
        }
      }

      throw err;
    }
  });

  // ─── Diagnostics (admin-only, for debugging Docker/NAS issues) ──────────────

  app.get('/api/sonos/diagnostics', async (request, reply) => {
    requireAuth(request, reply);
    await requireAdmin(request, reply);
    try {
      const result = await runDiagnostics();
      return reply.send(result);
    } catch (err) {
      console.error('[sonos] diagnostics failed:', err);
      return reply.status(500).send({ error: 'Diagnostics failed', detail: String(err) });
    }
  });
}
