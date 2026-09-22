# Research — Widget Management & Widget Types

**Feature**: 002-widget-management
**Date**: 2025-07-17

## Table of Contents

- [RD-01: Markdown Rendering Library](#rd-01-markdown-rendering-library)
- [RD-02: Widget Reorder DnD Strategy](#rd-02-widget-reorder-dnd-strategy)
- [RD-03: Timezone Picker Approach](#rd-03-timezone-picker-approach)
- [RD-04: Weather API Selection](#rd-04-weather-api-selection)
- [RD-05: System Status Polling Architecture](#rd-05-system-status-polling-architecture)
- [RD-06: Widget Type Registry Pattern](#rd-06-widget-type-registry-pattern)
- [RD-07: Edit Mode Widget Draft Strategy](#rd-07-edit-mode-widget-draft-strategy)
- [RD-08: Iframe Sandboxing](#rd-08-iframe-sandboxing)

---

## RD-01: Markdown Rendering Library

**Decision**: `react-markdown` v10 + `remark-gfm` v4

**Rationale**: react-markdown renders markdown via a remark/rehype AST pipeline that
produces React elements directly — no `dangerouslySetInnerHTML`. This is inherently
XSS-safe (FR-022, NFR-007) without requiring a separate sanitization step. It integrates
naturally with Tailwind's `@tailwindcss/typography` prose classes and supports custom
component overrides for links (open in new tab per spec).

**Alternatives considered**:

| Option | Rejected Because |
|--------|------------------|
| `marked` + `DOMPurify` | Outputs raw HTML strings requiring `dangerouslySetInnerHTML`; ~19× larger bundle; two packages to maintain for the same result |
| `remark` + `rehype-sanitize` | Lower-level; react-markdown already wraps this pipeline with a simpler API |

**New dependencies**: `react-markdown@^10`, `remark-gfm@^4`, `@tailwindcss/typography@^0.5`

**Implementation notes**:
- Links rendered with `target="_blank"` and `rel="noopener noreferrer"` via custom component override
- Prose container gets `overflow-y-auto` for scrollable content (FR-023)
- Empty content shows a helpful placeholder message (spec edge case)

---

## RD-02: Widget Reorder DnD Strategy

**Decision**: `@hello-pangea/dnd` v18 (primary) + up/down button fallback

**Rationale**: The spec allows "drag-and-drop or up/down controls" (FR-004). For
reordering 1–5 widgets in a dialog, `@hello-pangea/dnd` provides the simplest API
(`DragDropContext` → `Droppable` → `Draggable`) with excellent touch and keyboard
accessibility. Up/down arrow buttons are also provided as a simpler fallback for
accessibility and mobile users.

**Alternatives considered**:

| Option | Rejected Because |
|--------|------------------|
| `@dnd-kit/core` + `@dnd-kit/sortable` | More complex setup for the same use case; overkill for a 1–5 item vertical list |
| Up/down buttons only | Meets spec but less intuitive for users accustomed to drag interactions |
| CSS-only reorder (no library) | No real drag-and-drop; poor UX |

**New dependencies**: `@hello-pangea/dnd@^18`

**Implementation notes**:
- Widget list editor lives inside PlaceholderConfigDialog (or a dedicated "Manage Widgets" dialog)
- Each item shows: widget type icon, name, grip handle, configure button, delete button, up/down arrows
- `onDragEnd` recomputes `orderIndex` values and marks edit state dirty

---

## RD-03: Timezone Picker Approach

**Decision**: Native `Intl.supportedValuesOf('timeZone')` + shadcn/ui Combobox

**Rationale**: Modern browsers (Chrome 99+, Firefox 93+, Safari 15.4+) support
`Intl.supportedValuesOf('timeZone')` which returns all ~400 IANA timezone strings.
Combined with a shadcn/ui `Popover` + `Command` (cmdk) combobox for searchable
selection, this adds zero new dependencies to the bundle.

**Alternatives considered**:

| Option | Rejected Because |
|--------|------------------|
| `react-timezone-select` | Adds ~600 kB of dependencies (spacetime + timezone-soft); unnecessary when native API suffices |
| Hardcoded timezone list | Maintenance burden; incomplete coverage |

**Implementation notes**:
- `Intl.supportedValuesOf('timeZone')` called once on mount, memoized
- Display format: replace underscores with spaces, show UTC offset alongside
- Default value: `Intl.DateTimeFormat().resolvedOptions().timeZone` (browser local)
- Uses existing shadcn/ui `Command` component for fuzzy search

---

## RD-04: Weather API Selection

**Decision**: Open-Meteo free API (no authentication required)

**Rationale**: Open-Meteo provides a free, no-auth current weather API that accepts
latitude/longitude coordinates. It also offers a geocoding endpoint for location name
search. This aligns with the spec's assumption (Weather API uses a free, no-auth service)
and avoids managing API keys — no secrets to store (constitution: Secure-by-Default).

**API endpoints**:

| Endpoint | Purpose | Auth |
|----------|---------|------|
| `GET https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m&timezone=auto` | Current weather | None |
| `GET https://geocoding-api.open-meteo.com/v1/search?name={query}&count=5` | Location search | None |

**Alternatives considered**:

| Option | Rejected Because |
|--------|------------------|
| OpenWeatherMap | Requires API key (secret management overhead); free tier has lower limits |
| WeatherAPI.com | Requires API key |
| wttr.in | Unreliable; limited structured data |

**Implementation notes**:
- Backend proxies both endpoints to keep the browser LAN-only (constitution: LAN-only boundary)
- Weather data cached in-memory with TTL (5 min default) to survive rapid re-renders
- Geocoding results are not cached (transient search)
- WMO weather codes mapped to human-readable descriptions and emoji icons on the frontend
- Manual mode bypasses the API entirely — admin enters temperature + conditions text directly

---

## RD-05: System Status Polling Architecture

**Decision**: On-demand backend endpoint + frontend TanStack Query `refetchInterval`

**Rationale**: The simplest architecture that satisfies FR-032 (backend-side checks) and
FR-033 (configurable poll interval). No background job system or persistent polling state
is needed. The frontend widget calls a backend endpoint with the service list; the backend
performs HTTP requests and returns results. TanStack Query's `refetchInterval` triggers
periodic re-checks matching the widget's configured poll interval.

**Architecture**:

```
┌─────────────────────┐        ┌──────────────────────┐
│  SystemStatusWidget  │  POST  │  /api/admin/          │
│  (TanStack Query     │ ─────► │  status-check         │
│   refetchInterval)   │        │                       │
│                      │ ◄───── │  → HTTP GET each URL  │
│  [up] [down] [?]     │  JSON  │  → timeout: 10s       │
└─────────────────────┘        └──────────────────────┘
```

**Alternatives considered**:

| Option | Rejected Because |
|--------|------------------|
| Background polling daemon on backend | Complexity far exceeds need; dashboard may not always be open; wasteful for homelab |
| Server-Sent Events (SSE) | Adds connection management complexity; overkill for 60s poll interval |
| WebSocket push | Heaviest option; not justified for periodic status checks |
| Browser-side fetch | CORS blocks LAN service checks (FR-032 requires backend-side) |

**Implementation notes**:
- `POST /api/admin/status-check` accepts `{ services: [{ name, url, expectedStatus, timeout? }] }`
- Backend uses Node.js `fetch()` (available in Node 20+) with `AbortSignal.timeout()`
- Each check returns: `{ name, status: 'up' | 'down' | 'unknown', responseTimeMs, checkedAt }`
- Timeout defaults to 10s (FR-034); admin can override per-service
- Errors (DNS failure, connection refused, timeout) all map to `status: 'down'`
- Endpoint is admin-only (requireAdmin + CSRF) since it makes outbound HTTP requests

---

## RD-06: Widget Type Registry Pattern

**Decision**: Frontend-only TypeScript map; backend validates config per-type via Zod discriminated schemas

**Rationale**: The spec states "the widget type registry is a frontend-only construct"
(Assumptions section). The backend stores `type` as an opaque string and `configJson` as
a JSON blob. Adding a new widget type requires: (1) register in the frontend map, (2)
create display component, (3) create config form component — matching SC-008 (≤ 3 files).

**Frontend registry shape**:

```typescript
interface WidgetTypeDefinition {
  type: string;                    // e.g., 'clock', 'markdown'
  displayName: string;             // e.g., 'Clock / Date'
  description: string;             // Brief description for picker
  icon: LucideIcon;                // Icon for picker & list
  defaultConfig: Record<string, unknown>;
  DisplayComponent: React.ComponentType<{ config: unknown }>;
  ConfigFormComponent: React.ComponentType<{ config: unknown; onChange: (config: unknown) => void }>;
}

const widgetRegistry: Map<string, WidgetTypeDefinition> = new Map([...]);
```

**Backend validation**: Each widget type has a Zod schema in `validation.ts`. On
layout save, the backend validates `configJson` against the schema for the declared
`type`. Unknown types pass through (forward-compatible).

**Implementation notes**:
- WidgetRenderer does `registry.get(widget.type)?.DisplayComponent` instead of switch/case
- Widget picker iterates `registry.values()` to list all types (FR-037)
- `links_list` is retrofitted into the registry (existing component, no config form needed initially)

---

## RD-07: Edit Mode Widget Draft Strategy

**Decision**: Extend existing `useEditMode` hook with widget draft operations

**Rationale**: The current `useEditMode` manages placeholder drafts (add/remove/reorder/
configure) and saves via `PUT /api/admin/dashboards/:id/layout`. This same pattern extends
naturally to widgets — the `PlaceholderDraft` type already carries a `widgets` array for
display. The layout save endpoint already accepts `widgets` in each placeholder
(`LayoutWidgetInputSchema`). Widget drafts are tracked as part of each placeholder's draft.

**Extended draft operations**:
- `addWidget(stableKey, widgetType)` — adds a new widget draft to a placeholder
- `removeWidget(stableKey, widgetId)` — removes a widget from a placeholder's draft
- `reorderWidgets(stableKey, orderedIds)` — reorders widgets within a placeholder
- `updateWidgetConfig(stableKey, widgetId, config)` — updates a widget's configJson

**Implementation notes**:
- New widgets get a temporary UUID (no `persistedId`) until save
- `saveEdit` payload now includes widgets for each placeholder (previously omitted)
- The backend `updateLayout` service already handles widget upsert/delete by ID within a transaction
- Cancel discards all widget changes (same as placeholder changes per FR-006)

---

## RD-08: Iframe Sandboxing

**Decision**: Strict `sandbox` attribute with minimal permissions

**Rationale**: FR-017 requires preventing the embedded page from navigating the parent
or accessing the parent DOM. The HTML `sandbox` attribute provides this by default.
Selective permissions are added only as needed.

**Sandbox value**: `sandbox="allow-scripts allow-same-origin allow-forms"`

- `allow-scripts`: Required for most embedded web UIs (Grafana, Pi-hole, etc.)
- `allow-same-origin`: Required for embedded apps to use their own cookies/storage
- `allow-forms`: Required for embedded apps with login pages
- Omitted: `allow-top-navigation`, `allow-popups`, `allow-modals` — prevents parent manipulation

**Implementation notes**:
- Iframe also gets `referrerpolicy="no-referrer"` to prevent leaking the parent URL
- Loading state shown while iframe loads; error state if `onError` fires
- Empty URL shows a "Configure URL" placeholder message (FR-018)
