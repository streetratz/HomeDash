# Feature Specification: Remote Docker Host Connectivity & Docker API Lockdown

**Feature Branch**: `043-docker-remote-auth`  
**Created**: 2026-Sep-18  
**Status**: Draft  
**Input**: GitHub issues [#181](https://github.com/streetratz/HomeDash/issues/181) (Docker only connects to local sock, not over the network) and [#189](https://github.com/streetratz/HomeDash/issues/189) (Docker container/ping endpoints are unauthenticated — enumeration + SSRF).

## Context

The Docker widget lets a HomeDash user point at a Docker host and see their
containers. Two linked defects break that promise:

- **Connectivity (#181)** — endpoint strings that HomeDash does not explicitly
  recognise are silently reinterpreted as a local Unix socket path. A user who
  enters a network endpoint in an unrecognised shape sees local containers, or a
  confusing failure, with no indication that their input was not understood. The
  same silent-local behaviour occurs when a widget's stored connection cannot be
  resolved.
- **API version (#181)** — HomeDash pins a fixed Docker Engine API version that
  current daemons reject outright. Reproduced against a live remote host
  (Engine 29.1.3, current API 1.52, minimum supported 1.44): the pinned version
  returns HTTP 400 "client version is too old", while the unversioned and
  minimum-supported paths both return 200. Crucially the connection test targets
  an **unversioned** endpoint, so it reports success while container listing
  against the very same host fails — the user sees "connected" and an empty
  widget. A local daemon old enough to still accept the pinned version keeps
  working, which is exactly the reported "only connects to the local socket"
  symptom.
- **Authorization (#189)** — the container-listing and connection-test endpoints
  are reachable without authentication and accept a caller-supplied endpoint.
  Any device on the LAN can enumerate container names, images, states and ports,
  and can use HomeDash as an unauthenticated probe against arbitrary hosts and
  ports. This contradicts constitution §I (default-deny authorization; only
  explicitly-designated public read-only resources may be unauthenticated) and
  the backend rule that only the dedicated public route module serves
  unauthenticated traffic.

The connectivity and authorization defects share a root: the Docker endpoint is
not treated as untrusted input at the trust boundary, and the system prefers a
silent local fallback over an explicit error. The version defect compounds them
by making a genuinely-correct remote configuration look successful while
returning no data.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Lock down the Docker endpoints (Priority: P1)

A HomeDash operator runs the dashboard on a LAN shared with guest devices, IoT
gear and other people's machines. They expect container inventory — names,
images, run state, published ports — to be visible only to people who have
signed in, and they expect HomeDash never to make outbound connections on behalf
of an anonymous caller.

**Why this priority**: This is an active security defect on a LAN the project
treats as hostile. It is exploitable today by any device that can reach the
dashboard, requires no credentials, and leaks infrastructure inventory while
turning HomeDash into a port-scanning proxy. It must land before, or at the same
time as, any connectivity work, because fixing connectivity alone widens the
range of hosts an anonymous caller can reach.

**Independent Test**: Can be fully tested by issuing container-list and
connection-test requests with no session, with a non-admin session, and with an
admin session, and confirming that only authenticated callers receive data and
only admins may supply an endpoint directly.

**Acceptance Scenarios**:

1. **Given** a caller with no session, **When** they request the Docker
   container list, **Then** the request is rejected as unauthenticated and no
   container data and no connection-outcome information is returned.
2. **Given** a caller with no session, **When** they submit a Docker connection
   test for an arbitrary host and port, **Then** the request is rejected as
   unauthenticated and HomeDash makes no outbound connection to that host.
3. **Given** an authenticated non-admin user, **When** they request the
   container list for a widget they can view, **Then** the containers are
   returned using the endpoint stored against that widget's connection, and any
   endpoint value supplied by the caller is ignored or rejected.
4. **Given** an authenticated non-admin user, **When** they submit a connection
   test containing an arbitrary endpoint, **Then** the request is rejected as
   unauthorised and no outbound connection is made.
5. **Given** an authenticated admin using the "Test connection" flow in
   settings, **When** they submit an endpoint, **Then** the endpoint is validated
   before use and the test result is returned.
6. **Given** any container-mutating request (start, stop, restart), **When** it
   is made, **Then** the existing admin-plus-CSRF requirement continues to apply
   unchanged.

---

### User Story 2 - Connect to a Docker host over the network (Priority: P1)

A user whose Docker host is a different machine on the LAN (a NAS, a mini PC, a
separate hypervisor guest) configures that host's address in the Docker
connection settings and expects the widget to show that host's containers.

**Why this priority**: This is the headline defect in #181 — the advertised
remote-host capability does not work, and it fails in the worst possible way by
appearing to succeed against the local host. Without it, the feature does not
deliver the value the settings form promises.

**Independent Test**: Can be fully tested by configuring each supported endpoint
form against a reachable remote Docker host and confirming the widget lists that
host's containers rather than the local host's.

**Acceptance Scenarios**:

1. **Given** a Docker host exposing its API over TCP on the LAN, **When** the
   user configures that host as the connection endpoint and saves, **Then** the
   widget lists containers from that remote host.
2. **Given** a TCP endpoint with no port specified, **When** the connection is
   used, **Then** the conventional plain-TCP Docker port is applied and the
   remote host is reached.
3. **Given** a TLS-protected Docker endpoint with no port specified, **When** the
   connection is used, **Then** the conventional TLS Docker port is applied.
4. **Given** an existing, working local Unix socket configuration, **When** the
   user upgrades to this release and changes nothing, **Then** the widget
   continues to list local containers exactly as before.
5. **Given** a remote host that is unreachable, **When** the connection is used,
   **Then** the user is shown a failure that identifies the configured remote
   host, and is never shown local container data in its place.

---

### User Story 3 - Understand and correct a bad endpoint (Priority: P2)

A user who mistypes an endpoint, omits the scheme, or uses a form HomeDash does
not support expects to be told precisely what is wrong and which forms are
accepted — at the moment they save or test, not after silently watching the
wrong host's containers.

**Why this priority**: The silent reinterpretation is what makes #181 hard to
diagnose; a clear rejection converts a confusing outage into a 30-second fix.
It depends on the accepted-format decision in User Story 2 but is separable, and
it is worth less on its own than either the security fix or basic remote
connectivity.

**Independent Test**: Can be fully tested by submitting a set of malformed and
unsupported endpoint strings through the settings form and confirming each is
rejected with a message naming the supported formats.

**Acceptance Scenarios**:

1. **Given** the user enters a bare host-and-port string with no scheme, **When**
   they save or test the connection, **Then** the value is rejected with a
   message listing the supported endpoint formats, and is not treated as a
   filesystem path.
2. **Given** the user enters an endpoint whose scheme is not supported, **When**
   they save or test, **Then** the value is rejected with a message naming the
   unsupported scheme and the supported alternatives.
3. **Given** the user opens the Docker connection settings, **When** they read
   the endpoint field, **Then** the supported endpoint formats are stated in the
   field's guidance text.
4. **Given** a widget whose stored Docker connection has been deleted or was
   never linked, **When** the widget requests containers, **Then** the user sees
   an error explaining that the widget has no usable Docker connection, and no
   local container data is shown.

---

### Edge Cases

- **Unresolvable widget connection** — a widget references a connection row that
  no longer exists, or references none at all. The system must surface a
  configuration error, not substitute the local socket.
- **Endpoint stored before this change** — a previously-saved value that this
  feature's rules would reject (for example a bare host:port that used to be
  accepted silently). The stored value must fail closed with a clear error that
  directs the user to re-enter it, rather than being coerced.
- **Scheme/port mismatch** — a TLS-scheme endpoint pointing at the plain-TCP
  port, or the reverse. The connection attempt fails; the error must identify the
  configured endpoint so the mismatch is diagnosable.
- **Endpoint targeting HomeDash's own host or a disallowed destination** — an
  admin-supplied endpoint that the URL-validation boundary refuses must be
  rejected before any outbound connection is attempted.
- **Empty endpoint** — a saved connection with a blank endpoint must be rejected
  at save time rather than defaulting to the local socket.
- **Slow or hung remote host** — the connection attempt must terminate within a
  bounded time and report a timeout; it must not hold a request open
  indefinitely, and the timing difference must not be the primary channel by
  which an unauthorised caller learns anything (authentication already removes
  that caller).
- **Unix socket path that does not exist inside the container** — for example a
  socket that was not mounted. The failure must name the configured socket path.

## Requirements *(mandatory)*

### Functional Requirements

#### Endpoint format and validation (Issue #181)

- **FR-001**: The system MUST define an explicit, closed set of accepted Docker
  endpoint formats, comprising at minimum: a Unix socket path form identifying a
  local socket; a plain-TCP network form accepting an optional port; a
  TLS network form accepting an optional port; and an SSH form (see FR-030)
  accepting an optional user and port.
- **FR-002**: The system MUST apply the conventional default Docker port for each
  network form when the user omits a port — the plain-TCP default for the
  plain-TCP form and the TLS default for the TLS form.
- **FR-003**: The system MUST reject a plain, unencrypted `http`-scheme endpoint
  with an actionable message directing the user to the supported plain-TCP form,
  and MUST NOT silently reinterpret it as a socket path. (Rationale: `http` and
  the plain-TCP form are functionally identical for the Docker API, and accepting
  both invites the exact ambiguity that caused #181; one canonical spelling is
  offered instead.)
- **FR-004**: The system MUST reject any endpoint that does not match an accepted
  format, at the point the value enters the system, and MUST NOT fall through to
  a default interpretation of any kind.
- **FR-005**: The system MUST NOT infer that an unrecognised endpoint string is a
  Unix socket path. A socket path is only accepted when stated in the Unix socket
  form.
- **FR-006**: Rejection messages MUST name the supported endpoint formats and
  MUST be surfaced to the user in the settings UI at save time and at
  connection-test time.
- **FR-007**: The system MUST validate the endpoint at every trust boundary where
  it is accepted — when a connection is saved, when a connection test is
  requested, and before any outbound connection is attempted — rather than
  relying on validation at a single earlier point.
- **FR-008**: An endpoint already persisted that does not satisfy FR-001 MUST
  fail closed on use, with an error that identifies the stored value's problem
  and instructs the user to re-enter it.

#### SSH transport (Issue #181)

Motivation: the reference remote host exposes the Docker API only over SSH, with
both conventional TCP ports closed. This is the configuration the Docker CLI
supports natively via SSH-based contexts, and it avoids exposing a
root-equivalent daemon on the LAN, so it is the preferred secure remote
transport for HomeDash.

- **FR-030**: The system MUST accept an SSH endpoint form identifying an optional
  user, a host, and an optional port, and MUST reach the remote Docker API over
  that SSH connection without requiring the daemon to listen on any network port.
- **FR-031**: SSH authentication MUST be non-interactive and key-based. The
  system MUST NOT prompt for, accept, or store an SSH password or passphrase, and
  MUST fail with a clear error rather than hanging when a key is unusable.
- **FR-032**: The remote host's identity MUST be verified against known host keys.
  An unknown or changed host key MUST fail the connection closed with a distinct
  error. Host-key verification MUST NOT be disabled by default, and any opt-out
  MUST be an explicit, documented administrator action.
- **FR-033**: SSH private key material MUST NOT be logged, MUST NOT be returned by
  any API response, and MUST NOT be committed. Where HomeDash stores or references
  a key it MUST live under the configured data directory or an operator-mounted
  path with owner-only permissions.
- **FR-034**: The SSH transport MUST run with the least privilege needed for the
  Docker API: no interactive terminal, no agent forwarding, and no port
  forwarding.
- **FR-035**: The runtime image MUST provide the SSH client the transport depends
  on. If it is unavailable at runtime, the system MUST report a clear
  configuration error naming the missing dependency rather than failing
  ambiguously.
- **FR-036**: SSH failures MUST be distinguishable by cause in the error surfaced
  to the administrator — at minimum: host unreachable, authentication rejected,
  host-key verification failed, and Docker unavailable on the remote host.
- **FR-037**: Every SSH transport invocation MUST be bounded by a timeout and MUST
  be cleaned up on success, failure, and timeout, leaving no orphaned processes or
  file descriptors.
- **FR-038**: An SSH endpoint MUST be subject to the same authorization rules as
  every other endpoint form: configurable by administrators only, resolved
  server-side for ordinary requests, and never accepted from an unauthenticated
  or non-administrator caller.

#### Docker Engine API version negotiation (Issue #181)

- **FR-026**: The system MUST NOT pin a fixed Docker Engine API version that a
  supported daemon can reject. Requests MUST use a version the target daemon
  accepts — either by sending unversioned requests or by negotiating from the
  daemon's reported current and minimum supported versions.
- **FR-027**: Version negotiation MUST be performed per configured endpoint, so
  that hosts running different Engine releases each work, and MUST NOT assume all
  configured hosts share the local host's version.
- **FR-028**: A connection test MUST exercise an operation that is subject to the
  same version constraints as the data the widget displays. A connection test MUST
  NOT report success when container listing against the same endpoint would fail.
- **FR-029**: When a daemon rejects the negotiated API version, the error surfaced
  to the user MUST state the daemon's supported range and the version attempted.

#### Removal of silent local fallback (Issue #181)

- **FR-009**: The system MUST NOT substitute the local Docker socket when a
  requested Docker endpoint cannot be determined. Container-listing and
  connection-test operations with no determinable endpoint MUST return an error.
- **FR-010**: When a widget's Docker connection cannot be resolved — unlinked,
  deleted, or otherwise missing — the system MUST return a configuration error
  that distinguishes "no connection configured" from "connection configured but
  unreachable", and MUST NOT return container data from any other host.
- **FR-011**: Errors returned for connectivity failures MUST identify which
  configured endpoint was attempted, so a remote-host failure is never mistakable
  for a local-host success.

#### Authorization and endpoint resolution (Issue #189)

- **FR-012**: The container-listing operation MUST require an authenticated
  session. Unauthenticated callers MUST receive an authentication failure and no
  container data.
- **FR-013**: The connection-test operation MUST require an authenticated
  session. Unauthenticated callers MUST receive an authentication failure, and
  the system MUST NOT attempt any outbound connection on their behalf.
- **FR-014**: For ordinary container-listing requests, the system MUST resolve
  the Docker endpoint server-side from the stored connection associated with the
  requested widget. A caller-supplied endpoint MUST NOT determine the destination
  of an ordinary listing request.
- **FR-015**: A caller-supplied endpoint MUST be accepted only from an
  administrator performing the explicit "Test connection" flow. Non-admin callers
  supplying an endpoint MUST be refused.
- **FR-016**: Every caller-supplied endpoint MUST pass through the project's
  shared URL-validation boundary (`backend/src/lib/url-validator.ts`) before any
  outbound connection is attempted.
- **FR-017**: The container-mutating operation MUST retain its existing
  administrator-plus-CSRF requirement; this feature MUST NOT weaken it.
- **FR-018**: The Docker routes MUST NOT be served as public, unauthenticated
  resources. Any code comment or assumption asserting that the Docker API is safe
  to expose because "the socket is local" MUST be removed, since the endpoint is
  caller-influenced and may be remote.
- **FR-019**: Authorization failures MUST NOT leak whether a given endpoint,
  host, or port is reachable — the response for an unauthorised caller MUST be
  independent of the configured or supplied destination.

#### Documentation and user guidance

- **FR-020**: The Docker connection settings form MUST state the supported
  endpoint formats, including the default ports applied when a port is omitted.
- **FR-021**: User-facing documentation covering Docker connections MUST be
  updated in the same change to state the supported endpoint formats, the
  rejection of unsupported forms, and the authentication requirement on the
  Docker endpoints.

#### Compatibility

- **FR-022**: Existing, correctly-configured local Unix-socket deployments —
  the common case, where the host's Docker socket is mounted into the HomeDash
  container — MUST continue to work with no configuration change.
- **FR-023**: The change MUST NOT require an administrator to re-create Docker
  connections whose stored endpoint already satisfies FR-001.

#### Testing

- **FR-024**: The change MUST include negative-path coverage for: an
  unauthenticated container-listing request; an unauthenticated connection-test
  request; a non-admin request supplying an arbitrary endpoint; a malformed or
  unsupported endpoint at save and at test; and a widget whose Docker connection
  cannot be resolved.
- **FR-025**: The change MUST include positive-path coverage for each accepted
  endpoint format, including default-port application, and for the preserved
  local Unix-socket behaviour.

### Key Entities

- **Docker connection**: A stored, administrator-managed record naming a Docker
  host by endpoint. It is the authoritative source of the endpoint for ordinary
  container-listing requests. Referenced by widget instances.
- **Docker endpoint**: The address of a Docker API, expressed in one of the
  accepted formats (local socket, plain-TCP network, TLS network). Untrusted
  input wherever it originates from a caller.
- **Docker widget instance**: A dashboard widget that references a Docker
  connection and displays that connection's containers. May reference a
  connection that no longer exists.
- **Container summary**: The per-container information rendered by the widget —
  name, image, state and published ports. Treated as private infrastructure
  inventory, not public data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An unauthenticated request to any Docker read endpoint returns zero
  container records and zero connection-outcome information, in 100% of attempts.
- **SC-002**: An unauthenticated caller cannot distinguish an open destination
  port from a closed one via HomeDash — responses to unauthenticated callers are
  identical regardless of the destination supplied.
- **SC-003**: A user with a remote Docker host on the LAN can configure it and
  see that host's containers, using only the guidance shown in the settings form,
  without consulting source code or external documentation.
- **SC-004**: 100% of endpoint strings that do not match an accepted format are
  rejected with a message naming the accepted formats; 0% are interpreted as a
  local socket path.
- **SC-005**: In every failure case — unreachable host, unresolvable connection,
  malformed endpoint — the user is shown an error rather than local container
  data; the rate of "silently showed the wrong host" outcomes is zero.
- **SC-006**: Existing local Unix-socket deployments upgrade with no
  configuration change and no change in what the widget displays.
- **SC-007**: Every scenario listed in FR-024 has an automated test that fails
  against the pre-change behaviour and passes after the change.
- **SC-008**: A Docker host running a current Engine release — one whose minimum
  supported API version is newer than the version HomeDash previously pinned —
  returns its container list successfully, verified against a live daemon.
- **SC-009**: A successful connection test implies a successful container listing
  against the same endpoint in 100% of cases; the combination "test reports
  success, widget shows no containers" does not occur.
- **SC-010**: A Docker host that exposes no network port and is reachable only
  over SSH can be configured in HomeDash and lists its containers, verified
  against a live host.
- **SC-011**: Repeated SSH-backed operations leave no orphaned client processes:
  the process count returns to its pre-operation baseline after success, failure,
  and timeout alike.

## Assumptions

- The Docker widget's container inventory is private data, not
  admin-selected public dashboard content, so it falls under default-deny
  authorization.
- The "Test connection" flow in settings is an administrator-only action; only
  administrators manage Docker connections today, so restricting caller-supplied
  endpoints to admins introduces no loss of existing user capability.
- The conventional Docker ports (plain-TCP and TLS) are the right defaults when a
  port is omitted; users needing non-standard ports state the port explicitly.
- TLS client-certificate authentication to a Docker host is not introduced by this
  feature; the TLS endpoint form is supported to the extent it works today.
- Existing stored endpoints are overwhelmingly local Unix-socket values, so
  fail-closed treatment of non-conforming stored values (FR-008) affects few
  installations and is preferable to silently preserving the defect.
- Shared URL-validation behaviour in `backend/src/lib/url-validator.ts` is
  reused as-is; this feature does not redefine which destinations are permitted.
- Both linked issues are fixed in a single change because the connectivity fix
  widens the set of reachable destinations and must not ship ahead of the
  authorization fix.

## Out of Scope

- **Public/unauthenticated dashboard access to widget data** — being designed
  separately under issue
  [#66](https://github.com/streetratz/HomeDash/issues/66). This feature
  deliberately sets the Docker endpoints to deny by default; any future public
  exposure must be designed there, against the constitution's public-resource
  rules.
- Docker TLS client-certificate management, credential storage, or mutual-TLS
  configuration UI.
- **Displaying more than one Docker host in a single widget** — deferred to issue
  [#190](https://github.com/streetratz/HomeDash/issues/190), which carries the
  drafted requirements, the schema-migration analysis, and the UI design
  decision. This feature keeps one host per widget, but must not make that
  deferred work harder: the endpoint is resolved server-side by connection
  identity rather than by a caller-supplied URL, which is the prerequisite #190
  depends on.
- Docker Swarm and multi-host orchestration.
- Changes to the container action (start/stop/restart) authorization model, which
  is already correct.
- Auto-discovery of Docker hosts on the LAN.
- Redesign of the Docker widget's visual presentation.
