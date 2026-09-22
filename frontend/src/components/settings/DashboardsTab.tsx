/**
 * Dashboards settings tab — Dashboard CRUD and public defaults.
 * Admin-only. Absorbs the former /admin/dashboards page.
 */

import { useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Monitor, Smartphone, Globe, Download, Upload, Eye, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button.js';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card.js';
import { Badge } from '../ui/badge.js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '../ui/dialog.js';
import { Separator } from '../ui/separator.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select.js';
import { DashboardDialog } from '../DashboardDialog.js';
import { DashboardImportDialog } from '../DashboardImportDialog.js';
import { FieldRow } from './FieldRow.js';
import {
  useAdminDashboards,
  useCreateDashboard,
  useUpdateDashboard,
  useDeleteDashboard,
  useDashboardExport,
  useDuplicateDashboard,
  type DashboardListItem,
} from '../../state/adminDashboards.js';
import {
  useUserPreferences,
  useUpdateUserPreferences,
  useAdminShellSettings,
  useUpdateShellSettings,
  type ShellSettingsUpdateInput,
} from '../../state/settings.js';
import { queryClient } from '../../state/queryClient.js';
import { bootstrapKeys } from '../../state/bootstrap.js';
import { SettingsErrorState } from './SettingsDataState.js';

const APPLICABILITY_ICONS = {
  web: Monitor,
  mobile: Smartphone,
  both: Globe,
} as const;

const APPLICABILITY_LABELS = {
  web: 'Web Only',
  mobile: 'Mobile Only',
  both: 'Web & Mobile',
} as const;

export function DashboardsTab() {
  const dashboardsQuery = useAdminDashboards(true);
  const dashboards = dashboardsQuery.data ?? [];
  const prefsQuery = useUserPreferences({ enabled: true });
  const activeWebDashboardId = prefsQuery.data?.webDashboardId ?? null;
  const updatePrefsMutation = useUpdateUserPreferences();

  const createMutation = useCreateDashboard();
  const updateMutation = useUpdateDashboard();
  const deleteMutation = useDeleteDashboard();
  const { exportDashboard, isExporting } = useDashboardExport();
  const duplicateMutation = useDuplicateDashboard();

  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<DashboardListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DashboardListItem | null>(null);

  const handleCreate = useCallback(
    (data: { name: string; applicability: 'web' | 'mobile' | 'both' }) => {
      createMutation.mutate(data, {
        onSuccess: () => setCreateOpen(false),
      });
    },
    [createMutation],
  );

  const handleEdit = useCallback(
    (data: {
      name: string;
      applicability: 'web' | 'mobile' | 'both';
      backgroundType?: 'solid' | 'image';
      backgroundColor?: string | null;
      backgroundAssetId?: string | null;
      backgroundDisplayMode?: 'fill' | 'stretch' | null;
    }) => {
      if (!editTarget) return;
      updateMutation.mutate(
        { id: editTarget.id, ...data },
        { onSuccess: () => setEditTarget(null) },
      );
    },
    [editTarget, updateMutation],
  );

  const handleActivate = useCallback(
    (dashId: string) => {
      updatePrefsMutation.mutate(
        { webDashboardId: dashId },
        {
          onSuccess: () => {
            toast.success('Dashboard activated');
            void queryClient.invalidateQueries({ queryKey: bootstrapKeys.public });
          },
        },
      );
    },
    [updatePrefsMutation],
  );

  const handleDelete = useCallback(() => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    });
  }, [deleteTarget, deleteMutation]);

  return (
    <div className="space-y-6">
      {/* Dashboard list header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Dashboards</h2>
          <p className="text-sm text-muted-foreground">
            Create and manage your home dashboards
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            Import
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Create
          </Button>
        </div>
      </div>

      {/* Dashboard grid */}
      {dashboardsQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-3">
                <div className="h-5 w-32 rounded bg-muted" />
              </CardHeader>
              <CardContent>
                <div className="h-4 w-20 rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : dashboardsQuery.isError ? (
        <SettingsErrorState
          message="Dashboards could not be loaded."
          onRetry={() => {
            void dashboardsQuery.refetch();
          }}
        />
      ) : dashboards.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Globe className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">No dashboards yet</p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Create your first dashboard to get started
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Create Dashboard
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {dashboards.map((dash) => {
            const Icon = APPLICABILITY_ICONS[dash.applicability];
            const isActive = dash.id === activeWebDashboardId;
            return (
              <Card
                key={dash.id}
                className={`group transition-colors hover:border-primary/30 ${isActive ? 'border-primary ring-1 ring-primary/30' : ''}`}
              >
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-semibold leading-tight">
                      {dash.name}
                    </CardTitle>
                    {isActive && (
                      <Badge variant="default" className="text-[10px]">Active</Badge>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                    {!isActive && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => handleActivate(dash.id)}
                        disabled={updatePrefsMutation.isPending}
                        aria-label={`Set ${dash.name} as active`}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => void exportDashboard(dash.id, dash.name)}
                      disabled={isExporting}
                      aria-label={`Export ${dash.name}`}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => duplicateMutation.mutate(dash.id)}
                      disabled={duplicateMutation.isPending}
                      aria-label={`Duplicate ${dash.name}`}
                      title="Duplicate dashboard"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => setEditTarget(dash)}
                      aria-label={`Edit ${dash.name}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(dash)}
                      aria-label={`Delete ${dash.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex items-center gap-2">
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <Icon className="h-3 w-3" />
                    {APPLICABILITY_LABELS[dash.applicability]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(dash.createdAt).toLocaleDateString()}
                  </span>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Public default dashboards */}
      <PublicDefaultsSection />

      {/* Dialogs */}
      <DashboardDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
        isSubmitting={createMutation.isPending}
      />
      <DashboardImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
      />
      <DashboardDialog
        dashboard={editTarget}
        open={!!editTarget}
        onOpenChange={(open) => { if (!open) setEditTarget(null); }}
        onSubmit={handleEdit}
        isSubmitting={updateMutation.isPending}
      />
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Dashboard</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>?
              This will remove all its placeholders, widgets, and links.
              If this dashboard is set as a default, those settings will be cleared.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Public Default Dashboards ────────────────────────────────────────────────

function PublicDefaultsSection() {
  const shellQuery = useAdminShellSettings({ enabled: true });
  const updateShell = useUpdateShellSettings();
  const dashboardsQuery = useAdminDashboards(true);
  const settings = shellQuery.data;

  const [unauthWebDashboardId, setUnauthWebDashboardId] = useState('');
  const [unauthMobileDashboardId, setUnauthMobileDashboardId] = useState('');
  const [syncedFrom, setSyncedFrom] = useState<unknown>(null);

  if (settings && settings !== syncedFrom) {
    setUnauthWebDashboardId(settings.unauthWebDashboardId ?? '');
    setUnauthMobileDashboardId(settings.unauthMobileDashboardId ?? '');
    setSyncedFrom(settings);
  }

  async function handleSave() {
    if (!settings) return;
    await updateShell.mutateAsync({
      titleText: settings.titleText || undefined,
      titleFont: settings.titleFont || undefined,
      titleFontSizePx: settings.titleFontSizePx || undefined,
      bodyFont: settings.bodyFont || undefined,
      headerHeightPx: settings.headerHeightPx || undefined,
      clockStripEnabled: settings.clockStripEnabled,
      clockStripAlignment: settings.clockStripAlignment ?? 'center',
      homeTimezone: settings.homeTimezone ?? null,
      homeClockConfig: settings.homeClockConfig ?? null,
      timezones: settings.timezones.filter((c) => !c.isHome).map((c) => ({ label: c.label, timezone: c.timezone })),
      footerText: settings.footerText ?? null,
      repoUrl: settings.repoUrl ?? null,
      unauthWebDashboardId: unauthWebDashboardId.trim() || null,
      unauthMobileDashboardId: unauthMobileDashboardId.trim() || null,
    } as ShellSettingsUpdateInput);
    toast.success('Public defaults saved');
  }

  return (
    <>
      <Separator />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Public Default Dashboards</CardTitle>
          <p className="text-sm text-muted-foreground">
            Set which dashboard unauthenticated visitors see.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <FieldRow label="Web default (desktop visitors)">
            <Select
              value={unauthWebDashboardId || '__none__'}
              onValueChange={(v) => setUnauthWebDashboardId(v === '__none__' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="None (use default)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None (use default)</SelectItem>
                {(dashboardsQuery.data ?? []).map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>

          <FieldRow label="Mobile default (mobile visitors)">
            <Select
              value={unauthMobileDashboardId || '__none__'}
              onValueChange={(v) => setUnauthMobileDashboardId(v === '__none__' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="None (use default)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None (use default)</SelectItem>
                {(dashboardsQuery.data ?? []).map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>

          <div className="pt-2">
            <Button
              size="sm"
              disabled={updateShell.isPending}
              onClick={() => void handleSave()}
            >
              {updateShell.isPending ? 'Saving…' : 'Save Public Defaults'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
