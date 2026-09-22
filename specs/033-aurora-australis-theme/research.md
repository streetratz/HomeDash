# Research — Aurora Australis CSS Theme

## Table of Contents

- [R1: Aurora Colour Palette & WCAG AA Compliance](#r1-aurora-colour-palette--wcag-aa-compliance)
- [R2: Multi-Theme Architecture with CSS Custom Properties](#r2-multi-theme-architecture-with-css-custom-properties)
- [R3: Database Schema Migration for Named Themes](#r3-database-schema-migration-for-named-themes)
- [R4: Gradient Effects & Reduced Motion](#r4-gradient-effects--reduced-motion)
- [R5: Theme Picker UI Pattern](#r5-theme-picker-ui-pattern)

---

## R1: Aurora Colour Palette & WCAG AA Compliance

**Task**: Determine specific colour values for the Aurora Australis palette that meet WCAG AA contrast requirements against deep navy backgrounds.

### Decision

Use HSL-defined colour tokens that pass WCAG AA validation:

| Token Role | HSL Value | Hex Approx. | Contrast vs Navy BG |
|------------|-----------|-------------|---------------------|
| Background (primary) | 228 60% 7% | #0a0e1a | — (base) |
| Background (card/elevated) | 225 50% 10% | #0d1525 | — (surface) |
| Foreground (primary text) | 210 20% 92% | #e8ecf0 | ~14:1 ✅ |
| Foreground (muted text) | 210 15% 65% | #97a3b0 | ~5.2:1 ✅ |
| Accent green | 155 70% 45% | #22c472 | ~5.5:1 ✅ (large text/UI) |
| Accent teal | 175 65% 42% | #25b0a0 | ~4.8:1 ✅ |
| Accent purple | 275 60% 65% | #9b6bd4 | ~4.6:1 ✅ |
| Border/subtle | 220 30% 20% | #24304a | decorative only |
| Ring/focus | 165 60% 50% | #33cc99 | ~5.8:1 ✅ |
| Destructive | 0 70% 55% | #d94444 | ~4.5:1 ✅ |

### Rationale

- Deep navy backgrounds (#0a0e1a range) match the spec requirement (FR-005)
- Light foreground text at 92% lightness provides excellent contrast (~14:1)
- Accent colours chosen at lightness levels that pass 3:1 minimum for UI components
- Muted text at 65% lightness passes 4.5:1 for normal text
- All values use HSL format to match existing shadcn/ui token convention

### Alternatives Considered

- **Pure CSS named colours**: Rejected — insufficient control over exact contrast ratios
- **Oklch colour space**: Considered for perceptual uniformity but rejected for browser compatibility with existing HSL token system
- **Higher-chroma accents**: Some initial candidates (e.g., saturated #00ff88 green) had accessibility issues when used as text or small UI elements

---

## R2: Multi-Theme Architecture with CSS Custom Properties

**Task**: Determine how to add a third theme (beyond light/dark) to the existing Tailwind + shadcn/ui CSS variable system.

### Decision

Add a `.aurora` class that coexists with `.dark`:
- Apply both `.dark.aurora` on `<html>` to activate the theme
- The `.aurora` selector overrides `.dark` tokens with aurora-specific values
- This leverages CSS specificity: `.dark.aurora` > `.dark`

```css
.dark.aurora {
  --background: 228 60% 7%;
  --foreground: 210 20% 92%;
  /* ... all tokens */
}
```

### Rationale

- Minimal change to Tailwind config — `darkMode: 'class'` continues to work
- Aurora inherits from dark mode as a base (spec states it's a dark-mode variant)
- Specificity ensures aurora overrides dark defaults without `!important`
- Switching away just removes `.aurora` class; `.dark` remains for standard dark mode
- Switching to light removes both `.dark` and `.aurora`

### Alternatives Considered

- **Data attribute** (`data-theme="aurora"`): Would work but requires modifying Tailwind's `darkMode` config to `['class', '[data-theme="dark"]']` — more invasive
- **Separate CSS file**: Rejected — would increase bundle complexity and loading states
- **CSS `@layer` approach**: Overcomplicated for a single additional theme

---

## R3: Database Schema Migration for Named Themes

**Task**: Determine how to extend the `user_preferences.themeMode` column from `'light' | 'dark'` to support `'aurora'`.

### Decision

Use a Drizzle migration to alter the column's effective enum:
- SQLite `text` columns don't enforce enums at DB level — Drizzle's `{ enum: [...] }` is a TypeScript-only constraint
- Update the schema definition to `{ enum: ['light', 'dark', 'aurora'] }`
- Add Zod validation on the API layer to accept the new value
- No physical migration SQL needed (SQLite text columns accept any string)

### Rationale

- SQLite doesn't have a native ENUM type — the existing `text('theme_mode', { enum: ['light', 'dark'] })` is purely a TypeScript/Drizzle type guard
- Adding `'aurora'` to the enum array is a TypeScript-only change
- Existing rows with `'dark'` or `'light'` remain valid
- Backward compatible: old clients sending `'dark'` still work
- Zod schema on the API validates input; unknown values rejected with 400

### Alternatives Considered

- **New column** (`namedTheme`): Rejected — overengineered for adding one variant; creates sync issues between two fields
- **JSON preferences blob**: Rejected — existing schema is simple and sufficient
- **Numeric theme ID with lookup table**: Rejected — unnecessary complexity for 3 values

---

## R4: Gradient Effects & Reduced Motion

**Task**: Determine how to implement subtle gradient accent effects while respecting `prefers-reduced-motion`.

### Decision

Use CSS custom properties for gradient definitions, applied as `background-image` on decorative borders and accent areas:

```css
.dark.aurora {
  --aurora-gradient: linear-gradient(135deg, 
    hsl(155 70% 45% / 0.3), 
    hsl(175 65% 42% / 0.3), 
    hsl(275 60% 65% / 0.3));
}

@media (prefers-reduced-motion: reduce) {
  .dark.aurora {
    --aurora-gradient: none;
    /* Fall back to solid accent border colour */
  }
}
```

### Rationale

- Spec (FR-008) requires respecting `prefers-reduced-motion`
- Gradients are static by default (no CSS animations for gradients)
- Optional subtle shimmer animation can be added for ambient effect, disabled under `prefers-reduced-motion`
- Using `/ 0.3` opacity keeps gradients subtle and non-distracting
- Text never placed directly on gradient areas without a solid background fallback underneath

### Alternatives Considered

- **SVG gradient overlays**: More control but heavier DOM; rejected for simplicity
- **Canvas-based aurora animation**: Rejected — violates performance constraints on low-power NAS devices
- **`backdrop-filter` effects**: Rejected — inconsistent browser support and performance implications

---

## R5: Theme Picker UI Pattern

**Task**: Determine the best UI pattern to replace the binary light/dark toggle with a multi-theme selector.

### Decision

Replace the `ThemeToggle` icon button with a `ThemePicker` component:
- **Header**: Compact dropdown (popover) triggered by a palette/paintbrush icon
- **Settings page**: Full radio-button group with theme previews
- Options: Light, Dark, Aurora Australis

```
[☀️ Light] [🌙 Dark] [🌌 Aurora]
```

### Rationale

- Three options don't warrant a full page — a segmented control or small popover is sufficient
- Icon button in header maintains compact layout (mobile-first principle)
- Settings page can show fuller preview cards for each theme
- Follows existing UI patterns in HomeDash (icon buttons → popover menus)
- Using shadcn/ui `DropdownMenu` or `Popover` components for consistency

### Alternatives Considered

- **Keep toggle, add settings-only picker**: Rejected — header toggle would need to cycle through 3 states (confusing UX)
- **Full modal theme selector**: Rejected — overkill for 3 options
- **System preference auto-detect only**: Rejected — spec requires explicit user selection
