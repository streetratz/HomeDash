/**
 * T004–T007 (010): Spotify API routes — OAuth flow, playback control, device management, search.
 */

import type { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import { z } from 'zod';
import { requireAuth, requireAdmin } from '../auth/requireRole.js';
import { assertCsrf } from '../auth/csrf.js';
import { Errors } from '../lib/errors.js';
import { getEnv } from '../config/env.js';
import {
  getSpotifyAccount,
  getAccessToken,
  exchangeSpotifyCode,
  deleteSpotifyAccount,
  spotifyFetch,
  spotifyCommand,
} from '../services/spotify-service.js';
import {
  getIntegrationConfigs,
  setIntegrationConfigs,
} from '../services/integrationConfigService.js';

/** Resolve Spotify credentials: DB overrides env vars. */
function getSpotifyCredentials(): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
} | null {
  const dbConfig = getIntegrationConfigs('spotify');
  const env = getEnv();
  const clientId = dbConfig['clientId'] ?? env.SPOTIFY_CLIENT_ID ?? '';
  const clientSecret = dbConfig['clientSecret'] ?? env.SPOTIFY_CLIENT_SECRET ?? '';
  const redirectUri = dbConfig['redirectUri'] ?? env.SPOTIFY_REDIRECT_URI ?? '';
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, redirectUri };
}

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

// ─── Spotify API response types ─────────────────────────────────────────────

interface SpotifyArtist {
  name: string;
}

interface SpotifyImage {
  url: string;
  width?: number;
  height?: number;
}

interface SpotifyAlbum {
  name: string;
  images: SpotifyImage[];
}

interface SpotifyTrack {
  uri: string;
  name: string;
  artists: SpotifyArtist[];
  album: SpotifyAlbum;
  duration_ms: number;
}

interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
  is_restricted: boolean;
  volume_percent: number | null;
  supports_volume: boolean;
}

interface SpotifyPlaybackState {
  is_playing: boolean;
  item: SpotifyTrack | null;
  progress_ms: number | null;
  device: SpotifyDevice;
}

interface SpotifyDevicesResponse {
  devices: SpotifyDevice[];
}

interface SpotifySearchResponse {
  tracks?: {
    items: SpotifyTrack[];
  };
  albums?: {
    items: Array<{
      uri: string;
      name: string;
      artists: SpotifyArtist[];
      images: SpotifyImage[];
    }>;
  };
  playlists?: {
    items: Array<SpotifySearchPlaylist | null>;
  };
}

interface SpotifySearchPlaylist {
  uri: string;
  name: string;
  owner: { display_name: string };
  images: SpotifyImage[];
  tracks: { total: number };
}

export function mapSpotifySearchPlaylists(items: Array<SpotifySearchPlaylist | null>) {
  return items
    .filter((playlist): playlist is SpotifySearchPlaylist => playlist !== null)
    .map((playlist) => ({
      uri: playlist.uri,
      name: playlist.name,
      owner: playlist.owner.display_name,
      imageUrl: playlist.images[0]?.url ?? null,
      trackCount: playlist.tracks.total,
    }));
}

const spotifyLibraryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  after: z.string().trim().min(1).max(200).optional(),
});

const spotifyLibraryTypeSchema = z.enum(['playlists', 'albums', 'artists', 'tracks']);

// ─── Route registration ─────────────────────────────────────────────────────

