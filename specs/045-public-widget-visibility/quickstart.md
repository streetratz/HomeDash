# Phase 1 Quickstart — Public Widget Visibility

**Feature**: `045-public-widget-visibility` | **Plan**: [plan.md](./plan.md)

How to expose one integration widget safely and verify both the public and
signed-in experiences.

---

## Table of Contents

- [Upgrade behavior](#upgrade-behavior)
- [Expose a widget](#expose-a-widget)
- [Verify anonymous behavior](#verify-anonymous-behavior)
- [Verify signed-in behavior](#verify-signed-in-behavior)
- [Run automated verification](#run-automated-verification)
- [Troubleshooting](#troubleshooting)

---

## Upgrade behavior

After migration, every integration widget is `hidden` for anonymous visitors.
Signed-in dashboards are unchanged.

Intrinsically public widgets such as clocks, weather, calendar, links,
markdown, iframe and photo frame remain on the public dashboard. Docker,
Spotify, todo and system-status widgets remain unavailable publicly.

No environment variable or deployment change is required.

---

## Expose a widget

1. Sign in as an administrator.
2. Open the dashboard currently selected as the unauthenticated web or mobile
   dashboard.
3. Enter edit mode.
4. Open the widget/placeholder configuration surface.
5. Change **Public visibility** from **Hidden** to **Read-only**.
6. Read the exposure warning and save the dashboard.

The widget shows an at-a-glance public indicator while editing.

`Visible` is also accepted, but is read-only in this release. Public controls
are not supported.

For Sonos cloud, saving an exposed mode binds the widget internally to the
signed-in administrator's connected Sonos account. The account identifier is
never returned publicly.

---

## Verify anonymous behavior

Use a private browser window with no HomeDash session.

1. Load the public dashboard.
2. Confirm the exposed widget renders live data.
3. Confirm hidden integration widgets and empty placeholders are absent.
4. Confirm Docker is absent even if its stored visibility was changed.
5. In browser developer tools, confirm widget requests use:

   ```text
   GET /api/public/widgets/<widget-id>
   ```

6. Confirm the page makes no requests to authenticated Pi-hole, UniFi, Sonos,
   stocks, app-shortcut or Docker routes.
7. Confirm Sonos and Pi-hole control buttons are absent.

Revoking the widget to **Hidden** and reloading must remove it and make the
public snapshot URL return the same 404 as a random widget id.

---

## Verify signed-in behavior

Sign in as both an administrator and a standard user:

- all widgets render according to existing role permissions;
- public visibility does not restrict signed-in reads;
- existing control routes retain their current auth/admin/CSRF requirements;
- Docker behavior is unchanged.

---

## Run automated verification

From the repository root:

```bash
pnpm --filter backend exec vitest run \
  tests/unit/publicWidgetSnapshotCache.test.ts \
  tests/integration/publicWidgetVisibility.test.ts \
  tests/integration/widgetDataPermissions.test.ts

pnpm --filter frontend test:unit
pnpm typecheck
pnpm build
```

Run the public-view Playwright spec with the app running:

```bash
pnpm dev
PLAYWRIGHT_BASE_URL=http://localhost:5173 \
  pnpm --filter frontend exec playwright test \
  tests/e2e/publicWidgetVisibility.spec.ts
```

Repository-wide lint, typecheck, backend test and OpenAPI results must be
compared with the recorded feature baselines because the repository contains
known pre-existing findings.

---

## Troubleshooting

| Symptom | Likely cause | Action |
| --- | --- | --- |
| Widget is absent publicly | Mode is hidden, widget is not on the selected public dashboard, or its type is unsupported | Verify dashboard designation and set the widget to Read-only |
| Sonos is absent after exposure | Cloud account binding is missing/deleted, or local discovery has no speakers | Save Hidden, then Read-only while signed in as the admin whose Sonos account should supply the data |
| Widget appears but controls are missing | Expected | Anonymous widgets are read-only in every mode |
| Public widget URL returns 404 | Expected for hidden, private, unsupported, missing or unavailable widgets | Check server logs while authenticated as operator; public errors intentionally reveal no detail |
| Many viewers are open | Expected to share one backend snapshot refresh | Verify loader call-count tests; browser count must not multiply integration polling |
| Docker is absent | Expected | Docker is never publicly exposable |
