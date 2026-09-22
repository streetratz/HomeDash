# Feature Specification: Exact Main Version Promotion

**Feature Branch**: `058-release-version-promotion`  
**Created**: 2026-09-20  
**Status**: In progress  
**Issue**: #242

## User Story

As a maintainer, I can promote the accumulated Main Version exactly so a repository
whose last release is `3.2.5` and whose current Main Version is `3.4.5` publishes
`3.4.5`, not a newly calculated version such as `3.2.6`.

## Functional Requirements

- **FR-001**: A root `versions.json` MUST be the machine-readable source for Main and
  Release versions.
- **FR-002**: Every normal PR advances only `versions.json.main` and its README badge.
- **FR-003**: `versions.json.release`, `package.json`, and the README Release Version
  MUST agree and represent the last deployed release.
- **FR-004**: Promotion MUST use the exact `versions.json.main` as its target.
- **FR-005**: Promotion MUST copy the target into `versions.json.release`,
  `package.json`, and the Release
  Version badge while leaving Main Version unchanged.
- **FR-006**: Promotion MUST reject malformed versions, inconsistent mirrors, a Main
  Version that is not
  newer than the current release, or a Release badge that differs from `package.json`.
- **FR-007**: Promotion MUST fail before committing if the target tag already exists.
- **FR-008**: Release comparison notes MUST start from the actual previous tag rather
  than assuming a one-patch difference.
- **FR-009**: PR checks MUST fail when a normal PR does not advance Main or changes
  Release.
- **FR-010**: Automated tests MUST cover exact multi-version jumps and all validation
  failures.
- **FR-011**: The current Main sequence MUST be restored from pre-regression `3.2.5`
  to `3.2.6` for this PR; the historical `v3.2.1` tag remains immutable.

## Success Criteria

- A Main `3.4.5` with current release `3.2.5` produces package, Release badge, tag,
  GitHub Release, and image version `3.4.5`.
- Main Version is identical before and after promotion.
- Invalid or non-forward version states stop before any push or tag.
- The corrective promotion after this PR creates `v3.2.6`.

## Out of Scope

- Deleting, moving, or replacing existing tags and GitHub Releases.
- Automatically choosing whether an individual PR is patch, minor, or major.
- Changing the rule that every PR advances Main Version.
