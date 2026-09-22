/**
 * Settings page with tabbed layout.
 *
 * Tabs:
 *   - General: Theme, dashboard preferences (all users)
 *   - Appearance: Branding, header/clock, footer, screensaver (admin only)
 *   - Dashboards: Dashboard CRUD, public defaults (admin only)
 *   - Groups & Access: Group/RBAC management (admin only)
 *   - Widgets: Widget management (admin only)
 *   - Integrations: External service connections (admin only)
 *   - System: Timezone, Scheduled Jobs, Backup & Restore (admin only)
 *
 * Route: /settings  (optional ?tab= query param for deep-linking)
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Settings2, Palette, LayoutDashboard, Users, UserCog, Plug, Puzzle, Server, Info } from 'lucide-react';
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs.js';
import { GeneralTab } from '../components/settings/GeneralTab.js';
import { AppearanceTab } from '../components/settings/AppearanceTab.js';
import { DashboardsTab } from '../components/settings/DashboardsTab.js';
import { GroupsTab } from '../components/settings/GroupsTab.js';
import { UsersTab } from '../components/settings/UsersTab.js';
import { IntegrationsTab } from '../components/settings/IntegrationsTab.js';
import { WidgetsTab } from '../components/settings/WidgetsTab.js';
import { SystemTab } from '../components/settings/SystemTab.js';
import { AboutTab } from '../components/settings/AboutTab.js';
import { MobileSectionSelect } from '../components/settings/MobileSectionSelect.js';

const TAB_IDS = ['general', 'appearance', 'dashboards', 'widgets', 'users', 'groups', 'integrations', 'system', 'about'] as const;
type TabId = (typeof TAB_IDS)[number];

const SETTINGS_TABS = [
  { id: 'general', label: 'General', icon: Settings2, adminOnly: false },
  { id: 'appearance', label: 'Appearance', icon: Palette, adminOnly: true },
  { id: 'dashboards', label: 'Dashboards', icon: LayoutDashboard, adminOnly: true },
  { id: 'groups', label: 'Groups & Access', icon: Users, adminOnly: true },
  { id: 'users', label: 'Users', icon: UserCog, adminOnly: true },
  { id: 'widgets', label: 'Widgets', icon: Puzzle, adminOnly: true },
  { id: 'integrations', label: 'Integrations', icon: Plug, adminOnly: true },
  { id: 'system', label: 'System', icon: Server, adminOnly: true },
  { id: 'about', label: 'About', icon: Info, adminOnly: false },
] as const;

/** Also accept legacy tab names and map them to new ones */
function resolveTab(value: string | null): TabId {
  if (!value) return 'general';
  if (TAB_IDS.includes(value as TabId)) return value as TabId;
  // Legacy redirects
  if (value === 'shell') return 'appearance';
  if (value === 'customization') return 'integrations';
  if (value === 'scheduled-jobs') return 'system';
  return 'general';
}

export function SettingsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isReady, isAuthenticated, isAuthLoading, isFirstRun, user, bootstrap } = useBootstrap();
  const isAdmin = user?.role === 'admin';
  const availableTabs = SETTINGS_TABS.filter((tab) => !tab.adminOnly || isAdmin);

  // Tab from URL, defaulting to 'general'
  const tabParam = searchParams.get('tab');
  const requestedTab = resolveTab(tabParam);
  const activeTab: TabId =
    user && !availableTabs.some((tab) => tab.id === requestedTab) ? 'general' : requestedTab;
  const [visitedTabs, setVisitedTabs] = useState<Set<TabId>>(
    () => new Set<TabId>([activeTab]),
  );
  const mountedTabs = new Set(visitedTabs).add(activeTab);

  // Normalize legacy and inaccessible tab names in the URL.
  useEffect(() => {
    if (user && tabParam && tabParam !== activeTab) {
      setSearchParams({ tab: activeTab }, { replace: true });
    }
  }, [user, tabParam, activeTab, setSearchParams]);

  function handleTabChange(value: string) {
    if (TAB_IDS.includes(value as TabId)) {
      setVisitedTabs((current) => new Set(current).add(value as TabId));
      setSearchParams({ tab: value }, { replace: true });
    }
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

  return (
    <ShellLayout
      shell={bootstrap?.shell ?? null}
      user={user}
      themeMode={currentTheme}
      onThemeToggle={handleThemeToggle}
      onLogout={() => void handleLogout()}
    >
      <div className="mx-auto max-w-5xl space-y-6">
        <h1 className="text-2xl font-semibold">Settings</h1>

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <MobileSectionSelect
            label="Settings section"
            value={activeTab}
            options={availableTabs.map((tab) => ({ value: tab.id, label: tab.label }))}
            onValueChange={handleTabChange}
            breakpoint="lg"
          />

          <TabsList className="hidden w-full lg:flex" aria-label="Settings sections">
            {availableTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="flex-1 gap-1.5"
                  aria-label={tab.label}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{tab.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {mountedTabs.has('general') && (
            <TabsContent
              value="general"
              forceMount
              className={activeTab === 'general' ? undefined : 'hidden'}
            >
              <GeneralTab
                user={user}
                currentTheme={currentTheme}
                onThemeToggle={handleThemeToggle}
              />
            </TabsContent>
          )}

          {isAdmin && mountedTabs.has('appearance') && (
            <TabsContent
              value="appearance"
              forceMount
              className={activeTab === 'appearance' ? undefined : 'hidden'}
            >
              <AppearanceTab />
            </TabsContent>
          )}

          {isAdmin && mountedTabs.has('dashboards') && (
            <TabsContent
              value="dashboards"
              forceMount
              className={activeTab === 'dashboards' ? undefined : 'hidden'}
            >
              <DashboardsTab />
            </TabsContent>
          )}

          {isAdmin && mountedTabs.has('widgets') && (
            <TabsContent
              value="widgets"
              forceMount
              className={activeTab === 'widgets' ? undefined : 'hidden'}
            >
              <WidgetsTab />
            </TabsContent>
          )}

          {isAdmin && mountedTabs.has('groups') && (
            <TabsContent
              value="groups"
              forceMount
              className={activeTab === 'groups' ? undefined : 'hidden'}
            >
              <GroupsTab />
            </TabsContent>
          )}

          {isAdmin && mountedTabs.has('users') && (
            <TabsContent
              value="users"
              forceMount
              className={activeTab === 'users' ? undefined : 'hidden'}
            >
              <UsersTab />
            </TabsContent>
          )}

          {isAdmin && mountedTabs.has('integrations') && (
            <TabsContent
              value="integrations"
              forceMount
              className={activeTab === 'integrations' ? undefined : 'hidden'}
            >
              <IntegrationsTab />
            </TabsContent>
          )}

          {isAdmin && mountedTabs.has('system') && (
            <TabsContent
              value="system"
              forceMount
              className={activeTab === 'system' ? undefined : 'hidden'}
            >
              <SystemTab />
            </TabsContent>
          )}

          {mountedTabs.has('about') && (
            <TabsContent
              value="about"
              forceMount
              className={activeTab === 'about' ? undefined : 'hidden'}
            >
              <AboutTab />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </ShellLayout>
  );
}
