# Feature Specification: Synology Session Secret Permissions

**Feature Branch**: `063-session-secret-permissions`
**Created**: 2026-09-24
**Status**: In Progress
**Input**: GitHub issue #14

## Requirement

HomeDash MUST explicitly enforce mode `0600` after atomically creating the generated
production session-secret file, including on Synology bind mounts with inherited ACLs.

## Success Criteria

- Unit coverage proves the creation path invokes `chmodSync(path, 0o600)`.
- The production image starts with a clean data directory.
- Live NAS verification confirms mode `0600`, healthy restart, and secret reuse.
