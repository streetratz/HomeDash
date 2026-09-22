/**
 * System info API — lightweight, no auth required.
 * GET /api/system/info → version, nodeVersion, environment, uptime
 */

import type { FastifyInstance } from 'fastify';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { z } from 'zod';

const packageMetadataSchema = z.object({
  version: z.string(),
});

function readVersion(): string {
  try {
    const raw: unknown = JSON.parse(
      readFileSync(resolve(__dirname, '../../../package.json'), 'utf-8'),
    );
    const result = packageMetadataSchema.safeParse(raw);
    return result.success ? result.data.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
}

export function registerSystemRoutes(app: FastifyInstance): void {
  const version = readVersion();

  app.get('/api/system/info', () => {
    const uptimeSeconds = Math.floor(process.uptime());
    return {
      version,
      nodeVersion: process.version,
      environment: process.env['NODE_ENV'] ?? 'development',
      uptime: uptimeSeconds,
      uptimeHuman: formatUptime(uptimeSeconds),
    };
  });
}
