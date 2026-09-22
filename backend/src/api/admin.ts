/**
 * T030 / T069 / T071 / T123 (US2): Admin route registration.
 * Phase R3: Dashboard, placeholder, widget, link, icon CRUD routes.
 *
 * Admin-only routes (shell settings, assets, dashboards, icons).
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requireAdmin } from '../auth/requireRole.js';
import { assertCsrf } from '../auth/csrf.js';
import {
  validate,
  TimezoneSchema,
  HttpUrlSchema,
  UuidSchema,
} from '../lib/validation.js';
import {
  getShellSettings,
  updateShellSettings,
  type UpdateShellSettingsInput,
} from '../services/shellSettingsService.js';
import { uploadLogo } from '../services/assetService.js';
import { registerAdminDashboardRoutes } from './adminDashboards.js';
import { registerAdminIconsRoutes } from './adminIcons.js';

// ── Zod schemas ───────────────────────────────────────────────────────────────

/** Per-clock display configuration schema (all optional). */
const ClockDisplayConfigSchema = z.object({
  label: z.string().max(32).optional(),
  layout: z.enum(['column', 'row']).optional(),
  showOffset: z.boolean().optional(),
  homeIconSide: z.enum(['left', 'right']).optional(),
  dayNightSide: z.enum(['left', 'right']).optional(),
});

/** Extra clock entry (non-home) in a shell settings update. */
const ExtraClockSchema = z.object({
  label: z.string().min(1).max(32),
  timezone: TimezoneSchema,
  config: ClockDisplayConfigSchema.optional(),
});

/**
 * Shell settings update body — all fields are optional so the client can
 * patch individual fields without resending the full payload.
 */
const ShellSettingsUpdateSchema = z
  .object({
    titleText: z.string().min(1).max(128).optional(),
    titleFont: z.string().min(1).max(64).optional(),
    titleFontSizePx: z
      .number()
      .int()
      .min(8)
      .max(72)
      .optional(),
    bodyFont: z.string().min(1).max(64).optional(),
    headerHeightPx: z.number().int().min(32).max(200).optional(),
    clockStripEnabled: z.boolean().optional(),
    clockStripAlignment: z.enum(['left', 'center', 'right']).optional(),
    homeTimezone: TimezoneSchema.nullable().optional(),
    /** Home clock display config. */
    homeClockConfig: ClockDisplayConfigSchema.nullable().optional(),
    /** Up to 5 extra clocks (after home). */
    timezones: z.array(ExtraClockSchema).max(5).optional(),
    footerText: z.string().max(256).nullable().optional(),
    repoUrl: HttpUrlSchema.nullable().optional(),
    /** Admin-configured default dashboard for unauthenticated web visitors. */
    unauthWebDashboardId: UuidSchema.nullable().optional(),
    /** Admin-configured default dashboard for unauthenticated mobile visitors. */
    unauthMobileDashboardId: UuidSchema.nullable().optional(),
    // Screensaver settings
    screensaverEnabled: z.boolean().optional(),
    screensaverIdleMinutes: z.number().int().min(1).max(120).optional(),
    screensaverSourceId: UuidSchema.nullable().optional(),
    screensaverIntervalSeconds: z.number().int().min(5).max(300).optional(),
    screensaverWeatherLat: z.number().min(-90).max(90).nullable().optional(),
    screensaverWeatherLon: z.number().min(-180).max(180).nullable().optional(),
    screensaverWeatherLocation: z.string().max(256).nullable().optional(),
    screensaverWeatherUnit: z.enum(['C', 'F']).optional(),
    screensaverClockFormat: z.enum(['12h', '24h']).optional(),
    screensaverTransition: z.enum(['fade', 'slide', 'kenburns', 'crossfade']).optional(),
    // Header animation settings
    headerStyle: z.enum(['none', 'gradient-shift', 'aurora', 'aurora-australis', 'glass-glow', 'gradient-underline']).optional(),
    headerStyleTarget: z.enum(['background', 'border', 'title']).optional(),
    headerGlassEffect: z.boolean().optional(),
    headerTitleStyle: z.enum(['none', 'gradient-shift', 'aurora', 'aurora-australis', 'glass-glow', 'gradient-underline']).optional(),
  })
  .strict();

// ── Route registration ────────────────────────────────────────────────────────

export function registerAdminRoutes(app: FastifyInstance): void {
  // ── T069 / T123 (US2): GET /api/admin/shell ───────────────────────────────
  app.get('/api/admin/shell', async (request: FastifyRequest, reply) => {
    await requireAdmin(request, reply);

    const settings = getShellSettings();
    return reply.status(200).send(settings);
  });

  // ── T069 / T123 (US2): PUT /api/admin/shell ───────────────────────────────
  app.put('/api/admin/shell', async (request: FastifyRequest, reply) => {
    await requireAdmin(request, reply);
    await assertCsrf(request, reply);

    const updates = validate(ShellSettingsUpdateSchema, request.body) as UpdateShellSettingsInput;
    const updated = updateShellSettings(updates);
    return reply.status(200).send(updated);
  });

  // ── T071 (US2): POST /api/admin/assets/logo ───────────────────────────────
  app.post('/api/admin/assets/logo', async (request: FastifyRequest, reply) => {
    await requireAdmin(request, reply);
    await assertCsrf(request, reply);

    const data = await (request as FastifyRequest & { file: () => Promise<{ toBuffer: () => Promise<Buffer>; filename: string } | undefined> }).file();
    if (!data) {
      return reply.status(400).send({ error: 'BAD_REQUEST', message: 'No file uploaded' });
    }

    const fileBuffer: Buffer = await data.toBuffer();
    const originalFilename: string = data.filename || 'logo';

    const asset = uploadLogo(fileBuffer, originalFilename);
    return reply.status(201).send(asset);
  });

  // ── Phase R3: Dashboard, placeholder, widget, link, icon routes ───────────
  registerAdminDashboardRoutes(app);
  registerAdminIconsRoutes(app);
}
