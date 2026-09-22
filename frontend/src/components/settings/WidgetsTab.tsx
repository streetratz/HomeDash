/**
 * Widget management entry point.
 *
 * Structural and configuration changes are intentionally handled by the
 * dashboard editor so there is one authoritative widget-management workflow.
 */

import { LayoutDashboard, Pencil, Puzzle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card.js';
import { useAdminDashboards } from '../../state/adminDashboards.js';
import { SettingsErrorState, SettingsLoadingState } from './SettingsDataState.js';

export function WidgetsTab() {
  const navigate = useNavigate();
  const dashboardsQuery = useAdminDashboards(true);
  const dashboards = dashboardsQuery.data ?? [];

  if (dashboardsQuery.isLoading) {
    return <SettingsLoadingState label="Loading widget management…" />;
  }

  if (dashboardsQuery.isError) {
    return (
      <SettingsErrorState
        message="Widget management could not be loaded."
        onRetry={() => {
          void dashboardsQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Widgets</h2>
        <p className="text-sm text-muted-foreground">
          Add, configure, arrange, and remove widgets in the dashboard editor.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Puzzle className="h-4 w-4 text-primary" aria-hidden="true" />
            Dashboard Widget Editor
          </CardTitle>
          <CardDescription>
            Widget content, visibility, layout, styling, and ordering are managed together so
            every change uses the same Save and Cancel workflow.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {dashboards.length > 0 ? (
            <>
              <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-muted/20 p-4">
                <LayoutDashboard
                  className="h-8 w-8 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-sm font-medium">
                    {dashboards.length} dashboard{dashboards.length === 1 ? '' : 's'} available
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Open the active dashboard in edit mode to manage its widgets and containers.
                  </p>
                </div>
              </div>
              <Button
                className="min-h-11 w-full sm:w-auto"
                onClick={() =>
                  navigate('/', {
                    state: { startDashboardEdit: true },
                  })
                }
              >
                <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                Open Dashboard Editor
              </Button>
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-6 text-center">
              <p className="text-sm font-medium">No dashboards available</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create a dashboard before adding widgets.
              </p>
              <Button
                variant="outline"
                className="mt-4 min-h-11"
                onClick={() => navigate('/settings?tab=dashboards')}
              >
                Create a Dashboard
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
