/**
 * Phase R3: Dashboard, Placeholder, Widget, and Link CRUD service.
 *
 * All operations are synchronous (better-sqlite3).
 * Dashboard → Placeholders → Widgets → Links form one aggregate.
 */

import crypto from 'node:crypto';
import { eq, inArray, asc } from 'drizzle-orm';
import { getDb } from '../db/drizzle.js';
import {
  dashboards,
  placeholderWidgets,
  placeholderBreakpointLayouts,
  appWidgetInstances,
  linksListItems,
  uploadedAssets,
  appShellSettings,
} from '../db/schema/index.js';
import { getSqliteDb } from '../db/sqlite.js';
import { Errors } from '../lib/errors.js';
import { invalidatePublicWidgetSnapshot } from './publicWidgetSnapshotCache.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DashboardRow {
  id: string;
  name: string;
  applicability: 'web' | 'mobile' | 'both';
  backgroundType: 'solid' | 'image';
  backgroundColor: string | null;
  backgroundAssetId: string | null;
  backgroundDisplayMode: 'fill' | 'stretch' | null;
  backgroundUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDashboardInput {
  name: string;
  applicability?: 'web' | 'mobile' | 'both';
}

export interface UpdateDashboardInput {
  name?: string;
  applicability?: 'web' | 'mobile' | 'both';
  backgroundType?: 'solid' | 'image';
  backgroundColor?: string | null;
  backgroundAssetId?: string | null;
  backgroundDisplayMode?: 'fill' | 'stretch' | null;
}

