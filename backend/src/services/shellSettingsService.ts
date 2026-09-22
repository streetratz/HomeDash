/**
 * T068 (US2): Shell settings service.
 * T123 (US2): Extends GET/PUT to include public default dashboard IDs.
 *
 * Manages the global singleton row in `app_shell_settings`.
 * The singleton row is seeded on first startup with sensible defaults.
 */

import { eq } from 'drizzle-orm';
import { getDb } from '../db/drizzle.js';
import { appShellSettings, uploadedAssets } from '../db/schema/index.js';
import { Errors } from '../lib/errors.js';
import { clearPublicWidgetSnapshotCache } from './publicWidgetSnapshotCache.js';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Per-clock display configuration (optional, all fields have sensible defaults). */
export interface ClockDisplayConfig {
  /** Custom label for the clock (e.g. overrides default 'Home' for the home clock). */
  label?: string;
  /** 'column' = stacked (default), 'row' = single horizontal line. */
  layout?: 'column' | 'row';
  /** Show GMT±XX numeric offset below the time. Default false. */
  showOffset?: boolean;
  /** Side of the home house icon relative to the label (row layout). Default 'left'. */
  homeIconSide?: 'left' | 'right';
  /** Side of the day/night icon relative to the time display (row layout). Default 'right'. */
  dayNightSide?: 'left' | 'right';
}

export interface ClockView {
  timezone: string;
  label: string;
  isHome: boolean;
  /** Optional per-clock display config. */
  config?: ClockDisplayConfig;
}

/** Full admin view of shell settings (includes admin-only fields). */
export interface ShellSettingsData {
  titleText: string;
  titleFont: string;
  titleFontSizePx: number;
  bodyFont: string;
  headerHeightPx: number;
  logoAssetId: string | null;
  /** Derived URL for the logo asset — null if no logo uploaded. */
  logoUrl: string | null;
  clockStripEnabled: boolean;
  /** Horizontal alignment of the clock strip: 'left' | 'center' | 'right'. */
  clockStripAlignment: 'left' | 'center' | 'right';
  homeTimezone: string | null;
  /** Optional display config for the home clock. */
  homeClockConfig: ClockDisplayConfig | null;
  /** Combined list: home clock first (isHome=true), then extras. */
  timezones: ClockView[];
  footerText: string | null;
  repoUrl: string | null;
  /** Admin-configured default dashboard for unauthenticated web visitors. */
  unauthWebDashboardId: string | null;
  /** Admin-configured default dashboard for unauthenticated mobile visitors. */
  unauthMobileDashboardId: string | null;
  /** Screensaver settings */
  screensaverEnabled: boolean;
  screensaverIdleMinutes: number;
  screensaverSourceId: string | null;
  screensaverIntervalSeconds: number;
  screensaverWeatherLat: number | null;
  screensaverWeatherLon: number | null;
  screensaverWeatherLocation: string | null;
  screensaverWeatherUnit: 'C' | 'F';
  screensaverClockFormat: '12h' | '24h';
  screensaverTransition: 'fade' | 'slide' | 'kenburns' | 'crossfade';
  headerStyle:
    | 'none'
    | 'gradient-shift'
    | 'aurora'
    | 'aurora-australis'
    | 'glass-glow'
    | 'gradient-underline';
  headerStyleTarget: 'background' | 'border' | 'title';
  headerGlassEffect: boolean;
  headerTitleStyle:
    | 'none'
    | 'gradient-shift'
    | 'aurora'
    | 'aurora-australis'
    | 'glass-glow'
    | 'gradient-underline';
  updatedAt: string;
}

export interface UpdateShellSettingsInput {
  titleText?: string;
  titleFont?: string;
  titleFontSizePx?: number;
  bodyFont?: string;
  headerHeightPx?: number;
  clockStripEnabled?: boolean;
  clockStripAlignment?: 'left' | 'center' | 'right';
  homeTimezone?: string | null;
  /** Optional display config for the home clock. */
  homeClockConfig?: ClockDisplayConfig | null;
  /** Extra clocks only (max 5). The label field is required; isHome is ignored. */
  timezones?: Array<{ label: string; timezone: string; config?: ClockDisplayConfig }>;
  footerText?: string | null;
  repoUrl?: string | null;
  unauthWebDashboardId?: string | null;
  unauthMobileDashboardId?: string | null;
  screensaverEnabled?: boolean;
  screensaverIdleMinutes?: number;
  screensaverSourceId?: string | null;
  screensaverIntervalSeconds?: number;
  screensaverWeatherLat?: number | null;
  screensaverWeatherLon?: number | null;
  screensaverWeatherLocation?: string | null;
  screensaverWeatherUnit?: 'C' | 'F';
  screensaverClockFormat?: '12h' | '24h';
  screensaverTransition?: 'fade' | 'slide' | 'kenburns' | 'crossfade';
  headerStyle?:
    | 'none'
    | 'gradient-shift'
    | 'aurora'
    | 'aurora-australis'
    | 'glass-glow'
    | 'gradient-underline';
  headerStyleTarget?: 'background' | 'border' | 'title';
  headerGlassEffect?: boolean;
  headerTitleStyle?:
    | 'none'
    | 'gradient-shift'
    | 'aurora'
    | 'aurora-australis'
    | 'glass-glow'
    | 'gradient-underline';
}

