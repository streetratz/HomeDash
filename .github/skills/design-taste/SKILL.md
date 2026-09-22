---
name: design-taste
version: 1.0.0
description: Use when building or reviewing any UI and you want it to look intentional and premium instead of generic "AI slop." A curated taste checklist and reference vocabulary for visual hierarchy, type, spacing, color, and restraint. Pairs with the impeccable skill (visual craft) and emil-design-eng (motion). Use before shipping a frontend, when a design "feels off" but you can't say why, or when output looks like every other AI-generated page.
---

# Design Taste

A compact, opinionated checklist for giving interfaces *taste*. It does not generate
code — it gives you (and the agent) the vocabulary and the eye to direct better design
decisions and to catch the tells of generic, machine-made UI.

## How to use this skill

1. **Before building:** read "The anti-slop tells" so you don't generate the defaults.
2. **While building:** apply the checklist section relevant to what you're doing.
3. **Before shipping:** run the full "Ship review" pass.
4. **Reach for companions** when you need depth:
   - Visual craft / redesign / audit → the **impeccable** skill.
   - Motion, transitions, micro-interactions → **emil-design-eng** / **review-animations**.

This skill is the *taste filter*; those are the *deep toolkits*.

## Core principle: taste is restraint + intention

Generic design is what you get from defaults. Taste is what you get from *choosing*.
Every element should be there on purpose, and look like it was. When unsure, remove,
align, or quiet down — almost never add, center-everything, or brighten.

## The anti-slop tells (what screams "AI made this")

Avoid these unless you have a deliberate reason:

- **Purple/indigo gradient hero** on a dark background. The default "AI startup" look.
- **Everything centered**, every section the same full-width stack. No rhythm, no anchor.
- **Three identical feature cards** with a generic icon, a bold title, two lines of lorem.
- **Emoji as iconography** (🚀 ✨ 🔥) standing in for real visual design.
- **One weight of everything** — same size gaps, same font weight, no clear hierarchy.
- **Pure black (#000) on pure white (#fff)** with harsh, full-opacity borders.
- **Glassmorphism + neon glow** sprinkled everywhere to fake "premium."
- **Buttons with no pressed/hover feel**, instant state changes, zero motion intent.
- **Default system spacing** (random 16/24px everywhere) with no consistent scale.

If your output has three or more of these, it is slop. Redesign with intention.

## Checklist

### Hierarchy
- One clear focal point per screen. The eye should know where to land first.
- Establish 3–4 distinct levels (display / heading / body / caption) and stick to them.
- Create hierarchy with **size, weight, and spacing** before reaching for color.
- De-emphasize secondary actions (ghost/quiet), not just emphasize primary ones.

### Type
- Two families max (often one). Pick intentional fonts, not the framework default.
- Use a modular type scale (e.g. 1.2–1.333 ratio), not arbitrary px values.
- Body 15–18px, generous line-height (1.5–1.7), measure ~60–75 chars per line.
- Tighten tracking on large display text; never letter-space lowercase body.

### Spacing & layout
- Commit to a spacing scale (4 / 8 base). Every gap is a value on the scale.
- White space is a feature — let things breathe; crowding reads as cheap.
- Break the single centered column: use asymmetry, an anchor image, or an offset grid.
- Align to a grid. Optical alignment beats mathematical when they disagree.

### Color
- Start neutral. Earn color. A restrained palette + one confident accent beats a rainbow.
- Prefer near-blacks (#0a0a0a) and off-whites (#fafafa); avoid pure #000/#fff.
- Borders and dividers: low-opacity (semi-transparent shadow/line), not solid 1px black.
- Check contrast (WCAG AA) — but don't let "accessible" become "muddy."

### Components & states
- Buttons feel physical: hover, active/pressed, focus-visible, disabled — all designed.
- Design the empty, loading, and error states. They are not afterthoughts.
- Consistent corner radii and elevation language across the whole UI.
- Real content, real lengths. Test with long names, long numbers, missing data.

### Motion (defer to emil-design-eng for depth)
- Enter = `ease-out`, exit = `ease-in`. Match easing to direction.
- Animate `transform`/`opacity` only; keep durations short (150–250ms for UI).
- Never animate from `scale(0)`; respect `prefers-reduced-motion`.

## Ship review (run before calling it done)

Ask, honestly:
1. **Focal point** — is it obvious where to look first?
2. **Hierarchy** — squint: do importance levels still read?
3. **Alignment** — does everything sit on the grid; any 1px drift?
4. **Spacing** — consistent scale; enough air?
5. **Restraint** — can anything be removed, quieted, or merged?
6. **Slop tells** — zero from the list above?
7. **States** — hover/focus/empty/loading/error all handled?
8. **The gut check** — does it look *chosen*, or *defaulted*?

If any answer is weak, fix it before shipping. Taste is the sum of these small calls.
