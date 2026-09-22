/**
 * T027 / T054 (US1): Public route registration.
 * T125 (US2): Enforce "explicitly selected only" unauth defaults.
 *
 * All routes here are accessible without authentication.
 * Returns only explicitly public, read-only data required for the unauthenticated experience.
 */

import type { FastifyInstance } from 'fastify';
import { count, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../db/drizzle.js';
import { appShellSettings, uploadedAssets, users } from '../db/schema/index.js';
import { detectDeviceContext } from '../lib/deviceContext.js';
import { selectUnauthDashboard } from '../services/dashboardSelection.js';
import { getDashboardWithChildren } from '../services/dashboardService.js';
import { publicWidgetRateLimit } from '../auth/rateLimit.js';
import {
  projectPublicDashboard,
  resolvePublicWidget,
} from '../services/publicVisibility.js';
import {
  getOrRefreshPublicSnapshot,
  PublicWidgetUnavailableError,
} from '../services/publicWidgetSnapshotCache.js';
import {
  loadPublicWidgetSnapshot,
  publicSnapshotCachePolicy,
} from '../services/publicWidgetProjection.js';

const PublicWidgetParamsSchema = z.object({ widgetId: z.string().uuid() });
const PUBLIC_NOT_FOUND = { error: 'NOT_FOUND', message: 'Public widget not found' } as const;

export function registerPublicRoutes(app: FastifyInstance): void {
  app.get(
    '/api/public/widgets/:widgetId',
    { config: { rateLimit: publicWidgetRateLimit } },
    async (request, reply) => {
      void reply.header('Cache-Control', 'no-store');
      const params = PublicWidgetParamsSchema.safeParse(request.params);
      if (!params.success) return reply.status(404).send(PUBLIC_NOT_FOUND);

      const widget = resolvePublicWidget(detectDeviceContext(request), params.data.widgetId);
      if (!widget) return reply.status(404).send(PUBLIC_NOT_FOUND);

      try {
        const snapshot = await getOrRefreshPublicSnapshot(
          `${widget.type}:${widget.id}:snapshot`,
          publicSnapshotCachePolicy(widget),
          () => loadPublicWidgetSnapshot(widget),
        );
        return reply.status(200).send(snapshot);
      } catch (error) {
        request.log.warn(
          {
            event: 'public_widget_snapshot_unavailable',
            widgetId: widget.id,
            widgetType: widget.type,
            reason:
              error instanceof PublicWidgetUnavailableError ? 'snapshot_unavailable' : 'unknown',
          },
          'Public widget snapshot unavailable',
        );
        return reply.status(404).send(PUBLIC_NOT_FOUND);
      }
    },
  );

  // T054 (US1): GET /api/public/bootstrap
  app.get('/api/public/bootstrap', async (request, reply) => {
    void reply.header('Cache-Control', 'no-store');
    const db = getDb();

    // Is this a first-run (no users in the DB)?
    const userCountResult = db.select({ value: count() }).from(users).all();
    const firstRunRequired = (userCountResult[0]?.value ?? 0) === 0;

    // Shell settings (safe public subset — no admin-only fields like unauth dashboard IDs)
    const shell = db.select().from(appShellSettings).where(eq(appShellSettings.id, 'global')).get();

    let shellPayload = null;
    if (shell) {
      // Build clock list combining home timezone + extra timezones
      interface StoredClock { label: string; timezone: string }
      const extraClocks = (JSON.parse(shell.timezonesJson) as StoredClock[]).map((c) => ({
        timezone: c.timezone,
        label: c.label,
        isHome: false as const,
      }));

      // Parse homeClockConfig for label override and global display settings
      interface HomeClockConfig { label?: string; layout?: string; homeIconSide?: string; dayNightSide?: string; showOffset?: boolean }
      let homeClockConfig: HomeClockConfig | null = null;
      if (shell.homeClockConfig) {
        try { homeClockConfig = JSON.parse(shell.homeClockConfig) as HomeClockConfig; } catch { /* ignore */ }
      }
      const homeLabel = homeClockConfig?.label ?? 'Home';

      const clocks = shell.homeTimezone
        ? [
            {
              timezone: shell.homeTimezone,
              label: homeLabel,
              isHome: true as const,
              ...(homeClockConfig ? { config: homeClockConfig } : {}),
            },
            ...extraClocks,
          ]
        : extraClocks;

      // Build logo URL from asset storagePath (T125: join assets table for correct URL)
      let logoUrl: string | null = null;
      if (shell.logoAssetId) {
        const asset = db
          .select()
          .from(uploadedAssets)
          .where(eq(uploadedAssets.id, shell.logoAssetId))
          .get();
        if (asset) {
          logoUrl = `/assets/data/${asset.storagePath}`;
        }
      }

      shellPayload = {
        titleText: shell.titleText,
        titleFont: shell.titleFont ?? 'system',
        titleFontSizePx: shell.titleFontSizePx ?? 18,
        bodyFont: shell.bodyFont ?? 'system',
        headerHeightPx: shell.headerHeightPx,
        logoUrl,
        clockStripEnabled: shell.clockStripEnabled,
        clockStripAlignment: shell.clockStripAlignment ?? 'center',
        clockDisplayConfig: homeClockConfig ?? {},
        clocks,
        footerText: shell.footerText ?? null,
        repoUrl: shell.repoUrl ?? null,
        screensaverEnabled: shell.screensaverEnabled,
        screensaverIdleMinutes: shell.screensaverIdleMinutes,
        screensaverSourceId: shell.screensaverSourceId ?? null,
        screensaverIntervalSeconds: shell.screensaverIntervalSeconds,
        screensaverWeatherLat: shell.screensaverWeatherLat ?? null,
        screensaverWeatherLon: shell.screensaverWeatherLon ?? null,
        screensaverWeatherLocation: shell.screensaverWeatherLocation ?? null,
        screensaverWeatherUnit: shell.screensaverWeatherUnit ?? 'C',
        screensaverClockFormat: shell.screensaverClockFormat ?? '12h',
        screensaverTransition: shell.screensaverTransition ?? 'kenburns',
        headerStyle: shell.headerStyle ?? 'none',
        headerGlassEffect: shell.headerGlassEffect ?? false,
        headerTitleStyle: shell.headerTitleStyle ?? 'none',
      };
    }

    // Default dashboard for the detected device context
    const device = detectDeviceContext(request);
    const selectedDashboard = selectUnauthDashboard(device);

    // Return full nested dashboard view (placeholders → widgets → links)
    let dashboardView = null;
    if (selectedDashboard) {
      try {
        dashboardView = projectPublicDashboard(getDashboardWithChildren(selectedDashboard.id));
      } catch {
        // Dashboard may have been deleted since selection; safe fallback
        dashboardView = null;
      }
    }

    return reply.status(200).send({
      firstRunRequired,
      shell: shellPayload,
      deviceContext: device,
      dashboard: dashboardView,
    });
  });
}
