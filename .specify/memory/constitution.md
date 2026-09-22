<!--
Sync Impact Report

- Version change: 2.3.0 → 2.4.0
- Modified principles: none
- Modified sections:
	- Development Workflow & Quality Gates: added new subsection "Spec Changelog" requiring
		a dated CH-NN entry in changelog-spec.md for every edit to a feature spec.md. Defines
		entry format, TOC requirement, and commit obligation.
- Removed sections: none
- Templates requiring updates:
	- ⚠ .specify/templates/ (consider adding changelog-spec.md template)
- Deferred TODOs: none

Previous entry (2.2.0 → 2.3.0):
- Modified principles:
	- V. Testing & Change Safety: expanded first bullet to include mandatory frontend E2E tests;
		removed stale "(supersedes test-outcomes-and-results.md)" parenthetical; updated sidecar
		bullet to reference subfolder layout; added new bullet requiring test suite to be green
		before a phase is marked complete.
- Modified sections:
	- Development Workflow & Quality Gates → Test & Error Logging: sidecar files moved from
		flat logs/ root into per-phase subfolders (NN-phase-<slug>/); sidecar filenames drop the
		NN-phase-slug- prefix (folder provides phase context); file structure diagram, naming rule,
		and Commands Run table example link updated accordingly.
-->

# HomeDash Constitution

## Core Principles

### I. Secure-by-Default (NON-NEGOTIABLE)
HomeDash is LAN-hosted, not “safe-by-location.” The LAN is a hostile network.

- The app MUST require authentication for all endpoints that mutate state or expose
	private/user-specific/admin-only data. The only unauthenticated endpoints permitted are
	explicitly-designated public, read-only resources required to render the admin-selected
	public dashboard (and its static assets).
- Public endpoints MUST NOT expose: user identity/session data, settings, dashboards lists,
	edit/management capabilities, or any admin-only metadata.
- Public dashboard content MUST be explicitly selected by an administrator (separately for
	web and mobile contexts).
- Public endpoints MUST be GET-only and MUST be safe under hostile-LAN assumptions (no
	secrets in responses; no implicit external callbacks).
- Authorization MUST be explicit and default-deny (least privilege). New endpoints MUST declare
	their authz requirements.
- Secrets (session keys, DB creds, API keys) MUST be provided via environment variables and/or
	mounted secret files. Secrets MUST NOT be committed or logged.
- Sessions MUST use HttpOnly cookies. If TLS is used (recommended), cookies MUST be `Secure`.
	`SameSite` MUST be set deliberately (prefer `Lax`; use `Strict` if compatible).
- Cookie-based auth MUST include CSRF protections for state-changing requests.
- Input validation MUST be enforced at every trust boundary (request payloads, query params,
	headers, and persistence layer). Reject by default; do not “best effort” parse.
- Browser security headers MUST be set (at least CSP, `X-Content-Type-Options: nosniff`,
	`Referrer-Policy`, and `Permissions-Policy`). Framing MUST be controlled via CSP
	`frame-ancestors` (or `X-Frame-Options` when applicable).

Rationale: A compromised device on the same subnet should not trivially pivot into HomeDash.

### II. Mobile-First, Fluid, Accessible UI
HomeDash MUST feel “native” on phones and tablets while remaining fast and readable on desktop.

- The UI MUST be responsive and usable from ~360px wide through large desktop layouts.
- Primary interactions MUST be touch-friendly (appropriate spacing/target sizes) and keyboard
	accessible.
- Accessibility is not optional: semantic HTML, visible focus states, and screen-reader friendly
	labeling MUST be maintained.
- Performance matters on low-power devices: avoid unnecessary re-renders, ship only needed
	JavaScript, and keep perceived latency low (especially for navigation and common actions).

Rationale: This is a dashboard used in motion (mobile) and at a desk (web).

