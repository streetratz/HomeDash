# Implementation Plan: Remove Dead Sonos Container URI Path

**Branch**: `056-remove-dead-sonos-uri` | **Date**: 2026-09-20 | **Spec**: `spec.md`

## Summary

Collapse Sonos container queue mutations to the identifier they actually use:
`objectId`. Update the React hooks, API boundary, adapter, and local service
together; reject cloud-mode mutations explicitly; add focused tests; advance the
Main Version badge; and release after the PR merges.

## Technical Context

- **Frontend**: React 18, TanStack Query, TypeScript
- **Backend**: Fastify, Zod, TypeScript, node-sonos
- **Storage**: No schema or migration changes
- **Testing**: Vitest integration/unit tests, full lint/build, Docker upgrade gate

## Constitution Check

- **Security**: Existing auth and CSRF checks remain; `objectId` is validated and
  bounded at the API boundary.
- **LAN boundary**: No new network path or cloud dependency.
- **UI**: No visual behavior change.
- **Testing**: Contract and capability behavior receive focused coverage.
- **Logging**: Implementation and validation commands are recorded under `logs/`.
- **Spec changelog**: Initial specification is recorded as CH-01.

## Implementation

1. Replace the two route bodies with a Zod object-ID schema.
2. Remove `uri` from adapter and local service signatures.
3. Remove `uri` from frontend mutation parameters and BrowsePanel callers.
4. Throw explicit local-mode errors from the adapter in cloud mode.
5. Add focused contract/auth tests and run mandatory repository gates.

## Threat Model

`objectId` originates from browsed Sonos library data but still crosses an HTTP
trust boundary. The API constrains it to a trimmed non-empty string with a maximum
length before passing it to LAN-only Sonos browsing. No URI or arbitrary outbound
destination is accepted by these mutations.

## Rollback

Revert the feature commit. No persistent data changes or migrations are involved.