// ── Service functions ─────────────────────────────────────────────────────────

/**
 * Return the current global shell settings.
 * Looks up the logo storagePath to construct the logoUrl.
 * Throws if the singleton row hasn't been seeded yet.
 */
export function getShellSettings(): ShellSettingsData {
  const db = getDb();

  const row = db.select().from(appShellSettings).where(eq(appShellSettings.id, 'global')).get();

  if (!row) {
    throw new Error('Shell settings singleton not found — run seed first');
  }

  // Resolve logo URL (join with uploaded_assets to get storagePath)
  let logoUrl: string | null = null;
  if (row.logoAssetId) {
    const asset = db
      .select()
      .from(uploadedAssets)
      .where(eq(uploadedAssets.id, row.logoAssetId))
      .get();
    if (asset) {
      logoUrl = `/assets/data/${asset.storagePath}`;
    }
  }

  // Build combined clock list: home TZ + extras
  interface StoredClock {
    label: string;
    timezone: string;
    config?: ClockDisplayConfig;
  }

  const extraClocks = (JSON.parse(row.timezonesJson) as StoredClock[]).map((c) => ({
    timezone: c.timezone,
    label: c.label,
    isHome: false as const,
    ...(c.config ? { config: c.config } : {}),
  }));

  // Parse home clock config
  let homeClockConfig: ClockDisplayConfig | null = null;
  if (row.homeClockConfig) {
    try {
      homeClockConfig = JSON.parse(row.homeClockConfig) as ClockDisplayConfig;
    } catch (e) {
      console.warn('[shell-settings] Ignoring malformed homeClockConfig JSON', e);
    }
  }

  const homeLabel = homeClockConfig?.label ?? 'Home';

  const timezones: ClockView[] = row.homeTimezone
    ? [
        {
          timezone: row.homeTimezone,
          label: homeLabel,
          isHome: true,
          ...(homeClockConfig ? { config: homeClockConfig } : {}),
        },
        ...extraClocks,
      ]
    : extraClocks;

  return {
    titleText: row.titleText,
    titleFont: row.titleFont,
    titleFontSizePx: row.titleFontSizePx,
    bodyFont: row.bodyFont,
    headerHeightPx: row.headerHeightPx,
    logoAssetId: row.logoAssetId ?? null,
    logoUrl,
    clockStripEnabled: row.clockStripEnabled,
    clockStripAlignment: row.clockStripAlignment ?? 'center',
    homeTimezone: row.homeTimezone ?? null,
    homeClockConfig,
    timezones,
    footerText: row.footerText ?? null,
    repoUrl: row.repoUrl ?? null,
    unauthWebDashboardId: row.unauthWebDashboardId ?? null,
    unauthMobileDashboardId: row.unauthMobileDashboardId ?? null,
    screensaverEnabled: row.screensaverEnabled,
    screensaverIdleMinutes: row.screensaverIdleMinutes,
    screensaverSourceId: row.screensaverSourceId ?? null,
    screensaverIntervalSeconds: row.screensaverIntervalSeconds,
    screensaverWeatherLat: row.screensaverWeatherLat ?? null,
    screensaverWeatherLon: row.screensaverWeatherLon ?? null,
    screensaverWeatherLocation: row.screensaverWeatherLocation ?? null,
    screensaverWeatherUnit: row.screensaverWeatherUnit ?? 'C',
    screensaverClockFormat: row.screensaverClockFormat ?? '12h',
    screensaverTransition: row.screensaverTransition ?? 'kenburns',
    headerStyle: row.headerStyle ?? 'none',
    headerStyleTarget: row.headerStyleTarget ?? 'background',
    headerGlassEffect: row.headerGlassEffect ?? false,
    headerTitleStyle: row.headerTitleStyle ?? 'none',
    updatedAt: row.updatedAt,
  };
}

/**
 * Update a subset of shell settings.
 * Only keys explicitly provided in the update are changed.
 * Returns the updated settings.
 */
