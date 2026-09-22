/**
 * T072 (US2): Asset serving routes.
 *
 * Handles:
 * - GET /favicon.ico — serves the 32×32 PNG favicon generated from the
 *   currently configured logo, or returns 204 if no logo has been uploaded.
 *
 * Uploaded logo and background files are served via @fastify/static at
 * /assets/data/* (configured in server.ts).  This route only handles the
 * special /favicon.ico path which browsers request unconditionally.
 */

import type { FastifyInstance } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/drizzle.js';
import { appShellSettings } from '../db/schema/index.js';
import { getDataDir } from '../config/dataDir.js';

export function registerAssetsRoutes(app: FastifyInstance): void {
  /**
   * GET /favicon.ico
   * Returns the 32×32 PNG favicon if a logo has been uploaded and the variant
   * file exists on disk.  Otherwise returns 204 No Content so the browser
   * doesn't cache a broken icon indefinitely.
   */
  app.get('/favicon.ico', async (_request, reply) => {
    const db = getDb();
    const shell = db
      .select()
      .from(appShellSettings)
      .where(eq(appShellSettings.id, 'global'))
      .get();

    if (shell?.logoAssetId) {
      const faviconPath = path.join(
        getDataDir(),
        'uploads',
        'logo',
        'favicon-32.png',
      );

      if (fs.existsSync(faviconPath)) {
        return reply
          .header('Content-Type', 'image/png')
          .header('Cache-Control', 'public, max-age=86400')
          .send(fs.createReadStream(faviconPath));
      }
    }

    // No favicon available — respond with No Content so clients don't retry
    // immediately with a cached 404.
    return reply
      .header('Cache-Control', 'public, max-age=300')
      .status(204)
      .send();
  });
}