### III. LAN-Only Deployment Boundary (Synology Host Network)
HomeDash is intended to run only on a private LAN inside a Synology NAS Docker container using
host networking.

- The app MUST NOT assume an internet connection at runtime for core functionality.
- The app MUST NOT auto-expose itself outside the LAN (no UPnP/NAT-PMP, no unsolicited external
	callbacks).
- Network binding MUST be configurable (host, port). Defaults MUST be safe and documented.
- Cross-origin access MUST be locked down: CORS and allowed origins MUST be explicit and
	configurable for the LAN domain(s) in use.
- Reverse-proxy deployments MUST be supported (common on Synology). If trusting proxy headers
	(e.g., `X-Forwarded-*`), trusted proxy ranges MUST be configurable.

Rationale: Host networking removes a Docker port-mapping safety net; the app must be intentional
about exposure and trust.

### IV. Operational Readiness (Observability & Resilience)
If it can’t be diagnosed and recovered on the NAS, it’s not “done.”

- The app MUST emit structured logs suitable for NAS-hosted troubleshooting (include request ID
	correlation where applicable).
- The app MUST provide health signaling appropriate for containers (health/readiness endpoints
	or equivalent).
- Error handling MUST be deliberate: fail safely, return consistent errors, and avoid leaking
	secrets or internal details.
- Startup, shutdown, and long-running requests MUST be handled gracefully (timeouts,
	cancellation, and cleanup).

Rationale: Home servers are “ops-light”; observability is the product.

### V. Testing & Change Safety (NON-NEGOTIABLE)
LAN-only is not a substitute for correctness. Tests prevent silent breakage.

- Backend business logic MUST have automated tests (unit and/or integration). Frontend UI flows
	MUST have automated E2E tests for all critical paths (first-run, auth, navigation).
- Authentication and authorization behavior MUST have explicit coverage (positive and negative
	cases).
- Changes to contracts (API routes, stored data schemas) MUST include upgrade/migration notes
	and tests.
- Breaking changes MUST be called out clearly and versioned (SemVer).
- A `<FEATURE_DIR>/logs/readme.md` canonical index MUST be created at feature start and
	kept current with a link to every numbered phase log file. This is the primary audit
	record for the feature.
- Each phase (or distinct implementation stage) MUST produce its own chronologically-numbered
	Markdown file in `<FEATURE_DIR>/logs/` (e.g., `01-phase-setup.md`). A new file MUST be
	created at the start of each phase; files MUST NOT be shared across phases.
- Every numbered phase file MUST open with a Table of Contents for its subsections and a
	navigation link back to `logs/readme.md`.
- Raw command output (stdout/stderr) MUST be captured to a `.log` sidecar file in that
	phase's dedicated sidecar subfolder (`NN-phase-<slug>/`), and linked from the Commands
	Run table in the phase `.md` file.
- All errors encountered during implementation MUST be recorded in the current phase file
	with their root cause and the fix applied. Errors MUST NOT be silently discarded.
- The test suite MUST be green before a phase is marked complete. A phase file MUST NOT
	have its Phase Checkpoint marked ✅ while known failing tests remain unresolved.

Rationale: Home automation/dashboards tend to accrete features; tests keep it maintainable.
A flat, numbered log structure with a root index ensures every implementation session is
traceable, browsable, and diagnosable long after the implementation session ends.

## Security, Privacy & Data Handling

- Data minimization: collect/store only what is required to deliver features.
- Credentials MUST be stored securely (passwords hashed with a modern algorithm such as
	Argon2id/bcrypt; never reversible encryption).
- Sensitive data MUST NOT be written to logs; redact by default.
- Browser storage: do not store long-lived secrets in `localStorage`/`sessionStorage`.
- Rate limiting and brute-force defenses MUST exist for auth entry points.
- Dependencies MUST be pinned and updated deliberately; high/critical security issues must be
	triaged quickly.

Deployment notes (Synology + host networking):

