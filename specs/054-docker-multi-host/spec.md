# Feature Specification: Docker Multi-Host Widget

**Feature Branch**: `054-docker-multi-host`
**Created**: 2026-09-20
**Status**: Draft
**Issue**: #190

## User Scenarios

### User Story 1 - Select multiple Docker hosts

As an administrator, I can select and order multiple saved Docker connections for one
Docker widget so I do not need a separate widget for every host.

**Acceptance criteria**

1. A persisted Docker widget can link zero, one, or many Docker connections.
2. The widget configuration lists all saved Docker connections with touch-friendly,
   keyboard-accessible selection controls.
3. Selected connections have a deterministic display order that the administrator can
   change.
4. Pi-hole and UniFi connection linking retain their existing single-link behavior.

### User Story 2 - Monitor hosts independently

As a dashboard user, I can see which host owns every container and continue using
healthy hosts when another host is slow or unavailable.

**Acceptance criteria**

1. Multiple hosts render as vertically grouped sections with sticky host headers.
2. Each host shows its own loading, empty, success, and error state.
3. Container queries run independently, so one slow or failing host does not suppress
   another host.
4. Long host names and five or more hosts remain usable from approximately 360 px.
5. A widget with exactly one host retains the existing visual presentation without a
   host header.

### User Story 3 - Control the correct host

As an administrator, container actions always target the host that owns the selected
container, even when container names collide across hosts.

**Acceptance criteria**

1. Listing and action requests identify both the widget instance and selected
   connection.
2. The backend verifies that the connection is linked to the widget before resolving
   its endpoint.
3. A connection ID linked to another widget cannot be used to list or mutate
   containers.
4. Successful actions refresh only the affected host query.

## Functional Requirements

- **FR-001**: `widget_connections` MUST allow multiple unique Docker connection rows
  per widget and store a deterministic `sort_order`.
- **FR-002**: Existing rows MUST migrate with `sort_order = 0`.
- **FR-003**: The existing generic link operation MUST continue replacing all links of
  a type so Pi-hole behavior cannot accidentally become additive.
- **FR-004**: A Docker-specific admin operation MUST atomically replace the ordered set
  of Docker links after validating the widget and every connection.
- **FR-005**: Authenticated users MUST be able to list the ordered Docker hosts linked
  to a widget without receiving endpoint URLs.
- **FR-006**: Container listing MUST accept a connection discriminator and validate
  widget-to-connection ownership before any outbound request.
- **FR-007**: Container actions MUST use the same ownership validation and remain
  admin-only and CSRF-protected.
- **FR-008**: The frontend MUST fan out one TanStack Query per linked host.
- **FR-009**: Host query keys MUST include both widget and connection IDs.
- **FR-010**: A single-host widget MUST remain visually unchanged.
- **FR-011**: Multi-host sections MUST show the host name, status counts, containers,
  and host-specific failures without hiding sibling hosts.
- **FR-012**: Legacy single-host widgets and adopted `config.dockerUrl` widgets MUST
  continue working without operator action.
- **FR-013**: Backup and restore MUST preserve `sort_order` and multiple links.

## Success Criteria

- **SC-001**: Two hosts with same-named containers are correctly attributed at 360 px
  and desktop widths.
- **SC-002**: With one host unreachable, a healthy host still renders while the error
  is shown only under the failing host.
- **SC-003**: A single-host widget has no additional host chrome.
- **SC-004**: Cross-widget connection IDs are rejected before any Docker transport is
  opened.
- **SC-005**: Upgrade validation preserves all pre-existing widget connection rows and
  foreign-key integrity.

## Out of Scope

- Creating or editing Docker connection endpoints from the widget.
- Server-side aggregation of container responses.
- Changing Docker transport, API-version negotiation, or SSH credential behavior.
- Changing Pi-hole or UniFi widget behavior.
