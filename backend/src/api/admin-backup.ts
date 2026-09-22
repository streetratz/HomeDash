/**
 * T010/T016: Backup & restore API routes (admin only).
 */

import type { FastifyInstance } from 'fastify';
import { requireAdmin } from '../auth/requireRole.js';
import { assertCsrf } from '../auth/csrf.js';
import { exportBackup, previewRestore, executeRestore } from '../services/backupService.js';
import { backupFileSchema } from '../services/backupTypes.js';
import { Errors } from '../lib/errors.js';

export function registerAdminBackupRoutes(app: FastifyInstance): void {
  // ── GET /api/admin/backup ── Download portable system backup ─────────────

  app.get('/api/admin/backup', async (request, reply) => {
    await requireAdmin(request, reply);
    request.log.info(
      { userId: request.user?.id },
      'Portable backup download requested',
    );

    const backup = exportBackup();
    const dateStr = new Date().toISOString().slice(0, 10);

    return reply
      .header('Content-Disposition', `attachment; filename="homedash-backup-${dateStr}.json"`)
      .header('Content-Type', 'application/json')
      .send(backup);
  });

  // ── GET /api/admin/backup/database ── Download full SQLite backup ────────

  app.get('/api/admin/backup/database', async (request, reply) => {
    await requireAdmin(request, reply);
    request.log.info(
      { userId: request.user?.id },
      'Full database backup download requested',
    );

    const { getSqliteDb } = await import('../db/sqlite.js');
    const { getDataDir } = await import('../config/dataDir.js');
    const fs = await import('node:fs');
    const path = await import('node:path');

    const dateStr = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
    const backupsDir = path.join(getDataDir(), 'backups');
    fs.mkdirSync(backupsDir, { recursive: true });
    const tmpPath = path.join(backupsDir, `homedash-download-${dateStr}.db`);

    try {
      await getSqliteDb().backup(tmpPath);

      const stream = fs.createReadStream(tmpPath);
      const dateLabel = new Date().toISOString().slice(0, 10);

      return reply
        .header('Content-Disposition', `attachment; filename="homedash-full-${dateLabel}.db"`)
        .header('Content-Type', 'application/x-sqlite3')
        .send(stream);
    } finally {
      // Clean up temp file after a delay to allow streaming
      setTimeout(() => {
        try {
          fs.unlinkSync(tmpPath);
        } catch (err) {
          request.log.warn(
            { err, filename: path.basename(tmpPath) },
            'Failed to remove temporary database backup',
          );
        }
      }, 30000);
    }
  });

  // ── POST /api/admin/backup/preview ── Preview restore contents ────────────

  app.post('/api/admin/backup/preview', {
    config: { rawBody: false },
    bodyLimit: 10 * 1024 * 1024, // 10 MB
    handler: async (request, reply) => {
      await requireAdmin(request, reply);
      await assertCsrf(request, reply);

      const preview = previewRestore(request.body);
      return reply.send(preview);
    },
  });

  // ── POST /api/admin/backup/restore ── Execute full restore ────────────────

  app.post('/api/admin/backup/restore', {
    config: { rawBody: false },
    bodyLimit: 10 * 1024 * 1024, // 10 MB
    handler: async (request, reply) => {
      await requireAdmin(request, reply);
      await assertCsrf(request, reply);

      const body = request.body as { backup?: unknown; confirmationWord?: string };

      if (!body.confirmationWord || body.confirmationWord !== 'RESTORE') {
        throw Errors.badRequest('You must provide confirmationWord: "RESTORE" to proceed.');
      }

      // Validate the backup payload
      const result = backupFileSchema.safeParse(body.backup);
      if (!result.success) {
        throw Errors.badRequest(`Invalid backup file: ${result.error.errors.map((e) => e.message).join(', ')}`);
      }

      const summary = executeRestore(result.data, request.user!.id);
      return reply.send({ success: true, summary });
    },
  });
}
