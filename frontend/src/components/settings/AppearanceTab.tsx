/**
 * Appearance settings tab — Admin-only visual/layout configuration.
 * Sidebar layout with 4 panels: Branding, Header & Footer, Clock Strip, Screensaver.
 * Each panel reads current server state and merges its own fields when saving.
 */

import { useState, useCallback, type ReactNode } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Type,
  Ruler,
  Clock,
  MonitorPlay,
  Upload,
  Save,
  Plus,
  Folder,
  CloudSun,
  MapPin,
  X,
  Search,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card.js';
import { Button } from '../ui/button.js';
import { Input } from '../ui/input.js';
import { Label } from '../ui/label.js';
import { Switch } from '../ui/switch.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select.js';
import { apiClient } from '../../lib/apiClient.js';
import { queryClient } from '../../state/queryClient.js';
import { getCsrfToken } from '../../lib/apiClient.js';
import {
  useAdminShellSettings,
  useUpdateShellSettings,
  type ShellSettingsUpdateInput,
} from '../../state/settings.js';
import type { ClockDisplayConfig } from '../../state/bootstrap.js';
import type { TransitionEffect } from '../ScreensaverOverlay.js';
import {
  AlignmentPicker,
  TimezoneCombobox,
  ClockDisplayConfigPicker,
  ExtraTimezoneRow,
} from './shell-helpers.js';
import { FieldRow } from './FieldRow.js';
import { MobileSectionSelect } from './MobileSectionSelect.js';
import { SettingsErrorState } from './SettingsDataState.js';

// ─── Sidebar types ──────────────────────────────────────────────────────────

type PanelId = 'branding' | 'header-footer' | 'clock-strip' | 'screensaver';

