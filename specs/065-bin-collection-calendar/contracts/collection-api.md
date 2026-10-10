# Collection API Contract

**Status**: Planned additive routes, not implemented.  
**Base**: same-origin JSON API; existing session cookies, apiClient, CSRF and
`{error,message,details?}` error envelope. Strict objects reject unknown fields.

## Route and Permission Matrix

| Method / path | Access / success | Behavior |
| --- | --- | --- |
| GET `/api/admin/calendar/collections` | `requireAdmin`; 200 | Full private aggregate or unconfigured envelope; runtime epoch for drafts |
| POST `/api/admin/calendar/collections/preview` | `requireAdmin` + `assertCsrf`; 200 | Read-only proposed dates, validation impact and digest; ≤2 MiB body |
| PUT `/api/admin/calendar/collections` | `requireAdmin` + `assertCsrf`; 200 | Validated full aggregate, revision/epoch/digest checked, atomic save |
| GET `/api/user/calendar/widgets/:widgetId/collections` | `requireAuth`; 200 | Selected-widget display only; match existing signed-in dashboard read policy |
| GET `/api/public/calendar/widgets/:widgetId/collections` | No auth; 200 or non-enumerating 404 | Sole anonymous collection route, registered in `api/public.ts`; designated dashboard and public stream subset |

No public config catalogue, POST/PUT/PATCH/DELETE or source sync route is added.
Anonymous/non-admin access to admin routes yields 401/403 before payload detail.
Non-admin remains forbidden even if granted `settings:manage` or another generic
manage permission. Authenticated display resolves a real Calendar widget and
its placeholder/dashboard, rather than accepting arbitrary stream IDs.
Current `/api/dashboards/:dashboardId` permits `requireAuth` reads; this design
does not claim that un-enforced dashboard access-rule rows impose an extra ACL.

## Shared Types and Limits

DateKey = exact Gregorian `YYYY-MM-DD`, 1900-01-01 through 2199-12-31.
Colour = exact six-digit `#RRGGBB`; names trimmed 1–80 chars.
Timezone = Intl-supported named IANA timezone, ≤100 chars, no numeric offsets.
UUIDs = strict UUID strings; duplicates rejected.

Limits: ≤32 streams, ≤2,048 explicit dates/stream, ≤512 exceptions/regular stream,
≤8,192 total date/exception entries, ≤2 MiB body. Date range query uses inclusive
`from`/`to`, ordered and ≤731 days, or the agenda `daysAhead` query below.
No body coercion or date rollover acceptance.

### Private aggregate GET response

```json
{
  "configured": true,
  "revision": 3,
  "runtimeEpoch": "opaque-process-epoch",
  "timezone": "Australia/Sydney",
  "providerLabel": null,
  "streams": [
    {
      "id": "7c6f6a84-2a54-4c2f-b4ed-4029f2f0ecf1",
      "name": "Recycling",
      "color": "#EAB308",
      "enabled": true,
      "schedule": {
        "mode": "regular",
        "weekdays": [3],
        "intervalWeeks": 2,
        "anchorDate": "2026-10-14"
      },
      "exceptions": []
    }
  ]
}
```

Stream array order supplies `sortOrder`. Audit timestamps can be returned on
GET as server-owned metadata but are never accepted in drafts. For unconfigured
state: `{configured:false,revision:0,runtimeEpoch,timezone:null,providerLabel:null,
streams:[]}`. Zero streams is valid configured state; explicit schedules cannot
have empty lists (disable or remove the stream instead).

### Draft body (preview)

```json
{
  "expectedRevision": 3,
  "runtimeEpoch": "opaque-process-epoch",
  "timezone": "Australia/Sydney",
  "providerLabel": null,
  "streams": [],
  "range": { "from": "2026-10-10", "to": "2026-11-07" },
  "confirmations": {
    "timezoneConfirmed": true,
    "deletedStreamIds": [],
    "removedExceptionIds": [],
    "clearedExplicitStreamIds": []
  }
}
```

