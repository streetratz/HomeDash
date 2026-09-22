/**
 * Breadcrumbs bar — shown below the header for all routes except the root ("/").
 *
 * Derives segments from the current URL path and maps them to human-readable
 * labels. Uses Lucide ChevronRight separators and shadcn design tokens.
 */

import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

/** Human-readable label map for known path segments. */
const SEGMENT_LABELS: Record<string, string> = {
  settings: 'Settings',
  'first-run': 'First Run',
  login: 'Login',
  admin: 'Admin',
  dashboards: 'Dashboards',
};

function segmentLabel(seg: string): string {
  return SEGMENT_LABELS[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1);
}

export function Breadcrumbs() {
  const { pathname } = useLocation();

  if (pathname === '/') return null;

  const segments = pathname.split('/').filter(Boolean);

  interface Crumb {
    label: string;
    path: string;
  }

  const crumbs: Crumb[] = segments.map((seg, i) => ({
    label: segmentLabel(seg),
    path: '/' + segments.slice(0, i + 1).join('/'),
  }));

  return (
    <nav
      aria-label="Breadcrumb"
      className="border-b border-border bg-background/80 px-4 py-1.5 backdrop-blur-sm"
    >
      <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        <li>
          <Link
            to="/"
            className="flex items-center gap-1 transition hover:text-foreground"
          >
            <Home className="h-3 w-3" aria-hidden="true" />
            Home
          </Link>
        </li>

        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <li key={crumb.path} className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3 text-muted-foreground/50" aria-hidden="true" />
              {isLast ? (
                <span
                  className="font-medium text-foreground"
                  aria-current="page"
                >
                  {crumb.label}
                </span>
              ) : (
                <Link
                  to={crumb.path}
                  className="transition hover:text-foreground"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
