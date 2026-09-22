# Data Model — Aurora Australis CSS Theme

## Table of Contents

- [Entity Changes](#entity-changes)
- [CSS Token Schema](#css-token-schema)
- [State Transitions](#state-transitions)

---

## Entity Changes

### UserPreferences (modified)

| Field | Type | Change | Notes |
|-------|------|--------|-------|
| `themeMode` | `text` enum | Extended | `'light' \| 'dark'` → `'light' \| 'dark' \| 'aurora'` |

**Migration**: TypeScript-only change. SQLite `text` column accepts any string; the Drizzle enum annotation and Zod API validation are the enforcement layer.

#### Schema Definition (updated)

```typescript
// backend/src/db/schema/index.ts
export const userPreferences = sqliteTable('user_preferences', {
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  themeMode: text('theme_mode', { enum: ['light', 'dark', 'aurora'] }).notNull().default('dark'),
  webDashboardId: text('web_dashboard_id').references(() => dashboards.id, { onDelete: 'set null' }),
  mobileDashboardId: text('mobile_dashboard_id').references(() => dashboards.id, { onDelete: 'set null' }),
  updatedAt: text('updated_at').notNull(),
});
```

#### Validation Schema (updated)

```typescript
// Zod schema for API input validation
const updatePreferencesSchema = z.object({
  themeMode: z.enum(['light', 'dark', 'aurora']).optional(),
  // ... existing fields
});
```

### Theme (new conceptual entity — CSS-only, no DB table)

| Attribute | Type | Description |
|-----------|------|-------------|
| `identifier` | string | Machine name: `'light'`, `'dark'`, `'aurora'` |
| `displayName` | string | Human label: "Light", "Dark", "Aurora Australis" |
| `baseMode` | `'light' \| 'dark'` | Underlying Tailwind dark-mode basis |
| `cssClass` | string | Class applied to `<html>`: `''`, `'dark'`, `'dark aurora'` |
| `tokens` | Record<string, string> | CSS custom property overrides (HSL values) |

This entity is **not stored in the database** — it's a frontend constant defining available themes. The DB only stores the user's selected `themeMode` identifier.

---

## CSS Token Schema

### Aurora Australis Token Definitions

All tokens follow the existing shadcn/ui HSL convention (`H S% L%` without `hsl()` wrapper).

| Token | Aurora Value (HSL) | Purpose |
|-------|-------------------|---------|
| `--background` | `228 60% 7%` | Page background — deep navy |
| `--foreground` | `210 20% 92%` | Primary text |
| `--card` | `225 50% 10%` | Card/elevated surface |
| `--card-foreground` | `210 20% 92%` | Card text |
| `--popover` | `225 50% 10%` | Popover/modal background |
| `--popover-foreground` | `210 20% 92%` | Popover text |
| `--primary` | `155 70% 45%` | Primary accent — aurora green |
| `--primary-foreground` | `228 60% 7%` | Text on primary |
| `--secondary` | `220 40% 15%` | Secondary surfaces |
| `--secondary-foreground` | `210 20% 88%` | Secondary text |
| `--muted` | `220 35% 14%` | Muted backgrounds |
| `--muted-foreground` | `210 15% 65%` | Muted/placeholder text |
| `--accent` | `175 65% 42%` | Accent — aurora teal |
| `--accent-foreground` | `210 20% 92%` | Text on accent surfaces |
| `--destructive` | `0 70% 55%` | Error/danger |
| `--destructive-foreground` | `210 20% 92%` | Text on destructive |
| `--border` | `220 30% 20%` | Borders |
| `--input` | `220 30% 18%` | Input borders |
| `--ring` | `165 60% 50%` | Focus ring — aurora teal-green |
| `--radius` | `0.5rem` | Border radius (unchanged) |
| `--status-info` | `195 80% 60%` | Info status — cyan-shifted |
| `--status-success` | `155 70% 50%` | Success — aurora green |
| `--status-warning` | `39 72% 49%` | Warning (unchanged) |
| `--status-danger` | `0 80% 60%` | Danger |
| `--status-purple` | `275 60% 65%` | Purple status — aurora purple |
| `--status-cyan` | `175 65% 55%` | Cyan status — aurora teal |
| `--chart-1` | `155 70% 45%` | Chart colour 1 — green |
| `--chart-2` | `175 65% 42%` | Chart colour 2 — teal |
| `--chart-3` | `275 60% 65%` | Chart colour 3 — purple |
| `--chart-4` | `195 80% 55%` | Chart colour 4 — cyan |
| `--chart-5` | `145 50% 60%` | Chart colour 5 — light green |
| `--sidebar-background` | `228 55% 9%` | Sidebar bg — slightly lighter navy |
| `--sidebar-foreground` | `210 20% 90%` | Sidebar text |
| `--sidebar-primary` | `155 70% 45%` | Sidebar primary — green |
| `--sidebar-primary-foreground` | `228 60% 7%` | Text on sidebar primary |
| `--sidebar-accent` | `220 40% 15%` | Sidebar accent surface |
| `--sidebar-accent-foreground` | `210 20% 88%` | Sidebar accent text |
| `--sidebar-border` | `220 30% 18%` | Sidebar border |
| `--sidebar-ring` | `165 60% 50%` | Sidebar focus ring |

### Aurora-Specific Tokens (new)

| Token | Value | Purpose |
|-------|-------|---------|
| `--aurora-gradient` | `linear-gradient(135deg, hsl(155 70% 45% / 0.15), hsl(175 65% 42% / 0.15), hsl(275 60% 65% / 0.15))` | Decorative gradient for borders/accents |
| `--aurora-glow` | `0 0 20px hsl(155 70% 45% / 0.1)` | Subtle glow effect for cards |

---

## State Transitions

### Theme State Machine

```
┌─────────┐     select 'dark'      ┌──────┐
│  Light  │ ──────────────────────▶ │ Dark │
│ (no cls)│ ◀────────────────────── │(.dark)│
└─────────┘     select 'light'     └──────┘
     │                                  │
     │         select 'aurora'          │
     │         ┌──────────────┐         │
     └────────▶│    Aurora     │◀───────┘
               │(.dark.aurora) │
               └──────────────┘
                      │
          select 'light' or 'dark'
                      │
                      ▼
            [removes .aurora class]
```

### Class Application Logic

```typescript
function applyTheme(mode: 'light' | 'dark' | 'aurora'): void {
  const html = document.documentElement;
  html.classList.remove('dark', 'aurora');
  
  if (mode === 'dark') {
    html.classList.add('dark');
  } else if (mode === 'aurora') {
    html.classList.add('dark', 'aurora');
  }
  // 'light' = no classes
}
```

### Persistence Flow

```
User selects theme
    │
    ├─► applyTheme(mode)          [immediate DOM update]
    ├─► storeTheme(mode)          [localStorage for persistence]
    └─► updatePrefs({ themeMode }) [API call for authenticated users]
           │
           └─► PUT /api/user/preferences { themeMode: 'aurora' }
                    │
                    └─► Zod validates enum → Drizzle updates row
```
