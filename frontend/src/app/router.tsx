/**
 * T036: Frontend router skeleton.
 * T057/T058/T059/T060 (US1): Pages wired.
 * T075 (US2): SettingsPage wired.
 * Phase R6: DashboardManagementPage wired.
 * Uses React Router v6 with a root layout and route placeholders.
 * Route-level code splitting via React.lazy for optimal initial load.
 */

import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Outlet, Navigate } from 'react-router-dom';
import { ChunkErrorBoundary } from '../components/ChunkErrorBoundary.js';

// ─── Lazy-loaded route pages ────────────────────────────────────────────────
const DashboardPage = lazy(() => import('../pages/DashboardPage.js').then(m => ({ default: m.DashboardPage })));
const FirstRunPage = lazy(() => import('../pages/FirstRunPage.js').then(m => ({ default: m.FirstRunPage })));
const LoginPage = lazy(() => import('../pages/LoginPage.js').then(m => ({ default: m.LoginPage })));
const SettingsPage = lazy(() => import('../pages/SettingsPage.js').then(m => ({ default: m.SettingsPage })));

// ─── Loading fallback ───────────────────────────────────────────────────────
function LoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted-foreground/20 border-t-primary" />
    </div>
  );
}

/** Root layout — wraps all pages with shell chrome (added in Phase 3). */
function RootLayout() {
  return (
    <ChunkErrorBoundary>
      <Suspense fallback={<LoadingFallback />}>
        <Outlet />
      </Suspense>
    </ChunkErrorBoundary>
  );
}

/** Internal — not exported to avoid non-portable type inference issues. */
const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: 'first-run',
        element: <FirstRunPage />,
      },
      {
        path: 'login',
        element: <LoginPage />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
      {
        path: 'admin/dashboards',
        element: <Navigate to="/settings?tab=dashboards" replace />,
      },
      {
        path: 'admin/groups',
        element: <Navigate to="/settings?tab=groups" replace />,
      },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
