# Calendar UI Contract — Collection Branch

**Scope**: Existing Calendar agenda/fullscreen and existing admin Calendars
settings panel only. Planned behavior, no UI code produced.

## Admin Management

Add “Bin collections” beside existing calendar feeds in `CalendarsPanel` of
`IntegrationsTab.tsx`; no top-level settings tab or new dashboard widget.
Only administrators mount/load the manager. Non-admin generic manage grants
do not reveal edit controls or enable config fetch.

1. Empty setup offers **Household preset** and **Custom streams** equally.
2. Preset requires confirmed timezone, weekday and known normal Recycling date,
   explains it is a customisable starting point, not official council advice,
   and shows at least four weeks. Red General waste weekly, yellow Recycling
   A at supplied anchor, green Garden waste B one week later.
3. Custom stream editor has visible name, colour picker + typed hex value,
   enabled switch and schedule-mode choice. Regular: weekday checkboxes,
   integer 1–52-week interval and normal-date anchor. Explicit: unique date
   list, remaining-future-date state and no recurrence extrapolation.
4. Exceptions identify original and actual dates: Skip / Move / Add, with
   concise impact preview. Changing a rule shows invalidated origins; mode
   switches/removal require explicit destructive confirmation.
5. Preview then Save/Cancel; changing draft invalidates preview. Field errors,
   request errors and stale revision retain entered values. Refresh/rebase of
   a stale draft is deliberate, never blind overwrite.
6. Optional provider label is private and never requires an address/lookup.
   Confirmed household timezone changes preserve entered dates.

Use existing shadcn/Radix primitives, Tailwind theme tokens, typography and
spacing. Manager rows stack at 360px; weekday/name/date/action labels remain
readable. Actions have ≥44px targets, visible focus, keyboard labels and
semantic field errors linked through `aria-describedby`. Do not substitute a
colour swatch for a name. Cancel restores saved state without writes.
Loading/error/exhausted/disabled/unconfigured are distinct private states.

## Calendar Configuration

Add saved optional arrays:

```text
collectionStreamIds: UUID[] = []
publicCollectionStreamIds: UUID[] = []
```

Both ≤32 unique IDs; public selection must be a subset of normal selection.
Only admin widget mutations save these using the existing schema/CSRF path.
Select independently from provider `sourceIds`; selecting a stream does not
enable it globally or publish it automatically.
Offer a deliberately labelled public read-only subset, explaining designated
web/mobile default-dashboard dependency. Remove public selection automatically
when its normal selection is unchecked, with clear local feedback.

No collection rule/private label belongs in widget config; stream identity
references the shared household. Stream rename/recolour preserves selection.
Removed stream IDs are pruned without altering other provider settings.
Old widget JSON lacking both fields behaves exactly as before.
Collections-only Calendar is valid with `sourceIds:[]`.

## Agenda Composition

Retain existing provider `CalendarEvent` rendering, source colours/private filtering,
timed-event formatting and maxEvents behavior. Add typed collection groups:

```text
date: DateKey
streams: [{key, name, color}]
timezone / householdToday / serverNow: display context
```

Group collection rows by **actual household date**, sort chronologically, then
saved stream order. Merge date sections alongside provider content without
changing that content's time basis. Where provider/browser Today differs, its
header remains provider-local; the collection subgroup has its own explicit
household-relative label and timezone rather than one misleading shared Today.

For the next collection at/after household today **within the selected range**:
use one prominent date heading, “Today”/“Tomorrow” when applicable **plus actual
weekday/date**, and list every due stream. Later groups use quieter emphasis.
No inferred next date outside range or unconfigured set-out time.
A coloured bin outline/icon plus **visible readable name** appears for every
stream in compact and expanded modes. Icon is decorative/aria-hidden when text
is present. Same-colour streams remain distinguishable. Long names wrap rather
than disappear in truncated chips; rows stack at narrow widths.

Collections remain all-day obligations all household day long. They do not
expire when a visitor's midnight passes or a guessed pickup hour elapses.
The collection range and date labels update on foreground household midnight
within 60 seconds, including a widget kept open across midnight. Use separate
Intl date-only helpers; do not reuse legacy browser-local `getDayInfo` or
`toLocalDateKey` for collections.