This example envelope does not authorise removing existing streams: if current
streams are omitted, `deletedStreamIds` must name each removed UUID and the UI
must show confirmation. New IDs may be client-generated UUIDs; submitted
existing IDs cannot change ownership or child references. Fields unknown to the
appropriate schedule union are rejected:

- Regular stream: `{id,name,color,enabled,schedule:{mode:"regular",weekdays,
  intervalWeeks,anchorDate},exceptions:[...]}`.
- Explicit stream: `{id,name,color,enabled,schedule:{mode:"explicit",dates:[...]}}`;
  no exception array or regular fields accepted.
- Exception: `{id,kind:"skip",originalDate}`, `{id,kind:"replace",originalDate,
  actualDate}` or `{id,kind:"add",actualDate}`; no unrelated keys.
- `expectedRevision` integer ≥0, epoch from current GET; no client-set timestamps.
- Confirmation lists name exactly the destructive differences, with no unknown
  IDs. Changing timezone/initial setup requires `timezoneConfirmed:true`;
  unchanged timezone can retain true without forcing another prompt.
- Switching explicit→regular confirms clearing that stream's explicit list.
  Regular→explicit confirms every removed exception ID. Direct exception
  deletion also confirms its removed ID. Stream deletion confirmation covers
  that stream's cascading children; no redundant child confirmation needed.

Preview validates field syntax and current revision/epoch. Structurally invalid
fields return 422. Semantically incomplete schedule drafts (orphan origins,
collisions, missing destructive confirmation) return 200 with `canSave:false`,
admin-only blockers identifying correction fields, and no partial mutation.
The preview must show origins/actual dates for editing but never publicly.

### Preview response

```json
{
  "canSave": true,
  "expectedRevision": 3,
  "runtimeEpoch": "opaque-process-epoch",
  "previewDigest": "sha256-of-canonical-draft-and-version-context",
  "range": { "from": "2026-10-10", "to": "2026-11-07" },
  "groups": [
    {
      "date": "2026-10-14",
      "streams": [
        {
          "key": "collection:7c6f6a84-2a54-4c2f-b4ed-4029f2f0ecf1:2026-10-14",
          "name": "Recycling",
          "color": "#EAB308"
        }
      ]
    }
  ],
  "blockers": [],
  "warnings": []
}
```

The digest is a consistency mechanism, not an auth secret or proof of human
approval. It binds canonical draft fields/order, confirmation lists, range,
revision, runtime epoch and engine contract version. Preview must not save or
materialize occurrences, update sync timestamps, or mutate widget selections.
Preset UI requests ≥four consecutive collection weeks; general edit preview
can show another bounded range. Collision validation covers the entire finite
exception set regardless of preview range.

PUT body is the same complete draft plus required `previewDigest`. Any edit
after preview invalidates it. Server revalidates all state, requires no blockers,
checks revision/epoch again inside one immediate transaction and commits or
rolls back all household/stream/child/selection changes. Success returns the
new private GET envelope. First setup expects revision 0, then creates revision 1.
Runtime epoch changes on process restart or successful full restore so stale
drafts fail even if restored persisted revisions match.

## Display Response

Authenticated/public display query accepts exactly one of:

- `{daysAhead}`: strict decimal integer query value 1–90. Server derives
  householdToday and inclusive range today…today+daysAhead in the configured
  timezone. Used for agenda, including initial load before client knows timezone.
- `{from,to}`: DateKey strings, inclusive ≤731-day range for fullscreen/
  explicit range navigation.

Reject mixed/partial/unknown window fields. Query-string parsing is explicit,
not permissive JavaScript numeric coercion. Private preview retains its explicit
body `range` shape; this display-window union is only for GET.
Public widget params are validated non-enumeratingly; resolve selection before
detailed range diagnostics. Disallow `streamIds`, `sourceIds`, `userId`, arbitrary
device-context override query or unknown keys. Device context is determined by
the existing server helper; it chooses the separately designated web/mobile
dashboard, not authentication strength.