export function registerSpotifyRoutes(app: FastifyInstance): void {
  // ── Config: Get Spotify setup status (admin only) ────────────────────────
  app.get('/api/spotify/config', async (request, reply) => {
    await requireAdmin(request, reply);

    const creds = getSpotifyCredentials();
    return reply.status(200).send({
      configured: creds !== null,
      clientId: creds?.clientId ? `${creds.clientId.slice(0, 8)}…` : null,
      redirectUri: creds?.redirectUri ?? null,
    });
  });

  // ── Config: Save Spotify credentials (admin only) ──────────────────────
  app.put('/api/spotify/config', async (request, reply) => {
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

    setIntegrationConfigs('spotify', {
      clientId: body.clientId.trim(),
      clientSecret: body.clientSecret.trim(),
      redirectUri: body.redirectUri?.trim() ?? '',
    });

    return reply.status(200).send({ ok: true });
  });

  // ── OAuth: Login redirect ───────────────────────────────────────────────
  app.get('/api/spotify/login', async (request, reply) => {
    requireAuth(request, reply);

    const creds = getSpotifyCredentials();
    if (!creds) {
      throw Errors.badRequest(
        'Spotify OAuth is not configured. Set credentials in Settings → Integrations.',
      );
    }

    const state = createState(request.user!.id);

    const params = new URLSearchParams({
      client_id: creds.clientId,
      response_type: 'code',
      redirect_uri: creds.redirectUri,
      scope:
        'streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private playlist-read-collaborative user-library-read',
      state,
      show_dialog: 'true',
    });

    const authUrl = `https://accounts.spotify.com/authorize?${params.toString()}`;
    return reply.redirect(authUrl);
  });

  // ── OAuth: Callback ─────────────────────────────────────────────────────
  app.get('/api/spotify/callback', async (request, reply) => {
    const query = request.query as {
      code?: string;
      state?: string;
      error?: string;
    };

    if (query.error) {
      return reply.redirect('/settings?tab=integrations&error=spotify_denied');
    }

    if (!query.code || !query.state) {
      return reply.redirect('/settings?tab=integrations&error=spotify_invalid');
    }

    const userId = consumeState(query.state);
    if (!userId) {
      return reply.redirect('/settings?tab=integrations&error=spotify_state_invalid');
    }

    try {
      await exchangeSpotifyCode(query.code, userId);
      return reply.redirect('/settings?tab=integrations&provider=spotify');
    } catch (err) {
      request.log.error({ err }, 'Spotify OAuth token exchange failed');
      return reply.redirect('/settings?tab=integrations&error=spotify_exchange_failed');
    }
  });

  // ── OAuth: Disconnect ───────────────────────────────────────────────────
  app.post('/api/spotify/disconnect', async (request, reply) => {
    requireAuth(request, reply);
    await assertCsrf(request, reply);

    deleteSpotifyAccount(request.user!.id);
    return reply.status(204).send();
  });

  // ── OAuth: Connection status ────────────────────────────────────────────
  app.get('/api/spotify/status', async (request, reply) => {
    requireAuth(request, reply);

    const account = getSpotifyAccount(request.user!.id);
    if (!account) {
      return reply.status(200).send({ connected: false });
    }

    return reply.status(200).send({
      connected: true,
      displayName: account.displayName,
      email: account.email,
    });
  });

  // ── Token: Provide access token for Web Playback SDK ───────────────────
  app.post('/api/spotify/token', async (request, reply) => {
    requireAuth(request, reply);
    await assertCsrf(request, reply);

    const token = await getAccessToken(request.user!.id);
    void reply.header('Cache-Control', 'no-store, private');
    return reply.status(200).send({ accessToken: token });
  });

  // ── Playback: Now Playing ───────────────────────────────────────────────
  app.get('/api/spotify/now-playing', async (request, reply) => {
    requireAuth(request, reply);

    // Use /me/player (not /currently-playing) to get device info too
    const data = await spotifyFetch<SpotifyPlaybackState>(request.user!.id, '/me/player');

    if (!data || !data.item) {
      return reply.status(200).send({
        isPlaying: false,
        // Still return device if player state exists (paused on a device)
        ...(data?.device
          ? {
              activeDevice: {
                id: data.device.id,
                name: data.device.name,
                type: data.device.type,
                isActive: true,
                isRestricted: data.device.is_restricted,
                volumePercent: data.device.volume_percent,
                supportsVolume: data.device.supports_volume,
              },
            }
          : {}),
      });
    }

    return reply.status(200).send({
      isPlaying: data.is_playing,
      trackName: data.item.name,
      artistName: data.item.artists.map((a) => a.name).join(', '),
      albumName: data.item.album.name,
      albumArtUrl: data.item.album.images[0]?.url ?? null,
      progressMs: data.progress_ms ?? 0,
      durationMs: data.item.duration_ms,
      deviceName: data.device?.name ?? null,
      activeDevice: data.device
        ? {
            id: data.device.id,
            name: data.device.name,
            type: data.device.type,
            isActive: true,
            isRestricted: data.device.is_restricted,
            volumePercent: data.device.volume_percent,
            supportsVolume: data.device.supports_volume,
          }
        : null,
    });
  });

  // ── Playback: Play ──────────────────────────────────────────────────────
  app.put('/api/spotify/play', async (request, reply) => {
    requireAuth(request, reply);
    await assertCsrf(request, reply);

    const body = (request.body ?? {}) as {
      uri?: string;
      context_uri?: string;
      device_id?: string;
    };

    const queryParams = body.device_id ? `?device_id=${encodeURIComponent(body.device_id)}` : '';

    const playBody: Record<string, unknown> = {};
    if (body.uri) playBody['uris'] = [body.uri];
    if (body.context_uri) playBody['context_uri'] = body.context_uri;

    const hasBody = Object.keys(playBody).length > 0;

    await spotifyCommand(request.user!.id, `/me/player/play${queryParams}`, {
      method: 'PUT',
      ...(hasBody
        ? {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(playBody),
          }
        : {}),
    });

    return reply.status(204).send();
  });

  // ── Playback: Pause ─────────────────────────────────────────────────────
  app.put('/api/spotify/pause', async (request, reply) => {
    requireAuth(request, reply);
    await assertCsrf(request, reply);

    const body = (request.body ?? {}) as { device_id?: string };
    const qs = body.device_id ? `?device_id=${encodeURIComponent(body.device_id)}` : '';

    await spotifyCommand(request.user!.id, `/me/player/pause${qs}`, {
      method: 'PUT',
    });

    return reply.status(204).send();
  });

  // ── Playback: Next ──────────────────────────────────────────────────────
  app.post('/api/spotify/next', async (request, reply) => {
    requireAuth(request, reply);
    await assertCsrf(request, reply);

    const body = (request.body ?? {}) as { device_id?: string };
    const qs = body.device_id ? `?device_id=${encodeURIComponent(body.device_id)}` : '';

    await spotifyCommand(request.user!.id, `/me/player/next${qs}`, {
      method: 'POST',
    });

    return reply.status(204).send();
  });

  // ── Playback: Previous ──────────────────────────────────────────────────
  app.post('/api/spotify/previous', async (request, reply) => {
    requireAuth(request, reply);
    await assertCsrf(request, reply);

    const body = (request.body ?? {}) as { device_id?: string };
    const qs = body.device_id ? `?device_id=${encodeURIComponent(body.device_id)}` : '';

    await spotifyCommand(request.user!.id, `/me/player/previous${qs}`, {
      method: 'POST',
    });

    return reply.status(204).send();
  });

  // ── Playback: Volume ────────────────────────────────────────────────────
  app.put('/api/spotify/volume', async (request, reply) => {
    requireAuth(request, reply);
    await assertCsrf(request, reply);

    const body = request.body as { volume_percent: number; device_id?: string };
    const vol = Math.max(0, Math.min(100, Math.round(body.volume_percent)));

    const qs = body.device_id
      ? `?volume_percent=${vol}&device_id=${encodeURIComponent(body.device_id)}`
      : `?volume_percent=${vol}`;

    await spotifyCommand(request.user!.id, `/me/player/volume${qs}`, { method: 'PUT' });

    return reply.status(204).send();
  });

  // ── Devices: List ───────────────────────────────────────────────────────
  app.get('/api/spotify/devices', async (request, reply) => {
    requireAuth(request, reply);

    const data = await spotifyFetch<SpotifyDevicesResponse>(request.user!.id, '/me/player/devices');

    const raw = data?.devices ?? [];
    request.log.info(
      {
        deviceCount: raw.length,
        devices: raw.map((d) => ({
          id: d.id,
          name: d.name,
          type: d.type,
          is_active: d.is_active,
        })),
        dataWasNull: data === null,
      },
      'Spotify devices API response',
    );

    const devices = raw.map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      isActive: d.is_active,
      isRestricted: d.is_restricted,
      volumePercent: d.volume_percent,
      supportsVolume: d.supports_volume,
    }));

    return reply.status(200).send({ devices });
  });

  // ── Devices: Transfer Playback ──────────────────────────────────────────
  app.put('/api/spotify/transfer', async (request, reply) => {
    requireAuth(request, reply);
    await assertCsrf(request, reply);

    const body = request.body as { device_id: string; play?: boolean };

    await spotifyCommand(request.user!.id, '/me/player', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_ids: [body.device_id],
        play: body.play ?? true,
      }),
    });

    return reply.status(204).send();
  });

  // ── Playlists: User's playlists ────────────────────────────────────────
  app.get('/api/spotify/playlists', async (request, reply) => {
    requireAuth(request, reply);

    const query = request.query as { limit?: string; offset?: string };
    const limit = Math.min(50, Math.max(1, parseInt(query.limit ?? '20', 10)));
    const offset = Math.max(0, parseInt(query.offset ?? '0', 10));

    const data = await spotifyFetch<{
      items: Array<{
        id: string;
        uri: string;
        name: string;
        owner: { display_name: string };
        images: Array<{ url: string }>;
        tracks: { total: number };
      }>;
      total: number;
    }>(request.user!.id, `/me/playlists?limit=${limit}&offset=${offset}`);

    const playlists = (data?.items ?? []).map((p) => ({
      id: p.id,
      uri: p.uri,
      name: p.name,
      owner: p.owner.display_name,
      imageUrl: p.images[0]?.url ?? null,
      trackCount: p.tracks.total,
    }));

    return reply.status(200).send({
      playlists,
      total: data?.total ?? 0,
    });
  });

  app.get('/api/spotify/library/:type', async (request, reply) => {
    requireAuth(request, reply);

    const typeResult = spotifyLibraryTypeSchema.safeParse(
      (request.params as { type?: string }).type,
    );
    const queryResult = spotifyLibraryQuerySchema.safeParse(request.query);
    if (!typeResult.success || !queryResult.success) {
      throw Errors.badRequest('Invalid Spotify library request');
    }

    const { limit, offset, after } = queryResult.data;
    const type = typeResult.data;

    if (type === 'playlists') {
      const data = await spotifyFetch<{
        items: Array<{
          id: string;
          uri: string;
          name: string;
          owner: { display_name: string };
          images: SpotifyImage[];
          tracks: { total: number };
        }>;
        total: number;
      }>(request.user!.id, `/me/playlists?limit=${limit}&offset=${offset}`);

      return reply.status(200).send({
        items: (data?.items ?? []).map((item) => ({
          id: item.id,
          uri: item.uri,
          name: item.name,
          subtitle: item.owner.display_name,
          imageUrl: item.images[0]?.url ?? null,
          itemCount: item.tracks.total,
        })),
        total: data?.total ?? 0,
        nextOffset: offset + (data?.items.length ?? 0),
      });
    }

    if (type === 'albums') {
      const data = await spotifyFetch<{
        items: Array<{
          album: {
            id: string;
            uri: string;
            name: string;
            artists: SpotifyArtist[];
            images: SpotifyImage[];
            total_tracks: number;
          };
        }>;
        total: number;
      }>(request.user!.id, `/me/albums?limit=${limit}&offset=${offset}`);

      return reply.status(200).send({
        items: (data?.items ?? []).map(({ album }) => ({
          id: album.id,
          uri: album.uri,
          name: album.name,
          subtitle: album.artists.map((artist) => artist.name).join(', '),
          imageUrl: album.images[0]?.url ?? null,
          itemCount: album.total_tracks,
        })),
        total: data?.total ?? 0,
        nextOffset: offset + (data?.items.length ?? 0),
      });
    }

    if (type === 'tracks') {
      const data = await spotifyFetch<{
        items: Array<{ track: SpotifyTrack & { id: string } }>;
        total: number;
      }>(request.user!.id, `/me/tracks?limit=${limit}&offset=${offset}`);

      return reply.status(200).send({
        items: (data?.items ?? []).map(({ track }) => ({
          id: track.id,
          uri: track.uri,
          name: track.name,
          subtitle: track.artists.map((artist) => artist.name).join(', '),
          detail: track.album.name,
          imageUrl: track.album.images[0]?.url ?? null,
          durationMs: track.duration_ms,
        })),
        total: data?.total ?? 0,
        nextOffset: offset + (data?.items.length ?? 0),
      });
    }

    const params = new URLSearchParams({ type: 'artist', limit: String(limit) });
    if (after) params.set('after', after);
    const data = await spotifyFetch<{
      artists: {
        items: Array<{
          id: string;
          uri: string;
          name: string;
          images: SpotifyImage[];
          followers: { total: number };
        }>;
        cursors?: { after?: string };
        total: number;
      };
    }>(request.user!.id, `/me/following?${params.toString()}`);

    return reply.status(200).send({
      items: (data?.artists.items ?? []).map((artist) => ({
        id: artist.id,
        uri: artist.uri,
        name: artist.name,
        subtitle: `${artist.followers.total.toLocaleString()} followers`,
        imageUrl: artist.images[0]?.url ?? null,
      })),
      total: data?.artists.total ?? 0,
      nextCursor: data?.artists.cursors?.after ?? null,
    });
  });

  // ── Search ──────────────────────────────────────────────────────────────
  app.get('/api/spotify/search', async (request, reply) => {
    requireAuth(request, reply);

    const query = request.query as {
      q?: string;
      type?: string;
      limit?: string;
    };

    if (!query.q) {
      throw Errors.badRequest('Search query (q) is required');
    }

    const type = query.type ?? 'track';
    const limit = Math.min(20, Math.max(1, parseInt(query.limit ?? '10', 10)));

    const searchParams = new URLSearchParams({
      q: query.q,
      type,
      limit: String(limit),
    });

    const data = await spotifyFetch<SpotifySearchResponse>(
      request.user!.id,
      `/search?${searchParams.toString()}`,
    );

    if (!data) {
      return reply.status(200).send({ tracks: [], albums: [], playlists: [] });
    }

    const tracks = (data.tracks?.items ?? []).map((t) => ({
      uri: t.uri,
      name: t.name,
      artist: t.artists.map((a) => a.name).join(', '),
      album: t.album.name,
      albumArtUrl: t.album.images[0]?.url ?? null,
      durationMs: t.duration_ms,
    }));

    const albums = (data.albums?.items ?? []).map((a) => ({
      uri: a.uri,
      name: a.name,
      artist: a.artists.map((ar) => ar.name).join(', '),
      imageUrl: a.images[0]?.url ?? null,
    }));

    const playlists = mapSpotifySearchPlaylists(data.playlists?.items ?? []);

    return reply.status(200).send({ tracks, albums, playlists });
  });
}