export interface PlaceholderRow {
  id: string;
  dashboardId: string;
  stableKey: string;
  x: number;
  y: number;
  w: number;
  h: number;
  borderColor: string;
  borderSize: number;
  showBorder: boolean;
  title: string | null;
  showTitle: boolean;
  titleStyle: string;
  childLayout: string;
  opacity: number;
  backgroundStyle: string;
  backgroundColor: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlaceholderInput {
  x: number;
  y: number;
  w: number;
  h: number;
  borderColor?: string;
  borderSize?: number;
  showBorder?: boolean;
  title?: string | null;
  showTitle?: boolean;
  titleStyle?: string;
  childLayout?: string;
  opacity?: number;
  backgroundStyle?: string;
  backgroundColor?: string | null;
}

export interface UpdatePlaceholderInput {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  borderColor?: string;
  borderSize?: number;
  showBorder?: boolean;
  title?: string | null;
  showTitle?: boolean;
  titleStyle?: string;
  childLayout?: string;
  opacity?: number;
  backgroundStyle?: string;
  backgroundColor?: string | null;
}

export interface WidgetRow {
  id: string;
  placeholderId: string;
  type: string;
  orderIndex: number;
  configJson: string;
  publicVisibility: PublicVisibility;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWidgetInput {
  type: string;
  orderIndex?: number;
  configJson?: string;
  publicVisibility?: PublicVisibility;
}

export interface UpdateWidgetInput {
  type?: string;
  orderIndex?: number;
  configJson?: string;
  publicVisibility?: PublicVisibility;
}

export type PublicVisibility = 'hidden' | 'read-only' | 'visible';

export interface VisibilityChange {
  widgetId: string;
  widgetType: string;
  previousVisibility: PublicVisibility;
  publicVisibility: PublicVisibility;
  actorUserId: string;
}

export interface LinkRow {
  id: string;
  widgetInstanceId: string;
  orderIndex: number;
  title: string;
  url: string;
  iconKey: string | null;
  iconOverrideKey: string | null;
}

export interface CreateLinkInput {
  title: string;
  url: string;
  iconKey?: string | null;
  iconOverrideKey?: string | null;
  orderIndex?: number;
}

export interface UpdateLinkInput {
  title?: string;
  url?: string;
  iconKey?: string | null;
  iconOverrideKey?: string | null;
  orderIndex?: number;
}

/** Full nested dashboard view for read endpoints */
export interface DashboardView {
  id: string;
  name: string;
  applicability: 'web' | 'mobile' | 'both';
  backgroundType: 'solid' | 'image';
  backgroundColor: string | null;
  backgroundUrl: string | null;
  backgroundDisplayMode: 'fill' | 'stretch' | null;
  placeholders: PlaceholderView[];
}

export interface BreakpointLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PlaceholderView {
  id: string;
  stableKey: string;
  x: number;
  y: number;
  w: number;
  h: number;
  borderColor: string;
  borderSize: number;
  showBorder: boolean;
  title: string | null;
  showTitle: boolean;
  titleStyle: string;
  childLayout: string;
  opacity: number;
  backgroundStyle: string;
  backgroundColor: string | null;
  widgets: WidgetView[];
  layouts?: Partial<Record<string, BreakpointLayout>> | undefined;
}

export interface WidgetView {
  id: string;
  type: string;
  orderIndex: number;
  config: unknown;
  publicVisibility: PublicVisibility;
  links: LinkView[];
}

export interface LinkView {
  id: string;
  orderIndex: number;
  title: string;
  url: string;
  iconKey: string | null;
  iconOverrideKey: string | null;
}

// ── Export types ──────────────────────────────────────────────────────────────

export interface DashboardExportLink {
  title: string;
  url: string;
  iconKey: string | null;
  iconOverrideKey: string | null;
  orderIndex: number;
}

export interface DashboardExportWidget {
  type: string;
  orderIndex: number;
  configJson: string;
  links?: DashboardExportLink[];
}

export interface DashboardExportPlaceholder {
  stableKey: string;
  x: number;
  y: number;
  w: number;
  h: number;
  borderColor: string;
  borderSize: number;
  showBorder: boolean;
  title: string | null;
  showTitle: boolean;
  titleStyle: string;
  childLayout: string;
  opacity: number;
  backgroundStyle: string;
  backgroundColor: string | null;
  widgets: DashboardExportWidget[];
  links?: DashboardExportLink[];
}

export interface DashboardExport {
  version: 1 | 2;
  dashboard: {
    name: string;
    applicability: 'web' | 'mobile' | 'both';
    backgroundType: 'solid' | 'image';
    backgroundColor: string | null;
    backgroundDisplayMode: 'fill' | 'stretch' | null;
  };
  placeholders: DashboardExportPlaceholder[];
}

// ── Layout update types ───────────────────────────────────────────────────────

export interface LayoutPlaceholderInput {
  stableKey: string;
  x: number;
  y: number;
  w: number;
  h: number;
  borderColor?: string;
  borderSize?: number;
  showBorder?: boolean;
  title?: string | null;
  showTitle?: boolean;
  titleStyle?: string;
  childLayout?: string;
  opacity?: number;
  backgroundStyle?: string;
  backgroundColor?: string | null;
  widgets?: LayoutWidgetInput[];
  layouts?: Partial<Record<string, BreakpointLayout>>;
}

export interface LayoutWidgetInput {
  id?: string;
  type: string;
  orderIndex: number;
  configJson?: string;
  publicVisibility?: PublicVisibility;
}

export interface VisibilityMutationContext {
  actorUserId: string;
  onVisibilityChange?: (change: VisibilityChange) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sourceUserIdForVisibility(
  publicVisibility: PublicVisibility,
  existingVisibility: PublicVisibility,
  existingSourceUserId: string | null,
  visibilityContext?: VisibilityMutationContext,
): string | null {
  if (publicVisibility === 'hidden') return null;
  if (existingVisibility !== 'hidden' && existingSourceUserId) return existingSourceUserId;
  if (!visibilityContext) {
    throw Errors.validationError('An authenticated actor is required to expose a widget');
  }
  return visibilityContext.actorUserId;
}

function resolveBgUrl(assetId: string | null): string | null {
  if (!assetId) return null;
  const db = getDb();
  const asset = db.select().from(uploadedAssets).where(eq(uploadedAssets.id, assetId)).get();
  return asset ? `/assets/data/${asset.storagePath}` : null;
}

function toDashboardRow(row: typeof dashboards.$inferSelect): DashboardRow {
  return {
    id: row.id,
    name: row.name,
    applicability: row.applicability,
    backgroundType: row.backgroundType,
    backgroundColor: row.backgroundColor ?? null,
    backgroundAssetId: row.backgroundAssetId ?? null,
    backgroundDisplayMode: row.backgroundDisplayMode ?? null,
    backgroundUrl: resolveBgUrl(row.backgroundAssetId ?? null),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ── Dashboard CRUD ────────────────────────────────────────────────────────────

export function listDashboards(): DashboardRow[] {
  const db = getDb();
  const rows = db.select().from(dashboards).orderBy(asc(dashboards.name)).all();
  return rows.map(toDashboardRow);
}

export function createDashboard(input: CreateDashboardInput): DashboardRow {
  const db = getDb();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  db.insert(dashboards)
    .values({
      id,
      name: input.name,
      applicability: input.applicability ?? 'both',
      backgroundType: 'solid',
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return getDashboard(id);
}

export function getDashboard(id: string): DashboardRow {
  const db = getDb();
  const row = db.select().from(dashboards).where(eq(dashboards.id, id)).get();
  if (!row) throw Errors.notFound(`Dashboard not found: ${id}`);
  return toDashboardRow(row);
}

export function getDashboardWithChildren(id: string): DashboardView {
  const db = getDb();
  const dashboard = db.select().from(dashboards).where(eq(dashboards.id, id)).get();
  if (!dashboard) throw Errors.notFound(`Dashboard not found: ${id}`);

  const phRows = db
    .select()
    .from(placeholderWidgets)
    .where(eq(placeholderWidgets.dashboardId, id))
    .orderBy(asc(placeholderWidgets.y), asc(placeholderWidgets.x))
    .all();

  const phIds = phRows.map((p) => p.id);

  // Fetch breakpoint layout overrides for responsive grid
  const bpRows =
    phIds.length > 0
      ? db
          .select()
          .from(placeholderBreakpointLayouts)
          .where(inArray(placeholderBreakpointLayouts.placeholderId, phIds))
          .all()
      : [];
  const bpByPlaceholder = new Map<string, Partial<Record<string, BreakpointLayout>>>();
  for (const bp of bpRows) {
    const map = bpByPlaceholder.get(bp.placeholderId) ?? {};
    map[bp.breakpoint] = { x: bp.x, y: bp.y, w: bp.w, h: bp.h };
    bpByPlaceholder.set(bp.placeholderId, map);
  }
  const widgetRows =
    phIds.length > 0
      ? db
          .select()
          .from(appWidgetInstances)
          .where(inArray(appWidgetInstances.placeholderId, phIds))
          .orderBy(asc(appWidgetInstances.orderIndex))
          .all()
      : [];

  const widgetIds = widgetRows.map((w) => w.id);
  const linkRows =
    widgetIds.length > 0
      ? db
          .select()
          .from(linksListItems)
          .where(inArray(linksListItems.widgetInstanceId, widgetIds))
          .orderBy(asc(linksListItems.orderIndex))
          .all()
      : [];

  // Group links by widgetInstanceId
  const linksByWidget = new Map<string, LinkView[]>();
  for (const l of linkRows) {
    const arr = linksByWidget.get(l.widgetInstanceId) ?? [];
    arr.push({
      id: l.id,
      orderIndex: l.orderIndex,
      title: l.title,
      url: l.url,
      iconKey: l.iconKey ?? null,
      iconOverrideKey: l.iconOverrideKey ?? null,
    });
    linksByWidget.set(l.widgetInstanceId, arr);
  }

  // Group widgets by placeholderId
  const widgetsByPh = new Map<string, WidgetView[]>();
  for (const w of widgetRows) {
    const arr = widgetsByPh.get(w.placeholderId) ?? [];
    let config: unknown = {};
    try {
      config = JSON.parse(w.configJson);
    } catch {
      /* keep default */
    }
    arr.push({
      id: w.id,
      type: w.type,
      orderIndex: w.orderIndex,
      config,
      publicVisibility: w.publicVisibility,
      links: linksByWidget.get(w.id) ?? [],
    });
    widgetsByPh.set(w.placeholderId, arr);
  }

  const placeholderViews: PlaceholderView[] = phRows.map((p) => ({
    id: p.id,
    stableKey: p.stableKey,
    x: p.x,
    y: p.y,
    w: p.w,
    h: p.h,
    borderColor: p.borderColor,
    borderSize: p.borderSize,
    showBorder: p.showBorder,
    title: p.title ?? null,
    showTitle: p.showTitle,
    titleStyle: p.titleStyle,
    childLayout: p.childLayout,
    opacity: p.opacity,
    backgroundStyle: p.backgroundStyle,
    backgroundColor: p.backgroundColor ?? null,
    widgets: widgetsByPh.get(p.id) ?? [],
    layouts: bpByPlaceholder.get(p.id),
  }));
  return {
    id: dashboard.id,
    name: dashboard.name,
    applicability: dashboard.applicability,
    backgroundType: dashboard.backgroundType,
    backgroundColor: dashboard.backgroundColor ?? null,
    backgroundUrl: resolveBgUrl(dashboard.backgroundAssetId ?? null),
    backgroundDisplayMode: dashboard.backgroundDisplayMode ?? null,
    placeholders: placeholderViews,
  };
}

// ── Dashboard Export ──────────────────────────────────────────────────────────

export function exportDashboard(id: string): DashboardExport {
  const db = getDb();
  const dashboard = db.select().from(dashboards).where(eq(dashboards.id, id)).get();
  if (!dashboard) throw Errors.notFound(`Dashboard not found: ${id}`);

  const phRows = db
    .select()
    .from(placeholderWidgets)
    .where(eq(placeholderWidgets.dashboardId, id))
    .orderBy(asc(placeholderWidgets.y), asc(placeholderWidgets.x))
    .all();

  const phIds = phRows.map((p) => p.id);
  const widgetRows =
    phIds.length > 0
      ? db
          .select()
          .from(appWidgetInstances)
          .where(inArray(appWidgetInstances.placeholderId, phIds))
          .orderBy(asc(appWidgetInstances.orderIndex))
          .all()
      : [];

  const widgetIds = widgetRows.map((w) => w.id);
  const linkRows =
    widgetIds.length > 0
      ? db
          .select()
          .from(linksListItems)
          .where(inArray(linksListItems.widgetInstanceId, widgetIds))
          .orderBy(asc(linksListItems.orderIndex))
          .all()
      : [];

  // Group links by widgetInstanceId
  const linksByWidget = new Map<string, DashboardExportLink[]>();
  for (const l of linkRows) {
    const arr = linksByWidget.get(l.widgetInstanceId) ?? [];
    arr.push({
      title: l.title,
      url: l.url,
      iconKey: l.iconKey ?? null,
      iconOverrideKey: l.iconOverrideKey ?? null,
      orderIndex: l.orderIndex,
    });
    linksByWidget.set(l.widgetInstanceId, arr);
  }

  // Group widgets by placeholderId with per-widget links (v2 format)
  const widgetsByPh = new Map<string, DashboardExportWidget[]>();
  for (const w of widgetRows) {
    const wArr = widgetsByPh.get(w.placeholderId) ?? [];
    const wLinks = linksByWidget.get(w.id);
    wArr.push({
      type: w.type,
      orderIndex: w.orderIndex,
      configJson: w.configJson,
      ...(wLinks && wLinks.length > 0 ? { links: wLinks } : {}),
    });
    widgetsByPh.set(w.placeholderId, wArr);
  }

  const placeholders: DashboardExportPlaceholder[] = phRows.map((p) => ({
    stableKey: p.stableKey,
    x: p.x,
    y: p.y,
    w: p.w,
    h: p.h,
    borderColor: p.borderColor,
    borderSize: p.borderSize,
    showBorder: p.showBorder,
    title: p.title ?? null,
    showTitle: p.showTitle,
    titleStyle: p.titleStyle,
    childLayout: p.childLayout,
    opacity: p.opacity,
    backgroundStyle: p.backgroundStyle,
    backgroundColor: p.backgroundColor ?? null,
    widgets: widgetsByPh.get(p.id) ?? [],
  }));

  return {
    version: 2,
    dashboard: {
      name: dashboard.name,
      applicability: dashboard.applicability,
      backgroundType: dashboard.backgroundType,
      backgroundColor: dashboard.backgroundColor ?? null,
      backgroundDisplayMode: dashboard.backgroundDisplayMode ?? null,
    },
    placeholders,
  };
}

// ── Dashboard Import ─────────────────────────────────────────────────────────

export function importDashboard(payload: DashboardExport, overrideName?: string): DashboardRow {
  const db = getDb();
  const sqlite = getSqliteDb();
  const now = new Date().toISOString();
  const dashboardId = crypto.randomUUID();
  const name = overrideName ?? payload.dashboard.name;

  // Downgrade backgroundType 'image' to 'solid' since assets can't be exported
  const backgroundType =
    payload.dashboard.backgroundType === 'image' ? 'solid' : payload.dashboard.backgroundType;

  sqlite.transaction(() => {
    db.insert(dashboards)
      .values({
        id: dashboardId,
        name,
        applicability: payload.dashboard.applicability,
        backgroundType,
        backgroundColor: backgroundType === 'solid' ? payload.dashboard.backgroundColor : null,
        backgroundDisplayMode:
          backgroundType === 'solid' ? null : payload.dashboard.backgroundDisplayMode,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    for (const ph of payload.placeholders) {
      const phId = crypto.randomUUID();
      db.insert(placeholderWidgets)
        .values({
          id: phId,
          dashboardId,
          stableKey: ph.stableKey,
          x: ph.x,
          y: ph.y,
          w: ph.w,
          h: ph.h,
          borderColor: ph.borderColor,
          borderSize: ph.borderSize ?? 2,
          showBorder: ph.showBorder,
          title: ph.title,
          showTitle: ph.showTitle ?? false,
          titleStyle: ph.titleStyle ?? 'header',
          childLayout: ph.childLayout ?? 'stacked',
          opacity: ph.opacity,
          backgroundStyle: ph.backgroundStyle ?? 'solid',
          backgroundColor: ph.backgroundColor ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      let linksTargetWidgetId: string | null = null;

      for (const w of ph.widgets) {
        const wId = crypto.randomUUID();
        db.insert(appWidgetInstances)
          .values({
            id: wId,
            placeholderId: phId,
            type: w.type,
            orderIndex: w.orderIndex,
            configJson: w.configJson,
            createdAt: now,
            updatedAt: now,
          })
          .run();

        // v2 format: links are per-widget
        if (w.links && w.links.length > 0) {
          for (const link of w.links) {
            db.insert(linksListItems)
              .values({
                id: crypto.randomUUID(),
                widgetInstanceId: wId,
                orderIndex: link.orderIndex,
                title: link.title,
                url: link.url,
                iconKey: link.iconKey,
                iconOverrideKey: link.iconOverrideKey ?? null,
              })
              .run();
          }
        }

        if (w.type === 'links_list' && !linksTargetWidgetId) {
          linksTargetWidgetId = wId;
        }
      }

      // v1 fallback: links at placeholder level → assign to first links_list widget
      const phLinks = ph.links ?? [];
      if (phLinks.length > 0) {
        // Create a links_list widget if none was provided
        if (!linksTargetWidgetId) {
          const wId = crypto.randomUUID();
          db.insert(appWidgetInstances)
            .values({
              id: wId,
              placeholderId: phId,
              type: 'links_list',
              orderIndex: ph.widgets.length,
              configJson: '{}',
              createdAt: now,
              updatedAt: now,
            })
            .run();
          linksTargetWidgetId = wId;
        }

        for (const link of phLinks) {
          db.insert(linksListItems)
            .values({
              id: crypto.randomUUID(),
              widgetInstanceId: linksTargetWidgetId,
              orderIndex: link.orderIndex,
              title: link.title,
              url: link.url,
              iconKey: link.iconKey,
              iconOverrideKey: link.iconOverrideKey ?? null,
            })
            .run();
        }
      }
    }
  })();

  return getDashboard(dashboardId);
}

// ── Dashboard Duplication ────────────────────────────────────────────────────

/**
 * Generate a unique copy name from a source name and existing dashboard names.
 * "Foo" → "Foo (Copy)", "Foo (Copy)" → "Foo (Copy 2)", etc.
 * Truncates the base name if the result would exceed 128 chars.
 */
export function generateCopyName(sourceName: string, existingNames: string[]): string {
  const MAX_LENGTH = 128;

  // Strip trailing " (Copy)" or " (Copy N)" to get the base name
  const base = sourceName.replace(/\s+\(Copy(?:\s+\d+)?\)$/, '');

  const suffix = ' (Copy)';
  const candidate = truncateForSuffix(base, suffix, MAX_LENGTH);
  if (!existingNames.includes(candidate)) return candidate;

  // Find next available numeric suffix
  let n = 2;
  while (n < 10000) {
    const numSuffix = ` (Copy ${n})`;
    const numCandidate = truncateForSuffix(base, numSuffix, MAX_LENGTH);
    if (!existingNames.includes(numCandidate)) return numCandidate;
    n++;
  }

  // Fallback (should never happen)
  return `${base.slice(0, MAX_LENGTH - 20)} (Copy ${Date.now()})`;
}

function truncateForSuffix(base: string, suffix: string, maxLen: number): string {
  if (base.length + suffix.length <= maxLen) return base + suffix;
  return base.slice(0, maxLen - suffix.length) + suffix;
}

/**
 * Duplicate a dashboard with all its placeholders, widgets, and links.
 * Preserves backgroundAssetId (unlike export which drops it).
 */
export function duplicateDashboard(sourceId: string): DashboardRow {
  const db = getDb();
  const sqlite = getSqliteDb();

  // Load the source dashboard
  const source = db.select().from(dashboards).where(eq(dashboards.id, sourceId)).get();
  if (!source) throw Errors.notFound(`Dashboard not found: ${sourceId}`);

  // Generate a unique copy name
  const allNames = db
    .select({ name: dashboards.name })
    .from(dashboards)
    .all()
    .map((r) => r.name);
  const copyName = generateCopyName(source.name, allNames);

  // Load full tree
  const exported = exportDashboard(sourceId);

  const now = new Date().toISOString();
  const newId = crypto.randomUUID();

  sqlite.transaction(() => {
    db.insert(dashboards)
      .values({
        id: newId,
        name: copyName,
        applicability: source.applicability,
        backgroundType: source.backgroundType,
        backgroundColor: source.backgroundColor,
        backgroundAssetId: source.backgroundAssetId,
        backgroundDisplayMode: source.backgroundDisplayMode,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    for (const ph of exported.placeholders) {
      const phId = crypto.randomUUID();
      db.insert(placeholderWidgets)
        .values({
          id: phId,
          dashboardId: newId,
          stableKey: crypto.randomUUID(),
          x: ph.x,
          y: ph.y,
          w: ph.w,
          h: ph.h,
          borderColor: ph.borderColor,
          borderSize: ph.borderSize ?? 2,
          showBorder: ph.showBorder,
          title: ph.title,
          showTitle: ph.showTitle ?? false,
          titleStyle: ph.titleStyle ?? 'header',
          childLayout: ph.childLayout ?? 'stacked',
          opacity: ph.opacity,
          backgroundStyle: ph.backgroundStyle ?? 'solid',
          backgroundColor: ph.backgroundColor ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      let linksTargetWidgetId: string | null = null;

      for (const w of ph.widgets) {
        const wId = crypto.randomUUID();
        db.insert(appWidgetInstances)
          .values({
            id: wId,
            placeholderId: phId,
            type: w.type,
            orderIndex: w.orderIndex,
            configJson: w.configJson,
            createdAt: now,
            updatedAt: now,
          })
          .run();

        // v2: per-widget links
        if (w.links && w.links.length > 0) {
          for (const link of w.links) {
            db.insert(linksListItems)
              .values({
                id: crypto.randomUUID(),
                widgetInstanceId: wId,
                orderIndex: link.orderIndex,
                title: link.title,
                url: link.url,
                iconKey: link.iconKey,
                iconOverrideKey: link.iconOverrideKey ?? null,
              })
              .run();
          }
        }

        if (w.type === 'links_list' && !linksTargetWidgetId) {
          linksTargetWidgetId = wId;
        }
      }

      // v1 fallback: placeholder-level links
      const phLinks = ph.links ?? [];
      if (phLinks.length > 0) {
        if (!linksTargetWidgetId) {
          const wId = crypto.randomUUID();
          db.insert(appWidgetInstances)
            .values({
              id: wId,
              placeholderId: phId,
              type: 'links_list',
              orderIndex: ph.widgets.length,
              configJson: '{}',
              createdAt: now,
              updatedAt: now,
            })
            .run();
          linksTargetWidgetId = wId;
        }

        for (const link of phLinks) {
          db.insert(linksListItems)
            .values({
              id: crypto.randomUUID(),
              widgetInstanceId: linksTargetWidgetId,
              orderIndex: link.orderIndex,
              title: link.title,
              url: link.url,
              iconKey: link.iconKey,
              iconOverrideKey: link.iconOverrideKey ?? null,
            })
            .run();
        }
      }
    }
  })();

  return getDashboard(newId);
}

export function updateDashboard(id: string, input: UpdateDashboardInput): DashboardRow {
  const db = getDb();
  const existing = db.select().from(dashboards).where(eq(dashboards.id, id)).get();
  if (!existing) throw Errors.notFound(`Dashboard not found: ${id}`);

  // Enforce background invariants
  const bgType = input.backgroundType ?? existing.backgroundType;
  if (bgType === 'solid') {
    // Clear image fields when switching to solid
    if (input.backgroundType === 'solid') {
      input.backgroundAssetId = null;
      input.backgroundDisplayMode = null;
    }
  } else if (bgType === 'image') {
    const assetId = input.backgroundAssetId ?? existing.backgroundAssetId;
    if (!assetId) {
      throw Errors.validationError('backgroundAssetId is required when backgroundType is image');
    }
    const displayMode = input.backgroundDisplayMode ?? existing.backgroundDisplayMode;
    if (!displayMode) {
      // Default to 'fill' if not set
      input.backgroundDisplayMode = 'fill';
    }
  }

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { updatedAt: now };

  if (input.name !== undefined) updates['name'] = input.name;
  if (input.applicability !== undefined) updates['applicability'] = input.applicability;
  if (input.backgroundType !== undefined) updates['backgroundType'] = input.backgroundType;
  if (input.backgroundColor !== undefined) updates['backgroundColor'] = input.backgroundColor;
  if (input.backgroundAssetId !== undefined) updates['backgroundAssetId'] = input.backgroundAssetId;
  if (input.backgroundDisplayMode !== undefined)
    updates['backgroundDisplayMode'] = input.backgroundDisplayMode;

  db.update(dashboards).set(updates).where(eq(dashboards.id, id)).run();

  return getDashboard(id);
}

export function deleteDashboard(id: string): { deleted: boolean; impact: string[] } {
  const db = getDb();
  const existing = db.select().from(dashboards).where(eq(dashboards.id, id)).get();
  if (!existing) throw Errors.notFound(`Dashboard not found: ${id}`);

  // Cascade delete handles placeholders→widgets→links automatically.
  // Shell settings and user_preferences FK refs use onDelete: set null.
  // Report what was affected so UI can warn.
  const impact: string[] = [];

  const shell = db.select().from(appShellSettings).where(eq(appShellSettings.id, 'global')).get();
  if (shell?.unauthWebDashboardId === id)
    impact.push('Was the default web dashboard for unauthenticated users');
  if (shell?.unauthMobileDashboardId === id)
    impact.push('Was the default mobile dashboard for unauthenticated users');

  db.delete(dashboards).where(eq(dashboards.id, id)).run();

  return { deleted: true, impact };
}

// ── Layout Update (diff/upsert by stableKey) ─────────────────────────────────

export function updateLayout(
  dashboardId: string,
  placeholderInputs: LayoutPlaceholderInput[],
  visibilityContext?: VisibilityMutationContext,
): DashboardView {
  const db = getDb();
  const sqlite = getSqliteDb();
  const existing = db.select().from(dashboards).where(eq(dashboards.id, dashboardId)).get();
  if (!existing) throw Errors.notFound(`Dashboard not found: ${dashboardId}`);

  const now = new Date().toISOString();
  const visibilityChanges: VisibilityChange[] = [];
  const transactionVisibilityContext = visibilityContext
    ? {
        actorUserId: visibilityContext.actorUserId,
        onVisibilityChange: (change: VisibilityChange) => visibilityChanges.push(change),
      }
    : undefined;

  // Run the entire layout update in a transaction
  sqlite.transaction(() => {
    // Get existing placeholders keyed by stableKey
    const existingPhs = db
      .select()
      .from(placeholderWidgets)
      .where(eq(placeholderWidgets.dashboardId, dashboardId))
      .all();
    const existingByKey = new Map(existingPhs.map((p) => [p.stableKey, p]));
    const incomingKeys = new Set(placeholderInputs.map((p) => p.stableKey));

    // Delete placeholders not in the new layout (cascades widgets+links)
    for (const existing of existingPhs) {
      if (!incomingKeys.has(existing.stableKey)) {
        db.delete(placeholderWidgets).where(eq(placeholderWidgets.id, existing.id)).run();
      }
    }

    // Upsert placeholders
    for (const phInput of placeholderInputs) {
      const existingPh = existingByKey.get(phInput.stableKey);

      if (existingPh) {
        // Update existing placeholder in place
        db.update(placeholderWidgets)
          .set({
            x: phInput.x,
            y: phInput.y,
            w: phInput.w,
            h: phInput.h,
            borderColor: phInput.borderColor ?? existingPh.borderColor,
            borderSize: phInput.borderSize ?? existingPh.borderSize,
            showBorder: phInput.showBorder ?? existingPh.showBorder,
            title: phInput.title !== undefined ? phInput.title : existingPh.title,
            showTitle: phInput.showTitle !== undefined ? phInput.showTitle : existingPh.showTitle,
            titleStyle: phInput.titleStyle ?? existingPh.titleStyle,
            childLayout: phInput.childLayout ?? existingPh.childLayout,
            opacity: phInput.opacity ?? existingPh.opacity,
            backgroundStyle: phInput.backgroundStyle ?? existingPh.backgroundStyle,
            backgroundColor:
              phInput.backgroundColor !== undefined
                ? phInput.backgroundColor
                : existingPh.backgroundColor,
            updatedAt: now,
          })
          .where(eq(placeholderWidgets.id, existingPh.id))
          .run();

        // Handle widgets if provided
        if (phInput.widgets) {
          syncWidgetsForPlaceholder(
            existingPh.id,
            phInput.widgets,
            now,
            transactionVisibilityContext,
          );
        }

        // Handle breakpoint layouts if provided
        if (phInput.layouts) {
          syncBreakpointLayouts(existingPh.id, phInput.layouts, now);
        }
      } else {
        // Insert new placeholder
        const phId = crypto.randomUUID();
        db.insert(placeholderWidgets)
          .values({
            id: phId,
            dashboardId,
            stableKey: phInput.stableKey,
            x: phInput.x,
            y: phInput.y,
            w: phInput.w,
            h: phInput.h,
            borderColor: phInput.borderColor ?? '#ffffff',
            borderSize: phInput.borderSize ?? 2,
            showBorder: phInput.showBorder ?? true,
            title: phInput.title ?? null,
            showTitle: phInput.showTitle ?? false,
            titleStyle: phInput.titleStyle ?? 'header',
            childLayout: phInput.childLayout ?? 'stacked',
            opacity: phInput.opacity ?? 0.3,
            backgroundStyle: phInput.backgroundStyle ?? 'solid',
            backgroundColor: phInput.backgroundColor ?? null,
            createdAt: now,
            updatedAt: now,
          })
          .run();

        // Insert widgets if provided
        if (phInput.widgets) {
          for (const wInput of phInput.widgets) {
            const widgetId = wInput.id ?? crypto.randomUUID();
            const publicVisibility = wInput.publicVisibility ?? 'hidden';
            db.insert(appWidgetInstances)
              .values({
                id: widgetId,
                placeholderId: phId,
                type: wInput.type,
                orderIndex: wInput.orderIndex,
                configJson: wInput.configJson ?? '{}',
                publicVisibility,
                publicSourceUserId: sourceUserIdForVisibility(
                  publicVisibility,
                  'hidden',
                  null,
                  transactionVisibilityContext,
                ),
                createdAt: now,
                updatedAt: now,
              })
              .run();
            if (publicVisibility !== 'hidden' && transactionVisibilityContext) {
              transactionVisibilityContext.onVisibilityChange?.({
                widgetId,
                widgetType: wInput.type,
                previousVisibility: 'hidden',
                publicVisibility,
                actorUserId: transactionVisibilityContext.actorUserId,
              });
            }
          }
        }

        // Insert breakpoint layouts if provided
        if (phInput.layouts) {
          syncBreakpointLayouts(phId, phInput.layouts, now);
        }
      }
    }
  })();

  for (const change of visibilityChanges) {
    invalidatePublicWidgetSnapshot(change.widgetId);
    visibilityContext?.onVisibilityChange?.(change);
  }
  for (const placeholder of placeholderInputs) {
    for (const widget of placeholder.widgets ?? []) {
      if (widget.id) invalidatePublicWidgetSnapshot(widget.id);
    }
  }

  return getDashboardWithChildren(dashboardId);
}

function syncWidgetsForPlaceholder(
  placeholderId: string,
  widgetInputs: LayoutWidgetInput[],
  now: string,
  visibilityContext?: VisibilityMutationContext,
): void {
  const db = getDb();

  // Get existing widgets for this placeholder
  const existingWidgets = db
    .select()
    .from(appWidgetInstances)
    .where(eq(appWidgetInstances.placeholderId, placeholderId))
    .all();
  const existingById = new Map(existingWidgets.map((w) => [w.id, w]));
  const incomingIds = new Set(widgetInputs.filter((w) => w.id).map((w) => w.id!));

  // Delete widgets not in input
  for (const w of existingWidgets) {
    if (!incomingIds.has(w.id)) {
      db.delete(appWidgetInstances).where(eq(appWidgetInstances.id, w.id)).run();
    }
  }

  // Upsert widgets
  for (const wInput of widgetInputs) {
    if (wInput.id && existingById.has(wInput.id)) {
      const existingWidget = existingById.get(wInput.id)!;
      const nextVisibility = wInput.publicVisibility ?? existingWidget.publicVisibility;
      db.update(appWidgetInstances)
        .set({
          type: wInput.type,
          orderIndex: wInput.orderIndex,
          configJson: wInput.configJson ?? existingWidget.configJson,
          publicVisibility: nextVisibility,
          publicSourceUserId: sourceUserIdForVisibility(
            nextVisibility,
            existingWidget.publicVisibility,
            existingWidget.publicSourceUserId,
            wInput.publicVisibility !== undefined ? visibilityContext : undefined,
          ),
          updatedAt: now,
        })
        .where(eq(appWidgetInstances.id, wInput.id))
        .run();
      if (
        wInput.publicVisibility !== undefined &&
        nextVisibility !== existingWidget.publicVisibility &&
        visibilityContext
      ) {
        visibilityContext.onVisibilityChange?.({
          widgetId: wInput.id,
          widgetType: wInput.type,
          previousVisibility: existingWidget.publicVisibility,
          publicVisibility: nextVisibility,
          actorUserId: visibilityContext.actorUserId,
        });
      }
    } else {
      const publicVisibility = wInput.publicVisibility ?? 'hidden';
      const widgetId = wInput.id ?? crypto.randomUUID();
      db.insert(appWidgetInstances)
        .values({
          id: widgetId,
          placeholderId,
          type: wInput.type,
          orderIndex: wInput.orderIndex,
          configJson: wInput.configJson ?? '{}',
          publicVisibility,
          publicSourceUserId: sourceUserIdForVisibility(
            publicVisibility,
            'hidden',
            null,
            visibilityContext,
          ),
          createdAt: now,
          updatedAt: now,
        })
        .run();
      if (publicVisibility !== 'hidden' && visibilityContext) {
        visibilityContext.onVisibilityChange?.({
          widgetId,
          widgetType: wInput.type,
          previousVisibility: 'hidden',
          publicVisibility,
          actorUserId: visibilityContext.actorUserId,
        });
      }
    }
  }
}

function syncBreakpointLayouts(
  placeholderId: string,
  layouts: Partial<Record<string, BreakpointLayout>>,
  now: string,
): void {
  const db = getDb();
  const validBreakpoints = ['md', 'sm', 'xs', 'xxs'];

  for (const [bp, layout] of Object.entries(layouts)) {
    if (!validBreakpoints.includes(bp) || !layout) continue;

    // Upsert: try update first, insert if not exists
    const existing = db
      .select()
      .from(placeholderBreakpointLayouts)
      .where(eq(placeholderBreakpointLayouts.placeholderId, placeholderId))
      .all()
      .find((r) => r.breakpoint === bp);

    if (existing) {
      db.update(placeholderBreakpointLayouts)
        .set({ x: layout.x, y: layout.y, w: layout.w, h: layout.h, updatedAt: now })
        .where(eq(placeholderBreakpointLayouts.id, existing.id))
        .run();
    } else {
      db.insert(placeholderBreakpointLayouts)
        .values({
          id: crypto.randomUUID(),
          placeholderId,
          breakpoint: bp,
          x: layout.x,
          y: layout.y,
          w: layout.w,
          h: layout.h,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }
  }
}

// ── Placeholder CRUD ──────────────────────────────────────────────────────────

export function createPlaceholder(
  dashboardId: string,
  input: CreatePlaceholderInput,
): PlaceholderRow {
  const db = getDb();
  // Verify dashboard exists
  const dashboard = db.select().from(dashboards).where(eq(dashboards.id, dashboardId)).get();
  if (!dashboard) throw Errors.notFound(`Dashboard not found: ${dashboardId}`);

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const stableKey = crypto.randomUUID();

  db.insert(placeholderWidgets)
    .values({
      id,
      dashboardId,
      stableKey,
      x: input.x,
      y: input.y,
      w: input.w,
      h: input.h,
      borderColor: input.borderColor ?? '#ffffff',
      borderSize: input.borderSize ?? 2,
      showBorder: input.showBorder ?? true,
      title: input.title ?? null,
      showTitle: input.showTitle ?? false,
      titleStyle: input.titleStyle ?? 'header',
      childLayout: input.childLayout ?? 'stacked',
      opacity: input.opacity ?? 0.3,
      backgroundStyle: input.backgroundStyle ?? 'solid',
      backgroundColor: input.backgroundColor ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return getPlaceholder(id);
}

export function getPlaceholder(id: string): PlaceholderRow {
  const db = getDb();
  const row = db.select().from(placeholderWidgets).where(eq(placeholderWidgets.id, id)).get();
  if (!row) throw Errors.notFound(`Placeholder not found: ${id}`);
  return {
    id: row.id,
    dashboardId: row.dashboardId,
    stableKey: row.stableKey,
    x: row.x,
    y: row.y,
    w: row.w,
    h: row.h,
    borderColor: row.borderColor,
    borderSize: row.borderSize,
    showBorder: row.showBorder,
    title: row.title ?? null,
    showTitle: row.showTitle,
    titleStyle: row.titleStyle,
    childLayout: row.childLayout,
    opacity: row.opacity,
    backgroundStyle: row.backgroundStyle,
    backgroundColor: row.backgroundColor ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function updatePlaceholder(id: string, input: UpdatePlaceholderInput): PlaceholderRow {
  const db = getDb();
  const existing = db.select().from(placeholderWidgets).where(eq(placeholderWidgets.id, id)).get();
  if (!existing) throw Errors.notFound(`Placeholder not found: ${id}`);

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { updatedAt: now };

  if (input.x !== undefined) updates['x'] = input.x;
  if (input.y !== undefined) updates['y'] = input.y;
  if (input.w !== undefined) updates['w'] = input.w;
  if (input.h !== undefined) updates['h'] = input.h;
  if (input.borderColor !== undefined) updates['borderColor'] = input.borderColor;
  if (input.borderSize !== undefined) updates['borderSize'] = input.borderSize;
  if (input.showBorder !== undefined) updates['showBorder'] = input.showBorder;
  if (input.title !== undefined) updates['title'] = input.title;
  if (input.showTitle !== undefined) updates['showTitle'] = input.showTitle;
  if (input.titleStyle !== undefined) updates['titleStyle'] = input.titleStyle;
  if (input.childLayout !== undefined) updates['childLayout'] = input.childLayout;
  if (input.opacity !== undefined) updates['opacity'] = input.opacity;
  if (input.backgroundStyle !== undefined) updates['backgroundStyle'] = input.backgroundStyle;
  if (input.backgroundColor !== undefined) updates['backgroundColor'] = input.backgroundColor;

  db.update(placeholderWidgets).set(updates).where(eq(placeholderWidgets.id, id)).run();
  return getPlaceholder(id);
}

export function deletePlaceholder(id: string): void {
  const db = getDb();
  const existing = db.select().from(placeholderWidgets).where(eq(placeholderWidgets.id, id)).get();
  if (!existing) throw Errors.notFound(`Placeholder not found: ${id}`);
  db.delete(placeholderWidgets).where(eq(placeholderWidgets.id, id)).run();
}

// ── Widget CRUD ───────────────────────────────────────────────────────────────

export function createWidget(
  placeholderId: string,
  input: CreateWidgetInput,
  visibilityContext?: VisibilityMutationContext,
): WidgetRow {
  const db = getDb();
  const ph = db
    .select()
    .from(placeholderWidgets)
    .where(eq(placeholderWidgets.id, placeholderId))
    .get();
  if (!ph) throw Errors.notFound(`Placeholder not found: ${placeholderId}`);

  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  // Auto-assign orderIndex if not provided
  let orderIndex = input.orderIndex ?? 0;
  if (input.orderIndex === undefined) {
    const maxRow = db
      .select()
      .from(appWidgetInstances)
      .where(eq(appWidgetInstances.placeholderId, placeholderId))
      .orderBy(asc(appWidgetInstances.orderIndex))
      .all();
    orderIndex = maxRow.length > 0 ? maxRow[maxRow.length - 1]!.orderIndex + 1 : 0;
  }

  db.insert(appWidgetInstances)
    .values({
      id,
      placeholderId,
      type: input.type,
      orderIndex,
      configJson: input.configJson ?? '{}',
      publicVisibility: input.publicVisibility ?? 'hidden',
      publicSourceUserId: sourceUserIdForVisibility(
        input.publicVisibility ?? 'hidden',
        'hidden',
        null,
        visibilityContext,
      ),
      createdAt: now,
      updatedAt: now,
    })
    .run();

  if (input.publicVisibility && input.publicVisibility !== 'hidden' && visibilityContext) {
    visibilityContext.onVisibilityChange?.({
      widgetId: id,
      widgetType: input.type,
      previousVisibility: 'hidden',
      publicVisibility: input.publicVisibility,
      actorUserId: visibilityContext.actorUserId,
    });
  }

  invalidatePublicWidgetSnapshot(id);
  return getWidget(id);
}

export function getWidget(id: string): WidgetRow {
  const db = getDb();
  const row = db.select().from(appWidgetInstances).where(eq(appWidgetInstances.id, id)).get();
  if (!row) throw Errors.notFound(`Widget not found: ${id}`);
  return {
    id: row.id,
    placeholderId: row.placeholderId,
    type: row.type,
    orderIndex: row.orderIndex,
    configJson: row.configJson,
    publicVisibility: row.publicVisibility,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function updateWidget(
  id: string,
  input: UpdateWidgetInput,
  visibilityContext?: VisibilityMutationContext,
): WidgetRow {
  const db = getDb();
  const existing = db.select().from(appWidgetInstances).where(eq(appWidgetInstances.id, id)).get();
  if (!existing) throw Errors.notFound(`Widget not found: ${id}`);

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { updatedAt: now };

  if (input.type !== undefined) updates['type'] = input.type;
  if (input.orderIndex !== undefined) updates['orderIndex'] = input.orderIndex;
  if (input.configJson !== undefined) updates['configJson'] = input.configJson;
  if (input.publicVisibility !== undefined) {
    updates['publicVisibility'] = input.publicVisibility;
    updates['publicSourceUserId'] = sourceUserIdForVisibility(
      input.publicVisibility,
      existing.publicVisibility,
      existing.publicSourceUserId,
      visibilityContext,
    );
  }

  db.update(appWidgetInstances).set(updates).where(eq(appWidgetInstances.id, id)).run();
  if (input.configJson !== undefined || input.publicVisibility !== undefined) {
    invalidatePublicWidgetSnapshot(id);
  }
  if (
    input.publicVisibility !== undefined &&
    input.publicVisibility !== existing.publicVisibility &&
    visibilityContext
  ) {
    visibilityContext.onVisibilityChange?.({
      widgetId: id,
      widgetType: input.type ?? existing.type,
      previousVisibility: existing.publicVisibility,
      publicVisibility: input.publicVisibility,
      actorUserId: visibilityContext.actorUserId,
    });
  }
  return getWidget(id);
}

export function deleteWidget(id: string): void {
  const db = getDb();
  const existing = db.select().from(appWidgetInstances).where(eq(appWidgetInstances.id, id)).get();
  if (!existing) throw Errors.notFound(`Widget not found: ${id}`);
  db.delete(appWidgetInstances).where(eq(appWidgetInstances.id, id)).run();
  invalidatePublicWidgetSnapshot(id);
}

export function reorderWidgets(placeholderId: string, orderedIds: string[]): WidgetRow[] {
  const db = getDb();
  const sqlite = getSqliteDb();

  // Verify placeholder exists
  const ph = db
    .select()
    .from(placeholderWidgets)
    .where(eq(placeholderWidgets.id, placeholderId))
    .get();
  if (!ph) throw Errors.notFound(`Placeholder not found: ${placeholderId}`);

  // Get existing widgets
  const existing = db
    .select()
    .from(appWidgetInstances)
    .where(eq(appWidgetInstances.placeholderId, placeholderId))
    .all();
  const existingIds = new Set(existing.map((w) => w.id));

  // Validate exact set match
  if (orderedIds.length !== existingIds.size) {
    throw Errors.validationError(
      'orderedIds must contain exactly all widget IDs for this placeholder',
    );
  }
  for (const id of orderedIds) {
    if (!existingIds.has(id)) {
      throw Errors.validationError(`Widget ${id} does not belong to placeholder ${placeholderId}`);
    }
  }
  if (new Set(orderedIds).size !== orderedIds.length) {
    throw Errors.validationError('orderedIds must not contain duplicates');
  }

  const now = new Date().toISOString();
  sqlite.transaction(() => {
    for (let i = 0; i < orderedIds.length; i++) {
      db.update(appWidgetInstances)
        .set({ orderIndex: i, updatedAt: now })
        .where(eq(appWidgetInstances.id, orderedIds[i]!))
        .run();
    }
  })();

  return db
    .select()
    .from(appWidgetInstances)
    .where(eq(appWidgetInstances.placeholderId, placeholderId))
    .orderBy(asc(appWidgetInstances.orderIndex))
    .all()
    .map((r) => ({
      id: r.id,
      placeholderId: r.placeholderId,
      type: r.type,
      orderIndex: r.orderIndex,
      configJson: r.configJson,
      publicVisibility: r.publicVisibility,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
}

// ── Link CRUD ─────────────────────────────────────────────────────────────────

export function createLink(widgetId: string, input: CreateLinkInput): LinkRow {
  const db = getDb();
  const widget = db
    .select()
    .from(appWidgetInstances)
    .where(eq(appWidgetInstances.id, widgetId))
    .get();
  if (!widget) throw Errors.notFound(`Widget not found: ${widgetId}`);

  const id = crypto.randomUUID();

  // Auto-assign orderIndex
  let orderIndex = input.orderIndex ?? 0;
  if (input.orderIndex === undefined) {
    const existing = db
      .select()
      .from(linksListItems)
      .where(eq(linksListItems.widgetInstanceId, widgetId))
      .orderBy(asc(linksListItems.orderIndex))
      .all();
    orderIndex = existing.length > 0 ? existing[existing.length - 1]!.orderIndex + 1 : 0;
  }

  db.insert(linksListItems)
    .values({
      id,
      widgetInstanceId: widgetId,
      orderIndex,
      title: input.title,
      url: input.url,
      iconKey: input.iconKey ?? null,
      iconOverrideKey: input.iconOverrideKey ?? null,
    })
    .run();

  return getLink(id);
}

export function getLink(id: string): LinkRow {
  const db = getDb();
  const row = db.select().from(linksListItems).where(eq(linksListItems.id, id)).get();
  if (!row) throw Errors.notFound(`Link not found: ${id}`);
  return {
    id: row.id,
    widgetInstanceId: row.widgetInstanceId,
    orderIndex: row.orderIndex,
    title: row.title,
    url: row.url,
    iconKey: row.iconKey ?? null,
    iconOverrideKey: row.iconOverrideKey ?? null,
  };
}

export function updateLink(id: string, input: UpdateLinkInput): LinkRow {
  const db = getDb();
  const existing = db.select().from(linksListItems).where(eq(linksListItems.id, id)).get();
  if (!existing) throw Errors.notFound(`Link not found: ${id}`);

  const updates: Record<string, unknown> = {};

  if (input.title !== undefined) updates['title'] = input.title;
  if (input.url !== undefined) updates['url'] = input.url;
  if (input.iconKey !== undefined) updates['iconKey'] = input.iconKey;
  if (input.iconOverrideKey !== undefined) updates['iconOverrideKey'] = input.iconOverrideKey;
  if (input.orderIndex !== undefined) updates['orderIndex'] = input.orderIndex;

  if (Object.keys(updates).length > 0) {
    db.update(linksListItems).set(updates).where(eq(linksListItems.id, id)).run();
  }

  return getLink(id);
}

export function deleteLink(id: string): void {
  const db = getDb();
  const existing = db.select().from(linksListItems).where(eq(linksListItems.id, id)).get();
  if (!existing) throw Errors.notFound(`Link not found: ${id}`);
  db.delete(linksListItems).where(eq(linksListItems.id, id)).run();
}

export function reorderLinks(widgetId: string, orderedIds: string[]): LinkRow[] {
  const db = getDb();
  const sqlite = getSqliteDb();

  const widget = db
    .select()
    .from(appWidgetInstances)
    .where(eq(appWidgetInstances.id, widgetId))
    .get();
  if (!widget) throw Errors.notFound(`Widget not found: ${widgetId}`);

  const existing = db
    .select()
    .from(linksListItems)
    .where(eq(linksListItems.widgetInstanceId, widgetId))
    .all();
  const existingIds = new Set(existing.map((l) => l.id));

  if (orderedIds.length !== existingIds.size) {
    throw Errors.validationError('orderedIds must contain exactly all link IDs for this widget');
  }
  for (const id of orderedIds) {
    if (!existingIds.has(id)) {
      throw Errors.validationError(`Link ${id} does not belong to widget ${widgetId}`);
    }
  }
  if (new Set(orderedIds).size !== orderedIds.length) {
    throw Errors.validationError('orderedIds must not contain duplicates');
  }

  sqlite.transaction(() => {
    for (let i = 0; i < orderedIds.length; i++) {
      db.update(linksListItems)
        .set({ orderIndex: i })
        .where(eq(linksListItems.id, orderedIds[i]!))
        .run();
    }
  })();

  return db
    .select()
    .from(linksListItems)
    .where(eq(linksListItems.widgetInstanceId, widgetId))
    .orderBy(asc(linksListItems.orderIndex))
    .all()
    .map((r) => ({
      id: r.id,
      widgetInstanceId: r.widgetInstanceId,
      orderIndex: r.orderIndex,
      title: r.title,
      url: r.url,
      iconKey: r.iconKey ?? null,
      iconOverrideKey: r.iconOverrideKey ?? null,
    }));
}