- The container MUST run as a non-root user unless there is a documented and reviewed need.
- The app MUST expose only the minimal required listening port(s).
- Default configuration MUST be safe for “first run” on a LAN (no anonymous admin surfaces).

## Development Workflow & Quality Gates

- Every feature MUST have a spec and plan produced from the `.specify` templates.
- Every plan MUST include a “Constitution Check” section populated from these principles.
- Pull requests MUST:
	- pass formatting/linting and automated tests,
	- update docs/quickstart when behavior or deployment changes,
	- include explicit notes for any new config/env vars.
- Any auth, networking, or data-storage change MUST include a brief threat model note
	(what's exposed, who can access it, how it's mitigated).

### Test & Error Logging

A persistent, committed record of all test runs and errors MUST be maintained per feature.

**File structure** (relative to the feature spec directory `<FEATURE_DIR>/`):

```
<FEATURE_DIR>/
  logs/
    readme.md                                        <- canonical index; links to all numbered phase files
    01-phase-setup.md                                <- one file per phase; has TOC + back-link
    01-phase-setup/                                  <- sidecar subfolder named after its phase file
      backend-tsc-run-1.log                          <- raw sidecar (stdout/stderr)
      frontend-tsc-run-1.log
      vite-run-1.log
    02-phase-foundational.md
    02-phase-foundational/
      backend-tsc-run-1.log
      drizzle-run-1.log
      vitest-run-1.log
    NN-phase-<kebab-slug>.md
    NN-phase-<kebab-slug>/
      <tool>-run-<N>.log
```

**File naming**:
- **Phase markdown**: `NN-phase-<kebab-slug>.md` — NN is a zero-padded two-digit global
  sequence; one file per phase (e.g., `03-phase-auth-integration.md`).
- **Raw sidecar**: `<tool>-run-<N>.log` inside `logs/NN-phase-<kebab-slug>/` — the
  enclosing folder provides phase context; do not repeat the phase prefix in the filename.
  N increments per tool per phase (first attempt = run-1; post-fix re-run = run-2).
  Recognised tool tokens: `tsc`, `vitest`, `playwright`, `drizzle`, `vite`, `eslint`,
  `redocly`, `pnpm-build`. Context-qualified tokens (e.g., `backend-tsc`, `frontend-tsc`)
  MUST be used when the same tool runs in multiple workspaces within the same phase.

**Phase markdown file format** (required sections, in order):

````markdown
# NN — Phase Name

[<- Back to Logs Index](readme.md)

