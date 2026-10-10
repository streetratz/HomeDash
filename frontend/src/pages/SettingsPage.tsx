/**
 * Settings page with a unified grouped navigation.
 *
 * A single left-hand rail (desktop) / slide-in drawer (mobile) lists every
 * settings leaf grouped by area (Account, Appearance, Content, Access, System,
 * About). The active leaf is encoded in `?tab=<leaf>`; a leaf may own an opaque
 * `?panel=<sub>` selector (Integrations today; Widgets reserved for #20) so a
 * reload or shared link restores the exact panel.
 *
 * Route: /settings?tab=<leaf>&panel=<sub>
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useBootstrap } from '../state/bootstrap.js';
import {
  useUserPreferences,
  applyTheme,
  storeTheme,
  type ThemeMode,
} from '../state/settings.js';
import { apiClient, setCsrfToken } from '../lib/apiClient.js';
import { queryClient } from '../state/queryClient.js';
import { ShellLayout } from '../components/ShellLayout.js';
import { GeneralTab } from '../components/settings/GeneralTab.js';
import { AppearancePanelContent } from '../components/settings/AppearanceTab.js';
import { DashboardsTab } from '../components/settings/DashboardsTab.js';
import { GroupsTab } from '../components/settings/GroupsTab.js';
import { UsersTab } from '../components/settings/UsersTab.js';
import { IntegrationsTab } from '../components/settings/IntegrationsTab.js';
import { WidgetsTab } from '../components/settings/WidgetsTab.js';
import { TimezoneSelector } from '../components/settings/TimezoneSelector.js';
import { ScheduledJobsTab } from '../components/settings/ScheduledJobsTab.js';
import { BackupRestoreSection } from '../components/settings/BackupRestoreSection.js';
import { AboutTab } from '../components/settings/AboutTab.js';
import { SettingsNav } from '../components/settings/SettingsNav.js';
import { getLeaf, resolveLeafId } from '../components/settings/settingsNavConfig.js';

export function SettingsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isReady, isAuthenticated, isAuthLoading, isFirstRun, user, bootstrap } = useBootstrap();
  const isAdmin = user?.role === 'admin';

  const tabParam = searchParams.get('tab');
  const panelParam = searchParams.get('panel');
  // Resolve once the user is known so admin-only leaves gate correctly.
  const activeLeaf = user ? resolveLeafId(tabParam, isAdmin) : resolveLeafId(tabParam, false);
  const activeLeafUsesPanel = getLeaf(activeLeaf)?.usesPanel ?? false;

  const [visitedLeaves, setVisitedLeaves] = useState<Set<string>>(
    () => new Set<string>([activeLeaf]),
  );
  const mountedLeaves = new Set(visitedLeaves).add(activeLeaf);

  // Normalize unknown / inaccessible / retired tab (and stray panel) in the URL.
  useEffect(() => {
    if (!user) return;
    const tabMismatch = tabParam !== activeLeaf;
    const strayPanel = panelParam !== null && !activeLeafUsesPanel;
    if (tabMismatch || strayPanel) {
      const next =
        activeLeafUsesPanel && panelParam
          ? { tab: activeLeaf, panel: panelParam }
          : { tab: activeLeaf };
      setSearchParams(next, { replace: true });
    }
  }, [user, tabParam, panelParam, activeLeaf, activeLeafUsesPanel, setSearchParams]);

  function handleSelectLeaf(leafId: string) {
    setVisitedLeaves((current) => new Set(current).add(leafId));
    setSearchParams({ tab: leafId }, { replace: true });
  }

  function handlePanelChange(panelId: string) {
    setSearchParams({ tab: activeLeaf, panel: panelId }, { replace: true });
  }

  // Redirect non-authenticated visitors (wait for auth query to settle first)
  useEffect(() => {
    if (isReady && !isAuthLoading && !isAuthenticated) {
      const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
      navigate(isFirstRun ? '/first-run' : `/login?returnTo=${returnTo}`, { replace: true });
    }
  }, [isReady, isAuthLoading, isAuthenticated, isFirstRun, navigate]);

  const prefsQuery = useUserPreferences({ enabled: isAuthenticated });
  const serverThemeMode = prefsQuery.data?.themeMode ?? null;
  const [currentTheme, setCurrentTheme] = useState<ThemeMode>('dark');

  if (serverThemeMode && currentTheme !== serverThemeMode) {
    setCurrentTheme(serverThemeMode);
    applyTheme(serverThemeMode);
  }

  function handleThemeToggle(newMode: ThemeMode) {
    setCurrentTheme(newMode);
    applyTheme(newMode);
    storeTheme(newMode);
  }

  async function handleLogout() {
    try {
      await apiClient.post('/api/auth/logout');
    } catch {
      // Session may be expired; proceed with cleanup
    } finally {
      setCsrfToken(null);
      queryClient.clear();
      navigate('/', { replace: true });
    }
  }

  if (!isReady || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="text-muted-foreground">Loading…</span>
      </div>
    );
  }

  function renderLeaf(leafId: string) {
    switch (leafId) {
      case 'general':
        return (
          <GeneralTab user={user} currentTheme={currentTheme} onThemeToggle={handleThemeToggle} />
        );
      case 'branding':
        return <AppearancePanelContent panelId="branding" />;
      case 'header-footer':
        return <AppearancePanelContent panelId="header-footer" />;
      case 'clock-strip':
        return <AppearancePanelContent panelId="clock-strip" />;
      case 'screensaver':
        return <AppearancePanelContent panelId="screensaver" />;
      case 'dashboards':
        return <DashboardsTab />;
      case 'widgets':
        return <WidgetsTab />;
      case 'integrations':
        return <IntegrationsTab panel={panelParam} onPanelChange={handlePanelChange} />;
      case 'users':
        return <UsersTab />;
      case 'groups':
        return <GroupsTab />;
      case 'timezone':
        return <TimezoneSelector />;
      case 'scheduled-jobs':
        return <ScheduledJobsTab />;
      case 'backup':
        return <BackupRestoreSection />;
      case 'about':
        return <AboutTab />;
      default:
        return null;
    }
  }

  return (
    <ShellLayout
      shell={bootstrap?.shell ?? null}
      user={user}
      themeMode={currentTheme}
      onThemeToggle={handleThemeToggle}
      onLogout={() => void handleLogout()}
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <h1 className="text-2xl font-semibold">Settings</h1>

        <div className="flex flex-col gap-4 lg:flex-row lg:gap-8">
          <SettingsNav activeLeafId={activeLeaf} isAdmin={isAdmin} onSelect={handleSelectLeaf} />

          <div className="min-w-0 flex-1">
            {[...mountedLeaves].map((leafId) => (
              <div key={leafId} hidden={activeLeaf !== leafId}>
                {renderLeaf(leafId)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </ShellLayout>
  );
}