interface NavItem {
  id: PanelId;
  label: string;
  icon: ReactNode;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: 'Layout',
    items: [
      { id: 'branding', label: 'Branding', icon: <Type className="h-4 w-4" /> },
      { id: 'header-footer', label: 'Header & Footer', icon: <Ruler className="h-4 w-4" /> },
      { id: 'clock-strip', label: 'Clock Strip', icon: <Clock className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Behavior',
    items: [
      { id: 'screensaver', label: 'Screensaver', icon: <MonitorPlay className="h-4 w-4" /> },
    ],
  },
];
const navItems = navGroups.flatMap((group) => group.items);

// ─── Screensaver types & hooks ──────────────────────────────────────────────

interface PhotoSource {
  id: string;
  name: string;
  type: string;
  config: {
    path?: string | undefined;
    recursive?: boolean | undefined;
  };
  imageCount: number;
  lastScannedAt: string | null;
}

interface ScreensaverShellSettings {
  screensaverEnabled: boolean;
  screensaverIdleMinutes: number;
  screensaverSourceId: string | null;
  screensaverIntervalSeconds: number;
  screensaverWeatherLat: number | null;
  screensaverWeatherLon: number | null;
  screensaverWeatherLocation: string | null;
  screensaverWeatherUnit: 'C' | 'F';
  screensaverClockFormat: '12h' | '24h';
  screensaverTransition: TransitionEffect;
}

type ScreensaverDraft = ScreensaverShellSettings;

function usePhotoSources() {
  return useQuery<PhotoSource[]>({
    queryKey: ['admin', 'photoSources'],
    queryFn: async () => {
      const data = await apiClient.get<{ sources: PhotoSource[] }>('/api/admin/photos/sources');
      return data.sources;
    },
  });
}

function useScreensaverShellSettings() {
  return useQuery<ScreensaverShellSettings>({
    queryKey: ['admin', 'shellSettings', 'screensaver'],
    queryFn: async () => {
      const data = await apiClient.get<{ shell: ScreensaverShellSettings }>('/api/public/bootstrap');
      return data.shell;
    },
    select: (shell) => ({
      screensaverEnabled: shell.screensaverEnabled ?? false,
      screensaverIdleMinutes: shell.screensaverIdleMinutes ?? 15,
      screensaverSourceId: shell.screensaverSourceId ?? null,
      screensaverIntervalSeconds: shell.screensaverIntervalSeconds ?? 30,
      screensaverWeatherLat: shell.screensaverWeatherLat ?? null,
      screensaverWeatherLon: shell.screensaverWeatherLon ?? null,
      screensaverWeatherLocation: shell.screensaverWeatherLocation ?? null,
      screensaverWeatherUnit: shell.screensaverWeatherUnit ?? 'C',
      screensaverClockFormat: shell.screensaverClockFormat ?? '12h',
      screensaverTransition: shell.screensaverTransition ?? 'kenburns',
    }),
  });
}

function makeScreensaverDraft(s: ScreensaverShellSettings): ScreensaverDraft {
  return { ...s };
}

function screensaverDraftsEqual(a: ScreensaverDraft, b: ScreensaverShellSettings): boolean {
  return (
    a.screensaverEnabled === b.screensaverEnabled &&
    a.screensaverIdleMinutes === b.screensaverIdleMinutes &&
    a.screensaverSourceId === b.screensaverSourceId &&
    a.screensaverIntervalSeconds === b.screensaverIntervalSeconds &&
    a.screensaverWeatherLat === b.screensaverWeatherLat &&
    a.screensaverWeatherLon === b.screensaverWeatherLon &&
    a.screensaverWeatherLocation === b.screensaverWeatherLocation &&
    a.screensaverWeatherUnit === b.screensaverWeatherUnit &&
    a.screensaverClockFormat === b.screensaverClockFormat &&
    a.screensaverTransition === b.screensaverTransition
  );
}

// ─── Geocode types for weather ──────────────────────────────────────────────

interface GeoResult {
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string;
}

// ─── BrandingPanel ──────────────────────────────────────────────────────────

const FONT_OPTIONS = [
  { value: 'system', label: 'System Default' },
  { value: 'sf-pro', label: 'San Francisco (Apple)' },
  { value: 'segoe', label: 'Segoe UI (Windows)' },
  { value: 'inter', label: 'Inter' },
  { value: 'roboto', label: 'Roboto' },
  { value: 'fira-sans', label: 'Fira Sans' },
  { value: 'poppins', label: 'Poppins' },
  { value: 'outfit', label: 'Outfit' },
  { value: 'space-grotesk', label: 'Space Grotesk' },
  { value: 'dm-sans', label: 'DM Sans' },
  { value: 'mono', label: 'Monospace (Fira Code)' },
  { value: 'jetbrains-mono', label: 'JetBrains Mono' },
  { value: 'serif', label: 'Serif (Georgia)' },
];

function BrandingPanel() {
  const shellQuery = useAdminShellSettings({ enabled: true });
  const updateShell = useUpdateShellSettings();
  const settings = shellQuery.data ?? null;

  const [titleText, setTitleText] = useState('');
  const [titleFont, setTitleFont] = useState('system');
  const [titleFontSizePx, setTitleFontSizePx] = useState(20);
  const [bodyFont, setBodyFont] = useState('system');
  const [syncedFrom, setSyncedFrom] = useState<typeof settings>(null);

  if (settings && settings !== syncedFrom) {
    setTitleText(settings.titleText);
    setTitleFont(settings.titleFont);
    setTitleFontSizePx(settings.titleFontSizePx);
    setBodyFont(settings.bodyFont ?? 'system');
    setSyncedFrom(settings);
  }

  const brandingDirty = settings != null && (
    titleText !== settings.titleText ||
    titleFont !== settings.titleFont ||
    titleFontSizePx !== settings.titleFontSizePx ||
    bodyFont !== (settings.bodyFont ?? 'system')
  );

  // Logo upload
  const [logoStatus, setLogoStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [faviconCacheBust, setFaviconCacheBust] = useState(() => Date.now());
  const [faviconOk, setFaviconOk] = useState(true);

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoStatus('uploading');
    const formData = new FormData();
    formData.append('file', file);
    try {
      const csrfToken = getCsrfToken();
      const headers: Record<string, string> = {};
      if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
      const res = await fetch('/api/admin/assets/logo', {
        method: 'POST',
        credentials: 'same-origin',
        headers,
        body: formData,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? `Upload failed (${res.status})`);
      }
      setLogoStatus('success');
      e.target.value = '';
      toast.success('Logo uploaded successfully');
      void queryClient.invalidateQueries({ queryKey: ['admin-shell'] });
      void queryClient.invalidateQueries({ queryKey: ['public-bootstrap'] });
      setFaviconCacheBust(Date.now());
      setFaviconOk(true);
      const faviconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (faviconLink) faviconLink.href = `/favicon.ico?t=${Date.now()}`;
      setTimeout(() => setLogoStatus('idle'), 2000);
    } catch (err) {
      setLogoStatus('error');
      toast.error(err instanceof Error ? err.message : 'Upload failed');
      setTimeout(() => setLogoStatus('idle'), 3000);
    }
  }

  async function handleSave() {
    try {
      await updateShell.mutateAsync({
        titleText: titleText.trim() || undefined,
        titleFont: titleFont || undefined,
        titleFontSizePx: titleFontSizePx || undefined,
        bodyFont: bodyFont || undefined,
        // Preserve non-branding fields from server
        headerHeightPx: settings?.headerHeightPx,
        clockStripEnabled: settings?.clockStripEnabled ?? false,
        clockStripAlignment: settings?.clockStripAlignment ?? 'center',
        homeTimezone: settings?.homeTimezone ?? null,
        homeClockConfig: settings?.homeClockConfig ?? null,
        timezones: settings?.timezones.filter((c) => !c.isHome).map((c) => ({ label: c.label, timezone: c.timezone })) ?? [],
        footerText: settings?.footerText ?? null,
        repoUrl: settings?.repoUrl ?? null,
        unauthWebDashboardId: settings?.unauthWebDashboardId ?? null,
        unauthMobileDashboardId: settings?.unauthMobileDashboardId ?? null,
      } as ShellSettingsUpdateInput);
      toast.success('Branding settings saved');
    } catch {
      toast.error('Failed to save branding settings');
    }
  }

  if (shellQuery.isLoading) {
    return <div className="py-8 text-center text-muted-foreground">Loading…</div>;
  }
  if (shellQuery.isError) {
    return (
      <SettingsErrorState
        message="Branding settings could not be loaded."
        onRetry={() => {
          void shellQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Branding</h3>
        <p className="text-sm text-muted-foreground">Logo, site title, and font settings</p>
      </div>

      {/* Sticky save bar — always visible */}
      <div className={`sticky top-0 z-10 flex items-center justify-between gap-3 rounded-md px-4 py-2.5 backdrop-blur-sm border ${brandingDirty ? 'border-primary/30 bg-primary/5' : 'border-border/40 bg-muted/30'}`}>
        <span className={`hidden sm:inline text-sm font-medium text-primary transition-opacity ${brandingDirty ? 'opacity-100' : 'opacity-0'}`}>You have unsaved changes</span>
        <div className="flex gap-2">
          {brandingDirty && (
            <Button variant="outline" size="sm" onClick={() => { if (settings) { setTitleText(settings.titleText); setTitleFont(settings.titleFont); setTitleFontSizePx(settings.titleFontSizePx); setBodyFont(settings.bodyFont ?? 'system'); } }}>
              Discard
            </Button>
          )}
          <Button size="sm" onClick={() => void handleSave()} disabled={updateShell.isPending || !brandingDirty}>
            <Save className="mr-1.5 h-3.5 w-3.5" />
            {updateShell.isPending ? 'Saving…' : 'Save Branding'}
          </Button>
        </div>
      </div>

      {/* Title, font, font size */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Title & Font</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FieldRow label="Site title">
            <Input
              type="text"
              value={titleText}
              onChange={(e) => setTitleText(e.target.value)}
              maxLength={128}
            />
          </FieldRow>

          <FieldRow label="Title font">
            <Select value={titleFont} onValueChange={setTitleFont}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>

          <FieldRow label={`Title font size (${titleFontSizePx}px)`}>
            <input
              type="range"
              min={8}
              max={72}
              value={titleFontSizePx}
              onChange={(e) => setTitleFontSizePx(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </FieldRow>

          <FieldRow label="Site-wide body font">
            <Select value={bodyFont} onValueChange={setBodyFont}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>
        </CardContent>
      </Card>

      {/* Logo upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Logo & Favicon</CardTitle>
          <CardDescription>
            Upload a PNG, JPEG, GIF, WebP, or SVG image (max 5 MiB).
            The logo is displayed in the header and used to generate favicon variants.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current logo/favicon preview */}
          <div className="flex items-center gap-4">
            {settings?.logoUrl ? (
              <>
                <img
                  src={settings.logoUrl}
                  alt="Current logo"
                  className="h-16 w-16 rounded-lg object-contain bg-muted/30"
                />
                {faviconOk && (
                  <img
                    src={`/favicon.ico?t=${String(faviconCacheBust)}`}
                    alt="Current favicon"
                    className="h-6 w-6 rounded object-contain"
                    onError={() => setFaviconOk(false)}
                  />
                )}
              </>
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted/30">
                <span className="text-xs text-muted-foreground">No logo uploaded</span>
              </div>
            )}
          </div>

          <label className="block">
            <span className="sr-only">Choose logo file</span>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={logoStatus === 'uploading'}
                onClick={() => document.querySelector<HTMLInputElement>('[data-testid="logo-file-input"]')?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                {logoStatus === 'uploading' ? 'Uploading…' : 'Choose file'}
              </Button>
              <span className="text-xs text-muted-foreground">PNG, JPEG, GIF, WebP, SVG</span>
            </div>
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
              onChange={(e) => void handleLogoUpload(e)}
              disabled={logoStatus === 'uploading'}
              className="hidden"
              data-testid="logo-file-input"
            />
          </label>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── HeaderFooterPanel ──────────────────────────────────────────────────────

function HeaderFooterPanel() {
  const shellQuery = useAdminShellSettings({ enabled: true });
  const updateShell = useUpdateShellSettings();
  const settings = shellQuery.data ?? null;

  const [headerHeightPx, setHeaderHeightPx] = useState(56);
  const [footerText, setFooterText] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [syncedFrom, setSyncedFrom] = useState<typeof settings>(null);

  if (settings && settings !== syncedFrom) {
    setHeaderHeightPx(settings.headerHeightPx);
    setFooterText(settings.footerText ?? '');
    setRepoUrl(settings.repoUrl ?? '');
    setSyncedFrom(settings);
  }

  const headerDirty = settings != null && (
    headerHeightPx !== settings.headerHeightPx ||
    (footerText.trim() || null) !== (settings.footerText ?? null) ||
    (repoUrl.trim() || null) !== (settings.repoUrl ?? null)
  );

  async function handleSave() {
    try {
      await updateShell.mutateAsync({
        // Preserve non-header/footer fields
        titleText: settings?.titleText || undefined,
        titleFont: settings?.titleFont || undefined,
        titleFontSizePx: settings?.titleFontSizePx || undefined,
        bodyFont: settings?.bodyFont || undefined,
        clockStripEnabled: settings?.clockStripEnabled ?? false,
        clockStripAlignment: settings?.clockStripAlignment ?? 'center',
        homeTimezone: settings?.homeTimezone ?? null,
        homeClockConfig: settings?.homeClockConfig ?? null,
        timezones: settings?.timezones.filter((c) => !c.isHome).map((c) => ({ label: c.label, timezone: c.timezone })) ?? [],
        unauthWebDashboardId: settings?.unauthWebDashboardId ?? null,
        unauthMobileDashboardId: settings?.unauthMobileDashboardId ?? null,
        // This panel's fields
        headerHeightPx,
        footerText: footerText.trim() || null,
        repoUrl: repoUrl.trim() || null,
      } as ShellSettingsUpdateInput);
      toast.success('Header & footer settings saved');
    } catch {
      toast.error('Failed to save header & footer settings');
    }
  }

  if (shellQuery.isLoading) {
    return <div className="py-8 text-center text-muted-foreground">Loading…</div>;
  }
  if (shellQuery.isError) {
    return (
      <SettingsErrorState
        message="Header and footer settings could not be loaded."
        onRetry={() => {
          void shellQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Header & Footer</h3>
        <p className="text-sm text-muted-foreground">Header height, footer text, and repository link</p>
      </div>

      {/* Sticky save bar — always visible */}
      <div className={`sticky top-0 z-10 flex items-center justify-between gap-3 rounded-md px-4 py-2.5 backdrop-blur-sm border ${headerDirty ? 'border-primary/30 bg-primary/5' : 'border-border/40 bg-muted/30'}`}>
        <span className={`hidden sm:inline text-sm font-medium text-primary transition-opacity ${headerDirty ? 'opacity-100' : 'opacity-0'}`}>You have unsaved changes</span>
        <div className="flex gap-2">
          {headerDirty && (
            <Button variant="outline" size="sm" onClick={() => { if (settings) { setHeaderHeightPx(settings.headerHeightPx); setFooterText(settings.footerText ?? ''); setRepoUrl(settings.repoUrl ?? ''); } }}>
              Discard
            </Button>
          )}
          <Button size="sm" onClick={() => void handleSave()} disabled={updateShell.isPending || !headerDirty}>
            <Save className="mr-1.5 h-3.5 w-3.5" />
            {updateShell.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <FieldRow label={`Header height (${headerHeightPx}px)`}>
            <input
              type="range"
              min={32}
              max={200}
              value={headerHeightPx}
              onChange={(e) => setHeaderHeightPx(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </FieldRow>

          <FieldRow label="Footer text">
            <Input
              type="text"
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              maxLength={256}
              placeholder="Optional footer message"
            />
          </FieldRow>

          <FieldRow label="Repository URL">
            <Input
              type="url"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/…"
            />
          </FieldRow>
        </CardContent>
      </Card>

      {/* Header Animation */}
      <HeaderAnimationSection />
    </div>
  );
}

// ─── Header Animation section (embedded in Header & Footer panel) ────────────

const HEADER_STYLE_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'gradient-shift', label: 'Gradient Shift' },
  { value: 'aurora', label: 'Aurora Borealis' },
  { value: 'aurora-australis', label: 'Aurora Australis' },
  { value: 'glass-glow', label: 'Glass Glow' },
  { value: 'gradient-underline', label: 'Gradient Underline' },
] as const;

function HeaderAnimationSection() {
  const { data: settings } = useAdminShellSettings();
  const mutation = useUpdateShellSettings();

  const bgStyle = settings?.headerStyle ?? 'none';
  const titleStyle = settings?.headerTitleStyle ?? 'none';
  const glassEffect = settings?.headerGlassEffect ?? false;

  const save = (updates: Record<string, unknown>) => {
    mutation.mutate(updates, {
      onSuccess: () => toast.success('Header animation updated'),
      onError: () => toast.error('Failed to update'),
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4" />
          Header Animation
        </CardTitle>
        <CardDescription>Animated effects for the header background and title text.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FieldRow label="Background">
          <Select value={bgStyle} onValueChange={(v) => save({ headerStyle: v })}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HEADER_STYLE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>

        <FieldRow label="Title Text">
          <Select value={titleStyle} onValueChange={(v) => save({ headerTitleStyle: v })}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HEADER_STYLE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>

        <FieldRow label="Glass Effect">
          <Switch
            checked={glassEffect}
            onCheckedChange={(v) => save({ headerGlassEffect: v })}
          />
        </FieldRow>
      </CardContent>
    </Card>
  );
}

// ─── ClockStripPanel ────────────────────────────────────────────────────────

function ClockStripPanel() {
  const shellQuery = useAdminShellSettings({ enabled: true });
  const updateShell = useUpdateShellSettings();
  const settings = shellQuery.data ?? null;

  const [clockStripEnabled, setClockStripEnabled] = useState(false);
  const [clockStripAlignment, setClockStripAlignment] = useState<'left' | 'center' | 'right'>('center');
  const [homeTimezone, setHomeTimezone] = useState('');
  const [homeLabel, setHomeLabel] = useState('');
  const [homeIconSide, setHomeIconSide] = useState<'left' | 'right'>('left');
  const [displayConfig, setDisplayConfig] = useState<ClockDisplayConfig>({});
  const [extraClocks, setExtraClocks] = useState<Array<{ label: string; timezone: string }>>([]);
  const [syncedFrom, setSyncedFrom] = useState<typeof settings>(null);

  if (settings && settings !== syncedFrom) {
    setClockStripEnabled(settings.clockStripEnabled);
    setClockStripAlignment(settings.clockStripAlignment);
    setHomeTimezone(settings.homeTimezone ?? '');
    const hc = settings.homeClockConfig ?? {};
    setHomeLabel(hc.label ?? '');
    setHomeIconSide(hc.homeIconSide ?? 'left');
    // Global display config from home clock config
    setDisplayConfig({
      layout: hc.layout ?? 'column',
      showOffset: hc.showOffset ?? false,
      dayNightSide: hc.dayNightSide ?? 'right',
    });
    setExtraClocks(
      settings.timezones
        .filter((c) => !c.isHome)
        .map((c) => ({ label: c.label, timezone: c.timezone })),
    );
    setSyncedFrom(settings);
  }

  // Compute dirty state for clock strip
  const clockDirty = settings != null && (
    clockStripEnabled !== settings.clockStripEnabled ||
    clockStripAlignment !== settings.clockStripAlignment ||
    (homeTimezone.trim() || null) !== (settings.homeTimezone ?? null) ||
    homeLabel.trim() !== ((settings.homeClockConfig?.label) ?? '') ||
    homeIconSide !== (settings.homeClockConfig?.homeIconSide ?? 'left') ||
    (displayConfig.layout ?? 'column') !== (settings.homeClockConfig?.layout ?? 'column') ||
    (displayConfig.showOffset ?? false) !== (settings.homeClockConfig?.showOffset ?? false) ||
    (displayConfig.dayNightSide ?? 'right') !== (settings.homeClockConfig?.dayNightSide ?? 'right') ||
    JSON.stringify(extraClocks) !== JSON.stringify(
      settings.timezones.filter((c) => !c.isHome).map((c) => ({ label: c.label, timezone: c.timezone }))
    )
  );

  function handleClockDiscard() {
    setSyncedFrom(null);
  }

  function moveExtraClock(from: number, to: number) {
    const next = [...extraClocks];
    const moved = next.splice(from, 1)[0];
    if (!moved) return;
    next.splice(to, 0, moved);
    setExtraClocks(next);
  }

  async function handleSave() {
    // Build homeClockConfig from the individual fields + global display
    const homeClockConfig: ClockDisplayConfig = {
      ...displayConfig,
      homeIconSide,
    };
    if (homeLabel.trim()) homeClockConfig.label = homeLabel.trim();

    try {
      await updateShell.mutateAsync({
        titleText: settings?.titleText || undefined,
        titleFont: settings?.titleFont || undefined,
        titleFontSizePx: settings?.titleFontSizePx || undefined,
        bodyFont: settings?.bodyFont || undefined,
        headerHeightPx: settings?.headerHeightPx,
        footerText: settings?.footerText ?? null,
        repoUrl: settings?.repoUrl ?? null,
        unauthWebDashboardId: settings?.unauthWebDashboardId ?? null,
        unauthMobileDashboardId: settings?.unauthMobileDashboardId ?? null,
        clockStripEnabled,
        clockStripAlignment,
        homeTimezone: homeTimezone.trim() || null,
        homeClockConfig: Object.keys(homeClockConfig).length > 0 ? homeClockConfig : null,
        // Apply the global display config to each extra clock too
        timezones: extraClocks
          .filter((c) => c.timezone.trim())
          .map((c) => ({ label: c.label, timezone: c.timezone, config: displayConfig })),
      } as ShellSettingsUpdateInput);
      toast.success('Clock strip settings saved');
    } catch {
      toast.error('Failed to save clock strip settings');
    }
  }

  if (shellQuery.isLoading) {
    return <div className="py-8 text-center text-muted-foreground">Loading…</div>;
  }
  if (shellQuery.isError) {
    return (
      <SettingsErrorState
        message="Clock strip settings could not be loaded."
        onRetry={() => {
          void shellQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Clock Strip</h3>
        <p className="text-sm text-muted-foreground">Toggle, alignment, home clock, and extra world clocks</p>
      </div>

      {/* Sticky save bar — always visible */}
      <div className={`sticky top-0 z-10 flex items-center justify-between gap-3 rounded-md px-4 py-2.5 backdrop-blur-sm border ${clockDirty ? 'border-primary/30 bg-primary/5' : 'border-border/40 bg-muted/30'}`}>
        <span className={`hidden sm:inline text-sm font-medium text-primary transition-opacity ${clockDirty ? 'opacity-100' : 'opacity-0'}`}>You have unsaved changes</span>
        <div className="flex gap-2">
          {clockDirty && (
            <Button variant="outline" size="sm" onClick={handleClockDiscard}>
              Discard
            </Button>
          )}
          <Button size="sm" onClick={() => void handleSave()} disabled={updateShell.isPending || !clockDirty}>
            <Save className="mr-1.5 h-3.5 w-3.5" />
            {updateShell.isPending ? 'Saving…' : 'Save Clock Strip'}
          </Button>
        </div>
      </div>

      {/* Strip-level controls */}
      <Card>
        <CardContent className="space-y-4 pt-6">
          <FieldRow label="Clock strip enabled">
            <Switch
              checked={clockStripEnabled}
              onCheckedChange={setClockStripEnabled}
            />
          </FieldRow>
          <FieldRow label="Alignment">
            <AlignmentPicker value={clockStripAlignment} onChange={setClockStripAlignment} />
          </FieldRow>
        </CardContent>
      </Card>

      {/* Home Clock */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Home Clock</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <FieldRow label="Timezone">
            <TimezoneCombobox value={homeTimezone} onChange={setHomeTimezone} />
          </FieldRow>
          <FieldRow label="Label override">
            <Input
              type="text"
              value={homeLabel}
              onChange={(e) => setHomeLabel(e.target.value)}
              placeholder="e.g. Home or Sydney"
              maxLength={32}
            />
          </FieldRow>
          <FieldRow label="Home icon side">
            <div className="flex gap-1">
              {(['left', 'right'] as const).map((s) => (
                <Button
                  key={s}
                  type="button"
                  variant={homeIconSide === s ? 'default' : 'secondary'}
                  size="sm"
                  className="h-7 px-3 text-xs"
                  onClick={() => setHomeIconSide(s)}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Button>
              ))}
            </div>
          </FieldRow>
        </CardContent>
      </Card>

      {/* Display Settings (global) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Display Settings</CardTitle>
          <CardDescription>Applies to all clocks</CardDescription>
        </CardHeader>
        <CardContent>
          <ClockDisplayConfigPicker value={displayConfig} onChange={setDisplayConfig} />
        </CardContent>
      </Card>

      {/* Extra Clocks */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Extra Clocks</CardTitle>
          <CardDescription>Up to 5 additional world clocks</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {extraClocks.map((entry, i) => (
            <ExtraTimezoneRow
              key={i}
              index={i}
              entry={entry}
              total={extraClocks.length}
              onChange={(updated) => {
                const next = [...extraClocks];
                next[i] = updated;
                setExtraClocks(next);
              }}
              onRemove={() => setExtraClocks(extraClocks.filter((_, j) => j !== i))}
              onMoveUp={() => moveExtraClock(i, i - 1)}
              onMoveDown={() => moveExtraClock(i, i + 1)}
            />
          ))}
          {extraClocks.length < 5 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setExtraClocks([...extraClocks, { label: '', timezone: '' }])}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Clock
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── WeatherLocationCard (for screensaver) ──────────────────────────────────

function WeatherLocationCard({
  draft,
  onChange,
}: {
  draft: ScreensaverDraft;
  onChange: (patch: Partial<ScreensaverDraft>) => void;
}) {
  const hasWeather = draft.screensaverWeatherLat != null && draft.screensaverWeatherLon != null;
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);

  async function handleSearch() {
    const q = searchQuery.trim();
    if (q.length < 2) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/geocode?name=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error('Geocode failed');
      const json = (await res.json()) as { results?: GeoResult[] };
      setSearchResults(json.results ?? []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  function selectLocation(loc: GeoResult) {
    const name = loc.admin1 ? `${loc.name}, ${loc.admin1}, ${loc.country}` : `${loc.name}, ${loc.country}`;
    onChange({
      screensaverWeatherLat: loc.latitude,
      screensaverWeatherLon: loc.longitude,
      screensaverWeatherLocation: name,
    });
    setSearchResults([]);
    setSearchQuery('');
  }

  function handleClear() {
    onChange({
      screensaverWeatherLat: null,
      screensaverWeatherLon: null,
      screensaverWeatherLocation: null,
      screensaverWeatherUnit: 'C',
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CloudSun className="h-5 w-5" />
          Weather Overlay
        </CardTitle>
        <CardDescription>
          Search for a location to show weather on the screensaver. Leave empty to hide weather.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasWeather && (
          <div className="flex items-center gap-2 rounded-md bg-muted/30 px-3 py-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span>
              {draft.screensaverWeatherLocation ?? 'Custom Location'} — {draft.screensaverWeatherLat}°, {draft.screensaverWeatherLon}° ({draft.screensaverWeatherUnit})
            </span>
            <Button variant="ghost" size="icon" className="ml-auto h-6 w-6" onClick={handleClear}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Search Location</Label>
          <div className="flex gap-2">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Type a city name…"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleSearch(); } }}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => void handleSearch()}
              disabled={searching || searchQuery.trim().length < 2}
            >
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          {searchResults.length > 0 && (
            <div className="rounded-md border border-border bg-popover">
              {searchResults.map((loc, i) => (
                <button
                  key={i}
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
                  onClick={() => selectLocation(loc)}
                >
                  <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>
                    {loc.name}
                    {loc.admin1 ? `, ${loc.admin1}` : ''}, {loc.country}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {loc.latitude.toFixed(2)}, {loc.longitude.toFixed(2)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Temperature Unit</Label>
          <div className="flex gap-2">
            <Button variant={draft.screensaverWeatherUnit === 'C' ? 'default' : 'outline'} size="sm" onClick={() => onChange({ screensaverWeatherUnit: 'C' })}>°C</Button>
            <Button variant={draft.screensaverWeatherUnit === 'F' ? 'default' : 'outline'} size="sm" onClick={() => onChange({ screensaverWeatherUnit: 'F' })}>°F</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── ScreensaverPanel ───────────────────────────────────────────────────────

const TRANSITION_OPTIONS: Array<{ value: TransitionEffect; label: string; description: string }> = [
  { value: 'kenburns', label: 'Ken Burns', description: 'Slow zoom + pan with fade' },
  { value: 'fade', label: 'Fade', description: 'Simple fade in/out' },
  { value: 'crossfade', label: 'Crossfade', description: 'Smooth blend between images' },
  { value: 'slide', label: 'Slide', description: 'Slide in from right' },
];

function ScreensaverPanel() {
  const sourcesQuery = usePhotoSources();
  const settingsQuery = useScreensaverShellSettings();
  const sources = sourcesQuery.data ?? [];
  const settings = settingsQuery.data;

  const [draft, setDraft] = useState<ScreensaverDraft | null>(() =>
    settings ? makeScreensaverDraft(settings) : null,
  );
  const [syncedSettings, setSyncedSettings] = useState(settings);

  // Sync draft when settings update (first load or after save)
  if (settings && settings !== syncedSettings) {
    setDraft(makeScreensaverDraft(settings));
    setSyncedSettings(settings);
  }

  const isDirty = draft != null && settings != null && !screensaverDraftsEqual(draft, settings);

  function updateDraft(patch: Partial<ScreensaverDraft>) {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  const saveSettings = useMutation({
    mutationFn: async (updates: Partial<ScreensaverShellSettings>) => {
      await apiClient.put('/api/admin/shell', updates);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-shell'] });
      void queryClient.invalidateQueries({ queryKey: ['public-bootstrap'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'shellSettings', 'screensaver'] });
      toast.success('Screensaver settings saved');
    },
    onError: () => toast.error('Failed to save settings'),
  });

  const handleSave = useCallback(() => {
    if (!draft) return;
    saveSettings.mutate(draft);
  }, [draft, saveSettings]);

  const handleDiscard = useCallback(() => {
    if (settings) setDraft(makeScreensaverDraft(settings));
  }, [settings]);

  if (settingsQuery.isError || sourcesQuery.isError) {
    return (
      <SettingsErrorState
        message="Screensaver settings could not be loaded."
        onRetry={() => {
          void settingsQuery.refetch();
          void sourcesQuery.refetch();
        }}
      />
    );
  }

  if (!settings || !draft) {
    return <div className="py-8 text-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Screensaver</h3>
        <p className="text-sm text-muted-foreground">Ambient photo display that activates when the dashboard is idle</p>
      </div>

      {/* Sticky save bar — always visible */}
      <div className={`sticky top-0 z-10 flex items-center justify-between gap-3 rounded-md px-4 py-2.5 backdrop-blur-sm border ${isDirty ? 'border-primary/30 bg-primary/5' : 'border-border/40 bg-muted/30'}`}>
        <span className={`hidden sm:inline text-sm font-medium text-primary transition-opacity ${isDirty ? 'opacity-100' : 'opacity-0'}`}>You have unsaved changes</span>
        <div className="flex gap-2">
          {isDirty && (
            <Button variant="outline" size="sm" onClick={handleDiscard}>
              Discard
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={saveSettings.isPending || !isDirty}>
            {saveSettings.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-3.5 w-3.5" />
            )}
            Save Settings
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center justify-between">
            <Label htmlFor="ss-enabled">Enable screensaver</Label>
            <Switch
              id="ss-enabled"
              checked={draft.screensaverEnabled}
              onCheckedChange={(v) => updateDraft({ screensaverEnabled: v })}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ss-idle">Idle timeout (minutes)</Label>
              <Input
                id="ss-idle"
                type="number"
                min={1}
                max={120}
                value={draft.screensaverIdleMinutes}
                onChange={(e) => {
                  const mins = parseInt(e.target.value, 10);
                  if (!isNaN(mins) && mins >= 1) updateDraft({ screensaverIdleMinutes: mins });
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ss-interval">Slide interval (seconds)</Label>
              <Input
                id="ss-interval"
                type="number"
                min={5}
                max={300}
                value={draft.screensaverIntervalSeconds}
                onChange={(e) => {
                  const secs = parseInt(e.target.value, 10);
                  if (!isNaN(secs) && secs >= 5) updateDraft({ screensaverIntervalSeconds: secs });
                }}
              />
            </div>
          </div>

          {/* Clock format */}
          <div className="space-y-1.5">
            <Label>Clock Format</Label>
            <p className="text-xs text-muted-foreground">Applies to all clocks and calendars across the dashboard</p>
            <div className="flex gap-2">
              <Button
                variant={draft.screensaverClockFormat === '12h' ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateDraft({ screensaverClockFormat: '12h' })}
              >
                12-hour
              </Button>
              <Button
                variant={draft.screensaverClockFormat === '24h' ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateDraft({ screensaverClockFormat: '24h' })}
              >
                24-hour
              </Button>
            </div>
          </div>

          {/* Transition effect */}
          <div className="space-y-1.5">
            <Label>Transition Effect</Label>
            <Select
              value={draft.screensaverTransition}
              onValueChange={(v) => updateDraft({ screensaverTransition: v as TransitionEffect })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRANSITION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className="font-medium">{opt.label}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{opt.description}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Source selection */}
          <div className="space-y-1.5">
            <Label>Photo source</Label>
            {sources.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No photo sources configured. Add sources in Settings → Integrations → Photo Sources.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {sources.map((s) => (
                  <Button
                    key={s.id}
                    variant={draft.screensaverSourceId === s.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateDraft({ screensaverSourceId: s.id })}
                  >
                    <Folder className="mr-1.5 h-3.5 w-3.5" />
                    {s.name}
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({s.imageCount})
                    </span>
                  </Button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Weather overlay config */}
      <WeatherLocationCard draft={draft} onChange={updateDraft} />
    </div>
  );
}

// ─── Panel renderer ─────────────────────────────────────────────────────────

function PanelContent({ panelId }: { panelId: PanelId }) {
  switch (panelId) {
    case 'branding': return <BrandingPanel />;
    case 'header-footer': return <HeaderFooterPanel />;
    case 'clock-strip': return <ClockStripPanel />;
    case 'screensaver': return <ScreensaverPanel />;
  }
}

// ─── Main tab ───────────────────────────────────────────────────────────────

export function AppearanceTab() {
  const [activePanel, setActivePanel] = useState<PanelId>('branding');
  const [visitedPanels, setVisitedPanels] = useState<Set<PanelId>>(
    () => new Set<PanelId>(['branding']),
  );

  function handlePanelChange(panelId: PanelId) {
    setVisitedPanels((current) => {
      if (current.has(panelId)) return current;
      return new Set(current).add(panelId);
    });
    setActivePanel(panelId);
  }

  return (
    <div className="flex flex-col gap-4 md:flex-row md:gap-6 md:min-h-[480px]">
      <MobileSectionSelect
        label="Appearance section"
        value={activePanel}
        options={navItems.map((item) => ({ value: item.id, label: item.label }))}
        onValueChange={handlePanelChange}
      />

      {/* Left sidebar nav — desktop */}
      <nav className="hidden md:flex md:w-44 md:shrink-0 md:flex-col md:space-y-4 md:border-r md:border-border md:pr-4" aria-label="Appearance sections">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => handlePanelChange(item.id)}
                  className={`flex w-full items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    activePanel === item.id
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Right content panel */}
      <div className="min-w-0 flex-1">
        {navItems
          .filter((item) => visitedPanels.has(item.id))
          .map((item) => (
            <div key={item.id} hidden={activePanel !== item.id}>
              <PanelContent panelId={item.id} />
            </div>
          ))}
      </div>
    </div>
  );
}
