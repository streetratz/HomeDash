# Tasks: Settings Unified Navigation (Option A)

**Input**: `plan.md`, `spec.md` (US1 unified nav, US2 deep-link/refresh persistence, US3 grouping)
**Tests**: Included — spec defines measurable nav, persistence, and admin-gating outcomes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency)
- Paths are relative to the repository root.

---

## Phase 1: Foundational (blocking prerequisites)

- [ ] T001 Create `frontend/src/components/settings/settingsNav.ts`: the single
  source of truth — groups (Account, Appearance, Content, Access, System, About)
  → leaves `{ id, label, icon, adminOnly }`, with Integrations carrying an
  optional `panels` list (docker, pihole, photos, spotify, sonos, calendars,
  todo, accounts). Clean leaf ids per FR-005. Export helpers to resolve a leaf
  id, derive its group, and list leaves visible to a given role.
- [ ] T002 [P] Add a URL helper (co-located in `settingsNav.ts` or a sibling)
  that reads/writes `?tab=<leaf>&panel=<sub>`: unknown/empty/retired `tab` →
  default leaf; `panel` is opaque and leaf-interpreted; unknown `panel` → leaf's
  first sub-panel. No group in the URL.

---

## Phase 2: User Story 1 — one navigation model (P1)

- [ ] T003 [US1] Create `frontend/src/components/settings/SettingsNav.tsx`:
  desktop grouped, non-collapsible rail (group label + leaf buttons) and mobile
  slide-in drawer, driven by `settingsNav`. ≥44px targets, accessible names,
  semantic `nav`/landmarks, visible focus, light/dark parity, no horizontal
  overflow 360px→desktop.
- [ ] T004 [US1] Refactor `frontend/src/pages/SettingsPage.tsx` to render
  `SettingsNav` + a leaf content router from `settingsNav`, replacing
  `TabsList` and the single-level `MobileSectionSelect`. Preserve mount/visited
  behavior and admin gating of leaves.
- [ ] T005 [US1] Promote Appearance panels to leaves: export `PanelContent`
  (branding, header-footer, clock-strip, screensaver) from `AppearanceTab.tsx`,
  render each as its own leaf, and remove AppearanceTab's internal sidebar +
  `MobileSectionSelect`.
- [ ] T006 [US1] Promote System sections to leaves: render `TimezoneSelector`,
  `ScheduledJobsTab`, `BackupRestoreSection` as the `timezone`,
  `scheduled-jobs`, `backup` leaves; retire the `SystemTab.tsx` wrapper.
- [ ] T007 [US1] Remove `MobileSectionSelect.tsx` once no caller remains (or
  keep only if still referenced), confirming no dead imports.

---

## Phase 3: User Story 2 — deep links & refresh persistence (P1)

- [ ] T008 [US2] Make Integrations' active service URL-driven: lift
  `activeService` in `IntegrationsTab.tsx` to `?panel=` via the T002 helper so
  reload/share restores the exact service; keep the internal service list as the
  in-leaf sub-nav. This is the generic `?panel=` seam reserved for #20.
- [ ] T009 [US2] Ensure every leaf (and Integrations sub-panel) round-trips
  through the URL on reload and shared links; selecting nav updates
  `?tab=`/`?panel=` with `replace`.
- [ ] T010 [US2] Admin gating on deep links: a `?tab=` naming a leaf the current
  user may not access redirects to a permitted default without rendering
  restricted content.

---

## Phase 4: User Story 3 — grouping & in-app links (P2)

- [ ] T011 [US3] Verify/sweep in-app deep links to clean leaf ids:
  `app/router.tsx`, `ShellLayout.tsx`, `UserMenu.tsx`, `EmptyDashboard.tsx`,
  `widgets/DockerConnectionPicker.tsx`, `SonosWidget.tsx`, `SpotifyWidget.tsx`,
  `components/settings/WidgetsTab.tsx`. Update any pointing at a retired id.

---

## Phase 5: Tests & validation

- [ ] T012 [P] Unit tests: leaf/group resolver + URL helper (default fallback,
  unknown panel, opaque panel), and admin-visible leaf filtering (positive +
  negative).
- [ ] T013 [P] Unit tests: `SettingsPage`/`SettingsNav` render the grouped nav,
  switch leaves, and non-admin cannot reach or deep-link admin leaves.
- [ ] T014 Update `EmptyDashboard.test.tsx` and any settings nav snapshot/tests
  affected by the new structure.
- [ ] T015 E2E (`frontend/tests/e2e`): desktop rail + mobile drawer navigation,
  and deep-link reload restores the exact leaf/sub-panel.
- [ ] T016 Run `pnpm --filter frontend test:unit`, `pnpm typecheck`, and the
  `lint-gate` (`pnpm lint`, zero warnings, Node 24). Record phase logs under
  `specs/066-settings-unified-nav/logs/`.

---

## Phase 6: Release hygiene (no push/PR in this session)

- [ ] T017 Bump Main Version via `pnpm version:bump-main` (+ blue README badge).
- [ ] T018 Run the mandatory pre-PR gates (code-review-standard, design-taste +
  emil-design-eng for UI, pre-pr-upgrade-gate) before any future PR. Deferred:
  no push or PR this session.

---

## Dependencies

- T001 blocks T002–T011. T002 blocks T008–T010.
- Phase 2 (T003–T007) blocks Phase 3 (T008–T010).
- Implementation (Phases 2–4) blocks tests (Phase 5).
- T016 blocks T017–T018.
