# 01 — Implementation

## Result

✅ Complete.

## Commit plan

- Workflow documentation.
- #229 widget editor draft semantics.
- #230 unsaved settings navigation.
- #231 settings query states.
- #232 group membership selection.
- #233 widget configuration controls.
- #234 widget management consistency.
- #235 settings accessibility.
- #236 sensitive dialog cleanup.

## Completed

- #229: Placeholder editor sessions now capture the opening draft. Cancel
  restores that snapshot and its prior dirty state, while Apply stages the
  complete dialog result and clearly points to the dashboard-level Save action.
- #230: Visited top-level Settings tabs and Appearance panels stay mounted so
  their unsaved local drafts survive section changes.
- #231: Added shared loading and recoverable error states and applied them to
  dashboard, scheduled-job, preference, appearance, widget, user, group,
  calendar, account, Pi-hole, Docker, and photo-source data panels so failed
  requests no longer masquerade as empty configuration.
- #232: Replaced raw group-member UUID entry with a searchable list of eligible
  users showing display names and usernames.
- #233: Standardized representative widget selects and toggles on the shared UI
  primitives, associated visible labels with controls, identified grouped
  choices, and made paired fields stack on narrow screens.
- #234: Removed the divergent persisted-widget editor from Settings and routed
  widget management to the authoritative dashboard draft editor. Dashboard edit
  controls are now available from the mobile navigation as well as desktop, and
  user-facing copy consistently calls placeholders widget containers.
- #235: Added target-specific accessible names and mobile touch targets to user,
  group, Pi-hole, Docker, photo-source, and representative widget-config actions.
- #236: User creation, editing, password-reset, and deletion dialogs now clear
  local fields and errors on every close path; password values do not survive
  cancellation or target changes.
