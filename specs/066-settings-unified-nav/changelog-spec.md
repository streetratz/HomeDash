# Specification Changelog

## CH-01 — 2026-10-11

- Created the specification for GitHub issue #22 (Settings unified navigation,
  Option A).

## CH-02 — 2026-10-11

- FR-005 / FR-012: specified that the `?panel=` URL value is an opaque,
  leaf-interpreted sub-selector (not Integrations-specific) so the Widgets leaf
  can reuse it as `?tab=widgets&panel=<widgetId>` for issue #20 with no routing
  rework.
