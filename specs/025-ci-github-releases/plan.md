# Implementation Plan: CI — GitHub Releases with Changelog

**Branch**: `025-ci-github-releases` | **Date**: 2026-05-10 | **Spec**: [spec.md](./spec.md)

## Summary

Add a git tag creation step and `gh release create` step to the existing `promote-release.yml` workflow so each version promotion produces a GitHub Release with auto-generated changelog.

## Technical Context

**Language/Version**: GitHub Actions YAML  
**Primary Dependencies**: `gh` CLI (pre-installed on ubuntu-latest runners)  
**Storage**: N/A  
**Testing**: Manual workflow_dispatch validation  
**Target Platform**: GitHub Actions  
**Project Type**: CI/CD workflow  
**Constraints**: Must not break existing promote → docker-build pipeline

## Project Structure

### Files Modified

```text
.github/workflows/promote-release.yml   # Add tag + release steps
```

No new files required.

## Design

### Current Workflow Steps

1. Checkout main
2. Setup Node
3. Bump version → output `$VERSION`
4. Commit version bump to main
5. Fast-forward release to main
6. Trigger Docker build

### New Workflow Steps (modified)

1. Checkout main
2. Setup Node
3. Bump version → output `$VERSION`
4. Commit version bump to main
5. Fast-forward release to main
6. **NEW: Create git tag `v$VERSION`**
7. **NEW: Create GitHub Release with `--generate-notes`**
8. Trigger Docker build (moved to last)

### Implementation Detail

```yaml
- name: Create git tag
  run: |
    git tag "v${{ steps.version.outputs.version }}"
    git push origin "v${{ steps.version.outputs.version }}"

- name: Create GitHub Release
  run: |
    gh release create "v${{ steps.version.outputs.version }}" \
      --generate-notes \
      --target release \
      --title "v${{ steps.version.outputs.version }}"
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Permissions

The workflow already has `contents: write` which covers:
- Creating tags ✅
- Creating releases ✅
- Pushing to branches ✅

No permission changes needed.
