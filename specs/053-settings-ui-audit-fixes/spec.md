# Feature Specification: Settings UI Audit Fixes

**Feature Branch**: `053-settings-ui-audit-fixes`
**Created**: 2026-09-20
**Status**: In progress

## Scope

Resolve the settings and widget-management UI defects tracked by #229 through
#236 in one pull request while preserving a separate commit for each issue.

## Requirements

- Widget editor Cancel and Apply actions must match their draft behavior.
- Unsaved settings edits must survive or be guarded during section changes.
- Settings data panels must distinguish loading, error, empty, and populated
  states.
- Group membership must use a user-facing selector rather than raw user IDs.
- Widget configuration controls and labels must be consistent and accessible.
- Dashboard and Settings widget management must expose a coherent capability
  model and user-facing terminology.
- Settings management actions must have accessible names and mobile touch
  targets.
- User-management dialogs must clear stale and sensitive values when closed.

## Out of scope

- Sonos behavior or UI.
- Release promotion or version tagging.
- Backend schema changes.

## Success criteria

- Each issue #229–#236 has focused regression coverage.
- The complete frontend test suite, build, lint gate, and Docker upgrade gate
  pass before the pull request is opened.
- The Main Version badge advances once for the combined pull request.
