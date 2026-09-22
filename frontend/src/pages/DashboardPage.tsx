/**
 * T058 (US1): Main dashboard page.
 * T073 (US2): Theme toggle wired into shell layout.
 * Phase R4: Dashboard grid view mode.
 * Phase R5: Dashboard grid edit mode (admin only).
 *
 * Loads the public bootstrap + auth state.
 * - If first-run is required → redirects to /first-run
 * - If authenticated → loads preferred dashboard (or falls back to bootstrap default)
 * - If unauthenticated → shows bootstrap default dashboard (read-only)
 * - Admin users can enter drag/drop/resize editing from desktop or mobile navigation.
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ShellLayout } from '../components/ShellLayout.js';
import { DashboardGrid } from '../components/DashboardGrid.js';
import { DashboardSkeleton } from '../components/DashboardSkeleton.js';
import { PublicViewProvider } from '../state/publicView.js';
import { EmptyDashboard } from '../components/EmptyDashboard.js';
import { PlaceholderConfigDialog } from '../components/PlaceholderConfigDialog.js';
import { ScreensaverOverlay } from '../components/ScreensaverOverlay.js';
import { useBootstrap } from '../state/bootstrap.js';
import { useDashboard, type DashboardView } from '../state/dashboards.js';
import { useEditMode } from '../state/useEditMode.js';
import { apiClient, setCsrfToken } from '../lib/apiClient.js';
import { queryClient } from '../state/queryClient.js';
import { useIdleDetection } from '../hooks/useIdleDetection.js';
import { ScreensaverActiveContext } from '../hooks/useScreensaverActive.js';
import {
  useUserPreferences,
  applyTheme,
  storeTheme,
  getStoredTheme,
  useInitTheme,
  type ThemeMode,
} from '../state/settings.js';

export function DashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { bootstrap, isReady, isFirstRun, isAuthenticated, isAuthLoading, user } =
    useBootstrap();

  // Load user preferences when authenticated (provides theme + preferred dashboard)
  const prefsQuery = useUserPreferences({ enabled: isAuthenticated });
  const serverTheme = prefsQuery.data?.themeMode ?? null;

  // Determine preferred dashboard ID for authenticated users
  const deviceContext = bootstrap?.deviceContext ?? 'web';
  const preferredDashboardId = useMemo(() => {
    if (!isAuthenticated || !prefsQuery.data) return null;
    return deviceContext === 'mobile'
      ? prefsQuery.data.mobileDashboardId ?? null
      : prefsQuery.data.webDashboardId ?? null;
  }, [isAuthenticated, prefsQuery.data, deviceContext]);

  // Authenticated views must always load the protected dashboard representation.
  // The public bootstrap copy is intentionally pruned and cannot be reused even
  // when it references the same dashboard id.
  const bootstrapDashboardId = bootstrap?.dashboard?.id ?? null;
  const authenticatedDashboardId = preferredDashboardId ?? bootstrapDashboardId;
  const needsOverride = isAuthenticated && !!authenticatedDashboardId;
  const overrideQuery = useDashboard(authenticatedDashboardId, { enabled: needsOverride });

  // Resolve which dashboard to display
  const activeDashboard: DashboardView | null = useMemo(() => {
    if (isAuthenticated) return overrideQuery.data ?? null;
    return bootstrap?.dashboard ?? null;
  }, [isAuthenticated, overrideQuery.data, bootstrap?.dashboard]);

  const isDashboardLoading =
    !isReady ||
    isAuthLoading ||
    (isAuthenticated && prefsQuery.isLoading) ||
    (needsOverride && overrideQuery.isLoading);

  // Local theme state — derives from server prefs or localStorage
  const resolvedTheme = useMemo(
    () => serverTheme ?? getStoredTheme(),
    [serverTheme],
  );
  const [themeMode, setThemeMode] = useState<ThemeMode>(resolvedTheme);

  // Sync when server prefs load (resolvedTheme changes)
  if (themeMode !== resolvedTheme && serverTheme) {
    setThemeMode(resolvedTheme);
  }

  // Apply theme to document on mount / change
  useInitTheme(serverTheme);

  // Redirect to first-run page when no admin account exists yet
  useEffect(() => {
    if (isReady && isFirstRun) {
      navigate('/first-run', { replace: true });
    }
  }, [isReady, isFirstRun, navigate]);

  function handleThemeToggle(newMode: ThemeMode) {
    setThemeMode(newMode);
    applyTheme(newMode);
    storeTheme(newMode);
  }

  async function handleLogout() {
    try {
      await apiClient.post('/api/auth/logout');
    } catch {
      // Session may already be expired; proceed with client-side cleanup
    } finally {
      setCsrfToken(null);
      queryClient.clear();
      navigate('/', { replace: true });
    }
  }

  // ── Phase R5: Edit mode ─────────────────────────────────────────────────

  const isAdmin = user?.role === 'admin';

  const editMode = useEditMode(
    activeDashboard?.id ?? null,
    activeDashboard?.placeholders ?? [],
  );

  // Track active RGL breakpoint for edit mode indicator
  const [activeBreakpoint, setActiveBreakpoint] = useState('lg');

  // Placeholder config dialog state — store key, derive live draft
  const [configTargetKey, setConfigTargetKey] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const configTarget = configTargetKey
    ? editMode.editLayout.find((d) => d.stableKey === configTargetKey) ?? null
    : null;

  const handleEditFab = useCallback(() => {
    editMode.enterEdit();
  }, [editMode]);

  useEffect(() => {
    const state = location.state as { startDashboardEdit?: boolean } | null;
    if (!state?.startDashboardEdit || !isAdmin || !activeDashboard || editMode.isEditing) return;

    handleEditFab();
    navigate(location.pathname, { replace: true, state: null });
  }, [
    activeDashboard,
    editMode.isEditing,
    handleEditFab,
    isAdmin,
    location.pathname,
    location.state,
    navigate,
  ]);

  const handleAddWidget = useCallback(() => {
    const stableKey = editMode.addPlaceholder();
    setConfigTargetKey(stableKey);
    setConfigOpen(true);
  }, [editMode]);

  const handlePlaceholderEdit = useCallback(
    (stableKey: string) => {
      setConfigTargetKey(stableKey);
      setConfigOpen(true);
    },
    [],
  );

  const handlePlaceholderDelete = useCallback(
    (stableKey: string) => {
      const draft = editMode.editLayout.find((d) => d.stableKey === stableKey);
      if (!draft) return;

      if (draft.widgets.length > 0) {
        // Destructive warning for non-empty placeholders
        const confirmed = window.confirm(
          `This placeholder contains ${draft.widgets.length} widget(s). Deleting it will also remove all its widgets and links. Continue?`,
        );
        if (!confirmed) return;
      }
      editMode.removePlaceholder(stableKey);
    },
    [editMode],
  );

  const handleConfigSave = useCallback(
    (stableKey: string, updates: { title: string | null; borderColor: string; borderSize: number; opacity: number; showBorder: boolean; showTitle: boolean; titleStyle: 'header' | 'pill'; childLayout: 'stacked' | 'side-by-side' }) => {
      editMode.updatePlaceholderConfig(stableKey, updates);
    },
    [editMode],
  );

  // ── Screensaver ────────────────────────────────────────────────────────

  const shellSettings = bootstrap?.shell;
  const screensaverEnabled = shellSettings?.screensaverEnabled ?? false;
  const screensaverIdleMinutes = shellSettings?.screensaverIdleMinutes ?? 15;
  const [screensaverActive, setScreensaverActive] = useState(false);

  // Auto-activate screensaver on idle
  useIdleDetection(
    screensaverIdleMinutes,
    useCallback(() => {
      if (screensaverEnabled && !editMode.isEditing) {
        setScreensaverActive(true);
      }
    }, [screensaverEnabled, editMode.isEditing]),
    screensaverEnabled && !editMode.isEditing,
  );

  // Weather config for screensaver — use shell settings (explicit config)
  const weatherConfig = useMemo(() => {
    if (!shellSettings?.screensaverWeatherLat || !shellSettings?.screensaverWeatherLon) {
      return undefined;
    }
    return {
      latitude: shellSettings.screensaverWeatherLat,
      longitude: shellSettings.screensaverWeatherLon,
      locationName: shellSettings.screensaverWeatherLocation ?? undefined,
      temperatureUnit: shellSettings.screensaverWeatherUnit ?? ('C' as const),
    };
  }, [shellSettings]);

  const handleScreensaverDismiss = useCallback(() => {
    setScreensaverActive(false);
  }, []);

  const handleManualScreensaver = useCallback(() => {
    if (screensaverEnabled) {
      setScreensaverActive(true);
    }
  }, [screensaverEnabled]);

  // ── Render ──────────────────────────────────────────────────────────────

  // Show loading skeleton while bootstrap is in flight
  if (!isReady) {
    return (
      <div className="flex min-h-screen flex-col bg-background" aria-busy="true">
        <DashboardSkeleton />
      </div>
    );
  }

  const showGrid = activeDashboard && (activeDashboard.placeholders.length > 0 || editMode.isEditing);

  return (
    <ScreensaverActiveContext.Provider value={screensaverActive}>
    <ShellLayout
      shell={bootstrap?.shell ?? null}
      user={isAuthenticated ? user : null}
      themeMode={themeMode}
      onThemeToggle={handleThemeToggle}
      fullBleed
      {...(isAuthenticated ? { onLogout: () => void handleLogout() } : {})}
      {...(isAdmin && !editMode.isEditing && activeDashboard ? { onEditDashboard: handleEditFab } : {})}
      {...(screensaverEnabled && !editMode.isEditing ? { onScreensaver: handleManualScreensaver } : {})}
      {...(editMode.isEditing ? {
        editMode: {
          isEditing: true,
          isDirty: editMode.isDirty,
          isSaving: editMode.isSaving,
          activeBreakpoint,
          onSave: editMode.saveEdit,
          onCancel: editMode.exitEdit,
          onAddPlaceholder: editMode.addPlaceholder,
          onAddWidget: handleAddWidget,
          onCopyToSmaller: () => editMode.copyLayoutToSmaller(activeBreakpoint),
        },
      } : {})}
    >
      {isDashboardLoading ? (
        <DashboardSkeleton />
      ) : showGrid && activeDashboard ? (
        <PublicViewProvider isPublic={!isAuthenticated}>
          <DashboardGrid
            dashboard={activeDashboard}
            isEditing={editMode.isEditing}
            editLayout={editMode.isEditing ? editMode.editLayout : undefined}
            onPositionChange={editMode.updatePlaceholderPosition}
            onBreakpointPositionChange={editMode.updateBreakpointPosition}
            onActiveBreakpointChange={setActiveBreakpoint}
            onPlaceholderEdit={handlePlaceholderEdit}
            onPlaceholderDelete={handlePlaceholderDelete}
          />
        </PublicViewProvider>
      ) : (
        <EmptyDashboard
          isAdmin={isAdmin}
          isAuthenticated={isAuthenticated}
          hasNoDashboard={!activeDashboard}
        />
      )}

      {/* Placeholder config dialog */}
      <PlaceholderConfigDialog
        placeholder={configTarget}
        open={configOpen}
        onOpenChange={setConfigOpen}
        onSave={handleConfigSave}
        dashboardDirty={editMode.isDirty}
        onRestorePlaceholder={editMode.restorePlaceholder}
        onAddWidget={(type, defaultConfig) => {
          if (configTargetKey) editMode.addWidget(configTargetKey, type, defaultConfig);
        }}
        onRemoveWidget={(draftId) => {
          if (configTargetKey) editMode.removeWidget(configTargetKey, draftId);
        }}
        onReorderWidgets={(orderedDraftIds) => {
          if (configTargetKey) editMode.reorderWidgets(configTargetKey, orderedDraftIds);
        }}
        onUpdateWidgetConfig={(draftId, config) => {
          if (configTargetKey) editMode.updateWidgetConfig(configTargetKey, draftId, config);
        }}
        onUpdateWidgetVisibility={(draftId, publicVisibility) => {
          if (configTargetKey) {
            editMode.updateWidgetVisibility(configTargetKey, draftId, publicVisibility);
          }
        }}
      />

      {/* Screensaver overlay */}
      {screensaverActive && (
        <ScreensaverOverlay
          sourceId={shellSettings?.screensaverSourceId ?? null}
          intervalSeconds={shellSettings?.screensaverIntervalSeconds ?? 30}
          clockFormat={shellSettings?.screensaverClockFormat ?? '12h'}
          transition={shellSettings?.screensaverTransition ?? 'kenburns'}
          onDismiss={handleScreensaverDismiss}
          weatherConfig={weatherConfig ? {
            latitude: weatherConfig.latitude,
            longitude: weatherConfig.longitude,
            locationName: weatherConfig.locationName,
            temperatureUnit: weatherConfig.temperatureUnit,
          } : undefined}
        />
      )}
    </ShellLayout>
    </ScreensaverActiveContext.Provider>
  );
}
