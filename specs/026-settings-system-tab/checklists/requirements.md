# Requirements Checklist: Settings System Tab + Cron Scheduler

## Functional Requirements

- [ ] FR1: System tab exists and is admin-only
- [ ] FR2: System tab contains Timezone, Scheduled Jobs, Backup & Restore sections
- [ ] FR3: General tab only shows Theme + Dashboard Preferences
- [ ] FR4: Legacy `?tab=scheduled-jobs` URL redirects to `?tab=system`
- [ ] FR5: Cron builder has presets: Every X Min, Hourly, Daily, Weekly, Monthly, Advanced
- [ ] FR6: Each preset generates correct cron expression
- [ ] FR7: Human-readable preview shown for selected schedule
- [ ] FR8: Auto-detect existing cron expressions and select matching preset
- [ ] FR9: Advanced mode shows raw cron input (editable)

## Success Criteria

- [ ] SC1: No backend changes required (DB schema unchanged)
- [ ] SC2: Typecheck passes (`pnpm typecheck`)
- [ ] SC3: Lint passes (`pnpm lint`)
- [ ] SC4: Build succeeds (`pnpm build` in frontend)
- [ ] SC5: Tab count stays at 7 (net zero change — Jobs removed, System added)
- [ ] SC6: Mobile responsive — builder works on 375px viewport
