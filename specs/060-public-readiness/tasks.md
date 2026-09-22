# Tasks: Public Repository Readiness

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), GitHub issue #249

## Phase 1: Setup and Inventory

- [x] T001 Create branch `060-public-readiness`.
- [x] T002 Create specification, plan, tasks, changelog, and phase-log index.
- [x] T003 Inventory tracked personal paths, usernames, LAN values, storage paths,
      Sonos identifiers, household names, databases, backups, and raw logs.
- [x] T004 Inventory session-secret implementation, documentation, encryption
      dependencies, tests, and upgrade behavior.
- [x] T005 Inventory workflows, permissions, action references, release gates, GHCR
      assumptions, and public governance files.

## Phase 2: Sanitized Public Tree

- [x] T006 Remove the tracked zero-byte file literally named `backend/*.db`.
- [x] T007 Strengthen `.gitignore` for SQLite variants, sidecars, backups, SSH
      material, uploads, generated test output, and portable exports.
- [x] T008 Replace tracked private identifiers with fictional examples.
- [x] T009 Sanitize or remove raw implementation logs that are unsafe for publication.
- [x] T010 Confirm runtime databases, backups, SSH material, uploads, and generated
      test output are absent from the tracked candidate.

## Phase 3: Session-Secret Migration

- [x] T011 Add failing tests for legacy, documented, conflicting, and missing secret
      configurations.
- [x] T012 Remove the known production default and implement deterministic compatible
      secret resolution.
- [x] T013 Preserve encrypted integration configuration or fail with explicit
      migration guidance.
- [x] T014 Update deployment and upgrade documentation without exposing secrets.
- [x] T015 Run focused backend tests and record the results.

## Phase 4: Public Governance and Automation

- [x] T016 Add root MIT `LICENSE`.
- [x] T017 Add `SECURITY.md`, `CONTRIBUTING.md`, sanitized deployment examples, and
      `.github/CODEOWNERS`.
- [x] T018 Add or expand PR checks for tests, lint, build, upgrade compatibility,
      dependency review, static analysis, and secret scanning where supported.
- [x] T019 Apply least-privilege workflow permissions and pin external actions.
- [x] T020 Restrict release promotion and direct GHCR publication to the approved
      owner-controlled path.
- [x] T020A Require an isolated current-release-to-proposed-main database upgrade
      preflight before promotion mutates `main`, `release`, tags, or releases.
- [x] T021 Increment only the Main Version and README Main Version badge.

## Phase 5: Candidate Validation

- [x] T022 Export the candidate without `.git`, ignored runtime data, branches, or
      tags.
- [x] T023 Run private-identifier and secret scans against the export.
- [x] T024 Run backend tests, frontend unit tests, typecheck, build, and format checks.
- [x] T025 Run the mandatory code-review, UI-review applicability, upgrade, and lint
      gates.
- [x] T026 Resolve all significant findings and repeat affected checks.

## Phase 6: Controlled Cutover

- [ ] T027 Freeze merges and releases for the cutover window.
- [ ] T028 Rename the private repository to `HomeDash-private-history` and update
      trusted archive remotes.
- [ ] T029 Initialize the sanitized export with one clean root commit using a GitHub
      noreply author email.
- [ ] T030 Create public `streetratz/HomeDash` and push only the clean root commit.
- [ ] T031 Configure branch rules, release environment, security features, merge
      settings, and owner-only authority.
- [ ] T032 Recreate only sanitized relevant issues and release information.
- [ ] T033 Reconnect and verify `ghcr.io/streetratz/homedash`.
- [ ] T034 Validate installation, upgrade, image startup, owner controls, and
      non-owner restrictions.
