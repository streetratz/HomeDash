# Tasks: CI — GitHub Releases with Changelog

**Input**: Design documents from `/specs/025-ci-github-releases/`  
**GitHub Issue**: #71

## Phase 1: Implementation

**Purpose**: Add tag + release creation to promote workflow

- [x] T001 [US1] Add git tag creation step to `.github/workflows/promote-release.yml` — creates and pushes `v$VERSION` tag after release branch push
- [x] T002 [US1] Add `gh release create` step with `--generate-notes --target release --title "vX.Y.Z"` after tag creation
- [x] T003 [US1] Move "Trigger Docker build" step to final position (after release creation)

**Checkpoint**: Workflow YAML complete, ready for validation

---

## Phase 2: Validation

**Purpose**: Verify the workflow is correct

- [x] T004 [US1] Validate YAML syntax (actionlint or manual review)
- [x] T005 [US1] Commit, push, create PR (#76)
- [ ] T006 [US1] After merge, run Promote workflow to verify release is created

---

## Dependencies & Execution Order

- T001 → T002 → T003 (sequential, same file)
- T004 depends on T003
- T005 depends on T004
- T006 depends on T005 (post-merge manual validation)
