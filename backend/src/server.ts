/**
 * T017: Fastify server bootstrap — logging, request IDs, plugin registration.
 * T113: Production static serving of frontend build.
 */

import Fastify, { LogController, type FastifyServerOptions } from 'fastify';
import path from 'node:path';
import fastifyStatic from '@fastify/static';
import fastifyCookie from '@fastify/cookie';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyMultipart from '@fastify/multipart';
import { getEnv } from './config/env.js';
import { getDataSubDir } from './config/dataDir.js';
import { registerSecurityHeaders } from './lib/securityHeaders.js';
import { registerCors } from './lib/cors.js';
import { registerErrorHandler } from './lib/errors.js';
import { setAppLogger } from './lib/logger.js';
import { runMigrations } from './db/migrate.js';
import { runDockerConnectionUpgrade } from './services/dockerConnectionUpgrade.js';
import { runDockerWidgetAdoption } from './services/dockerWidgetAdoption.js';
import { seedDatabase } from './db/seed.js';
import { registerAuthMiddleware } from './auth/authMiddleware.js';
import { registerAllRoutes } from './api/index.js';
import { startScheduler, stopScheduler, seedSystemJobs } from './services/scheduledJobService.js';

export async function buildServer() {
  const env = getEnv();

  const loggerConfig: Exclude<FastifyServerOptions['logger'], boolean | undefined> = {
    level: env.LOG_LEVEL,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        '*.password',
        '*.passwordHash',
        '*.token',
        '*.accessToken',
        '*.refreshToken',
        '*.clientSecret',
      ],
      censor: '[REDACTED]',
    },
  };

  if (env.NODE_ENV === 'development') {
    loggerConfig['transport'] = {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
    };
  } else if (env.LOG_FILE) {
    loggerConfig['transport'] = {
      target: 'pino/file',
      options: { destination: env.LOG_FILE, mkdir: true },
    };
  }

  const app = Fastify({
    logger: loggerConfig,
    genReqId: () => crypto.randomUUID(),
    requestIdHeader: 'x-request-id',
    logController: new LogController({ requestIdLogLabel: 'reqId' }),
    trustProxy: env.TRUST_PROXY,
  });
  setAppLogger(app.log);

  // ── Security ────────────────────────────────────────────────────────────────
  await registerSecurityHeaders(app);
  await registerCors(app);

  // ── Cookie parsing (required before auth middleware) ─────────────────────────
  await app.register(fastifyCookie);

  // ── Rate limiting (global: false = opt-in per route) ────────────────────────
  await app.register(fastifyRateLimit, { global: false });

  // ── Multipart (logo + background uploads) ────────────────────────────────────
  await app.register(fastifyMultipart, {
    limits: {
      fileSize: 6 * 1024 * 1024, // 6 MiB hard cap (service layer enforces 5 MiB)
      files: 1,
    },
  });

  // ── Auth middleware (populate request.user from session cookie) ─────────────
  registerAuthMiddleware(app);

  // ── Error handling ──────────────────────────────────────────────────────────
  registerErrorHandler(app);

  // ── Routes ──────────────────────────────────────────────────────────────────
  registerAllRoutes(app);

  // ── Static serving (T113) ────────────────────────────────────────────────────
  // In production, serve the frontend build from backend.
  // The data dir assets (logos, favicons) are served at /assets/data.
  if (env.NODE_ENV === 'production') {
    const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');

    await app.register(fastifyStatic, {
      root: frontendDistPath,
      prefix: '/',
      // decorateReply must be true (default) so reply.sendFile is available
      // in the SPA notFound fallback below.
    });

    // SPA fallback — serve index.html for all unmatched GET requests
    app.setNotFoundHandler(async (_request, reply) => {
      return reply.sendFile('index.html', frontendDistPath);
    });
  }

  // Serve only uploaded assets; private runtime state must never be web-readable.
  await app.register(fastifyStatic, {
    root: getDataSubDir('uploads'),
    prefix: '/assets/data/uploads/',
    decorateReply: false,
  });

  // ── Scheduled job service (T031/T035) ────────────────────────────────────────
  app.addHook('onReady', () => {
    seedSystemJobs();
    if (env.NODE_ENV !== 'test') {
      startScheduler();
    }
  });

  app.addHook('onClose', () => {
    stopScheduler();
  });

  return app;
}

async function main() {
  const env = getEnv();
  const app = await buildServer();

  try {
    // Run migrations before accepting traffic
    runMigrations(app.log);
    // Seed initial data (shell settings singleton + starter dashboard)
    seedDatabase(app.log);
    // Normalize unambiguous Unix socket paths stored by older releases.
    runDockerConnectionUpgrade(app.log);
    // Move any legacy per-widget Docker URLs into connection rows (043).
    // Row writes only, idempotent — safe on every boot.
    runDockerWidgetAdoption(app.log);

    await app.listen({ host: env.HOST, port: env.PORT });
  } catch (err) {
    app.log.error(err, 'Failed to start server');
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown(app: Awaited<ReturnType<typeof buildServer>>, signal: string) {
  app.log.info({ signal }, 'Shutting down…');
  await app.close();
  process.exit(0);
}

if (process.env['NODE_ENV'] !== 'test') {
  void (async () => {
    const app = await buildServer();
    process.on('SIGTERM', () => void shutdown(app, 'SIGTERM'));
    process.on('SIGINT', () => void shutdown(app, 'SIGINT'));

    try {
      runMigrations(app.log);
      seedDatabase(app.log);
      runDockerConnectionUpgrade(app.log);
      runDockerWidgetAdoption(app.log);
      await app.listen({ host: getEnv().HOST, port: getEnv().PORT });
    } catch (err) {
      app.log.error(err, 'Failed to start server');
      process.exit(1);
    }
  })();
}

export { main };
