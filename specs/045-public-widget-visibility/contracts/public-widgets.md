# Phase 1 Contracts — Public Widget Visibility

**Feature**: `045-public-widget-visibility` | **Plan**: [../plan.md](../plan.md)

All anonymous widget data is served through one GET-only route registered in
the existing public route module. Existing authenticated widget routes and
guards remain unchanged.

---

## Table of Contents

- [GET /api/public/bootstrap](#get-apipublicbootstrap)
- [GET /api/public/widgets/:widgetId](#get-apipublicwidgetswidgetid)
- [PUT /api/admin/dashboards/:dashboardId/layout](#put-apiadmindashboardsdashboardidlayout)
- [PUT /api/admin/widgets/:widgetId](#put-apiadminwidgetswidgetid)
- [Error and security contract](#error-and-security-contract)

---

## GET /api/public/bootstrap

**Auth**: none  
**Mutation**: none

The top-level response shape is unchanged. `dashboard.placeholders[].widgets`
is filtered server-side before serialization:

- intrinsically public types remain;
- explicitly exposable types remain only when `publicVisibility` is
  `read-only` or `visible`;
- Docker and unsupported types are removed regardless of mode;
- placeholders with zero remaining widgets are removed.

Public widget objects retain the fields needed to render: `id`, `type`,
`orderIndex`, safe `config`, and `links`. They do **not** include
`publicVisibility`, `publicSourceUserId`, credentials, integration URLs or
connection ids.

Signed-in dashboard endpoints are not filtered and include `publicVisibility`
for the administration surface.

---

## GET /api/public/widgets/:widgetId

**Auth**: none, explicitly public  
**Rate limit**: public-widget per-IP policy  
**Method**: GET only

### Request

| Parameter | Location | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `widgetId` | path | UUID | yes | Used only after resolution through the selected public dashboard |

Device context is detected with the same server helper used by public
bootstrap. The route does not accept dashboard ids, connection ids, provider
URLs, Sonos group ids, stock symbols or any other target selector.

### Success

`200`:

```json
{
  "widgetId": "uuid",
  "type": "pihole",
  "data": {},
  "refreshedAt": "2026-09-18T04:00:00.000Z"
}
```

`type` is one of:

- `pihole`
- `unifi`
- `sonos_music`
- `stocks`
- `app_shortcuts`

`data` follows the allowlisted type-specific shape in
[data-model.md](../data-model.md#payload-shapes).

### Denial and unavailability

`404` with the existing generic not-found error shape for all of:

- no public dashboard selected;
- malformed or missing widget id;
- widget does not exist;
- widget belongs to another dashboard;
- widget mode is `hidden`;
- widget type is unsupported or Docker;
- required integration configuration/account is missing;
- initial integration load fails and no bounded stale snapshot exists.

The public response must not distinguish these cases by body, status or
provider-derived text. Structured server logs may record a redacted internal
reason.

`429` uses the existing Fastify rate-limit response.

No public route returns `401`; normal public rendering does not call an
authenticated route.

### Cache behavior

Authorization is evaluated before every cache lookup. A fresh snapshot may be
returned immediately. An expired value may be returned within its bounded stale
window while one shared refresh runs. Concurrent misses for the same key invoke
the integration loader exactly once.

---

## PUT /api/admin/dashboards/:dashboardId/layout

**Auth**: admin + CSRF

Each widget input gains:

```json
{
  "id": "uuid",
  "type": "pihole",
  "orderIndex": 0,
  "configJson": "{}",
  "publicVisibility": "read-only"
}
```

`publicVisibility` is optional for compatibility; omitted values preserve an
existing widget's mode and default a new widget to `hidden`.

The client cannot send `publicSourceUserId`. The server binds the authenticated
admin as described in
[data-model.md](../data-model.md#public-source-principal).

Response dashboard widgets include `publicVisibility` for admin rendering.

---

## PUT /api/admin/widgets/:widgetId

**Auth**: admin + CSRF

Optional request field:

```json
{ "publicVisibility": "hidden" }
```

Changing visibility:

- takes effect on the next public bootstrap/data request;
- invalidates the widget snapshot;
- writes a structured audit log with actor, widget, type and old/new mode;
- binds or clears the internal source principal according to the data model.

The response includes `publicVisibility` but never `publicSourceUserId`.

---

## Error and security contract

- Existing authenticated Pi-hole, UniFi, Sonos, stocks and app-shortcut route
  guards do not change.
- There is no public POST, PUT, PATCH or DELETE route.
- Docker has no public loader and is always denied.
- Public responses are constructed from allowlist projections.
- Credential-shaped fields (`token`, `password`, `secret`, `credential`,
  `baseUrl`, `endpoint`, `connectionId`, `oauthAccountId`,
  `publicSourceUserId`) are forbidden recursively in public payloads.
- A hidden/private/missing widget produces one constant 404 body.
- Public requests cannot select an outbound target through path/query/body
  fields.

