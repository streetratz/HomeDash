/**
 * Phase R3: Admin dashboard, placeholder, widget, and link CRUD routes.
 *
 * All routes require admin authentication and CSRF for mutations.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requireAdmin } from '../auth/requireRole.js';
import { assertCsrf } from '../auth/csrf.js';
import {
  validate,
  UuidSchema,
  ApplicabilitySchema,
  BackgroundTypeSchema,
  BackgroundDisplayModeSchema,
  HexColorSchema,
  OpacitySchema,
  HttpUrlSchema,
  widgetConfigSchemas,
  DashboardImportSchema,
} from '../lib/validation.js';
import { executeChecks } from '../services/statusCheckService.js';
import {
  fetchWeather,
  WeatherRequestSchema,
} from '../services/weatherProxyService.js';
import {
  listDashboards,
  createDashboard,
  getDashboardWithChildren,
  updateDashboard,
  deleteDashboard,
  updateLayout,
  createPlaceholder,
  updatePlaceholder,
  deletePlaceholder,
  createWidget,
  updateWidget,
  deleteWidget,
  reorderWidgets,
  createLink,
  updateLink,
  deleteLink,
  reorderLinks,
  exportDashboard,
  importDashboard,
  duplicateDashboard,
  type CreateDashboardInput,
  type UpdateDashboardInput,
  type DashboardExport,
  type CreatePlaceholderInput,
  type UpdatePlaceholderInput,
  type CreateWidgetInput,
  type UpdateWidgetInput,
  type CreateLinkInput,
  type UpdateLinkInput,
  type LayoutPlaceholderInput,
  type VisibilityMutationContext,
} from '../services/dashboardService.js';

// ── Zod schemas ───────────────────────────────────────────────────────────────

const CreateDashboardSchema = z
  .object({
    name: z.string().min(1).max(128),
    applicability: ApplicabilitySchema.optional(),
  })
  .strict();

const UpdateDashboardSchema = z
  .object({
    name: z.string().min(1).max(128).optional(),
    applicability: ApplicabilitySchema.optional(),
    backgroundType: BackgroundTypeSchema.optional(),
    backgroundColor: HexColorSchema.nullable().optional(),
    backgroundAssetId: UuidSchema.nullable().optional(),
    backgroundDisplayMode: BackgroundDisplayModeSchema.nullable().optional(),
  })
  .strict();

export const PublicVisibilitySchema = z.enum(['hidden', 'read-only', 'visible']);

const LayoutWidgetInputSchema = z.object({
  id: UuidSchema.optional(),
  type: z.string().min(1).max(64),
  orderIndex: z.number().int().min(0),
  configJson: z.string().optional(),
  publicVisibility: PublicVisibilitySchema.optional(),
});

const BreakpointLayoutSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(1).max(12),
  h: z.number().int().min(1).max(20),
});

const LayoutPlaceholderInputSchema = z.object({
  stableKey: UuidSchema,
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(1).max(12),
  h: z.number().int().min(1).max(20),
  borderColor: HexColorSchema.optional(),
  borderSize: z.number().int().min(1).max(8).optional(),
  showBorder: z.boolean().optional(),
  showTitle: z.boolean().optional(),
  titleStyle: z.enum(['header', 'pill']).optional(),
  childLayout: z.enum(['stacked', 'side-by-side']).optional(),
  title: z.string().max(64).nullable().optional(),
  opacity: OpacitySchema.optional(),
  backgroundStyle: z.enum(['solid', 'aurora', 'aurora-australis']).optional(),
  backgroundColor: HexColorSchema.nullable().optional(),
  widgets: z.array(LayoutWidgetInputSchema).optional(),
  layouts: z.record(z.enum(['md', 'sm', 'xs', 'xxs']), BreakpointLayoutSchema).optional(),
});

const LayoutUpdateSchema = z
  .object({
    placeholders: z.array(LayoutPlaceholderInputSchema),
  })
  .strict();

const CreatePlaceholderSchema = z
  .object({
    x: z.number().int().min(0),
    y: z.number().int().min(0),
    w: z.number().int().min(1).max(12),
    h: z.number().int().min(1).max(20),
    borderColor: HexColorSchema.optional(),
    showBorder: z.boolean().optional(),
    title: z.string().max(64).nullable().optional(),
    opacity: OpacitySchema.optional(),
  })
  .strict();

const UpdatePlaceholderSchema = z
  .object({
    x: z.number().int().min(0).optional(),
    y: z.number().int().min(0).optional(),
    w: z.number().int().min(1).max(12).optional(),
    h: z.number().int().min(1).max(20).optional(),
    borderColor: HexColorSchema.optional(),
    borderSize: z.number().int().min(1).max(8).optional(),
    showBorder: z.boolean().optional(),
    title: z.string().max(64).nullable().optional(),
    showTitle: z.boolean().optional(),
    titleStyle: z.enum(['header', 'pill']).optional(),
    opacity: OpacitySchema.optional(),
  })
  .strict();

const CreateWidgetSchema = z
  .object({
    type: z.string().min(1).max(64),
    orderIndex: z.number().int().min(0).optional(),
    configJson: z.string().optional(),
    publicVisibility: PublicVisibilitySchema.optional(),
  })
  .strict();

const UpdateWidgetSchema = z
  .object({
    type: z.string().min(1).max(64).optional(),
    orderIndex: z.number().int().min(0).optional(),
    configJson: z.string().optional(),
    publicVisibility: PublicVisibilitySchema.optional(),
  })
  .strict();

const ReorderSchema = z
  .object({
    orderedIds: z.array(UuidSchema).min(0),
  })
  .strict();

const CreateLinkSchema = z
  .object({
    title: z.string().min(1).max(15),
    url: HttpUrlSchema,
    iconKey: z.string().max(128).nullable().optional(),
    iconOverrideKey: z.string().max(128).nullable().optional(),
    orderIndex: z.number().int().min(0).optional(),
  })
  .strict();

const UpdateLinkSchema = z
  .object({
    title: z.string().min(1).max(15).optional(),
    url: HttpUrlSchema.optional(),
    iconKey: z.string().max(128).nullable().optional(),
    iconOverrideKey: z.string().max(128).nullable().optional(),
    orderIndex: z.number().int().min(0).optional(),
  })
  .strict();

// ── Param extraction helper ───────────────────────────────────────────────────

function param(request: FastifyRequest, name: string): string {
  return (request.params as Record<string, string>)[name] ?? '';
}

function visibilityContext(request: FastifyRequest): VisibilityMutationContext {
  const actorUserId = request.user!.id;
  return {
    actorUserId,
    onVisibilityChange: (change) => {
      request.log.info(
        {
          event: 'widget_public_visibility_changed',
          widgetId: change.widgetId,
          widgetType: change.widgetType,
          previousVisibility: change.previousVisibility,
          publicVisibility: change.publicVisibility,
          actorUserId: change.actorUserId,
        },
        'Widget public visibility changed',
      );
    },
  };
}

// ── Route registration ────────────────────────────────────────────────────────

export function registerAdminDashboardRoutes(app: FastifyInstance): void {
  // ── Dashboard CRUD ────────────────────────────────────────────────────────

  app.get('/api/admin/dashboards', async (request, reply) => {
    await requireAdmin(request, reply);
    return reply.status(200).send(listDashboards());
  });

  app.post('/api/admin/dashboards', async (request, reply) => {
    await requireAdmin(request, reply);
    await assertCsrf(request, reply);
    const input = validate(CreateDashboardSchema, request.body) as CreateDashboardInput;
    const dashboard = createDashboard(input);
    return reply.status(201).send(dashboard);
  });

  app.get('/api/admin/dashboards/:dashboardId', async (request, reply) => {
    await requireAdmin(request, reply);
    const id = param(request, 'dashboardId');
    // Admin GET returns full nested layout
    const view = getDashboardWithChildren(id);
    return reply.status(200).send(view);
  });

  app.put('/api/admin/dashboards/:dashboardId', async (request, reply) => {
    await requireAdmin(request, reply);
    await assertCsrf(request, reply);
    const id = param(request, 'dashboardId');
    const input = validate(UpdateDashboardSchema, request.body) as UpdateDashboardInput;
    const updated = updateDashboard(id, input);
    return reply.status(200).send(updated);
  });

  app.delete('/api/admin/dashboards/:dashboardId', async (request, reply) => {
    await requireAdmin(request, reply);
    await assertCsrf(request, reply);
    const id = param(request, 'dashboardId');
    const result = deleteDashboard(id);
    return reply.status(200).send(result);
  });

  // ── Dashboard Export ───────────────────────────────────────────────────────

  app.get('/api/admin/dashboards/:dashboardId/export', async (request, reply) => {
    await requireAdmin(request, reply);
    const id = param(request, 'dashboardId');
    const exported = exportDashboard(id);
    const filename = exported.dashboard.name.replace(/[^a-zA-Z0-9-_]/g, '_') + '-export.json';
    return reply
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .type('application/json')
      .send(exported);
  });

  // ── Dashboard Duplicate ──────────────────────────────────────────────────

  app.post('/api/admin/dashboards/:dashboardId/duplicate', async (request, reply) => {
    await requireAdmin(request, reply);
    await assertCsrf(request, reply);
    const id = validate(UuidSchema, param(request, 'dashboardId'));
    try {
      const duplicated = duplicateDashboard(id);
      return reply.status(201).send(duplicated);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && err.code === 'NOT_FOUND') {
        return reply.status(404).send({ error: 'NOT_FOUND', message: `Dashboard not found: ${id}` });
      }
      throw err;
    }
  });

  // ── Dashboard Import ─────────────────────────────────────────────────────

  app.post('/api/admin/dashboards/import', async (request, reply) => {
    await requireAdmin(request, reply);
    await assertCsrf(request, reply);
    const payload = validate(DashboardImportSchema, request.body);
    const overrideName = payload.overrideName;

    // Check for name conflict
    const targetName = overrideName ?? payload.dashboard.name;
    const existing = listDashboards().find((d) => d.name === targetName);
    if (existing) {
      return reply.status(409).send({
        error: 'RESOURCE_CONFLICT',
        message: `Dashboard "${existing.name}" already exists`,
        existingName: existing.name,
        existingId: existing.id,
      });
    }

    const dashboard = importDashboard(payload as unknown as DashboardExport, overrideName);
    return reply.status(201).send(dashboard);
  });

  // ── Layout (batch) ────────────────────────────────────────────────────────

  app.put('/api/admin/dashboards/:dashboardId/layout', async (request, reply) => {
    await requireAdmin(request, reply);
    await assertCsrf(request, reply);
    const id = param(request, 'dashboardId');
    const body = validate(LayoutUpdateSchema, request.body);

    // Validate per-type widget configJson before saving
    for (const ph of body.placeholders) {
      if (!ph.widgets) continue;
      for (const w of ph.widgets) {
        if (!w.configJson) continue;
        const schema = widgetConfigSchemas[w.type];
        if (schema) {
          let parsed: unknown;
          try {
            parsed = JSON.parse(w.configJson);
          } catch {
            return reply.status(400).send({
              error: `Invalid JSON in configJson for widget type "${w.type}"`,
            });
          }
          const result = schema.safeParse(parsed);
          if (!result.success) {
            return reply.status(400).send({
              error: `Invalid config for widget type "${w.type}"`,
              details: result.error.errors.map((e) => ({
                path: e.path.join('.'),
                message: e.message,
              })),
            });
          }
        }
      }
    }

    const view = updateLayout(
      id,
      body.placeholders as LayoutPlaceholderInput[],
      visibilityContext(request),
    );
    return reply.status(200).send(view);
  });

  // ── Placeholder CRUD ──────────────────────────────────────────────────────

  app.post('/api/admin/dashboards/:dashboardId/placeholders', async (request, reply) => {
    await requireAdmin(request, reply);
    await assertCsrf(request, reply);
    const dashboardId = param(request, 'dashboardId');
    const input = validate(CreatePlaceholderSchema, request.body) as CreatePlaceholderInput;
    const ph = createPlaceholder(dashboardId, input);
    return reply.status(201).send(ph);
  });

  app.put('/api/admin/placeholders/:placeholderId', async (request, reply) => {
    await requireAdmin(request, reply);
    await assertCsrf(request, reply);
    const id = param(request, 'placeholderId');
    const input = validate(UpdatePlaceholderSchema, request.body) as UpdatePlaceholderInput;
    const updated = updatePlaceholder(id, input);
    return reply.status(200).send(updated);
  });

  app.delete('/api/admin/placeholders/:placeholderId', async (request, reply) => {
    await requireAdmin(request, reply);
    await assertCsrf(request, reply);
    const id = param(request, 'placeholderId');
    deletePlaceholder(id);
    return reply.status(204).send();
  });

  // ── Widget CRUD ───────────────────────────────────────────────────────────

  app.post('/api/admin/placeholders/:placeholderId/widgets', async (request, reply) => {
    await requireAdmin(request, reply);
    await assertCsrf(request, reply);
    const placeholderId = param(request, 'placeholderId');
    const input = validate(CreateWidgetSchema, request.body) as CreateWidgetInput;
    const widget = createWidget(placeholderId, input, visibilityContext(request));
    return reply.status(201).send(widget);
  });

  app.put('/api/admin/widgets/:widgetId', async (request, reply) => {
    await requireAdmin(request, reply);
    await assertCsrf(request, reply);
    const id = param(request, 'widgetId');
    const input = validate(UpdateWidgetSchema, request.body) as UpdateWidgetInput;
    const updated = updateWidget(id, input, visibilityContext(request));
    return reply.status(200).send(updated);
  });

  app.delete('/api/admin/widgets/:widgetId', async (request, reply) => {
    await requireAdmin(request, reply);
    await assertCsrf(request, reply);
    const id = param(request, 'widgetId');
    deleteWidget(id);
    return reply.status(204).send();
  });

  app.put('/api/admin/placeholders/:placeholderId/widgets/reorder', async (request, reply) => {
    await requireAdmin(request, reply);
    await assertCsrf(request, reply);
    const placeholderId = param(request, 'placeholderId');
    const body = validate(ReorderSchema, request.body);
    const widgets = reorderWidgets(placeholderId, body.orderedIds);
    return reply.status(200).send(widgets);
  });

  // ── Link CRUD ─────────────────────────────────────────────────────────────

  app.post('/api/admin/widgets/:widgetId/links', async (request, reply) => {
    await requireAdmin(request, reply);
    await assertCsrf(request, reply);
    const widgetId = param(request, 'widgetId');
    const input = validate(CreateLinkSchema, request.body) as CreateLinkInput;
    const link = createLink(widgetId, input);
    return reply.status(201).send(link);
  });

  app.put('/api/admin/links/:linkId', async (request, reply) => {
    await requireAdmin(request, reply);
    await assertCsrf(request, reply);
    const id = param(request, 'linkId');
    const input = validate(UpdateLinkSchema, request.body) as UpdateLinkInput;
    const updated = updateLink(id, input);
    return reply.status(200).send(updated);
  });

  app.delete('/api/admin/links/:linkId', async (request, reply) => {
    await requireAdmin(request, reply);
    await assertCsrf(request, reply);
    const id = param(request, 'linkId');
    deleteLink(id);
    return reply.status(204).send();
  });

  app.put('/api/admin/widgets/:widgetId/links/reorder', async (request, reply) => {
    await requireAdmin(request, reply);
    await assertCsrf(request, reply);
    const widgetId = param(request, 'widgetId');
    const body = validate(ReorderSchema, request.body);
    const links = reorderLinks(widgetId, body.orderedIds);
    return reply.status(200).send(links);
  });

  // ── T032 (US7): POST /api/admin/status-check ─────────────────────────────

  const StatusCheckRequestSchema = z.object({
    services: z
      .array(
        z.object({
          name: z.string().min(1).max(64),
          url: z.string().url().max(2048),
          expectedStatus: z.number().int().min(100).max(599),
          timeoutSeconds: z.number().int().min(1).max(30),
        }),
      )
      .min(1)
      .max(20),
  });

  app.post('/api/admin/status-check', async (request, reply) => {
    await requireAdmin(request, reply);
    await assertCsrf(request, reply);
    const body = validate(StatusCheckRequestSchema, request.body);
    const results = await executeChecks(body.services);
    return reply.status(200).send({ results });
  });

  // ── T039/T040 (US8): Weather proxy routes ──────────────────────────────────

  app.post('/api/admin/weather', async (request, reply) => {
    await requireAdmin(request, reply);
    await assertCsrf(request, reply);
    const body = validate(WeatherRequestSchema, request.body);
    const data = await fetchWeather(body);
    return reply.status(200).send(data);
  });

  // Public read-only route for dashboard viewers (no CSRF needed)
  app.get('/api/weather', async (request, reply) => {
    const query = request.query as Record<string, string>;
    const lat = parseFloat(query['lat'] ?? '');
    const lon = parseFloat(query['lon'] ?? '');
    const unit = (query['unit'] ?? 'C') as 'C' | 'F';
    if (isNaN(lat) || isNaN(lon)) {
      return reply.status(400).send({ error: 'lat and lon query params required' });
    }
    const parsed = WeatherRequestSchema.safeParse({
      latitude: lat,
      longitude: lon,
      temperatureUnit: unit,
    });
    if (!parsed.success) {
      return reply.status(422).send({ error: parsed.error.flatten() });
    }
    const data = await fetchWeather(parsed.data);
    return reply.status(200).send(data);
  });

  // Public geocoding proxy (Open-Meteo, no API key needed)
  app.get('/api/geocode', async (request, reply) => {
    const query = request.query as Record<string, string>;
    const name = (query['name'] ?? '').trim();
    if (!name || name.length < 2) {
      return reply.status(400).send({ error: 'name query param required (min 2 chars)' });
    }
    const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
    url.searchParams.set('name', name);
    url.searchParams.set('count', '5');
    url.searchParams.set('language', 'en');
    url.searchParams.set('format', 'json');
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      return reply.status(502).send({ error: `Geocoding API responded with ${res.status}` });
    }
    const json = await res.json();
    return reply.status(200).send(json);
  });
}
