# Implementation Plan: Public Repository Readiness

**Branch**: `060-public-readiness` | **Date**: 2026-09-22 | **Spec**: [spec.md](./spec.md)

## Summary

Prepare a sanitized, public-ready HomeDash source tree while preserving the complete
private repository as a historical archive. Inventory and remove private data, harden
session-secret configuration with an upgrade-safe migration, add public governance and
CI controls, validate a history-free candidate, then perform a controlled repository
rename and clean one-commit cutover.

## Technical Context

**Language/Version**: TypeScript, Node.js 24
**Primary Dependencies**: Fastify 5, React 18, Vite, Drizzle ORM, GitHub Actions
**Storage**: SQLite plus filesystem backup/export artifacts
**Testing**: Vitest, Testing Library, Playwright, Docker upgrade gate, secret scanning
**Target Platform**: Docker/GHCR on a LAN-hosted server; GitHub public repository
**Project Type**: Full-stack pnpm workspace and repository migration
**Performance Goals**: No runtime performance regression; CI remains bounded and actionable
**Constraints**: Preserve existing configuration, retain owner-only release control, expose no
private history or identifiers, and keep the existing GHCR image path
**Scale/Scope**: Entire tracked repository tree, workflows, documentation, and release process

## Constitution Check

| Gate | Assessment |
| --- | --- |
| Security | Public output is default-deny: history is excluded, secrets are migrated without logging, and secret scanning gates cutover. |
| Privacy | Personal, household, network, device, storage, and workstation identifiers are inventoried and removed from public files. |
| Input validation | Secret configuration accepts only explicit supported inputs and rejects unsafe or ambiguous startup states. |
| LAN boundary | Sanitized examples retain LAN-first operation without publishing the owner's real network details. |
| Operational readiness | Existing upgrades, health signaling, GHCR publication, rollback, and repository recovery are validated. |
| Testing | Auth/secret behavior receives positive and negative tests; the full local and upgrade gates run before cutover. |
| Spec changelog | Initial specification is recorded in `changelog-spec.md`; later spec edits require a new entry. |
| Phase logging | Each implementation phase has a numbered log and raw command sidecars under `logs/`. |

**Result**: PASS. No constitution exceptions are required.

## Threat Model

The public repository is readable by anyone, including attackers searching commit
history and examples for credentials, LAN topology, usernames, device identifiers, and
known cryptographic defaults. The clean-snapshot cutover removes historical recovery
paths, while pattern inventories and secret scanners cover the current tree. Session
secret changes fail explicitly rather than falling back to a known value, preserve
supported existing installations, and never log secret material. GitHub branch,
environment, Actions, and package permissions restrict mutation and publication to the
owner-controlled flow.

## Implementation Phases

1. **Setup and inventory**: create feature artifacts; enumerate tracked data,
   identifiers, runtime artifacts, logs, workflows, and secret handling.
2. **Tracked-tree sanitization**: replace private examples, remove unsafe artifacts,
   strengthen ignore rules, and sanitize retained logs.
3. **Session-secret migration**: implement compatible variable handling, explicit
   startup behavior, migration documentation, and positive/negative tests.
4. **Public governance and CI**: add license and community/security files, harden
   workflows, and add required checks.
5. **Candidate validation**: export without history; run tests, build, lint, upgrade,
   code/UI review, private-data scan, and secret scan.
6. **Controlled cutover**: freeze changes, rename the private repository, create the
   public repository from one root commit, configure protections, reconnect GHCR, and
   validate owner/non-owner behavior.

## Source Impact

```text
.github/
├── CODEOWNERS
├── workflows/
└── contribution templates as required
backend/
├── src/ configuration and secret handling
├── tests/
└── AGENTS.md rules apply
docs/
├── getting-started.md
└── operations.md
specs/
├── retained historical specifications and sanitized logs
└── 060-public-readiness/
LICENSE
SECURITY.md
CONTRIBUTING.md
.gitignore
README.md
versions.json
```

## Validation Strategy

- Search tracked files for known personal, network, storage, and device identifiers.
- Inspect tracked/ignored database and backup patterns.
- Run a purpose-built secret scanner against the history-free candidate.
- Add focused backend tests for supported, missing, and conflicting secret variables.
- Run backend tests, frontend unit tests, typecheck, production build, format checks,
  mandatory lint gate, and Docker upgrade compatibility gate.
- Review the final branch diff under the repository code-review standard.
- Record UI review as not applicable unless sanitization changes user-facing output.
- Verify the public repository has one root commit and no imported branches or tags.
- Verify GHCR publish/pull and owner/non-owner repository controls after cutover.

## Rollback

Before cutover, discard the candidate and continue using the untouched private
repository. During cutover, if public creation or GHCR reconnection fails, rename the
private archive back to `HomeDash`, restore trusted local remotes, and resume the prior
release flow. The full local ZIP backup provides an independent recovery copy.
