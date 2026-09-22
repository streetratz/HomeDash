# Feature Specification: CI — GitHub Releases with Changelog

**Feature Branch**: `025-ci-github-releases`  
**Created**: 2026-05-10  
**Status**: Draft  
**GitHub Issue**: #71  
**Input**: User description: "Add a step to the Promote to Release workflow that creates a GitHub Release with auto-generated release notes"

## User Scenarios & Testing

### User Story 1 - Release Visibility (Priority: P1)

As a HomeDash user/developer, when a new version is promoted, I want a GitHub Release page created automatically so I can see what changed and download the tagged source.

**Why this priority**: Without this, version history is invisible — users see Docker images update but have no changelog or release notes.

**Independent Test**: After running the Promote workflow, verify a GitHub Release exists at `vX.Y.Z` with auto-generated notes.

**Acceptance Scenarios**:

1. **Given** the Promote workflow completes, **When** I visit the Releases page, **Then** I see a release tagged `vX.Y.Z` with notes generated from merged PRs since the last release.
2. **Given** the release is created, **When** I view the release body, **Then** it lists PR titles/links since the previous tag.
3. **Given** this is the first release with this feature, **When** no prior tag exists, **Then** the release notes include all PRs since repo creation.

---

### Edge Cases

- First-ever release: no prior tag exists — `--generate-notes` handles this gracefully (includes everything)
- Promote workflow fails mid-way: release should only be created after successful push to `release` branch
- Manual workflow_dispatch: should still create the release correctly

## Requirements

### Functional Requirements

- **FR-001**: System MUST create a git tag `vX.Y.Z` on the promote commit
- **FR-002**: System MUST create a GitHub Release associated with that tag
- **FR-003**: Release MUST include auto-generated notes from merged PRs
- **FR-004**: Release MUST target the `release` branch
- **FR-005**: Docker build trigger MUST remain the final step (release creation must not block image build)

## Success Criteria

### Measurable Outcomes

- **SC-001**: Every successful Promote workflow run produces exactly one GitHub Release
- **SC-002**: Release notes contain at least one PR reference (when PRs exist since last tag)
- **SC-003**: Release tag matches the bumped version in `package.json`

## Assumptions

- The existing `contents: write` permission is sufficient for tag + release creation
- `gh` CLI is available in the runner (ubuntu-latest includes it)
- No branch protection rules block tag creation on `release`
