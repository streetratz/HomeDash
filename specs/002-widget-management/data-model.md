# Data Model — Widget Management & Widget Types

**Feature**: 002-widget-management
**Date**: 2025-07-17

## Table of Contents

- [Existing Entities (No Changes)](#existing-entities-no-changes)
- [Widget Type Registry (Frontend-Only)](#widget-type-registry-frontend-only)
- [Per-Type Config Schemas](#per-type-config-schemas)
- [Ephemeral Data Shapes](#ephemeral-data-shapes)
- [Entity Relationship Diagram](#entity-relationship-diagram)

---

## Existing Entities (No Changes)

These tables already exist and require **no schema migrations**. All new widget types
store their configuration in the existing `configJson` TEXT column.

### `app_widget_instances`

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (UUID, PK) | Unique widget instance identifier |
| `placeholderId` | TEXT (FK → placeholder_widgets.id, CASCADE) | Parent placeholder |
| `type` | TEXT | Widget type key (e.g., `'clock'`, `'markdown'`, `'iframe'`, `'weather'`, `'system_status'`, `'links_list'`) |
| `orderIndex` | INTEGER | Display order within placeholder (0-based) |
| `configJson` | TEXT (JSON) | Type-specific configuration (see Per-Type Config Schemas below) |
| `createdAt` | TEXT (ISO 8601) | Creation timestamp |
| `updatedAt` | TEXT (ISO 8601) | Last update timestamp |

### `placeholder_widgets`

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (UUID, PK) | Unique placeholder identifier |
| `dashboardId` | TEXT (FK → dashboards.id, CASCADE) | Parent dashboard |
| `stableKey` | TEXT (UUID) | Stable key for layout matching across saves |
| `x`, `y` | INTEGER | Grid position |
| `w`, `h` | INTEGER | Grid dimensions |
| `borderColor` | TEXT | Hex color (e.g., `#3b82f6`) |
| `title` | TEXT (nullable) | Optional title pill text (max 64 chars) |
| `opacity` | REAL | Background opacity (0.0–1.0) |
| `createdAt`, `updatedAt` | TEXT (ISO 8601) | Timestamps |

### `links_list_items`

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (UUID, PK) | Unique link identifier |
| `widgetInstanceId` | TEXT (FK → app_widget_instances.id, CASCADE) | Parent widget |
| `orderIndex` | INTEGER | Display order (0-based) |
| `title` | TEXT (max 15) | Link display text |
| `url` | TEXT | Link target URL |
| `iconKey` | TEXT (nullable) | Icon identifier |
| `iconOverrideKey` | TEXT (nullable) | Override icon identifier |

---

## Widget Type Registry (Frontend-Only)

The registry is a TypeScript `Map<string, WidgetTypeDefinition>` that maps type keys to
their UI metadata and components. This is the single registration point (SC-008).

```typescript
interface WidgetTypeDefinition {
  /** Unique type key stored in app_widget_instances.type */
  type: string;
  /** Human-readable name for the picker */
  displayName: string;
  /** Brief description for the picker */
  description: string;
  /** Lucide icon component for picker and list */
  icon: LucideIcon;
  /** Default config for newly created instances */
  defaultConfig: Record<string, unknown>;
  /** Component that renders the widget in view mode */
  DisplayComponent: React.ComponentType<WidgetDisplayProps>;
  /** Component that renders the config form in edit mode */
  ConfigFormComponent: React.ComponentType<WidgetConfigFormProps>;
}

interface WidgetDisplayProps {
  widget: WidgetView;      // Full widget view (id, type, config, links)
}

interface WidgetConfigFormProps {
  config: unknown;
  onChange: (config: unknown) => void;
}
```

### Registered Types

| Type Key | Display Name | Icon | Has Config Form | Has Links |
|----------|-------------|------|-----------------|-----------|
| `links_list` | Links List | `List` | No (links managed separately) | Yes |
| `clock` | Clock / Date | `Clock` | Yes (timezone, format) | No |
| `markdown` | Markdown / Notes | `FileText` | Yes (content text) | No |
| `iframe` | Iframe Embed | `Globe` | Yes (URL, aspect ratio) | No |
| `weather` | Weather | `CloudSun` | Yes (mode, location/manual data) | No |
| `system_status` | System Status | `Activity` | Yes (services list, poll interval) | No |

---

## Per-Type Config Schemas

All configs are stored as JSON in `app_widget_instances.configJson`. Backend Zod schemas
validate on layout save; frontend TypeScript interfaces mirror them.

### Clock Config (`type: 'clock'`)

```typescript
interface ClockConfig {
  timezone?: string;      // IANA timezone (e.g., "America/New_York")
                          // Default: null → browser local timezone
  format: '12h' | '24h'; // Time format. Default: '12h'
  showDate: boolean;      // Show date below time. Default: true
  showSeconds: boolean;   // Show seconds. Default: true
}
```

**Zod schema**:
```typescript
const ClockConfigSchema = z.object({
  timezone: z.string().min(1).max(64).regex(/^[A-Za-z0-9/_+-]+$/).nullable().optional(),
  format: z.enum(['12h', '24h']).default('12h'),
  showDate: z.boolean().default(true),
  showSeconds: z.boolean().default(true),
}).strict();
```

**Default**: `{ format: '12h', showDate: true, showSeconds: true }`

### Markdown Config (`type: 'markdown'`)

```typescript
interface MarkdownConfig {
  content: string;  // Raw markdown text. Default: ''
}
```

**Zod schema**:
```typescript
const MarkdownConfigSchema = z.object({
  content: z.string().max(50_000).default(''),
}).strict();
```

**Default**: `{ content: '' }`

**Validation notes**: 50 KB limit is generous for notes/documentation but prevents abuse.

### Iframe Config (`type: 'iframe'`)

```typescript
interface IframeConfig {
  url: string;                           // Target URL to embed
  aspectRatio: '16:9' | '4:3' | '1:1' | 'auto'; // Display aspect ratio. Default: 'auto'
}
```

**Zod schema**:
```typescript
const IframeConfigSchema = z.object({
  url: z.string().url().max(2048).default(''),
  aspectRatio: z.enum(['16:9', '4:3', '1:1', 'auto']).default('auto'),
}).strict();
```

**Default**: `{ url: '', aspectRatio: 'auto' }`

**Validation notes**: URL must be a valid `http://` or `https://` URL. Empty string
triggers the "configure URL" empty state.

### Weather Config (`type: 'weather'`)

```typescript
interface WeatherConfig {
  mode: 'api' | 'manual';       // Data source. Default: 'manual'

  // API mode fields
  latitude?: number;             // WGS84 latitude (-90 to 90)
  longitude?: number;            // WGS84 longitude (-180 to 180)
  locationName?: string;         // Display name (e.g., "London, UK")

  // Manual mode fields
  temperature?: number;          // Temperature value
  temperatureUnit: 'C' | 'F';   // Unit. Default: 'C'
  conditions?: string;           // Conditions text (e.g., "Partly Cloudy")
  icon?: string;                 // Emoji or icon key (e.g., "☀️")
}
```

**Zod schema**:
```typescript
const WeatherConfigSchema = z.object({
  mode: z.enum(['api', 'manual']).default('manual'),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  locationName: z.string().max(128).optional(),
  temperature: z.number().optional(),
  temperatureUnit: z.enum(['C', 'F']).default('C'),
  conditions: z.string().max(128).optional(),
  icon: z.string().max(16).optional(),
}).strict();
```

**Default**: `{ mode: 'manual', temperatureUnit: 'C' }`

### System Status Config (`type: 'system_status'`)

```typescript
interface SystemStatusConfig {
  services: ServiceEntry[];
  pollIntervalSeconds: number;  // Default: 60, minimum: 15
}

interface ServiceEntry {
  name: string;                 // Display name (e.g., "Pi-hole")
  url: string;                  // URL to check (e.g., "http://192.168.1.10/admin")
  expectedStatus: number;       // Expected HTTP status code. Default: 200
  timeoutSeconds: number;       // Timeout per check. Default: 10
}
```

**Zod schema**:
```typescript
const ServiceEntrySchema = z.object({
  name: z.string().min(1).max(64),
  url: z.string().url().max(2048),
  expectedStatus: z.number().int().min(100).max(599).default(200),
  timeoutSeconds: z.number().int().min(1).max(30).default(10),
}).strict();

const SystemStatusConfigSchema = z.object({
  services: z.array(ServiceEntrySchema).max(20).default([]),
  pollIntervalSeconds: z.number().int().min(15).max(3600).default(60),
}).strict();
```

**Default**: `{ services: [], pollIntervalSeconds: 60 }`

**Validation notes**: Max 20 services per widget to prevent excessive backend load.

### Links List Config (`type: 'links_list'`) — Existing

```typescript
interface LinksListConfig {
  layout?: 'vertical' | 'horizontal';  // Default: 'vertical'
}
```

No changes required.

---

## Ephemeral Data Shapes

These are not persisted in the database. They exist only in API responses or in-memory.

### Status Check Result

Returned by `POST /api/admin/status-check`:

```typescript
interface StatusCheckResult {
  name: string;
  status: 'up' | 'down' | 'unknown';
  responseTimeMs: number | null;   // null if unknown/timeout
  checkedAt: string;               // ISO 8601 timestamp
  error?: string;                  // Error message if down (e.g., "TIMEOUT", "ECONNREFUSED")
}
```

### Weather API Response (cached in-memory)

Returned by `GET /api/admin/weather/current`:

```typescript
interface WeatherResponse {
  temperature: number;
  temperatureUnit: 'C';           // Always Celsius from API; frontend converts
  weatherCode: number;            // WMO weather code
  humidity: number;               // Relative humidity %
  windSpeed: number;              // Wind speed km/h
  timestamp: string;              // ISO 8601 of the API data time
  fetchedAt: string;              // ISO 8601 when backend fetched
}
```

### Geocoding Result

Returned by `GET /api/admin/weather/geocoding`:

```typescript
interface GeocodingResult {
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  timezone: string;
  population?: number;
}
```

---

## Entity Relationship Diagram

```
dashboards
    │
    │ 1:N (CASCADE)
    ▼
placeholder_widgets
    │
    │ 1:N (CASCADE)
    ▼
app_widget_instances
    │                    ┌──────────────────────────────┐
    │ type: string ────► │ Widget Type Registry          │
    │                    │ (frontend Map, not a table)   │
    │                    │ clock → ClockWidget           │
    │ configJson ──────► │ markdown → MarkdownWidget     │
    │ (type-specific)    │ iframe → IframeWidget         │
    │                    │ weather → WeatherWidget       │
    │                    │ system_status → StatusWidget   │
    │                    │ links_list → LinksListWidget   │
    │                    └──────────────────────────────┘
    │
    │ 1:N (CASCADE, only for links_list type)
    ▼
links_list_items
```

**Key invariant**: The `type` column in `app_widget_instances` determines which config
schema applies to `configJson` and which display/config components are resolved from the
frontend registry. The backend validates `configJson` against the appropriate Zod schema
on save but does not otherwise interpret it.
