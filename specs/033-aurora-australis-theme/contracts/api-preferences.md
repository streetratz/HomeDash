# API Contract Changes — Aurora Australis Theme

## Modified Endpoint: PUT /api/user/preferences

### Change Summary

The `themeMode` field enum is extended from `'light' | 'dark'` to `'light' | 'dark' | 'aurora'`.

### Request

```http
PUT /api/user/preferences
Content-Type: application/json
Cookie: session=<session_cookie>

{
  "themeMode": "aurora"
}
```

### Request Schema (Zod)

```typescript
const updatePreferencesBody = z.object({
  themeMode: z.enum(['light', 'dark', 'aurora']).optional(),
  webDashboardId: z.string().nullable().optional(),
  mobileDashboardId: z.string().nullable().optional(),
});
```

### Response (200 OK)

```json
{
  "themeMode": "aurora",
  "webDashboardId": "dash-abc123",
  "mobileDashboardId": null
}
```

### Response (400 Bad Request)

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "body/themeMode must be one of: light, dark, aurora"
}
```

### Backward Compatibility

- ✅ Existing clients sending `'light'` or `'dark'` continue to work unchanged
- ✅ GET response may now return `themeMode: 'aurora'` — older clients should treat unknown values as `'dark'` (graceful degradation)
- ✅ No new endpoints required
- ✅ No authentication/authorization changes

---

## Modified Endpoint: GET /api/user/preferences

### Change Summary

Response `themeMode` field may now return `'aurora'` in addition to `'light'` or `'dark'`.

### Response Schema (updated)

```typescript
const preferencesResponse = z.object({
  themeMode: z.enum(['light', 'dark', 'aurora']),
  webDashboardId: z.string().nullable(),
  mobileDashboardId: z.string().nullable(),
});
```

---

## localStorage Contract

### Key: `homedash_theme`

| Value | Meaning |
|-------|---------|
| `'light'` | Light theme |
| `'dark'` | Standard dark theme |
| `'aurora'` | Aurora Australis theme |
| missing/invalid | Defaults to `'dark'` |

### Backward Compatibility

Old clients that only know `'light'` / `'dark'` will read `'aurora'` from localStorage and fall through to the `else` branch returning `'dark'`. This is acceptable graceful degradation.
