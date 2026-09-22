# Requirements Checklist: CI — GitHub Releases

## Functional Requirements

- [ ] FR-001: Git tag `vX.Y.Z` created on promote commit
- [ ] FR-002: GitHub Release created and associated with tag
- [ ] FR-003: Release includes auto-generated notes from merged PRs
- [ ] FR-004: Release targets the `release` branch
- [ ] FR-005: Docker build trigger remains the final step

## Success Criteria

- [ ] SC-001: Every Promote run produces a GitHub Release
- [ ] SC-002: Release notes contain PR references
- [ ] SC-003: Release tag matches bumped version
