/**
 * T019: CORS configuration.
 * CORS is disabled by default; only enabled when ALLOWED_ORIGINS is set.
 * This is appropriate for LAN deployments at the same origin.
 */

import type { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { getEnv } from '../config/env.js';

/**
 * Register CORS with explicit allowlist from ALLOWED_ORIGINS env var.
 * If no origins are configured, CORS headers are not sent (same-origin only).
 */
export async function registerCors(app: FastifyInstance): Promise<void> {
  const { ALLOWED_ORIGINS } = getEnv();

  if (ALLOWED_ORIGINS.length === 0) {
    app.log.info('CORS disabled (no ALLOWED_ORIGINS configured)');
    return;
  }

  await app.register(cors, {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
  });

  app.log.info({ allowedOrigins: ALLOWED_ORIGINS }, 'CORS enabled');
}