export function updateShellSettings(updates: UpdateShellSettingsInput): ShellSettingsData {
  const db = getDb();
  const now = new Date().toISOString();

  // Build set values — only include keys explicitly present in updates
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const setValues: Record<string, any> = { updatedAt: now };

  if (updates.titleText !== undefined) setValues['titleText'] = updates.titleText;
  if (updates.titleFont !== undefined) setValues['titleFont'] = updates.titleFont;
  if (updates.titleFontSizePx !== undefined) setValues['titleFontSizePx'] = updates.titleFontSizePx;
  if (updates.bodyFont !== undefined) setValues['bodyFont'] = updates.bodyFont;
  if (updates.headerHeightPx !== undefined) setValues['headerHeightPx'] = updates.headerHeightPx;
  if (updates.clockStripEnabled !== undefined)
    setValues['clockStripEnabled'] = updates.clockStripEnabled;
  if (updates.clockStripAlignment !== undefined)
    setValues['clockStripAlignment'] = updates.clockStripAlignment;
  if (updates.homeTimezone !== undefined) {
    if (updates.homeTimezone !== null && !isValidTimezone(updates.homeTimezone)) {
      throw Errors.validationError(
        `Invalid timezone: "${updates.homeTimezone}" is not a recognised IANA timezone identifier`,
      );
    }
    setValues['homeTimezone'] = updates.homeTimezone;
  }
  if (updates.homeClockConfig !== undefined)
    setValues['homeClockConfig'] = updates.homeClockConfig
      ? JSON.stringify(updates.homeClockConfig)
      : null;
  if (updates.timezones !== undefined) {
    // Validate each extra clock timezone
    for (const c of updates.timezones) {
      if (!isValidTimezone(c.timezone)) {
        throw Errors.validationError(
          `Invalid timezone: "${c.timezone}" is not a recognised IANA timezone identifier`,
        );
      }
    }
    // Store extra clocks (home TZ is a separate field), preserving any display config
    const extras = updates.timezones
      .filter(
        (c): c is { label: string; timezone: string; config?: ClockDisplayConfig } =>
          !('isHome' in c) || !(c as { isHome?: boolean }).isHome,
      )
      .slice(0, 5) // Enforce max 5 extra clocks
      .map(({ label, timezone, config }) => ({ label, timezone, ...(config ? { config } : {}) }));
    setValues['timezonesJson'] = JSON.stringify(extras);
  }
  if (updates.footerText !== undefined) setValues['footerText'] = updates.footerText;
  if (updates.repoUrl !== undefined) setValues['repoUrl'] = updates.repoUrl;
  if (updates.unauthWebDashboardId !== undefined)
    setValues['unauthWebDashboardId'] = updates.unauthWebDashboardId;
  if (updates.unauthMobileDashboardId !== undefined)
    setValues['unauthMobileDashboardId'] = updates.unauthMobileDashboardId;
  if (updates.screensaverEnabled !== undefined)
    setValues['screensaverEnabled'] = updates.screensaverEnabled;
  if (updates.screensaverIdleMinutes !== undefined)
    setValues['screensaverIdleMinutes'] = updates.screensaverIdleMinutes;
  if (updates.screensaverSourceId !== undefined)
    setValues['screensaverSourceId'] = updates.screensaverSourceId;
  if (updates.screensaverIntervalSeconds !== undefined)
    setValues['screensaverIntervalSeconds'] = updates.screensaverIntervalSeconds;
  if (updates.screensaverWeatherLat !== undefined)
    setValues['screensaverWeatherLat'] = updates.screensaverWeatherLat;
  if (updates.screensaverWeatherLon !== undefined)
    setValues['screensaverWeatherLon'] = updates.screensaverWeatherLon;
  if (updates.screensaverWeatherLocation !== undefined)
    setValues['screensaverWeatherLocation'] = updates.screensaverWeatherLocation;
  if (updates.screensaverWeatherUnit !== undefined)
    setValues['screensaverWeatherUnit'] = updates.screensaverWeatherUnit;
  if (updates.screensaverClockFormat !== undefined)
    setValues['screensaverClockFormat'] = updates.screensaverClockFormat;
  if (updates.screensaverTransition !== undefined)
    setValues['screensaverTransition'] = updates.screensaverTransition;
  if (updates.headerStyle !== undefined) setValues['headerStyle'] = updates.headerStyle;
  if (updates.headerStyleTarget !== undefined)
    setValues['headerStyleTarget'] = updates.headerStyleTarget;
  if (updates.headerGlassEffect !== undefined)
    setValues['headerGlassEffect'] = updates.headerGlassEffect;
  if (updates.headerTitleStyle !== undefined)
    setValues['headerTitleStyle'] = updates.headerTitleStyle;

  try {
    db.update(appShellSettings).set(setValues).where(eq(appShellSettings.id, 'global')).run();
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('FOREIGN KEY constraint failed')) {
      throw Errors.validationError('One or more referenced resources do not exist');
    }
    throw err;
  }

  if (
    updates.unauthWebDashboardId !== undefined ||
    updates.unauthMobileDashboardId !== undefined
  ) {
    clearPublicWidgetSnapshotCache();
  }

  return getShellSettings();
}

/**
 * Update only the logoAssetId in shell settings.
 * Called by the asset service after a successful logo upload.
 */
export function setLogoAsset(assetId: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.update(appShellSettings)
    .set({ logoAssetId: assetId, updatedAt: now })
    .where(eq(appShellSettings.id, 'global'))
    .run();
}

// ── Timezone Helpers (T007) ──────────────────────────────────────────────────

let timezoneCache: string[] | null = null;

/** Returns all IANA timezone identifiers supported by this runtime. */
export function getTimezoneList(): string[] {
  if (!timezoneCache) {
    timezoneCache = Intl.supportedValuesOf('timeZone');
  }
  return timezoneCache;
}

/** Validates that `tz` is a recognised IANA timezone identifier. */
export function isValidTimezone(tz: string): boolean {
  if (tz === 'UTC') return true;
  return getTimezoneList().includes(tz);
}
