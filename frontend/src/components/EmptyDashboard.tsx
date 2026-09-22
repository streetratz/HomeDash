/**
 * Phase R4: Empty dashboard state.
 *
 * Shown when no dashboard is configured or the selected dashboard has no placeholders.
 */

import { LayoutDashboard } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from './ui/card.js';
import { Button } from './ui/button.js';

interface EmptyDashboardProps {
  isAdmin: boolean;
  isAuthenticated: boolean;
  hasNoDashboard: boolean;
}

export function EmptyDashboard({ isAdmin, isAuthenticated, hasNoDashboard }: EmptyDashboardProps) {
  return (
    <div className="flex min-h-[300px] items-center justify-center p-4" data-testid="dashboard-empty">
      <Card className="w-full max-w-sm text-center">
        <CardContent className="flex flex-col items-center gap-4 pt-8 pb-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <LayoutDashboard className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
          </div>

          {hasNoDashboard ? (
            <>
              <h3 className="text-base font-semibold">No Dashboard Configured</h3>
              <p className="text-sm text-muted-foreground">
                {isAdmin
                  ? 'Create your first dashboard to start adding widgets.'
                  : isAuthenticated
                    ? 'Ask an admin to create and assign a dashboard.'
                    : 'No public dashboard has been configured yet.'}
              </p>
              {isAdmin && (
                <Button asChild className="h-11">
                  <Link to="/settings?tab=dashboards">Open dashboard settings</Link>
                </Button>
              )}
            </>
          ) : (
            <>
              <h3 className="text-base font-semibold">Dashboard is Empty</h3>
              <p className="text-sm text-muted-foreground">
                {isAdmin
                  ? 'Add widgets to this dashboard via the edit mode (coming soon).'
                  : 'This dashboard has no widgets yet.'}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
