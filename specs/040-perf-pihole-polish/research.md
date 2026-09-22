# Research — Performance Optimizations & Pi-hole Widget Polish

**Feature Branch**: `040-perf-and-polish`  
**Date**: 2026-06-22

## Table of Contents

- [R1: React.lazy Code Splitting with React Router v6](#r1-reactlazy-code-splitting-with-react-router-v6)
- [R2: TanStack Query staleTime and refetchInterval for Stale-While-Revalidate](#r2-tanstack-query-staletime-and-refetchinterval-for-stale-while-revalidate)
- [R3: Visibility-Aware Polling (Page Visibility + Intersection Observer)](#r3-visibility-aware-polling-page-visibility--intersection-observer)
- [R4: Vite Manual Chunks Coexistence with Route-Level Splitting](#r4-vite-manual-chunks-coexistence-with-route-level-splitting)
- [R5: CSS Responsive Techniques for Compact Widget Layout](#r5-css-responsive-techniques-for-compact-widget-layout)
- [R6: Chunk Load Error Recovery Patterns](#r6-chunk-load-error-recovery-patterns)

---

## R1: React.lazy Code Splitting with React Router v6

**Decision**: Use `React.lazy()` + `<Suspense>` for route-level code splitting within the existing `createBrowserRouter` setup.

**Rationale**: React.lazy is the standard React approach for component-level code splitting. It integrates naturally with React Router v6's route definitions. Each page component becomes a separate Vite chunk automatically — no additional Vite plugin required.

**Implementation pattern**:
```tsx
const DashboardPage = lazy(() => import('../pages/DashboardPage.js'));
const SettingsPage = lazy(() => import('../pages/SettingsPage.js'));
// ... wrap route elements in <Suspense fallback={<LoadingIndicator />}>
```

**Alternatives considered**:
- **React Router `lazy` route property** (v6.4+ data router feature): More elegant for data-fetching routes, but HomeDash routes don't use loader/action patterns. Would require restructuring route definitions for minimal benefit.
- **Loadable Components**: Third-party library adds SSR support we don't need. React.lazy is sufficient for client-only SPA.
- **Vite dynamic import without React.lazy**: Would lose Suspense integration and require manual loading state management.

---

## R2: TanStack Query staleTime and refetchInterval for Stale-While-Revalidate

**Decision**: Use TanStack Query's built-in `staleTime` and `refetchInterval` options to implement stale-while-revalidate without custom logic.

**Rationale**: The existing codebase already uses these options (e.g., `usePiholeStats` currently has `staleTime` and `refetchInterval` set to `pollIntervalSec * 1000`). The change is simply adjusting the default values: `staleTime: 30_000` (30s stale window) and `refetchInterval: 60_000` (60s refetch). TanStack Query already keeps stale data visible during refetch by default (`keepPreviousData` behaviour).

**Configuration pattern**:
```ts
// Pi-hole / UniFi
staleTime: 30_000,        // Data considered stale after 30s
refetchInterval: 60_000,  // Refetch every 60s
// User override: if pollIntervalSec is set, use that * 1000 instead
```

**Alternatives considered**:
- **SWR library**: Would require replacing TanStack Query entirely. Not justified for an interval change.
- **Custom polling with setInterval**: Loses all TanStack Query benefits (caching, deduplication, background refetch). Rejected.
- **refetchOnWindowFocus only**: Insufficient — users expect periodic updates without switching tabs.

---

## R3: Visibility-Aware Polling (Page Visibility + Intersection Observer)

**Decision**: Create a custom `useVisibility(ref)` hook combining `document.visibilityState` (Page Visibility API) and `IntersectionObserver` to determine if a widget is "active" (tab visible AND element in viewport). Use this to conditionally set `refetchInterval` in TanStack Query.

**Rationale**: TanStack Query already pauses refetching when `refetchInterval` is set to `false`. The Spotify widget can conditionally pass `refetchInterval: isVisible ? interval : false`. This avoids polling when the tab is hidden or the widget is scrolled out of view.

**Implementation pattern**:
```ts
function useWidgetVisibility(ref: RefObject<HTMLElement>): boolean {
  // Combines: document.visibilityState === 'visible' AND IntersectionObserver entry.isIntersecting
  // Returns true only when BOTH conditions are met
}

// In Spotify hook:
refetchInterval: isVisible ? (isPlaying ? 5_000 : 30_000) : false
```

**Browser support**: Page Visibility API and IntersectionObserver are supported in all evergreen browsers (Chrome 33+, Firefox 55+, Safari 12.1+, Edge 15+). No polyfill needed per project assumptions.

**Alternatives considered**:
- **TanStack Query `refetchOnWindowFocus` only**: Only handles tab focus, not viewport intersection. Insufficient for scroll-based visibility.
- **Third-party `react-intersection-observer` package**: Adds a dependency for a simple 20-line hook. Rejected — IntersectionObserver API is straightforward.
- **requestAnimationFrame-based check**: Wasteful and less accurate than IntersectionObserver. Rejected.

---

## R4: Vite Manual Chunks Coexistence with Route-Level Splitting

**Decision**: Keep existing `manualChunks` configuration (vendor, query, grid) and let React.lazy dynamic imports create additional route-level chunks automatically.

**Rationale**: Vite/Rollup handles dynamic imports (from `React.lazy(() => import(...))`) by creating separate chunks automatically. The existing `manualChunks` config only affects statically imported modules — it won't interfere with lazy route chunks. The shared vendor/query/grid chunks will still be extracted as common dependencies, reducing duplication across route chunks.

**Expected chunk layout post-change**:
```
dist/assets/
├── vendor-[hash].js      (react, react-dom, react-router-dom)
├── query-[hash].js       (tanstack/react-query)
├── grid-[hash].js        (react-grid-layout)
├── DashboardPage-[hash].js   (lazy route chunk)
├── SettingsPage-[hash].js    (lazy route chunk)
├── FirstRunPage-[hash].js    (lazy route chunk)
├── LoginPage-[hash].js       (lazy route chunk)
└── index-[hash].js       (entry: router, providers, shared components)
```

**Alternatives considered**:
- **Removing manualChunks entirely**: Would let Vite auto-split everything, but may create too many small chunks or inline shared deps in multiple route chunks. The current manual config produces good vendor splitting.
- **Adding route chunks to manualChunks**: Unnecessary — React.lazy already triggers code splitting. Explicit listing would be fragile to maintain.

---

## R5: CSS Responsive Techniques for Compact Widget Layout

**Decision**: Use Tailwind CSS responsive utilities and CSS container queries (or explicit size props from the grid) to create a compact layout for the Pi-hole widget at ≤180px.

**Rationale**: The Pi-hole widget currently uses fixed padding (`p-2`), absolute icon sizes (`h-3.5 w-3.5`), and text classes (`text-xs`, `text-[10px]`) that work at standard sizes but overflow at 180px cells. The fix involves: (1) reducing padding, (2) using `overflow-hidden` + `text-ellipsis` for long text, (3) conditionally hiding or stacking panels based on available width, and (4) reducing icon/font sizes at compact breakpoints.

**Approach**:
- The widget receives its container size from the grid layout system. Pass a `compact` boolean prop when the cell width is ≤ 200px.
- In compact mode: single-column stacked layout, smaller icons (`h-3 w-3`), tighter padding (`p-1.5`), text truncation on labels/values, hide non-essential stat rows.
- Use `truncate` (Tailwind's `overflow-hidden text-ellipsis whitespace-nowrap`) for all stat values to prevent overflow.

**Alternatives considered**:
- **CSS Container Queries (`@container`)**: Elegant solution but requires adding `container-type: inline-size` to the parent. Could be used but adds complexity — a prop-based approach is simpler given the grid already knows cell size.
- **CSS `clamp()` for font sizing**: Good for gradual scaling but harder to control specific breakpoints. Rejected for this use case where we want a discrete compact mode.
- **Separate `PiholeWidgetCompact` component**: Duplicates logic and complicates maintenance. A single component with conditional styling is preferred.

---

## R6: Chunk Load Error Recovery Patterns

**Decision**: Implement a React Error Boundary that catches chunk load failures (typically `ChunkLoadError` or network errors from dynamic imports) and renders a user-friendly "Something went wrong" UI with a retry button that triggers a full page reload.

**Rationale**: When a deployment occurs and chunk hashes change, users on stale tabs will get `ChunkLoadError` when navigating. A page reload fetches the fresh `index.html` with updated chunk references. React Error Boundaries are the standard way to catch render-time errors from Suspense/lazy.

**Implementation pattern**:
```tsx
class ChunkErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError(error) {
    // Detect chunk load error (name varies by bundler)
    if (error.name === 'ChunkLoadError' || error.message?.includes('Loading chunk')) {
      return { hasError: true };
    }
    throw error; // Re-throw non-chunk errors
  }
  handleRetry = () => window.location.reload();
  render() {
    if (this.state.hasError) return <ErrorFallback onRetry={this.handleRetry} />;
    return this.props.children;
  }
}
```

**Alternatives considered**:
- **Service Worker cache busting**: Too complex for a LAN-only dashboard. Adds operational complexity.
- **Retry dynamic import automatically (with backoff)**: Good pattern (`retryLazy`) — could retry the import 2-3 times before showing error. Worth combining with the error boundary as a defence-in-depth approach.
- **Toast notification instead of error boundary**: Insufficient — if the chunk truly fails, the route can't render. A full fallback UI is required.
