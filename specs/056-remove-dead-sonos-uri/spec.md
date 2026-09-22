# Feature Specification: Remove Dead Sonos Container URI Path

**Feature Branch**: `056-remove-dead-sonos-uri`  
**Created**: 2026-09-20  
**Status**: Draft  
**Input**: GitHub issue #237

## Problem

Sonos container queue mutations carry both a container URI and an object ID through
the frontend, API, adapter, and local service. The local implementation resolves
container tracks exclusively from the object ID, so the URI is a dead duplicate
input that misstates the actual contract. The same adapter path returns a
success-shaped response in cloud mode even though no queue mutation occurs.

## User Scenarios and Testing

### User Story 1 - Queue a browsed container (Priority: P1)

An authenticated user queues or plays a browsed Sonos library container in local
mode. HomeDash sends the one identifier used to resolve that container and reports
the real mutation result.

**Independent Test**: Trigger add-to-queue and replace-queue actions for a container
and verify the request contains `objectId`, the backend resolves that object, and
the queue mutation succeeds.

### User Story 2 - Reject unsupported cloud mutations (Priority: P1)

An authenticated user attempts a container queue mutation while Sonos is in cloud
mode. HomeDash returns an explicit capability error instead of a zero-track
success response.

**Independent Test**: Set cloud mode and verify both container mutation endpoints
return a typed client error without invoking the local Sonos service.

## Requirements

- **FR-001**: Container queue mutation requests MUST require a bounded, non-empty
  `objectId` and MUST NOT require or forward an unused container URI.
- **FR-002**: Frontend mutation hooks and callers MUST use the same object-ID-only
  contract.
- **FR-003**: Local service and adapter signatures MUST remove the unused URI
  parameter.
- **FR-004**: Cloud-mode container queue mutations MUST return an explicit
  local-mode capability error and MUST NOT return a success-shaped result.
- **FR-005**: Existing authentication and CSRF protections MUST remain unchanged.

## Success Criteria

- **SC-001**: Strict unused-parameter compilation reports no Sonos container URI
  findings.
- **SC-002**: Focused request/auth tests cover the object-ID-only contract and
  cloud-mode rejection.
- **SC-003**: Existing Sonos browse and queue tests continue to pass.

## Out of Scope

- Changing Sonos library browsing or recursive track resolution.
- Adding cloud queue support.
- Refactoring unrelated legacy or migration compatibility paths.
