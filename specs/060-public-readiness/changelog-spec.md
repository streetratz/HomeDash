# Spec Changelog - Public Repository Readiness

## Table of Contents

- [CH-01 : Define public cutover](#ch-01--define-public-cutover--2026-sep-22-2027-utc)
- [CH-02 : Exclude runtime artifacts](#ch-02--exclude-runtime-artifacts--2026-sep-22-2033-utc)
- [CH-03 : Reject secret conflicts](#ch-03--reject-secret-conflicts--2026-sep-22-2040-utc)
- [CH-04 : Normalize audit whitespace](#ch-04--normalize-audit-whitespace--2026-sep-22-2130-utc)

---

## CH-01 : Define public cutover : 2026-Sep-22 2027 UTC

**Type**: New document, New FR, New SC
**Summary**: Defined the sanitized snapshot, upgrade-safe secret migration, public
governance, validation, and controlled cutover requirements from #249.

| ID | Description |
| --- | --- |
| FR-001 - FR-006 | Preserve private history and sanitize all public source and evidence. |
| FR-007 - FR-011 | Remove known secret defaults while preserving safe upgrades. |
| FR-012 - FR-020 | Establish public governance, automation, GHCR continuity, and rollback. |
| SC-001 - SC-008 | Define measurable scan, validation, cutover, control, and publication outcomes. |

---

## CH-02 : Exclude runtime artifacts : 2026-Sep-22 2033 UTC

**Type**: New FR, Revised SC
**Summary**: Added an explicit requirement to remove and exclude runtime backup, SSH,
upload, generated test-output, and database artifacts while retaining automated test
source.

| ID | Description |
| --- | --- |
| FR-021 | Remove runtime artifacts from the workspace and public candidate without deleting test source. |
| SC-003 | Expanded the zero-artifact outcome to cover SSH material, uploads, and generated test output. |

---

## CH-03 : Reject secret conflicts : 2026-Sep-22 2040 UTC

**Type**: Revised FR
**Summary**: Replaced ambiguous secret-variable precedence with explicit startup
failure when canonical and legacy variables contain different values.

| ID | Description |
| --- | --- |
| FR-009 | Accept either variable for compatibility, but reject conflicting values without revealing them. |

---

## CH-04 : Normalize audit whitespace : 2026-Sep-22 2130 UTC

**Type**: Revised
**Summary**: Removed trailing whitespace from the feature specification and related
audit artifacts so the PR-wide whitespace gate is deterministic.

| ID | Description |
| --- | --- |
| Editorial | Formatting-only normalization; no requirement or acceptance behavior changed. |
