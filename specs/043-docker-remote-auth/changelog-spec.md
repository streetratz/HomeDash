# Spec Changelog — Remote Docker Host Connectivity & Docker API Lockdown

## Table of Contents
- [CH-01 : Initial-Specification](#ch-01--initial-specification)
- [CH-02 : Docker-API-Version-Negotiation](#ch-02--docker-api-version-negotiation)
- [CH-03 : SSH-Transport-For-Docker-Endpoints](#ch-03--ssh-transport-for-docker-endpoints)
- [CH-04 : Multi-Host-Docker-Widget](#ch-04--multi-host-docker-widget)
- [CH-05 : Defer-Multi-Host-Widget-To-190](#ch-05--defer-multi-host-widget-to-190)

---

## CH-01 : Initial-Specification : 2026-Sep-18 0745 AEST

**Type**: New document  
**Summary**: Initial feature specification covering two linked GitHub issues — #181 (remote Docker hosts unreachable; unrecognised endpoints silently reinterpreted as a local Unix socket path, and an unresolvable widget connection silently falling back to the local socket) and #189 (the container-listing and connection-test endpoints served unauthenticated, enabling container enumeration and SSRF/port-scanning via a caller-supplied endpoint). Defines 25 functional requirements, 7 success criteria, and 3 prioritised user stories, and records public/unauthenticated dashboard access (#66) as explicitly out of scope.

| ID | Description |
|----|-------------|
| FR-001 – FR-008 | Closed set of accepted Docker endpoint formats, default ports, rejection of plain `http` and of unrecognised forms, no socket-path inference, validation at every trust boundary, fail-closed on non-conforming stored endpoints (Issue #181) |
| FR-009 – FR-011 | Removal of the silent local-socket fallback; explicit configuration errors for unresolvable widget connections; failure messages that identify the attempted endpoint (Issue #181) |
| FR-012 – FR-019 | Authentication required on container-listing and connection-test; server-side endpoint resolution from the stored connection; caller-supplied endpoints admin-only and routed through `url-validator.ts`; container action authz preserved; no public exposure; no reachability leakage to unauthorised callers (Issue #189) |
| FR-020 – FR-021 | Settings-form guidance and user documentation stating supported endpoint formats, default ports, and the authentication requirement |
| FR-022 – FR-023 | Backwards compatibility for existing local Unix-socket deployments and for conforming stored endpoints |
| FR-024 – FR-025 | Mandatory negative-path and positive-path test coverage |
| SC-001 – SC-007 | Measurable outcomes for unauthenticated denial, non-leakage of destination reachability, remote-host configurability, endpoint rejection rate, zero silent-wrong-host outcomes, upgrade compatibility, and test coverage |
| US-1 | Lock down the Docker endpoints (P1) |
| US-2 | Connect to a Docker host over the network (P1) |
| US-3 | Understand and correct a bad endpoint (P2) |

---

## CH-02 : Docker-API-Version-Negotiation : 2026-Sep-18 0805 AEST

**Type**: New FR, New SC, Revised

**Summary**: Empirical reproduction against a live remote Docker host (Engine 29.1.3, current API 1.52, minimum supported API 1.44) uncovered a third defect behind issue #181 that code inspection alone had missed: HomeDash pins Docker Engine API version `v1.43` in its request paths, which current daemons reject with HTTP 400 "client version is too old". Because the connection test targets the unversioned `/_ping` endpoint, it returns success while container listing against the same host fails — so a correctly-configured remote host presents as "connected" with an empty widget, which is the reported "only connects to the local socket" symptom. Added a requirement group for version negotiation, two success criteria, and revised the Context section to describe the defect and its interaction with the other two.

| ID | Description |
|----|-------------|
| FR-026 | No fixed Engine API version may be pinned; requests must use a version the target daemon accepts, unversioned or negotiated from its reported current/minimum versions |
| FR-027 | Version negotiation is per configured endpoint; hosts on differing Engine releases must each work, with no assumption that remote hosts match the local one |
| FR-028 | A connection test must exercise the same version constraints as the displayed data; it must not report success where container listing would fail |
| FR-029 | A version rejection must surface the daemon's supported range and the version attempted |
| SC-008 | A host whose minimum supported API version is newer than the previously pinned version returns its container list, verified against a live daemon |
| SC-009 | A successful connection test implies a successful container listing 100% of the time; "test passes, widget empty" cannot occur |
| Context | Revised to add the API-version defect, its live-daemon evidence, and why it masks itself behind a passing connection test |

---

## CH-03 : SSH-Transport-For-Docker-Endpoints : 2026-Sep-18 0815 AEST

**Type**: New FR, New SC, Revised

**Summary**: Scope decision recorded after verifying the reference remote host: it serves the Docker API only over SSH, with TCP 2375 and 2376 both closed, so the API-version and endpoint-validation fixes alone would still leave it unreachable. Added an SSH transport requirement group covering key-only non-interactive authentication, mandatory host-key verification, key-material handling, least-privilege SSH options, the runtime client dependency, cause-distinguishable errors, and bounded lifecycle with cleanup. Revised FR-001 to include the SSH form in the closed set of accepted endpoint formats. Plain unauthenticated TCP on the remote daemon was considered and rejected as contrary to constitution §I.

| ID | Description |
|----|-------------|
| FR-030 | Accept an SSH endpoint form (optional user, host, optional port) and reach the Docker API over it with no daemon network listener |
| FR-031 | Key-based, non-interactive authentication only; no password or passphrase prompting/storage; fail fast rather than hang |
| FR-032 | Mandatory host-key verification, fail closed on unknown/changed keys, no default opt-out |
| FR-033 | Private key material never logged, never returned by an API, never committed; owner-only permissions under the data directory or an operator-mounted path |
| FR-034 | Least-privilege SSH invocation: no TTY, no agent forwarding, no port forwarding |
| FR-035 | Runtime image must provide the SSH client; a clear configuration error when absent |
| FR-036 | Errors distinguishable by cause: unreachable, auth rejected, host-key failure, Docker unavailable remotely |
| FR-037 | Bounded timeout and guaranteed cleanup on success, failure, and timeout |
| FR-038 | SSH endpoints subject to the same authorization rules as all other endpoint forms |
| SC-010 | An SSH-only host with no open Docker port lists its containers, verified live |
| SC-011 | No orphaned SSH client processes after repeated operations |
| FR-001 | Revised to add the SSH form to the closed set of accepted endpoint formats |

---

## CH-04 : Multi-Host-Docker-Widget : 2026-Sep-18 0830 AEST

**Type**: New FR, New SC

**Summary**: Added a user-interface requirement group allowing one Docker widget to show containers from several hosts, segregated so each container is attributable to its host. Investigation found this is not merely a presentation change: `widget_connections` carries a unique index on (widget instance, connection type), so exactly one Docker connection per widget is currently enforced at the schema level, and `resolveDockerUrl()` reads a single row. Delivering this requires a new generated migration plus a multi-connection resolution path, and interacts with the per-endpoint API-version negotiation (CH-02) and SSH transport (CH-03) because each host may run a different Engine release and use a different transport. The specific control (tabs, segmented control, selector, or grouped sections) is left to the design phase against the constitution §II mobile-first and accessibility constraints; the requirement fixes the behaviour, not the widget chrome.

| ID | Description |
|----|-------------|
| FR-039 | One Docker widget may display containers from more than one configured host |
| FR-040 | Every container is unambiguously attributable to its host; hosts visually segregated, not merged |
| FR-041 | Segregation control usable from ~360px, touch-friendly, keyboard accessible, degrades with host count and name length |
| FR-042 | One failing host does not suppress the others; failure reported inline against the failing host |
| FR-043 | Hosts queried independently; a slow or unreachable host does not block the rest |
| FR-044 | Container actions dispatch to the owning host, with no cross-host targeting of same-named containers |
| FR-045 | Existing single-host widgets keep working unchanged, with no added chrome for a single host |
| FR-046 | Data model supports multiple Docker connections per widget instance in a deterministic display order |
| SC-012 | Two-host widget attributes containers correctly at 360px and desktop |
| SC-013 | With one host unreachable, the other still displays and the error is attributed correctly |
| SC-014 | A single-host widget is visually unchanged |

---

## CH-05 : Defer-Multi-Host-Widget-To-190 : 2026-Sep-18 0815 AEST

**Type**: Revised

**Summary**: Removed the multi-host Docker widget requirement group added in CH-04 and deferred it to issue #190, at the user's direction, so this feature stays focused on the connectivity defects (#181) and the authorization lockdown (#189). The drafted requirements, the `widget_connections` unique-index migration analysis, and the grouped-sections-over-tabs UI decision are all recorded on #190 rather than discarded. The Out of Scope section now names the deferral explicitly and records the one constraint this feature must still honour for #190's benefit: the Docker endpoint is resolved server-side by connection identity, never from a caller-supplied URL, which #190 depends on for per-host action routing. Removing these requirements does not weaken any security or connectivity obligation — FR-001..FR-038 and SC-001..SC-011 are unchanged.

| ID | Description |
|----|-------------|
| FR-039 – FR-046 | Removed from this spec; deferred to #190 |
| SC-012 – SC-014 | Removed from this spec; deferred to #190 |
| Out of Scope | Replaced the generic multi-connection-aggregation exclusion with an explicit #190 deferral plus the server-side endpoint-resolution constraint retained for it |
