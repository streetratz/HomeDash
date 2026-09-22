# Feature Specification: Public Repository Readiness

**Feature Branch**: `060-public-readiness`
**Created**: 2026-09-22
**Status**: Draft
**Input**: GitHub issue #249 and the decision to retain the `streetratz` account

## User Scenarios & Testing

### User Story 1 - Publish a Sanitized Source Snapshot (Priority: P1)

As the project owner, I can publish the current HomeDash source without exposing
private repository history, household identifiers, credentials, runtime data, or
personal workstation details.

**Why this priority**: Public publication is unsafe until the candidate source tree is
demonstrably free of private data.

**Independent Test**: Export the tracked candidate tree without `.git`, scan it for
secrets and identified private-data patterns, and confirm that no runtime database or
backup artifact is present.

**Acceptance Scenarios**:

1. **Given** the private historical repository, **When** the public candidate is
   exported, **Then** it contains only sanitized tracked files and no Git history.
2. **Given** known household and workstation identifiers, **When** the candidate is
   scanned, **Then** none of those identifiers are present.
3. **Given** database, journal, backup, and portable export patterns, **When** the
   candidate is inspected, **Then** those runtime artifacts are absent and ignored.

---

### User Story 2 - Upgrade Without Losing Protected Configuration (Priority: P1)

As an existing HomeDash operator, I can upgrade to the public-ready build without a
known default session secret and without silently losing encrypted integration
credentials.

**Why this priority**: A security fix that invalidates stored credentials without an
explicit migration would create data loss and an unsafe upgrade path.

**Independent Test**: Start the candidate image against a database produced by the
current release, exercise the supported secret configurations, and verify that
existing encrypted configuration remains readable or fails with an explicit
actionable error.

**Acceptance Scenarios**:

1. **Given** an installation using the supported existing secret variable, **When** it
   upgrades, **Then** authentication and encrypted integrations continue to work.
2. **Given** no configured session secret, **When** HomeDash starts, **Then** it does
   not use a known production default.
3. **Given** conflicting legacy and documented secret variables, **When** HomeDash
   starts, **Then** startup fails with actionable guidance without logging either
   secret.

---

### User Story 3 - Operate a Governed Public Repository (Priority: P2)

As the repository owner, I can maintain a public MIT-licensed project while retaining
sole merge and release authority.

**Why this priority**: Public contribution and release controls must be ready before
the clean repository is announced.

**Independent Test**: Inspect the new public repository as both the owner and a
non-owner, confirming that contribution guidance is visible, direct protected-branch
changes are blocked, and only the owner can approve production releases.

**Acceptance Scenarios**:

1. **Given** the sanitized candidate, **When** the public repository is created,
   **Then** it starts from one clean root commit under `streetratz/HomeDash`.
2. **Given** a non-owner account, **When** it attempts protected changes or release
   approval, **Then** those actions are denied.
3. **Given** the new public repository, **When** its release workflow runs, **Then**
   the expected GHCR image can be published and pulled.

### Edge Cases

- A tracked log contains a private identifier embedded in otherwise useful evidence.
- A secret scanner reports a false positive in a fixture or generated checksum.
- Existing deployments use only `SESSION_SECRET`, only
  `HOMEDASH_SESSION_SECRET`, both variables, or neither variable.
- The public repository name is temporarily unavailable during the rename window.
- GHCR remains linked to the private historical repository after cutover.
- Repository protection features differ between private and public GitHub Free
  repositories.

## Requirements

### Functional Requirements

- **FR-001**: The existing repository MUST remain private as the historical archive.
- **FR-002**: The public repository MUST be created from a history-free export with one
  clean root commit.
- **FR-003**: The public candidate MUST exclude private branches, tags, issues, pull
  requests, discussions, Actions history, logs, releases, and Git metadata.
- **FR-004**: Tracked personal paths, usernames, LAN addresses, hostnames, storage
  paths, Sonos identifiers, household room/device names, and private examples MUST be
  removed or replaced with clearly fictional values.
- **FR-005**: Runtime SQLite databases, journals, WAL/SHM sidecars, backups, and
  portable exports MUST be absent from the candidate and covered by ignore rules.
- **FR-006**: Retained implementation logs MUST contain only evidence suitable for
  public distribution.
- **FR-007**: The application MUST NOT rely on a known production session-secret
  default.
- **FR-008**: Existing deployments using `SESSION_SECRET` MUST have a documented and
  tested compatibility path.
- **FR-009**: The documented `HOMEDASH_SESSION_SECRET` name and implemented secret
  configuration MUST be reconciled; the legacy name remains compatible and conflicting
  values fail startup explicitly.
- **FR-010**: Secret migration MUST NOT silently invalidate encrypted integration
  credentials.
- **FR-011**: Secret values MUST never be written to logs or error responses.
- **FR-012**: The repository MUST include an MIT license, security policy,
  contribution guidance, and owner-routing CODEOWNERS configuration.
- **FR-013**: Pull-request checks MUST cover backend tests, frontend unit tests,
  production build, lint, upgrade compatibility, dependency review, static analysis,
  and secret scanning where GitHub supports them.
- **FR-014**: Workflow permissions MUST be least-privilege and third-party actions
  MUST be pinned to immutable commit SHAs where practical.
- **FR-015**: Release promotion and production environment approval MUST remain under
  `streetratz` control.
- **FR-016**: Direct manual GHCR publication MUST be removed or gated behind the
  approved promotion process.
- **FR-017**: The public `main` and `release` branches MUST block force-push and
  deletion and enforce the intended pull-request/release paths.
- **FR-018**: Only sanitized, still-relevant issues and release notes MAY be recreated
  publicly.
- **FR-019**: The existing `ghcr.io/streetratz/homedash` publication and pull path
  MUST be verified after cutover.
- **FR-020**: The cutover MUST include explicit rollback steps for repository naming,
  local remotes, and GHCR publication.
- **FR-021**: Runtime backup, SSH, upload, generated test-output, and database
  directories MUST be removed from the workspace before export and explicitly
  excluded from the public candidate; automated test source code MUST remain.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A purpose-built secret scan of the exported public candidate reports no
  unresolved secrets.
- **SC-002**: A private-data pattern scan reports zero occurrences of the identified
  personal, LAN, storage, and device identifiers.
- **SC-003**: The candidate contains zero runtime databases, database sidecars,
  backups, SSH material, uploads, generated test output, or Git metadata.
- **SC-004**: Existing configuration survives the documented upgrade path with
  foreign-key integrity intact.
- **SC-005**: Backend tests, frontend unit tests, typecheck, build, required lint gate,
  and upgrade compatibility gate pass before cutover.
- **SC-006**: The public repository contains one root commit at creation and no
  historical branches or tags.
- **SC-007**: A non-owner validation account cannot directly modify protected
  branches, merge owner-controlled changes, or approve a production release.
- **SC-008**: A post-cutover image is successfully published to and pulled from
  `ghcr.io/streetratz/homedash`.

## Assumptions

- The GitHub owner remains the existing `streetratz` account.
- The full private working-directory backup created on 2026-09-22 remains available
  throughout the migration.
- The current private repository is renamed only after the sanitized candidate passes
  all required gates.
- Historical issues, pull requests, releases, and Git history remain available only
  in the private archive.
- GitHub-hosted security and repository-protection features are enabled only where
  available for a public repository on the owner's plan.
