import { and, eq } from 'drizzle-orm';
import { getDb } from '../db/drizzle.js';
import { appWidgetInstances, placeholderWidgets } from '../db/schema/index.js';
import type { DeviceContext } from '../lib/deviceContext.js';
import { selectUnauthDashboard } from './dashboardSelection.js';
import type {
  DashboardView,
  PublicVisibility,
  WidgetView,
} from './dashboardService.js';

export const INTRINSIC_PUBLIC_WIDGET_TYPES = new Set([
  'clock',
  'weather',
  'calendar',
  'links_list',
  'single_link',
  'markdown',
  'iframe',
  'photo_frame',
]);

export const EXPLICIT_PUBLIC_WIDGET_TYPES = [
  'pihole',
  'unifi',
  'sonos_music',
  'stocks',
  'app_shortcuts',
] as const;

export type PublicWidgetType = (typeof EXPLICIT_PUBLIC_WIDGET_TYPES)[number];

const explicitPublicWidgetTypes = new Set<string>(EXPLICIT_PUBLIC_WIDGET_TYPES);

export interface ResolvedPublicWidget {
  id: string;
  type: PublicWidgetType;
  publicVisibility: Exclude<PublicVisibility, 'hidden'>;
  config: Record<string, unknown>;
  publicSourceUserId: string | null;
}

export function isExplicitPublicWidgetType(type: string): type is PublicWidgetType {
  return explicitPublicWidgetTypes.has(type);
}

export function isWidgetVisibleInPublicBootstrap(
  type: string,
  publicVisibility: PublicVisibility,
): boolean {
  if (INTRINSIC_PUBLIC_WIDGET_TYPES.has(type)) return true;
  return isExplicitPublicWidgetType(type) && publicVisibility !== 'hidden';
}

export function resolvePublicWidget(
  deviceContext: DeviceContext,
  widgetId: string,
): ResolvedPublicWidget | null {
  const selectedDashboard = selectUnauthDashboard(deviceContext);
  if (!selectedDashboard) return null;

  const db = getDb();
  const row = db
    .select({
      id: appWidgetInstances.id,
      type: appWidgetInstances.type,
      configJson: appWidgetInstances.configJson,
      publicVisibility: appWidgetInstances.publicVisibility,
      publicSourceUserId: appWidgetInstances.publicSourceUserId,
    })
    .from(appWidgetInstances)
    .innerJoin(
      placeholderWidgets,
      eq(appWidgetInstances.placeholderId, placeholderWidgets.id),
    )
    .where(
      and(
        eq(appWidgetInstances.id, widgetId),
        eq(placeholderWidgets.dashboardId, selectedDashboard.id),
      ),
    )
    .get();

  if (
    !row ||
    row.publicVisibility === 'hidden' ||
    !isExplicitPublicWidgetType(row.type)
  ) {
    return null;
  }

  let config: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(row.configJson) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      config = parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }

  return {
    id: row.id,
    type: row.type,
    publicVisibility: row.publicVisibility,
    config,
    publicSourceUserId: row.publicSourceUserId ?? null,
  };
}

const FORBIDDEN_PUBLIC_CONFIG_KEYS = new Set([
  'baseurl',
  'endpoint',
  'connectionid',
  'oauthaccountid',
  'publicsourceuserid',
]);

function isForbiddenPublicConfigKey(key: string): boolean {
  const normalized = key.toLowerCase().replaceAll(/[^a-z0-9]/g, '');
  return (
    FORBIDDEN_PUBLIC_CONFIG_KEYS.has(normalized) ||
    normalized.includes('token') ||
    normalized.includes('password') ||
    normalized.includes('secret') ||
    normalized.includes('credential') ||
    normalized.includes('apikey')
  );
}

function projectPublicConfig(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(projectPublicConfig);
  if (!value || typeof value !== 'object') return value;

  const projected: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (isForbiddenPublicConfigKey(key)) continue;
    projected[key] = projectPublicConfig(child);
  }
  return projected;
}

function projectPublicWidget(widget: WidgetView): Omit<WidgetView, 'publicVisibility'> {
  return {
    id: widget.id,
    type: widget.type,
    orderIndex: widget.orderIndex,
    config: projectPublicConfig(widget.config),
    links: widget.links,
  };
}

export function projectPublicDashboard(
  dashboard: DashboardView,
): Omit<DashboardView, 'placeholders'> & {
  placeholders: Array<
    Omit<DashboardView['placeholders'][number], 'widgets'> & {
      widgets: Array<Omit<WidgetView, 'publicVisibility'>>;
    }
  >;
} {
  return {
    ...dashboard,
    placeholders: dashboard.placeholders
      .map((placeholder) => ({
        ...placeholder,
        widgets: placeholder.widgets
          .filter((widget) =>
            isWidgetVisibleInPublicBootstrap(widget.type, widget.publicVisibility),
          )
          .map(projectPublicWidget),
      }))
      .filter((placeholder) => placeholder.widgets.length > 0),
  };
}