## Table of Contents
- [Overview](#overview)
- [Commands Run](#commands-run)
- [Run 1: <tool>](#run-1-tool)
- [Errors & Fixes](#errors--fixes)
- [Phase Checkpoint](#phase-checkpoint)

## Overview
**Phase**: NN — <Name>
**Task range**: T-XX – T-XX
**Date/Time**: YYYY-MM-DD HH:MM
**Purpose**: <brief description>

## Commands Run

| # | Command | Outcome | Log File |
|---|---------|---------|----------|
| 1 | `<exact command>` | ✅ PASS | [01-phase-setup/tsc-run-1.log](01-phase-setup/tsc-run-1.log) |

## Run 1: <tool>
<!-- one sub-section per tool run; if the run failed, add root cause + fix here -->

## Errors & Fixes
<!-- numbered entry for each error encountered in this phase; "No errors recorded." if none -->

## Phase Checkpoint
<!-- overall pass/fail statement for the phase -->
````

**Raw sidecar format** — first five lines, then raw stdout/stderr:

```
# Command: <exact command>
# Phase:   NN — <name>
# Run:     N
# Time:    YYYY-MM-DD HH:MM
# Exit:    <exit code>
---
<raw stdout/stderr>
```

**`logs/readme.md` structure**:

````markdown
# Logs Index — <Feature Name>

## Phases

| # | Phase | Status | File |
|---|-------|--------|------|
| 01 | Phase Setup | ✅ Complete | [01-phase-setup.md](01-phase-setup.md) |
| 02 | Phase Foundational | ⏳ In Progress | [02-phase-foundational.md](02-phase-foundational.md) |

## Overall Status
<!-- updated after each phase completes -->
````

**Update obligations** (update immediately — do not batch):

| Trigger | Required action |
|---------|----------------|
| Feature start | Create `logs/readme.md` with feature name and empty Phases table |
| Before each phase starts | Create `NN-phase-<slug>.md` (Overview section populated); add row to `logs/readme.md` |
| After every command with observable output | Add row to Commands Run table in phase file; capture stdout/stderr to `.log` sidecar; link sidecar in table |
| For every error found | Add numbered entry in current phase file's Errors & Fixes section with root cause + fix |
| After each phase completes | Complete Phase Checkpoint section; update row status in `logs/readme.md` |

**Commit requirements**: All files under `logs/` — `readme.md`, numbered `.md` phase
files, and `.log` sidecars — MUST be committed as part of the feature branch. They are
audit artifacts, not throwaway local output.

### Spec Changelog

Every edit to a feature `spec.md` MUST be recorded in a `changelog-spec.md` file in the
same directory as the spec.

**Entry format**:

```
CH-NN : <ShortDescription> : YYYY-Mmm-DD HHMM TZ
```

- `CH-NN` — zero-padded two-digit global sequence within the feature (CH-01, CH-02, …).
- `<ShortDescription>` — 3–8 words; no punctuation other than hyphens.
- `YYYY-Mmm-DD HHMM TZ` — date and 24-hour time with timezone (e.g., `2026-Feb-22 1400 UTC`).

**Required content per entry**: change type (New FR / New NFR / New SC / Revised /
New document), affected IDs, and a short diff summary (one sentence per changed item is
sufficient).

**`changelog-spec.md` structure**:

````markdown
# Spec Changelog — <Feature Name>

## Table of Contents
- [CH-01 : <ShortDescription>](#ch-01--shortdescription)

---

## CH-01 : <ShortDescription> : YYYY-Mmm-DD HHMM TZ

**Type**: <change type>  
**Summary**: <one paragraph>

| ID | Description |
|----|-------------|
| FR-XXX | … |
````

**Update obligations**:

| Trigger | Required action |
|---------|-----------------|
| First spec created | Create `changelog-spec.md` with TOC + CH-01 entry |
| Any edit to `spec.md` | Add next CH-NN entry with date/time, types, IDs, and summary |
| Commit | `changelog-spec.md` MUST be committed in the same commit as the `spec.md` change |

**Commit requirements**: `changelog-spec.md` is an audit artifact and MUST be committed
alongside every `spec.md` change. The changelog MUST NOT be updated retroactively in bulk;
each entry MUST be written at the time of the corresponding spec edit.

## Governance
<!-- Example: Constitution supersedes all other practices; Amendments require documentation, approval, migration plan -->

- The constitution is the highest-order project rule set. Specs, plans, tasks, and
	implementation MUST conform.
- Amendment process:
	- Propose changes via PR editing `.specify/memory/constitution.md`.
	- Update the Sync Impact Report (top-of-file).
	- Bump version following SemVer (see below).
	- Describe migration/transition steps if behavior expectations change.
- Versioning policy (SemVer):
	- MAJOR: incompatible principle/governance changes or removed non-negotiables.
	- MINOR: new principle/section, or materially expanded mandatory guidance.
	- PATCH: clarifications and wording that do not change obligations.
- Compliance review expectations:
	- Feature plans MUST enumerate constitution gates.
	- Any violation MUST be explicitly documented in the plan under “Complexity Tracking” with a
		rationale and a rollback path.

**Version**: 2.4.0 | **Ratified**: 2026-02-21 | **Last Amended**: 2026-02-22
