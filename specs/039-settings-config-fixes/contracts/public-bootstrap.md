# API Contract Changes: Public Bootstrap

**Feature**: 039-settings-config-fixes  
**Endpoint**: `GET /api/public/bootstrap`  
**Auth**: None (public)

## Current Response Shape (shell object)

```jsonc
{
  "firstRunRequired": false,
  "shell": {
    "titleText": "HomeDash",
    "headerHeightPx": 56,
    "logoUrl": "/assets/data/logos/logo.png",
    "clockStripEnabled": true,
    "clockStripAlignment": "center",
    "clocks": [
      { "timezone": "Australia/Sydney", "label": "Home", "isHome": true, "config": { "layout": "column" } },
      { "timezone": "America/New_York", "label": "NYC", "isHome": false }
    ],
    "footerText": "My Dashboard",
    "repoUrl": "https://github.com/user/repo",
    "screensaverEnabled": false,
    // ... screensaver fields ...
    "headerStyle": "none",
    "headerStyleTarget": "background",   // ← TO BE REMOVED
    "headerGlassEffect": false,
    "headerTitleStyle": "none"
  },
  "deviceContext": "web",
  "dashboard": { /* ... */ }
}
```

## Updated Response Shape (shell object)

```jsonc
{
  "firstRunRequired": false,
  "shell": {
    "titleText": "HomeDash",
    "titleFont": "system",                    // ← ADDED
    "titleFontSizePx": 20,                    // ← ADDED
    "headerHeightPx": 56,
    "logoUrl": "/assets/data/logos/logo.png",
    "clockStripEnabled": true,
    "clockStripAlignment": "center",
    "clockDisplayConfig": {                   // ← ADDED (top-level, not nested in home clock)
      "layout": "column",
      "showOffset": false,
      "homeIconSide": "left",
      "dayNightSide": "right"
    },
    "clocks": [
      { "timezone": "Australia/Sydney", "label": "Home", "isHome": true, "config": { "layout": "column" } },
      { "timezone": "America/New_York", "label": "NYC", "isHome": false }
    ],
    "footerText": "My Dashboard",
    "repoUrl": "https://github.com/user/repo",
    "screensaverEnabled": false,
    // ... screensaver fields ...
    "headerStyle": "none",
    // "headerStyleTarget" REMOVED
    "headerGlassEffect": false,
    "headerTitleStyle": "none"
  },
  "deviceContext": "web",
  "dashboard": { /* ... */ }
}
```

## Changes Summary

| Change | Field | Type | Default | Breaking? |
|--------|-------|------|---------|:---------:|
| ADD | `shell.titleFont` | string | `"system"` | No (additive) |
| ADD | `shell.titleFontSizePx` | number | `20` | No (additive) |
| ADD | `shell.clockDisplayConfig` | ClockDisplayConfig \| null | `null` | No (additive) |
| REMOVE | `shell.headerStyleTarget` | string | — | No (unused by frontend) |

## Frontend Type Changes

### `ShellSettings` (in `frontend/src/state/bootstrap.ts`)

```diff
 export interface ShellSettings {
   titleText: string;
+  titleFont: string;
+  titleFontSizePx: number;
   headerHeightPx: number;
   logoUrl: string | null;
   clockStripEnabled: boolean;
   clockStripAlignment: 'left' | 'center' | 'right';
+  clockDisplayConfig: ClockDisplayConfig | null;
   clocks: Clock[];
   footerText: string | null;
   repoUrl: string | null;
   // ... screensaver fields ...
   headerStyle: 'none' | 'gradient-shift' | 'aurora' | 'aurora-australis' | 'glass-glow' | 'gradient-underline';
-  headerStyleTarget: 'background' | 'border' | 'title';
   headerGlassEffect: boolean;
   headerTitleStyle: 'none' | 'gradient-shift' | 'aurora' | 'aurora-australis' | 'glass-glow' | 'gradient-underline';
 }
```
