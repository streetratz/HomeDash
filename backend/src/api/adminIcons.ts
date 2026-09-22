/**
 * Phase R3: Admin icon cache and background upload routes.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requireAdmin } from '../auth/requireRole.js';
import { assertCsrf } from '../auth/csrf.js';
import { validate } from '../lib/validation.js';
import {
  listIconCacheEntries,
  getIconCacheEntry,
  refreshIcons,
} from '../services/iconService.js';
import { uploadBackground } from '../services/assetService.js';

// ── Zod schemas ───────────────────────────────────────────────────────────────

const RefreshIconsSchema = z
  .object({
    keys: z.array(z.string().min(1).max(256)).min(1).max(100),
  })
  .strict();

// ── Route registration ────────────────────────────────────────────────────────

export function registerAdminIconsRoutes(app: FastifyInstance): void {
  // ── Icon cache management ─────────────────────────────────────────────────

  app.get('/api/admin/icons', async (request, reply) => {
    await requireAdmin(request, reply);
    return reply.status(200).send(listIconCacheEntries());
  });

  app.get('/api/icons/:iconKey', async (request, reply) => {
    const key = (request.params as Record<string, string>)['iconKey'] ?? '';
    const entry = getIconCacheEntry(key);
    return reply.status(200).send(entry);
  });

  app.post('/api/admin/icons/refresh', async (request, reply) => {
    await requireAdmin(request, reply);
    await assertCsrf(request, reply);
    const input = validate(RefreshIconsSchema, request.body);
    const result = refreshIcons(input);
    return reply.status(200).send(result);
  });

  // ── Background upload ─────────────────────────────────────────────────────

  app.post('/api/admin/assets/background', async (request: FastifyRequest, reply) => {
    await requireAdmin(request, reply);
    await assertCsrf(request, reply);

    const data = await (
      request as FastifyRequest & {
        file: () => Promise<{ toBuffer: () => Promise<Buffer>; filename: string } | undefined>;
      }
    ).file();
    if (!data) {
      return reply.status(400).send({ error: 'BAD_REQUEST', message: 'No file uploaded' });
    }

    const fileBuffer: Buffer = await data.toBuffer();
    const originalFilename: string = data.filename || 'background';

    const asset = uploadBackground(fileBuffer, originalFilename);
    return reply.status(201).send(asset);
  });
}
