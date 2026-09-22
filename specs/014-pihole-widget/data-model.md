# Data Model: Pi-hole DNS Controls Widget

## New Table: `pihole_instances`

Stores Pi-hole connection configuration per widget instance. The API token is stored encrypted (AES-256-GCM via `token-encryption.ts`), never in plain text.

### Schema

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK, UUID | Unique instance identifier |
| `widgetInstanceId` | TEXT | FK → `app_widget_instances.id`, UNIQUE, NOT NULL | Links to the parent widget instance |
| `baseUrl` | TEXT | NOT NULL | Pi-hole base URL (e.g., `http://192.168.1.50`) |
| `apiTokenEncrypted` | TEXT | NOT NULL | Encrypted API token (AES-256-GCM) |
| `pollIntervalSec` | INTEGER | NOT NULL, DEFAULT 30 | Stats refresh interval in seconds (10–300) |
| `createdAt` | TEXT | NOT NULL, DEFAULT now | ISO timestamp |
| `updatedAt` | TEXT | NOT NULL, DEFAULT now | ISO timestamp |

### Drizzle ORM Definition

```typescript
export const piholeInstances = sqliteTable('pihole_instances', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  widgetInstanceId: text('widget_instance_id')
    .notNull()
    .unique()
    .references(() => appWidgetInstances.id, { onDelete: 'cascade' }),
  baseUrl: text('base_url').notNull(),
  apiTokenEncrypted: text('api_token_encrypted').notNull(),
  pollIntervalSec: integer('poll_interval_sec').notNull().default(30),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});
```

### Relationships

- **1:1 with `app_widget_instances`**: Each Pi-hole widget instance has exactly one `pihole_instances` row. Cascade delete ensures cleanup when the widget is removed.
- The widget's `configJson` column stores display preferences only (e.g., which stats to show), NOT connection secrets.

### Migration

```sql
CREATE TABLE pihole_instances (
  id TEXT PRIMARY KEY,
  widget_instance_id TEXT NOT NULL UNIQUE
    REFERENCES app_widget_instances(id) ON DELETE CASCADE,
  base_url TEXT NOT NULL,
  api_token_encrypted TEXT NOT NULL,
  poll_interval_sec INTEGER NOT NULL DEFAULT 30,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

## Widget `configJson` Schema

Display-only preferences stored in the widget's existing `configJson` column (safe to send to frontend):

```typescript
const PiholeDisplayConfigSchema = z.object({
  showSystemHealth: z.boolean().default(true),
  showBlocklistCount: z.boolean().default(true),
});
```

## Security Notes

- `apiTokenEncrypted` is encrypted using `encryptToken()` from `backend/src/lib/token-encryption.ts`
- The API token is decrypted only in the backend service when making Pi-hole API calls
- The token is NEVER included in any API response to the frontend
- The `configJson` field only contains display preferences, never secrets
