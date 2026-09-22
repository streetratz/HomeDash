/**
 * Photo API routes — manage photo sources and serve images.
 *
 * Public:
 *   GET /api/photos/manifest?sourceId — get image list for a source
 *   GET /api/photos/serve?sourceId&key — serve an individual image
 *
 * Admin:
 *   GET    /api/admin/photos/sources — list all photo sources
 *   POST   /api/admin/photos/sources — create new source
 *   PUT    /api/admin/photos/sources/:id — update source
 *   DELETE /api/admin/photos/sources/:id — delete source
 *   POST   /api/admin/photos/sources/:id/scan — rescan source
 */

import fs from 'node:fs';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { requireAdmin } from '../auth/requireRole.js';
import { assertCsrf } from '../auth/csrf.js';
import {
  listSources,
  createSource,
  updateSource,
  deleteSource,
  getManifest,
  scanSource,
  resolveImagePath,
  browseFolders,
} from '../services/photoService.js';

// ── Schemas ──────────────────────────────────────────────────────────────────

const manifestQuerySchema = z.object({
  sourceId: z.string().min(1),
});

const serveQuerySchema = z.object({
  sourceId: z.string().min(1),
  key: z.string().min(1),
});

const createSourceSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['folder', 'url_list']),
  config: z.union([
    z.object({ path: z.string().min(1), recursive: z.boolean().optional() }),
    z.object({ urls: z.array(z.string().url()).min(1).max(500) }),
  ]),
});

const updateSourceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  config: z.union([
    z.object({ path: z.string().min(1), recursive: z.boolean().optional() }),
    z.object({ urls: z.array(z.string().url()).min(1).max(500) }),
  ]).optional(),
});

// ── Route registration ──────────────────────────────────────────────────────

export function registerPhotoRoutes(app: FastifyInstance): void {
  // ── Public routes ─────────────────────────────────────────────────────────

  /** GET /api/photos/manifest — get image list for a source */
  app.get('/api/photos/manifest', async (req, reply) => {
    const parsed = manifestQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'sourceId is required' });
    }

    try {
      const manifest = getManifest(parsed.data.sourceId);
      return reply.send(manifest);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return reply.status(404).send({ error: msg });
    }
  });

  /** GET /api/photos/serve — serve a single image file */
  app.get('/api/photos/serve', async (req, reply) => {
    const parsed = serveQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'sourceId and key are required' });
    }

    const resolved = resolveImagePath(parsed.data.sourceId, parsed.data.key);
    if (!resolved) {
      return reply.status(404).send({ error: 'Image not found' });
    }

    const stat = fs.statSync(resolved.absolutePath);
    const stream = fs.createReadStream(resolved.absolutePath);

    return reply
      .type(resolved.contentType)
      .header('Content-Length', stat.size)
      .header('Cache-Control', 'public, max-age=86400')
      .send(stream);
  });

  // ── Admin routes ──────────────────────────────────────────────────────────

  /** GET /api/admin/photos/sources — list all sources */
  app.get('/api/admin/photos/sources', { preHandler: [requireAdmin] }, async (_req, reply) => {
    return reply.send({ sources: listSources() });
  });

  /** GET /api/admin/photos/browse — browse folders within PHOTOS_DIR */
  app.get<{ Querystring: { path?: string } }>(
    '/api/admin/photos/browse',
    { preHandler: [requireAdmin] },
    async (req, reply) => {
      const result = browseFolders(req.query.path);
      return reply.send(result);
    },
  );

  /** POST /api/admin/photos/sources — create new source */
  app.post('/api/admin/photos/sources', { preHandler: [requireAdmin, assertCsrf] }, async (req, reply) => {
    const parsed = createSourceSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }

    try {
      const source = createSource(parsed.data.name, parsed.data.type, parsed.data.config);
      return reply.status(201).send(source);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return reply.status(400).send({ error: msg });
    }
  });

  /** PUT /api/admin/photos/sources/:id — update source */
  app.put<{ Params: { id: string } }>(
    '/api/admin/photos/sources/:id',
    { preHandler: [requireAdmin, assertCsrf] },
    async (req, reply) => {
      const parsed = updateSourceSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.message });
      }

      try {
        const source = updateSource(req.params.id, parsed.data);
        return reply.send(source);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return reply.status(404).send({ error: msg });
      }
    },
  );

  /** DELETE /api/admin/photos/sources/:id — delete source */
  app.delete<{ Params: { id: string } }>(
    '/api/admin/photos/sources/:id',
    { preHandler: [requireAdmin, assertCsrf] },
    async (req, reply) => {
      deleteSource(req.params.id);
      return reply.status(204).send();
    },
  );

  /** POST /api/admin/photos/sources/:id/scan — rescan source */
  app.post<{ Params: { id: string } }>(
    '/api/admin/photos/sources/:id/scan',
    { preHandler: [requireAdmin, assertCsrf] },
    async (req, reply) => {
      try {
        const manifest = scanSource(req.params.id);
        return reply.send(manifest);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return reply.status(404).send({ error: msg });
      }
    },
  );
}
