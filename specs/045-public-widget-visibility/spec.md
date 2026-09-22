# Feature Specification: Public Dashboard Widget Visibility & Control Permissions

**Feature Branch**: `045-public-widget-visibility`  
**Created**: 2026-Sep-18  
**Status**: Draft  
**Input**: GitHub issue [#66](https://github.com/streetratz/HomeDash/issues/66) (Public dashboard widget visibility and control permissions).

## Context

An administrator can designate a dashboard as the public one — the view served
to a visitor who has not signed in. Today that designation is all-or-nothing in
a way that satisfies nobody:

- **The dashboard is delivered in full.** `/api/public/bootstrap` returns the
  complete nested view of the selected dashboard — placeholders, widgets, links
  and widget configuration — to any anonymous caller.
- **None of the data behind it is.** Every integration widget fetches its data
  from an authenticated route. Pi-hole and UniFi stats, Sonos playback state,
  stock quotes, Docker container listings and app shortcuts all require a
  session.
- **So the public dashboard renders as a wall of failures.** Each widget mounts,
  fires its request, receives 401 and falls into its loading or error state.
  Feature 043 deliberately made Docker's failures *visible and specific*, which
  improves the signed-in experience and makes the logged-out one worse: the
  public dashboard now advertises its own brokenness.

There is no way for an administrator to express the thing they actually want,
which is per-widget: *this one is fine for anyone to see, that one is not, and
this third one may be looked at but not touched.*

The issue proposes a three-mode visibility setting per widget (`visible`,
`hidden`, `read-only`) plus per-widget-type control toggles.

### Why this is security-sensitive, not cosmetic

This feature decides what an unauthenticated visitor on a hostile LAN can see
and do. Constitution §I governs it directly and constrains the design more
tightly than the issue assumes:

- Unauthenticated endpoints are permitted **only** as "explicitly-designated
  public, read-only resources required to render the admin-selected public
  dashboard".
- **Public endpoints MUST be GET-only.**
- Authorization MUST be explicit and default-deny.
- Public endpoints MUST NOT expose settings or admin-only metadata.

Two consequences follow, and both narrow the issue's proposal:

1. **Hiding a control in the UI is not a permission.** If a widget's data route
   becomes reachable without a session, then that data is public regardless of
   what the frontend draws. Every rule in this feature must be enforced by the
   server; the frontend may only reflect a decision the server has already made.
2. **"Public controls" cannot be granted as the issue describes them.** The
   issue suggests Sonos `allowPublicControls` defaulting to `true` "since
   LAN-only". Sonos transport control is `POST /api/sonos/groups/:id/play` and
   friends — state-changing, non-GET, and therefore not eligible to be public
   under §I. Confirmed with the requester: anonymous visitors may see Sonos
   playback state but not control it. See Assumptions.

Feature 043 (#189) has just closed an unauthenticated hole on precisely these
grounds. This feature must not reopen it, and must not become a general-purpose
mechanism for making authenticated routes anonymous.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A public dashboard that does not look broken (Priority: P1)

An administrator has chosen a public dashboard for the hallway tablet. They
have not configured anything else. They expect the visitor's view to show the
widgets that are safe by nature — clock, weather, calendar, links, markdown,
photo frame — and to simply *not show* the widgets whose data requires a
session, rather than showing a grid of error states.

**Why this priority**: This is the defect a user actually experiences today,
and it is fixable without any new permission model: it is the default-deny
behaviour that should have existed from the start. It delivers value alone —
a clean public dashboard — and every later story refines it.

**Independent Test**: Mark a dashboard public, place one integration widget and
one static widget on it, sign out, and load the dashboard. The static widget
renders; the integration widget is absent; no error state and no failed
authenticated request is visible to the anonymous viewer.

**Acceptance Scenarios**:

1. **Given** a public dashboard containing a Pi-hole widget and a clock widget,
   **When** an anonymous visitor loads it, **Then** the clock renders and the
   Pi-hole widget is not rendered at all.
2. **Given** that same dashboard, **When** an anonymous visitor loads it,
   **Then** no request to an authenticated widget data route is issued by the
   page.
3. **Given** that same dashboard, **When** a signed-in user loads it, **Then**
   both widgets render exactly as they do today.
4. **Given** a placeholder whose every widget is unavailable publicly,
   **When** an anonymous visitor loads the dashboard, **Then** the layout does
   not leave a conspicuous empty frame where the placeholder was.

---

### User Story 2 - Choosing what the public may see (Priority: P1)

An administrator wants the hallway tablet to show Pi-hole's block statistics —
it is their own house, and they consider that harmless — but not the UniFi
network detail. They expect to make that choice per widget, for it to be
obvious which widgets are exposed, and for the default to be "not exposed".

**Why this priority**: Without this, story 1 is a blunt instrument that removes
every integration widget from public dashboards with no recourse. Together the
two stories are the feature.

**Independent Test**: Set one widget to public-visible, leave another at the
default, sign out, and confirm exactly the first one renders with live data.

**Acceptance Scenarios**:

1. **Given** a widget whose public visibility has never been configured,
   **When** an anonymous visitor loads the dashboard, **Then** the widget is
   not rendered and its data is not served.
2. **Given** an administrator sets a Pi-hole widget to be publicly visible,
   **When** an anonymous visitor loads the dashboard, **Then** the widget
   renders with live statistics.
3. **Given** that widget is publicly visible, **When** an anonymous visitor
   loads it, **Then** the response contains no credential, token, endpoint
   URL, or other configuration metadata beyond what the display needs.
4. **Given** an administrator revokes public visibility, **When** an anonymous
   visitor reloads, **Then** the widget disappears and its public data route
   stops serving that widget.
5. **Given** a widget marked publicly visible, **When** a request names a
   *different* widget that is not marked public, **Then** the response is the
   same denial as for a widget that does not exist.

---

### User Story 3 - Look, don't touch (Priority: P2)

An administrator is happy for a visitor to see that the living room is playing
music, or that Pi-hole is currently blocking, but not to pause the music or
disable blocking. They expect the controls to be absent from the public view —
and to stay unavailable even to someone who bypasses the interface.

**Why this priority**: It is the distinction the issue is named for, but it is
only meaningful once stories 1 and 2 exist, and it is the part most constrained
by the GET-only rule (see Assumptions).

**Independent Test**: Mark a widget publicly visible in read-only mode, sign
out, and confirm the data renders, no control affordances are present, and a
direct request to the corresponding action route is refused.

**Acceptance Scenarios**:

1. **Given** a Pi-hole widget publicly visible in read-only mode, **When** an
   anonymous visitor views it, **Then** statistics render and the blocking
   toggle is absent.
2. **Given** that widget, **When** an anonymous caller posts directly to the
   blocking route, **Then** the request is refused.
3. **Given** a Sonos widget publicly visible in read-only mode, **When** an
   anonymous visitor views it, **Then** now-playing information renders and
   transport controls are absent.
4. **Given** any widget in any public mode, **When** an anonymous caller
   attempts a Docker container action, **Then** the request is refused —
   Docker actions are never publicly available (043 / #189).
5. **Given** a signed-in non-admin user, **When** they view the same widgets,
   **Then** public visibility settings do not further restrict them; their
   access is governed by their role alone (#100).

---

### Edge Cases

- A widget is marked publicly visible, then its underlying integration
  connection is deleted or its credentials are revoked. The public view must
  degrade to the same "not rendered" outcome rather than surfacing an error
  that describes the missing connection.
- A dashboard stops being the designated public dashboard while a visitor has
  it open. The next data fetch must stop serving it.
- A widget is publicly visible on the public dashboard and also present on a
  private dashboard. Public exposure must follow the *dashboard*, not leak the
  widget wherever it appears.
- A publicly visible widget polls on an interval. Anonymous polling must be
  rate-limited and must not become an amplifier for outbound requests to the
  integration host.
- Duplicating or importing a dashboard that contains publicly visible widgets.
  The safe outcome is that the copy is not public until an administrator says
  so.
- A screensaver or kiosk view rendering a public dashboard must obey the same
  rules as the dashboard itself.
- An anonymous request naming a widget that does not exist, versus one that
  exists but is not public, must be indistinguishable.

## Requirements *(mandatory)*

### Functional Requirements

**Visibility model**

- **FR-001**: The system MUST allow an administrator to set a public visibility
  mode per widget instance, with at least the modes *hidden*, *read-only* and
  *visible*.
- **FR-002**: The system MUST default every widget — existing and newly created
  — to the most restrictive mode, such that no widget becomes publicly visible
  as a result of this feature shipping.
- **FR-003**: The system MUST apply public visibility only to viewers with no
  authenticated session. Signed-in users MUST be unaffected, whatever their
  role.
- **FR-004**: The system MUST persist the setting with the widget instance, so
  it survives dashboard edits, reordering and restarts.

**Server-side enforcement**

- **FR-005**: The system MUST enforce every public visibility decision on the
  server. A widget that is not publicly visible MUST NOT have its data served
  to an anonymous caller under any circumstances.
- **FR-006**: Public widget data MUST be served only for widgets that are
  publicly visible **and** belong to the currently designated public dashboard.
- **FR-007**: Anonymous access to widget data MUST be read-only. No anonymous
  caller may cause a state change in HomeDash or in an integration.
- **FR-008**: Docker container actions MUST remain unavailable to anonymous
  callers regardless of any visibility setting.
- **FR-009**: Public responses MUST contain only what the widget needs to
  render, and MUST NOT include credentials, tokens, integration endpoint URLs,
  connection identifiers, or other configuration metadata.
- **FR-010**: A request for a widget that is not publicly available MUST be
  answered identically to one for a widget that does not exist, so that
  anonymous callers cannot enumerate which widgets exist or which are exposed.
- **FR-011**: Anonymous widget data requests MUST be rate-limited.
- **FR-012**: The system MUST NOT weaken any existing authenticated route in
  order to serve public viewers; public access MUST be additive and explicitly
  scoped.

**Client behaviour**

- **FR-013**: The public view MUST NOT issue requests to authenticated widget
  data routes; an anonymous visitor MUST NOT be able to provoke a 401 by
  loading the dashboard normally.
- **FR-014**: A widget that is not publicly visible MUST be absent from the
  public view, not merely visually hidden, and MUST NOT leave a conspicuous gap
  in the layout.
- **FR-015**: In read-only mode, interactive affordances MUST be absent rather
  than present-but-disabled.
- **FR-016**: The public view MUST NOT display configuration, edit or
  connection-management affordances for any widget.

**Administration**

- **FR-017**: An administrator MUST be able to set public visibility from the
  widget or placeholder configuration surface, and MUST be able to see a
  widget's current public visibility without opening a dialog per widget.
- **FR-018**: The administration surface MUST make clear that the setting
  applies to unauthenticated visitors of the designated public dashboard, and
  MUST make the exposure consequence explicit for widgets that surface
  infrastructure data.
- **FR-019**: Changing public visibility MUST take effect without requiring a
  restart, and MUST be reflected on the next public fetch.
- **FR-020**: The system MUST record public visibility changes in a way that an
  operator can audit after the fact.

**Migration**

- **FR-021**: Existing dashboards MUST retain their current behaviour for
  signed-in users after upgrade, with no administrator action required.
- **FR-022**: The upgrade MUST be documented as a behaviour change for public
  dashboards: widgets that previously rendered error states for anonymous
  visitors will instead be absent until explicitly exposed.

### Key Entities

- **Widget instance**: an individual widget placed on a dashboard. Gains a
  public visibility mode. The unit at which exposure is decided.
- **Placeholder**: the layout container holding one or more widget instances.
  Its public presence is derived from the widgets inside it.
- **Public dashboard designation**: the existing administrator choice of which
  dashboard unauthenticated visitors see, per device context. Public visibility
  is meaningful only in combination with it.
- **Public viewer**: a caller with no authenticated session. Distinct from a
  signed-in non-admin user, whose access is governed by role (#100).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Loading a public dashboard as an anonymous visitor produces zero
  authentication failures and zero widget error states attributable to missing
  authentication.
- **SC-002**: With no administrator action after upgrade, the number of widgets
  exposing integration data to anonymous visitors is zero.
- **SC-003**: An administrator can expose a single widget to public viewers in
  under a minute, from the dashboard they are already editing.
- **SC-004**: Every anonymous request for a widget that is not publicly visible
  is refused, including requests that name a valid widget on a non-public
  dashboard, and the refusals are indistinguishable from those for a
  non-existent widget.
- **SC-005**: No anonymous request can change state in HomeDash or in any
  integration, verified by explicit negative coverage of each control route
  reachable from a publicly visible widget.
- **SC-006**: Public responses for exposed widgets contain no credential,
  token, endpoint URL or connection identifier, verified by automated
  assertion rather than review.
- **SC-007**: Signed-in behaviour is unchanged: the authenticated test suites
  pass without modification to their expectations.

## Assumptions

- **Public means unauthenticated.** Signed-in non-admin users are out of scope;
  their access was addressed in #100 and is governed by role.
- **Read-only is the interesting middle mode.** The issue's per-widget-type
  toggles (`showDisableButton`, `publicVisibility: 'full' | 'summary'`, and so
  on) are treated as refinements of the three modes rather than a parallel
  mechanism, to avoid two systems that can disagree about the same widget.
- **Safe-by-nature widgets stay visible.** Widgets that render only their own
  stored configuration — clock, markdown, links, single link, iframe, photo
  frame — are already delivered in the public bootstrap and continue to render
  publicly. This feature governs widgets that reach an integration or an
  authenticated route.
- **The designated public dashboard remains the only public surface.** This
  feature does not introduce additional public dashboards or per-user public
  views.
- **Sonos is read-only in public view. (Resolved)** The issue proposed
  `allowPublicControls: true` by default for Sonos, on the grounds that it is
  LAN-only. Constitution §I requires public endpoints to be GET-only, and Sonos
  transport control is state-changing, so the proposal is not eligible as
  written. The requester has accepted read-only: anonymous visitors may *see*
  Sonos playback state but not control it. No constitutional exception is
  sought, and no kiosk-session trust model is introduced. Public control of any
  widget is out of scope for this feature.
- **UniFi `summary` mode is out of scope. (Resolved)** The issue proposed a
  `summary` public mode for UniFi distinct from full detail. A third,
  widget-specific payload shape is not worth its complexity for the first
  implementation; UniFi is therefore either publicly visible with its normal
  read payload or not publicly visible at all. A reduced payload can be added
  later without changing the visibility model.
- **Rate limiting exists to build on.** The project already rate-limits
  authenticated routes; anonymous widget polling is assumed to reuse that
  mechanism rather than introduce a new one.
- **No CI gate.** Verification is local, against the recorded baselines: `pnpm
  lint` 81 problems, `pnpm typecheck` 23 errors, and 3 known pre-existing
  `calendar-phase7.test.ts` failures.

## Dependencies

- **#100 / PR #193** — established that reading widget data is an authenticated
  action and only configuration is an admin action. This feature adds the third
  tier below it (anonymous) and must not disturb that boundary.
- **043 / #189** — closed the unauthenticated Docker hole. FR-008 exists to
  keep it closed.
