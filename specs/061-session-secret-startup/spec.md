# Feature Specification: Persistent Session Secret Startup

**Feature Branch**: `061-session-secret-startup`
**Created**: 2026-09-24
**Status**: In Progress
**Input**: GitHub issue #11

## User Scenario

As an existing HomeDash operator whose container does not define a session-secret
environment variable, I can upgrade and restart the production image without entering
a reboot loop or using a known or process-ephemeral production secret.

## Requirements

- **FR-001**: Explicit `HOMEDASH_SESSION_SECRET` and legacy `SESSION_SECRET` values
  MUST remain authoritative.
- **FR-002**: Conflicting explicit values MUST fail startup without disclosing either
  value.
- **FR-003**: Production startup without either variable MUST generate a
  cryptographically random 256-bit secret once under `HOMEDASH_DATA_DIR`.
- **FR-004**: The generated secret MUST persist across restarts and use file mode
  `0600`.
- **FR-005**: Invalid generated-secret files MUST fail with actionable guidance rather
  than silently rotate credentials.
- **FR-006**: Documentation and example Compose files MUST describe the fallback and
  the need to preserve the data volume.

## Success Criteria

- **SC-001**: A production process with neither secret variable starts successfully.
- **SC-002**: Repeated starts against the same data directory resolve the same secret.
- **SC-003**: Focused unit tests cover explicit variables, conflicts, generation,
  reuse, permissions, and malformed files.
- **SC-004**: A locally built production container becomes healthy without either
  secret variable.
