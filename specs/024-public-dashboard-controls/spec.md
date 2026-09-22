# 024 — Public Dashboard Widget Visibility & Controls

> GitHub Issue: #66

## Problem

When a dashboard is marked as public (viewable without login), all widgets render identically to the logged-in view. Some widgets expose sensitive data or dangerous controls (e.g., Pi-hole disable, Docker restart) that shouldn't be available to unauthenticated viewers.

## Goals

- Per-widget control over what public viewers see
- Three visibility modes: visible, hidden, read-only
- Widget-specific control toggles for interactive elements
- No backend data leakage for hidden widgets
- Zero config needed for sensible defaults

## Design Principles

1. **Secure by default** — dangerous controls hidden for public unless explicitly enabled
2. **Per-widget granularity** — not all-or-nothing
3. **Simple mental model** — three modes cover 99% of cases
4. **LAN-aware** — Sonos controls are safe (LAN-only), default to visible

## Visibility Modes

| Mode | Behavior | Data fetched? |
|------|----------|---------------|
| `visible` | Widget renders normally | Yes |
| `read-only` | Widget shows data, hides controls (buttons, inputs) | Yes |
| `hidden` | Widget/placeholder not rendered, no API calls made | No |

## Default Visibility Per Widget Type

| Widget | Default Public Mode | Rationale |
|--------|-------------------|-----------|
| Clock/Date | visible | No sensitive data |
| Weather | visible | Public info |
| Calendar | visible | Events may be private but user chose to make dashboard public |
| Photo Frame | visible | User chose to display |
| Markdown/Notes | visible | Static content |
| Links List | visible | Navigation |
| App Shortcuts | visible | Navigation |
| Iframe | visible | User chose to embed |
| System Status | visible | Service health is informational |
| Sonos | visible | LAN-only, controls fine |
| Spotify | read-only | Show now-playing, hide controls (requires auth) |
| Pi-hole | read-only | Show stats, hide disable button |
| Docker | read-only | Show status, hide start/stop/restart |
| UniFi | hidden | Network data is sensitive |
| Stocks | hidden | Portfolio is private |
| Todo | hidden | Personal tasks |

## Data Model

Add to `app_widget_instances` (or in `configJson`):

```sql
-- Option A: dedicated column
ALTER TABLE app_widget_instances ADD COLUMN publicVisibility TEXT DEFAULT NULL;
-- NULL = use widget-type default, 'visible' | 'read-only' | 'hidden'
```

Or in `configJson`:
```jsonc
{
  // ... existing widget config
  "publicVisibility": "read-only",  // null = use type default
  "publicControls": {
    "showDisableButton": false,  // Pi-hole specific
    "allowPlayback": true        // Sonos specific
  }
}
```

**Recommendation**: Use `configJson` — no migration needed, widget-specific controls are naturally scoped there.

## API Changes

### Public dashboard endpoint

`GET /api/public/dashboards/:id` already exists. Changes:

1. Filter out `hidden` widgets from response (don't send data at all)
2. Add `publicVisibility` field to each widget in response
3. Frontend uses this to conditionally render controls

### Widget data routes

Routes like `/api/widgets/pihole/stats`, `/api/widgets/docker/containers`:

- Already served to public viewers (dashboard is public)
- For `hidden` widgets: frontend won't request data (widget not rendered)
- For `read-only` widgets: data routes remain accessible, action routes are blocked

### Action routes (mutations)

Routes like `POST /api/widgets/pihole/disable`, `POST /api/widgets/docker/:id/restart`:

- Check if request comes from public viewer (no session)
- Check widget's `publicVisibility` — if not `visible`, reject with 403
- Check widget-specific `publicControls` overrides

## Frontend Implementation

### `useIsPublicView()` hook

```typescript
function useIsPublicView(): boolean {
  const { user } = useBootstrap();
  return user === null;
}
```

### Widget wrapper

```typescript
function WidgetRenderer({ widget, isPublic }) {
  const visibility = widget.publicVisibility ?? getDefaultVisibility(widget.type);
  
  if (isPublic && visibility === 'hidden') return null;
  
  return <WidgetComponent 
    {...widget} 
    readOnly={isPublic && visibility === 'read-only'} 
  />;
}
```

### Per-widget control hiding

Each widget checks a `readOnly` prop:

```typescript
// PiholeWidget.tsx
function PiholeWidget({ config, readOnly }) {
  return (
    <div>
      <StatsDisplay stats={stats} />
      {!readOnly && config.publicControls?.showDisableButton !== false && (
        <DisableButton />
      )}
    </div>
  );
}
```

## Settings UI

In the widget/placeholder edit panel (WidgetsTab), add a "Public View" section:

```
┌─────────────────────────────────────────────┐
│  Public View                                │
│                                             │
│  When this dashboard is viewed without      │
│  logging in:                                │
│                                             │
│  Visibility: [● Visible] [Read-only] [Hidden]│
│                                             │
│  Controls (when visible):                   │
│  ☑ Allow playback controls (Sonos)          │
│  ☐ Show disable button (Pi-hole)            │
└─────────────────────────────────────────────┘
```

Only shows widget-specific control toggles when the widget type has them and visibility isn't `hidden`.

## Implementation Plan

1. **Add `publicVisibility` to configJson schema** — update validation
2. **Update public dashboard API** — filter hidden widgets, include visibility field
3. **Add `readOnly` prop to all interactive widgets** — hide controls when true
4. **Block action routes for public viewers** — middleware check
5. **Settings UI** — visibility picker + control toggles in widget edit panel
6. **Defaults** — hardcode sensible defaults per widget type

## Security Considerations

- Backend must enforce — frontend hiding is UX, not security
- Action routes MUST check auth regardless of frontend state
- Hidden widgets must not leak data through API (don't include in public response)
- Rate limiting on public data routes to prevent scraping

## Edge Cases

- Widget visibility set to `visible` but dashboard is private → no effect (login required anyway)
- Admin viewing public dashboard while logged in → sees everything (visibility only applies to unauthenticated)
- Widget type doesn't have controls → `read-only` behaves same as `visible`