```json
{
  "timezone": "Australia/Sydney",
  "householdToday": "2026-10-10",
  "serverNow": "2026-10-09T23:00:00.000Z",
  "range": { "from": "2026-10-10", "to": "2026-11-07" },
  "state": "ready",
  "groups": [
    {
      "date": "2026-10-14",
      "streams": [
        {
          "key": "collection:7c6f6a84-2a54-4c2f-b4ed-4029f2f0ecf1:2026-10-14",
          "name": "Recycling",
          "color": "#EAB308"
        }
      ]
    }
  ]
}
```

Allowlist only these keys. Group contains **all** enabled selected streams due
on that actual date. Names/colours may repeat; stable row keys distinguish them.
No provider label, description, schedule/anchor/weekdays/interval, explicit list,
exception/origin ID/date, user/source identity, config revision, runtime epoch,
enabled catalogue or management action is returned.
`serverNow` is UTC transport context, never collection time.

Authenticated states: `unconfigured`, `not_selected`, `disabled`,
`no_dates_in_range`, `exhausted`, `ready`, computed only for its selected scope.
Unconfigured returns null timezone/householdToday; client shows setup info without
admin controls for non-admin. `exhausted` requires only enabled explicit streams
selected and none with dates on/after householdToday, not merely outside range.
Public states: `ready` or `no_dates`; empty groups never disclose private causes.
All transport errors are separate from empty success data.

### Public resolution

1. Use `selectUnauthDashboard(detectDeviceContext(request))`; no designation →404.
2. Join actual widget through placeholder to that dashboard; require type Calendar.
3. Strictly parse its saved collection selection; absent/empty public list →404.
4. Resolve only existing public IDs also present in `collectionStreamIds`, and
   generate only enabled matches. No widening on malformed config or deleted IDs.
5. Send fresh allowlisted DTO with `Cache-Control:no-store`, existing public
   widget IP rate limit. No cached generation is allowed to bypass the resolver.

Calendar remains intrinsic public for its legacy provider content. The new
`publicCollectionStreamIds` selection is the collection-specific publish control;
it is **not** inferred from intrinsic visibility or a generic `publicVisibility`
flag which was designed for other widget types.
Public bootstrap projects only that public subset as `collectionStreamIds`
and removes `publicCollectionStreamIds`, never the authenticated selection list.
Revoking designation/selection denies the next fetch even with a previously
valid widget ID; client removes previously rendered collection data on denial.

## Error and Transaction Contract

| Status | Code / expected action |
| --- | --- |
| 401 | `UNAUTHORIZED`; login, clear privileged collection cache |
| 403 | `FORBIDDEN` for role/CSRF; no state changes, no private diagnostics |
| 404 | `NOT_FOUND`; public unavailable widget response identical for guessed/hidden/wrong-context widget; clear display |
| 409 | `RESOURCE_CONFLICT`; stale epoch/revision/digest, destructive confirmation or actual-date conflict; retain draft, reload/resolve and re-preview |
| 422 | `VALIDATION_ERROR`; precise admin field paths without full payload/SQL echo |
| 413 | scoped body-limit response; safe existing error envelope, never generic 500 |
| 429 | `TOO_MANY_REQUESTS`; existing per-IP limit, safe retry |
| 500 | `INTERNAL_ERROR`; safe retry and request correlation, no SQL/private input leaked |

An unsaveable semantic preview reports blockers without mutation; PUT rejects
it with 409 (collisions/confirmation) or 422 (invalid schedule state).
SQLite busy/IO failure rolls back and returns safe retry failure, not partial
success. Validate bounds before expensive work and no await/outbound work inside
transaction. Error handling must sanitise DB errors before global logger sees
private input or bind values. GET/preview do not write collection tables.

## Backup Contract Extension

Portable envelope v2 includes all four arrays from [data-model.md](../data-model.md)
and normal widget selections; generated display groups are excluded. V2 requires
complete strictly validated collection data. V1 remains accepted by new readers,
defaulting absent arrays empty and warning that full restore removes collections.
Reject collection-bearing v1 payloads rather than mislabelling them; old v1-only
readers reject v2 by version. FK/mode/row limits/date/collision/selection semantic
validation occurs before destructive restore; any insertion failure rolls back.
Private backup content is never exposed through public calendar APIs.