Collection groups are not sliced by provider maxEvents/200-row limit; use the
existing scrollable agenda space and keep the entire next-date group.
If one source branch fails, preserve successful other branch content and show
the failed branch's retry state; do not label failure as “No collections.”
No management controls in normal/public collection rows.

## Fullscreen Composition

Pass originating widget ID and its authorised collection scope into existing
fullscreen. Navigate month civil keys; fetch a bounded displayed range
independently of old provider ISO queries. No fallback to every household stream.
For collection-enabled widgets, pass the saved provider `sourceIds` explicitly:
an empty array means no provider events, even when provider/birthday sources exist.
Mixed mode uses only its selected provider sources. Bypass the legacy all-sources
fallback for this mode, while preserving legacy behavior for widgets with no
collection selection. Test both modes with unrelated existing sources present.
For collection-enabled fullscreen, initialise month from returned householdToday;
keep provider/browser Today as a separately labelled control/marker. Old widgets
with no collections keep existing month/today initialization.

Cells show coloured bin icon/name when room permits and a count with an
accessible day-detail path when crowded; day detail always shows every due name
and actual date. Provider rows retain their prior behavior. At 360px the day
detail stacks below grid and complete names remain available without horizontal
page scroll. Household Today marker/control is clearly labelled when selected;
do not silently overwrite provider/browser Today semantics.
Today/month selection is driven by current date context, not a once-only memo.
Reuse overlay focus/escape patterns, restoring focus to expand trigger and
maintaining modal labelling/keyboard navigation for touched paths.

## Query, Clock, Cache and States

Queries use apiClient and TanStack Query with separate auth/public + widget +
window/range keys. Agenda sends `daysAhead`, with range/today derived by server,
so first load needs no private timezone lookup or browser-date guess. Fullscreen
sends explicit from/to date keys. No privileged response cache reuse after logout
or account switch.
Visible collection queries poll at most every 30s; use existing visibility
helpers and immediate refetch on focus/visibility/resume. Fullscreen visibility
must keep its collection query active even if originating widget is out of view.
Use serverNow plus elapsed local monotonic time for household labels and range
rollover; refetch refreshes that context. No raw intervals per widget.

| Context/state | Visible behavior |
| --- | --- |
| Initial load | labelled loading/skeleton, no misleading empty claim |
| Admin unconfigured | preset/custom call to action |
| Signed-in display unconfigured/not selected | clear setup/selection instruction; admin link only for admin |
| Signed-in selected disabled | “Selected collection streams are disabled” |
| Signed-in no dates in range | range-specific message, no extrapolation |
| Signed-in exhausted | no future explicit dates; admin manager has edit action |
| Public empty | generic “No collections in this range”; no private reason/catalogue |
| Load/save failure | visible error/retry; draft preserved; marked stale last-good data only on transient load failures |
| Auth/visibility denied or revoked | clear collection cache/content on next fetch; never render stale private/public rows |

No new decorative motion: dense calendar lists should be immediate. Existing
occasional modal feedback may be retained with reduced-motion support; no
animation blocks keyboard action. Reuse theme/token surfaces, no glow/gradient
redesign or new animation library.

## Acceptance Test Obligations

Map US1–US4 and FR-014–FR-023 to unit/Playwright tests: preset/custom setup,
four-week preview, invalid weekday anchor, rule/orphan/mode confirmation,
conflict/stale retry, normal/public selection, zero selected provider IDs despite
existing provider/birthday sources, mixed-mode exact source selection, grouping,
same-colour and long names, every next-date stream, fullscreen month navigation,
different visitor timezone, household midnight rollover, disabled/exhausted/error
states, admin vs non-admin direct attempts and revocation.
Check 360px/desktop and light/dark keyboard/screen-reader/touch interactions.
Representative user tasks test SC-001/SC-005 separately; screenshots/unit tests
alone do not establish 9-of-10 usability thresholds.
