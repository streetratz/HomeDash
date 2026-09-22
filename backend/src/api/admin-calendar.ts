/**
 * T018 (004): Calendar source CRUD routes (admin).
 * T019 (004): Calendar events read route (user).
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { eq, and, inArray, gte, lte } from 'drizzle-orm';
import { requireAuth } from '../auth/requireRole.js';
import { requireAdmin } from '../auth/requireRole.js';
import { assertCsrf } from '../auth/csrf.js';
import {
  validate,
  CalendarSourceCreateSchema,
  CalendarSourceUpdateSchema,
  CalendarFileImportSchema,
  BirthdayRecordSchema,
  BirthdaySourceCreateSchema,
  BirthdayCsvSchema,
  BirthdayCsvImportSchema,
  BirthdayExportQuerySchema,
  UuidSchema,
} from '../lib/validation.js';
import { Errors } from '../lib/errors.js';
import { getDb } from '../db/drizzle.js';
import {
  calendarBirthdays,
  calendarSources,
  calendarEvents,
  appWidgetInstances,
} from '../db/schema/index.js';
import { syncSource } from '../services/calendar-sync-service.js';
import { MAX_ICS_JSON_BODY_BYTES, parseIcalBody } from '../services/ical-service.js';
import { getSqliteDb } from '../db/sqlite.js';
import {
  exportBirthdaysCsv,
  exportBirthdaysIcs,
  MAX_BIRTHDAY_CSV_BYTES,
  parseBirthdayCsv,
} from '../services/birthday-calendar-service.js';

const calendarSourceResponseFields = {
  id: calendarSources.id,
  oauthAccountId: calendarSources.oauthAccountId,
  type: calendarSources.type,
  name: calendarSources.name,
  url: calendarSources.url,
  fileName: calendarSources.fileName,
  color: calendarSources.color,
  syncIntervalSeconds: calendarSources.syncIntervalSeconds,
  lastSyncAt: calendarSources.lastSyncAt,
  lastSyncError: calendarSources.lastSyncError,
  enabled: calendarSources.enabled,
  createdAt: calendarSources.createdAt,
  updatedAt: calendarSources.updatedAt,
};

function enableSourceInCalendarWidgets(sourceId: string, now: string): void {
  const db = getDb();
  const calendarWidgets = db
    .select()
    .from(appWidgetInstances)
    .where(eq(appWidgetInstances.type, 'calendar'))
    .all();

  for (const widget of calendarWidgets) {
    try {
      const config = JSON.parse(widget.configJson || '{}') as Record<string, unknown>;
      const sourceIds = Array.isArray(config['sourceIds']) ? (config['sourceIds'] as string[]) : [];
      if (!sourceIds.includes(sourceId)) {
        sourceIds.push(sourceId);
        config['sourceIds'] = sourceIds;
        db.update(appWidgetInstances)
          .set({ configJson: JSON.stringify(config), updatedAt: now })
          .where(eq(appWidgetInstances.id, widget.id))
          .run();
      }
    } catch {
      // Skip widgets with malformed config
    }
  }
}

function validateUploadedIcal(body: string): void {
  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString();
    const end = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
    parseIcalBody(body, start, end);
  } catch (error) {
    throw Errors.validationError(
      error instanceof Error ? error.message : 'Invalid iCalendar content',
    );
  }
}

function getOwnedBirthdaySource(sourceId: string, userId: string) {
  const db = getDb();
  const source = db.select().from(calendarSources).where(eq(calendarSources.id, sourceId)).get();

  if (!source) throw Errors.notFound('Calendar source not found');
  if (source.userId !== userId) {
    throw Errors.forbidden('Calendar source does not belong to this user');
  }
  if (source.type !== 'birthday_local') {
    throw Errors.validationError('Calendar source is not a local birthday source');
  }

  return source;
}

function birthdayKey(value: {
  firstName: string;
  lastName: string | null;
  month: number;
  day: number;
  birthYear: number | null;
}): string {
  return `${value.firstName.toLocaleLowerCase()}\u0000${value.lastName?.toLocaleLowerCase() ?? ''}\u0000${value.month}\u0000${value.day}\u0000${value.birthYear ?? ''}`;
}

function exportFileName(sourceName: string, extension: string): string {
  const safeName = sourceName
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${safeName || 'birthdays'}.${extension}`;
}

async function refreshBirthdayEvents(sourceId: string): Promise<void> {
  const result = await syncSource(sourceId, { allowDisabled: true });
  if (result.error) {
    throw Errors.validationError(`Birthday events could not be updated: ${result.error}`);
  }
}

// ─── Shared event query helper ─────────────────────────────────────────────

function fetchCalendarEvents(query: Record<string, string | undefined>, userId?: string) {
  const sourceIdsParam = query['sourceIds'];
  const from = query['from'];
  const to = query['to'];

  if (!sourceIdsParam || !from || !to) {
    throw Errors.validationError('Missing required query params: sourceIds, from, to');
  }

  const sourceIds = sourceIdsParam
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (sourceIds.length === 0) {
    throw Errors.validationError('sourceIds must contain at least one UUID');
  }

  for (const sid of sourceIds) {
    validate(UuidSchema, sid);
  }

  const db = getDb();

  // If userId provided, verify ownership; otherwise just look up source metadata
  const sourceFilter = userId
    ? and(eq(calendarSources.userId, userId), inArray(calendarSources.id, sourceIds))
    : inArray(calendarSources.id, sourceIds);

  const ownedSources = db
    .select({ id: calendarSources.id, color: calendarSources.color, name: calendarSources.name })
    .from(calendarSources)
    .where(sourceFilter)
    .all();

  if (userId) {
    const ownedIds = new Set(ownedSources.map((s) => s.id));
    for (const sid of sourceIds) {
      if (!ownedIds.has(sid)) {
        throw Errors.forbidden(`Calendar source ${sid} does not belong to this user`);
      }
    }
  }

  const sourceMap = new Map(ownedSources.map((s) => [s.id, s]));
  const validSourceIds = [...sourceMap.keys()];
  if (validSourceIds.length === 0) return [];

  const events = db
    .select({
      id: calendarEvents.id,
      sourceId: calendarEvents.sourceId,
      title: calendarEvents.title,
      description: calendarEvents.description,
      location: calendarEvents.location,
      startAt: calendarEvents.startAt,
      endAt: calendarEvents.endAt,
      startTz: calendarEvents.startTz,
      endTz: calendarEvents.endTz,
      isAllDay: calendarEvents.isAllDay,
      isPrivate: calendarEvents.isPrivate,
      calendarName: calendarEvents.calendarName,
    })
    .from(calendarEvents)
    .where(
      and(
        inArray(calendarEvents.sourceId, validSourceIds),
        gte(calendarEvents.startAt, from),
        lte(calendarEvents.startAt, to),
      ),
    )
    .orderBy(calendarEvents.startAt)
    .limit(200)
    .all();

  return events.map((ev) => {
    const source = sourceMap.get(ev.sourceId);
    return {
      ...ev,
      sourceColor: source?.color ?? '#3b82f6',
      sourceName: source?.name ?? '',
    };
  });
}

// ─── Route registration ────────────────────────────────────────────────────────

export function registerCalendarRoutes(app: FastifyInstance): void {
  // ── T018: GET /api/user/calendar/sources ─────────────────────────────────
  app.get('/api/user/calendar/sources', async (request, reply) => {
    requireAuth(request, reply);

    const db = getDb();
    const sources = db
      .select(calendarSourceResponseFields)
      .from(calendarSources)
      .where(eq(calendarSources.userId, request.user!.id))
      .all();

    return reply.status(200).send(sources);
  });

  // ── T018: POST /api/admin/calendar/sources ───────────────────────────────
  app.post('/api/admin/calendar/sources', async (request, reply) => {
    await requireAdmin(request, reply);
    await assertCsrf(request, reply);

    const body = validate(CalendarSourceCreateSchema, request.body);
    const db = getDb();
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    db.insert(calendarSources)
      .values({
        id,
        userId: request.user!.id,
        type: body.type,
        name: body.name,
        url: body.url,
        color: body.color,
        syncIntervalSeconds: body.syncIntervalSeconds,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    // Fire-and-forget initial sync
    void syncSource(id).catch(() => {
      /* logged inside syncSource */
    });

    enableSourceInCalendarWidgets(id, now);

    const source = db
      .select(calendarSourceResponseFields)
      .from(calendarSources)
      .where(eq(calendarSources.id, id))
      .get();

    return reply.status(201).send(source);
  });

  // ── POST /api/admin/calendar/sources/import ──────────────────────────────
  app.post(
    '/api/admin/calendar/sources/import',
    { bodyLimit: MAX_ICS_JSON_BODY_BYTES },
    async (request, reply) => {
      await requireAdmin(request, reply);
      await assertCsrf(request, reply);

      const body = validate(CalendarFileImportSchema, request.body);
      validateUploadedIcal(body.icsContent);

      const db = getDb();
      const now = new Date().toISOString();
      const id = crypto.randomUUID();

      db.insert(calendarSources)
        .values({
          id,
          userId: request.user!.id,
          type: 'ical_file',
          name: body.name,
          url: null,
          icsContent: body.icsContent,
          fileName: body.fileName,
          color: body.color,
          syncIntervalSeconds: 3600,
          enabled: true,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const result = await syncSource(id);
      if (result.error) {
        db.delete(calendarSources).where(eq(calendarSources.id, id)).run();
        throw Errors.validationError(result.error);
      }

      enableSourceInCalendarWidgets(id, now);

      const source = db
        .select(calendarSourceResponseFields)
        .from(calendarSources)
        .where(eq(calendarSources.id, id))
        .get();
      return reply.status(201).send(source);
    },
  );

  // ── POST /api/admin/calendar/sources/:id/import ──────────────────────────
  app.post(
    '/api/admin/calendar/sources/:id/import',
    { bodyLimit: MAX_ICS_JSON_BODY_BYTES },
    async (request: FastifyRequest, reply) => {
      await requireAdmin(request, reply);
      await assertCsrf(request, reply);

      const sourceId = (request.params as Record<string, string>)['id'] ?? '';
      validate(UuidSchema, sourceId);
      const body = validate(CalendarFileImportSchema, request.body);
      validateUploadedIcal(body.icsContent);

      const db = getDb();
      const existing = db
        .select({
          userId: calendarSources.userId,
          type: calendarSources.type,
        })
        .from(calendarSources)
        .where(eq(calendarSources.id, sourceId))
        .get();

      if (!existing) throw Errors.notFound('Calendar source not found');
      if (existing.userId !== request.user!.id) {
        throw Errors.forbidden('Calendar source does not belong to this user');
      }
      if (existing.type !== 'ical_file') {
        throw Errors.validationError('Only uploaded iCalendar sources can be re-imported');
      }

      const result = await syncSource(sourceId, {
        allowDisabled: true,
        fileReplacement: {
          name: body.name,
          color: body.color ?? '#3b82f6',
          fileName: body.fileName,
          icsContent: body.icsContent,
        },
      });
      if (result.error) throw Errors.validationError(result.error);

      const source = db
        .select(calendarSourceResponseFields)
        .from(calendarSources)
        .where(eq(calendarSources.id, sourceId))
        .get();
      return reply.status(200).send(source);
    },
  );

  // ── Local birthday sources ────────────────────────────────────────────────

  app.post('/api/admin/calendar/birthday-sources', async (request, reply) => {
    await requireAdmin(request, reply);
    await assertCsrf(request, reply);

    const body = validate(BirthdaySourceCreateSchema, request.body);
    const db = getDb();
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    db.insert(calendarSources)
      .values({
        id,
        userId: request.user!.id,
        type: 'birthday_local',
        name: body.name,
        color: body.color,
        syncIntervalSeconds: 86400,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const result = await syncSource(id);
    if (result.error) {
      db.delete(calendarSources).where(eq(calendarSources.id, id)).run();
      throw Errors.validationError(result.error);
    }
    enableSourceInCalendarWidgets(id, now);

    const source = db
      .select(calendarSourceResponseFields)
      .from(calendarSources)
      .where(eq(calendarSources.id, id))
      .get();
    return reply.status(201).send(source);
  });

  app.post(
    '/api/admin/calendar/birthdays/preview',
    { bodyLimit: MAX_BIRTHDAY_CSV_BYTES + 64 * 1024 },
    async (request, reply) => {
      await requireAdmin(request, reply);
      await assertCsrf(request, reply);

      const body = validate(BirthdayCsvSchema, request.body);
      return reply.status(200).send(parseBirthdayCsv(body.csvContent));
    },
  );

  app.get('/api/admin/calendar/sources/:id/birthdays', async (request: FastifyRequest, reply) => {
    await requireAdmin(request, reply);
    const sourceId = (request.params as Record<string, string>)['id'] ?? '';
    validate(UuidSchema, sourceId);
    getOwnedBirthdaySource(sourceId, request.user!.id);

    const birthdays = getDb()
      .select()
      .from(calendarBirthdays)
      .where(eq(calendarBirthdays.sourceId, sourceId))
      .orderBy(
        calendarBirthdays.month,
        calendarBirthdays.day,
        calendarBirthdays.firstName,
        calendarBirthdays.lastName,
      )
      .all();
    return reply.status(200).send(birthdays);
  });

  app.post('/api/admin/calendar/sources/:id/birthdays', async (request: FastifyRequest, reply) => {
    await requireAdmin(request, reply);
    await assertCsrf(request, reply);
    const sourceId = (request.params as Record<string, string>)['id'] ?? '';
    validate(UuidSchema, sourceId);
    getOwnedBirthdaySource(sourceId, request.user!.id);
    const body = validate(BirthdayRecordSchema, request.body);

    const db = getDb();
    const existing = db
      .select()
      .from(calendarBirthdays)
      .where(eq(calendarBirthdays.sourceId, sourceId))
      .all();
    const key = birthdayKey({
      ...body,
      lastName: body.lastName ?? null,
      birthYear: body.birthYear ?? null,
    });
    if (existing.some((record) => birthdayKey(record) === key)) {
      throw Errors.conflict('This birthday already exists in the source');
    }

    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    db.insert(calendarBirthdays)
      .values({
        id,
        sourceId,
        firstName: body.firstName,
        lastName: body.lastName || null,
        month: body.month,
        day: body.day,
        birthYear: body.birthYear ?? null,
        notes: body.notes || null,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    await refreshBirthdayEvents(sourceId);

    const birthday = db.select().from(calendarBirthdays).where(eq(calendarBirthdays.id, id)).get();
    return reply.status(201).send(birthday);
  });

  app.put(
    '/api/admin/calendar/sources/:id/birthdays/:birthdayId',
    async (request: FastifyRequest, reply) => {
      await requireAdmin(request, reply);
      await assertCsrf(request, reply);
      const params = request.params as Record<string, string>;
      const sourceId = params['id'] ?? '';
      const birthdayId = params['birthdayId'] ?? '';
      validate(UuidSchema, sourceId);
      validate(UuidSchema, birthdayId);
      getOwnedBirthdaySource(sourceId, request.user!.id);
      const body = validate(BirthdayRecordSchema, request.body);

      const db = getDb();
      const records = db
        .select()
        .from(calendarBirthdays)
        .where(eq(calendarBirthdays.sourceId, sourceId))
        .all();
      const current = records.find((record) => record.id === birthdayId);
      if (!current) throw Errors.notFound('Birthday not found');
      const key = birthdayKey({
        ...body,
        lastName: body.lastName ?? null,
        birthYear: body.birthYear ?? null,
      });
      if (records.some((record) => record.id !== birthdayId && birthdayKey(record) === key)) {
        throw Errors.conflict('This birthday already exists in the source');
      }

      db.update(calendarBirthdays)
        .set({
          firstName: body.firstName,
          lastName: body.lastName || null,
          month: body.month,
          day: body.day,
          birthYear: body.birthYear ?? null,
          notes: body.notes || null,
          updatedAt: new Date().toISOString(),
        })
        .where(and(eq(calendarBirthdays.id, birthdayId), eq(calendarBirthdays.sourceId, sourceId)))
        .run();
      await refreshBirthdayEvents(sourceId);

      const birthday = db
        .select()
        .from(calendarBirthdays)
        .where(eq(calendarBirthdays.id, birthdayId))
        .get();
      return reply.status(200).send(birthday);
    },
  );

  app.delete(
    '/api/admin/calendar/sources/:id/birthdays/:birthdayId',
    async (request: FastifyRequest, reply) => {
      await requireAdmin(request, reply);
      await assertCsrf(request, reply);
      const params = request.params as Record<string, string>;
      const sourceId = params['id'] ?? '';
      const birthdayId = params['birthdayId'] ?? '';
      validate(UuidSchema, sourceId);
      validate(UuidSchema, birthdayId);
      getOwnedBirthdaySource(sourceId, request.user!.id);

      const result = getDb()
        .delete(calendarBirthdays)
        .where(and(eq(calendarBirthdays.id, birthdayId), eq(calendarBirthdays.sourceId, sourceId)))
        .run();
      if (result.changes === 0) throw Errors.notFound('Birthday not found');
      await refreshBirthdayEvents(sourceId);
      return reply.status(204).send();
    },
  );

  app.post(
    '/api/admin/calendar/sources/:id/birthdays/import',
    { bodyLimit: MAX_BIRTHDAY_CSV_BYTES + 64 * 1024 },
    async (request: FastifyRequest, reply) => {
      await requireAdmin(request, reply);
      await assertCsrf(request, reply);
      const sourceId = (request.params as Record<string, string>)['id'] ?? '';
      validate(UuidSchema, sourceId);
      getOwnedBirthdaySource(sourceId, request.user!.id);
      const body = validate(BirthdayCsvImportSchema, request.body);
      const preview = parseBirthdayCsv(body.csvContent);
      if (preview.errors.length > 0) {
        throw Errors.validationError('Birthday CSV contains invalid rows', preview);
      }

      const db = getDb();
      const now = new Date().toISOString();
      const existing = db
        .select()
        .from(calendarBirthdays)
        .where(eq(calendarBirthdays.sourceId, sourceId))
        .all();
      const existingKeys = new Set(existing.map(birthdayKey));
      let imported = 0;
      let skipped = 0;

      getSqliteDb().transaction(() => {
        if (body.mode === 'replace') {
          db.delete(calendarBirthdays).where(eq(calendarBirthdays.sourceId, sourceId)).run();
          existingKeys.clear();
        }

        for (const row of preview.rows) {
          const key = birthdayKey(row);
          if (existingKeys.has(key)) {
            skipped++;
            continue;
          }
          db.insert(calendarBirthdays)
            .values({
              id: crypto.randomUUID(),
              sourceId,
              firstName: row.firstName,
              lastName: row.lastName,
              month: row.month,
              day: row.day,
              birthYear: row.birthYear,
              notes: row.notes,
              createdAt: now,
              updatedAt: now,
            })
            .run();
          existingKeys.add(key);
          imported++;
        }
      })();

      await refreshBirthdayEvents(sourceId);
      return reply.status(200).send({ imported, skipped, mode: body.mode });
    },
  );

  app.get(
    '/api/admin/calendar/sources/:id/birthdays/export',
    async (request: FastifyRequest, reply) => {
      await requireAdmin(request, reply);
      const sourceId = (request.params as Record<string, string>)['id'] ?? '';
      validate(UuidSchema, sourceId);
      const source = getOwnedBirthdaySource(sourceId, request.user!.id);
      const query = validate(BirthdayExportQuerySchema, request.query);
      const records = getDb()
        .select()
        .from(calendarBirthdays)
        .where(eq(calendarBirthdays.sourceId, sourceId))
        .orderBy(
          calendarBirthdays.month,
          calendarBirthdays.day,
          calendarBirthdays.firstName,
          calendarBirthdays.lastName,
        )
        .all();

      const isCsv = query.format === 'csv';
      return reply.status(200).send({
        fileName: exportFileName(source.name, query.format),
        mimeType: isCsv ? 'text/csv;charset=utf-8' : 'text/calendar;charset=utf-8',
        content: isCsv ? exportBirthdaysCsv(records) : exportBirthdaysIcs(records, source.name),
      });
    },
  );

  // ── T018: PUT /api/admin/calendar/sources/:id ────────────────────────────
  app.put('/api/admin/calendar/sources/:id', async (request: FastifyRequest, reply) => {
    await requireAdmin(request, reply);
    await assertCsrf(request, reply);

    const sourceId = (request.params as Record<string, string>)['id'] ?? '';
    validate(UuidSchema, sourceId);

    const body = validate(CalendarSourceUpdateSchema, request.body);
    const db = getDb();

    // Verify source belongs to requesting user
    const existing = db
      .select({
        id: calendarSources.id,
        userId: calendarSources.userId,
        type: calendarSources.type,
      })
      .from(calendarSources)
      .where(eq(calendarSources.id, sourceId))
      .get();

    if (!existing) {
      throw Errors.notFound('Calendar source not found');
    }
    if (existing.userId !== request.user!.id) {
      throw Errors.forbidden('Calendar source does not belong to this user');
    }

    const now = new Date().toISOString();

    db.update(calendarSources)
      .set({ ...body, updatedAt: now })
      .where(eq(calendarSources.id, sourceId))
      .run();

    if (existing.type === 'birthday_local') {
      await refreshBirthdayEvents(sourceId);
    }

    const updated = db
      .select(calendarSourceResponseFields)
      .from(calendarSources)
      .where(eq(calendarSources.id, sourceId))
      .get();

    return reply.status(200).send(updated);
  });

  // ── T018: DELETE /api/admin/calendar/sources/:id ─────────────────────────
  app.delete('/api/admin/calendar/sources/:id', async (request: FastifyRequest, reply) => {
    await requireAdmin(request, reply);
    await assertCsrf(request, reply);

    const sourceId = (request.params as Record<string, string>)['id'] ?? '';
    validate(UuidSchema, sourceId);

    const db = getDb();
    const source = db
      .select({ userId: calendarSources.userId })
      .from(calendarSources)
      .where(eq(calendarSources.id, sourceId))
      .get();

    if (!source) throw Errors.notFound('Calendar source not found');
    if (source.userId !== request.user!.id) {
      throw Errors.forbidden('Calendar source does not belong to this user');
    }
    db.delete(calendarSources).where(eq(calendarSources.id, sourceId)).run();

    return reply.status(204).send();
  });

  // ── T018: POST /api/admin/calendar/sources/:id/sync ──────────────────────
  app.post('/api/admin/calendar/sources/:id/sync', async (request: FastifyRequest, reply) => {
    await requireAdmin(request, reply);
    await assertCsrf(request, reply);

    const sourceId = (request.params as Record<string, string>)['id'] ?? '';
    validate(UuidSchema, sourceId);

    const source = getDb()
      .select({ userId: calendarSources.userId })
      .from(calendarSources)
      .where(eq(calendarSources.id, sourceId))
      .get();
    if (!source) throw Errors.notFound('Calendar source not found');
    if (source.userId !== request.user!.id) {
      throw Errors.forbidden('Calendar source does not belong to this user');
    }

    const result = await syncSource(sourceId);
    return reply.status(200).send(result);
  });

  // ── T019: GET /api/user/calendar/events (auth'd — validates source ownership)
  app.get('/api/user/calendar/events', async (request: FastifyRequest, reply) => {
    requireAuth(request, reply);
    const result = fetchCalendarEvents(
      request.query as Record<string, string | undefined>,
      request.user!.id,
    );
    return reply.status(200).send(result);
  });

  // ── Public: GET /api/public/calendar/sources (read-only, for widget rendering)
  app.get('/api/public/calendar/sources', async (_request, reply) => {
    const db = getDb();
    const sources = db
      .select({
        id: calendarSources.id,
        type: calendarSources.type,
        name: calendarSources.name,
        color: calendarSources.color,
        enabled: calendarSources.enabled,
      })
      .from(calendarSources)
      .all();
    return reply.status(200).send(sources);
  });

  // ── Public: GET /api/public/calendar/events (read-only, for widget rendering)
  app.get('/api/public/calendar/events', async (request: FastifyRequest, reply) => {
    const result = fetchCalendarEvents(request.query as Record<string, string | undefined>);
    return reply.status(200).send(result);
  });
}
