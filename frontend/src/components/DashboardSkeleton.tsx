/**
 * Phase R4: Dashboard loading skeleton.
 *
 * FR-037: All data-fetching views must show skeleton loading components.
 * Renders a grid-like skeleton to hint at dashboard layout.
 */

import { Skeleton } from './ui/skeleton.js';

export function DashboardSkeleton() {
  return (
    <div className="grid gap-4 p-1" data-testid="dashboard-skeleton">
      {/* Simulate a typical dashboard grid layout */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="hidden h-40 rounded-lg sm:block" />
        <Skeleton className="hidden h-40 rounded-lg lg:block" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Skeleton className="h-52 rounded-lg" />
        <Skeleton className="hidden h-52 rounded-lg sm:block" />
      </div>
    </div>
  );
}
