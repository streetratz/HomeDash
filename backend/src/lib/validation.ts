/**
 * T021: Zod request validation helpers.
 * Provides typed parsers for request body, params, and query strings,
 * throwing AppError on validation failure.
 */

import { z, type ZodSchema } from 'zod';
import { DockerErrors, Errors } from './errors.js';

/**
 * Parse and validate a value against a Zod schema.
 * Throws AppError(VALIDATION_ERROR) on failure with structured details.
 */
export function validate<T>(schema: ZodSchema<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const details = result.error.errors.map((e) => ({
      path: e.path.join('.'),
      message: e.message,
    }));
    throw Errors.validationError('Validation failed', details);
  }
  return result.data;
}

// ─── Common reusable schemas ─────────────────────────────────────────────────

/** UUID v4 string */
export const UuidSchema = z.string().uuid();

/** IANA timezone string — basic structural validation */
export const TimezoneSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9/_+-]+$/, 'Invalid IANA timezone format');

/** HTTP/HTTPS URL */
export const HttpUrlSchema = z
  .string()
  .url()
  .refine((v) => v.startsWith('http://') || v.startsWith('https://'), {
    message: 'URL must use http or https scheme',
  });

/** Theme mode */
export const ThemeModeSchema = z.enum(['light', 'dark']);

/** Dashboard applicability */
export const ApplicabilitySchema = z.enum(['web', 'mobile', 'both']);

/** Background type */
export const BackgroundTypeSchema = z.enum(['solid', 'image']);

/** Background display mode */
export const BackgroundDisplayModeSchema = z.enum(['fill', 'stretch']);

/** Hex color (abbreviated or full) */
export const HexColorSchema = z
  .string()
  .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, 'Invalid hex color');

/** Opacity 0..1 */
export const OpacitySchema = z.number().min(0).max(1);

/** Username: alphanumeric + underscore/hyphen, max 32 */
export const UsernameSchema = z
  .string()
  .min(1)
  .max(32)
  .regex(/^[a-zA-Z0-9_-]+$/, 'Username may only contain letters, numbers, _ and -');

/** Display name max 64 */
export const DisplayNameSchema = z.string().min(1).max(64);

/** Password min 8 chars */
export const PasswordSchema = z.string().min(8).max(256);

// ─── iCal / Calendar source schemas (004-calendar-widget Phase 4) ────────────

/** iCal URL — HTTPS required, or HTTP only for LAN (RFC 1918 / loopback) */
export const ICalUrlSchema = z
  .string()
  .url()
  .max(2048)
  .refine((url) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:') return true;
      if (parsed.protocol === 'http:') {
        const host = parsed.hostname;
        if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true;
        const parts = host.split('.').map(Number);
        if (parts[0] === 10) return true;
        if (parts[0] === 172 && parts[1] !== undefined && parts[1] >= 16 && parts[1] <= 31)
          return true;
        if (parts[0] === 192 && parts[1] === 168) return true;
      }
      return false;
    } catch {
      return false;
    }
  }, 'URL must be HTTPS or HTTP on a local network address');

/** Create an iCal calendar source */
export const CalendarSourceCreateSchema = z.object({
  type: z.literal('ical'),
  name: z.string().min(1).max(100),
  url: ICalUrlSchema,
  color: HexColorSchema.optional().default('#3b82f6'),
  syncIntervalSeconds: z.number().int().min(60).max(3600).optional().default(900),
});

/** Update an existing calendar source */
export const CalendarSourceUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  url: ICalUrlSchema.optional(),
  color: HexColorSchema.optional(),
  syncIntervalSeconds: z.number().int().min(60).max(3600).optional(),
  enabled: z.boolean().optional(),
});

/** Create or replace a static iCalendar file source. */
export const CalendarFileImportSchema = z.object({
  name: z.string().trim().min(1).max(100),
  color: HexColorSchema.optional().default('#3b82f6'),
  fileName: z.string().trim().min(1).max(255),
  icsContent: z
    .string()
    .min(1)
    .max(5 * 1024 * 1024),
});

const currentYear = new Date().getUTCFullYear();

function hasValidBirthdayDate(value: { month: number; day: number }): boolean {
  const date = new Date(Date.UTC(2000, value.month - 1, value.day));
  return date.getUTCMonth() === value.month - 1 && date.getUTCDate() === value.day;
}

/** Create or replace one editable local birthday record. */
export const BirthdayRecordSchema = z
  .object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().max(100).nullable().optional(),
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31),
    birthYear: z.number().int().min(1800).max(currentYear).nullable().optional(),
    notes: z.string().trim().max(500).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (!hasValidBirthdayDate(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['day'],
        message: 'Day is not valid for the selected month',
      });
    }
  });

/** Create a server-managed local birthday source. */
export const BirthdaySourceCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  color: HexColorSchema.optional().default('#ec4899'),
});

/** Preview or import a bounded birthday CSV body. */
export const BirthdayCsvSchema = z.object({
  csvContent: z
    .string()
    .min(1)
    .max(1024 * 1024),
});

export const BirthdayCsvImportSchema = BirthdayCsvSchema.extend({
  mode: z.enum(['append', 'replace']).default('append'),
});

export const BirthdayExportQuerySchema = z.object({
  format: z.enum(['csv', 'ics']),
});

// ─── Per-widget-type config schemas (002-widget-management) ──────────────────

export const LinksListConfigSchema = z
  .object({
    layout: z.enum(['vertical', 'horizontal']).default('vertical'),
  })
  .strict();

export const ClockConfigSchema = z
  .object({
    timezone: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[A-Za-z0-9/_+-]+$/)
      .nullable()
      .optional(),
    format: z.enum(['12h', '24h']).default('12h'),
    showDate: z.boolean().default(true),
    showSeconds: z.boolean().default(true),
  })
  .strict();

export const MarkdownConfigSchema = z
  .object({
    content: z.string().max(50_000).default(''),
  })
  .strict();

export const IframeConfigSchema = z
  .object({
    url: z.string().url().max(2048).or(z.literal('')).default(''),
    aspectRatio: z.enum(['16:9', '4:3', '1:1', 'auto']).default('auto'),
  })
  .strict();

export const WeatherConfigSchema = z
  .object({
    mode: z.enum(['api', 'manual']).default('manual'),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    locationName: z.string().max(128).optional(),
    temperature: z.number().optional(),
    temperatureUnit: z.enum(['C', 'F']).default('C'),
    conditions: z.string().max(128).optional(),
    icon: z.string().max(16).optional(),
  })
  .strict();

const ServiceEntrySchema = z
  .object({
    name: z.string().min(1).max(64),
    url: z.string().url().max(2048),
    expectedStatus: z.number().int().min(100).max(599).default(200),
    timeoutSeconds: z.number().int().min(1).max(30).default(10),
  })
  .strict();

export const SystemStatusConfigSchema = z
  .object({
    services: z.array(ServiceEntrySchema).max(20).default([]),
    pollIntervalSeconds: z.number().int().min(15).max(3600).default(60),
  })
  .strict();

// ─── Dashboard import schema (003-dashboard-enhancements) ────────────────────

const ImportLinkSchema = z.object({
  title: z.string().min(1).max(15),
  url: HttpUrlSchema,
  iconKey: z.string().max(128).nullable(),
  iconOverrideKey: z.string().max(128).nullable().optional(),
  orderIndex: z.number().int().min(0),
});

const ImportWidgetSchema = z.object({
  type: z.string().min(1).max(64),
  orderIndex: z.number().int().min(0),
  configJson: z.string().max(100_000),
  links: z.array(ImportLinkSchema).max(200).optional(),
});

const ImportPlaceholderSchema = z.object({
  stableKey: z.string().uuid(),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(1).max(12),
  h: z.number().int().min(1).max(20),
  borderColor: HexColorSchema,
  showBorder: z.boolean().default(true),
  title: z.string().max(64).nullable(),
  opacity: OpacitySchema,
  backgroundStyle: z.enum(['solid', 'aurora', 'aurora-australis']).optional(),
  backgroundColor: z.string().max(64).nullable().optional(),
  widgets: z.array(ImportWidgetSchema).max(100),
  links: z.array(ImportLinkSchema).max(200).optional(),
});

export const DashboardImportSchema = z.object({
  version: z.union([z.literal(1), z.literal(2)]),
  dashboard: z.object({
    name: z.string().min(1).max(128),
    applicability: ApplicabilitySchema,
    backgroundType: BackgroundTypeSchema,
    backgroundColor: HexColorSchema.nullable(),
    backgroundDisplayMode: BackgroundDisplayModeSchema.nullable(),
  }),
  placeholders: z.array(ImportPlaceholderSchema).max(50),
  overrideName: z.string().min(1).max(128).optional(),
});

// ─── Calendar widget config schema (004-calendar-widget Phase 6) ─────────────

export const CalendarConfigSchema = z
  .object({
    sourceIds: z.array(z.string().uuid()).min(0).max(20).default([]),
    viewMode: z.enum(['compact', 'expanded']).default('expanded'),
    daysAhead: z.number().int().min(1).max(90).default(7),
    maxEvents: z.number().int().min(5).max(100).default(25),
    showLocation: z.boolean().default(true),
    showPrivateEvents: z.boolean().default(false),
  })
  .strict();

/** Maps widget type → config Zod schema for server-side validation */
export const widgetConfigSchemas: Record<string, z.ZodSchema> = {
  links_list: LinksListConfigSchema,
  clock: ClockConfigSchema,
  markdown: MarkdownConfigSchema,
  iframe: IframeConfigSchema,
  weather: WeatherConfigSchema,
  system_status: SystemStatusConfigSchema,
  calendar: CalendarConfigSchema,
};

// ─── Todo widget schemas (005-todo-widget Phase 1) ───────────────────────────

export const CreateTodoListSchema = z.object({
  name: z.string().min(1).max(100),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a 6-digit hex color')
    .optional(),
});

export const UpdateTodoListSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a 6-digit hex color')
    .nullable()
    .optional(),
});

export const CreateTodoItemSchema = z.object({
  title: z.string().min(1).max(500),
  notes: z.string().max(5000).optional(),
  dueDate: z.string().datetime().optional(),
  priority: z.number().int().min(0).max(3).optional(),
});

export const UpdateTodoItemSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  notes: z.string().max(5000).nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  priority: z.number().int().min(0).max(3).optional(),
  completed: z.boolean().optional(),
  orderIndex: z.number().int().min(0).optional(),
});

export const ReorderItemsSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        orderIndex: z.number().int().min(0),
      }),
    )
    .min(1),
});

export const TodoConfigSchema = z
  .object({
    selectedListIds: z.array(z.string().uuid()).min(0).max(50).default([]),
    sortBy: z.enum(['dueDate', 'priority', 'createdAt', 'manual']).default('manual'),
    groupByList: z.boolean().default(false),
    maxItems: z.number().int().min(1).max(200).default(50),
    showCompleted: z.boolean().default(true),
  })
  .strict();

// Add todo to widget config schemas map
widgetConfigSchemas['todo'] = TodoConfigSchema;

// ─── App Shortcuts widget config schema (013-app-shortcuts) ──────────────────

export const AppShortcutsConfigSchema = z
  .object({
    columns: z.number().int().min(2).max(8).default(4),
    iconSize: z.enum(['sm', 'md', 'lg']).default('md'),
    showLabels: z.boolean().default(true),
  })
  .strict();

widgetConfigSchemas['app_shortcuts'] = AppShortcutsConfigSchema;

// ─── Connection CRUD schemas (015-integrations-hub) ──────────────────────────

export const CreatePiholeConnectionSchema = z
  .object({
    name: z.string().min(1).max(100).default('Pi-hole'),
    baseUrl: z
      .string()
      .url()
      .transform((u) => u.replace(/\/+$/, '')),
    apiToken: z.string().min(1),
    pollIntervalSec: z.number().int().min(10).max(300).default(30),
  })
  .strict();

export const UpdatePiholeConnectionSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    baseUrl: z
      .string()
      .url()
      .transform((u) => u.replace(/\/+$/, ''))
      .optional(),
    apiToken: z.string().min(1).optional(),
    pollIntervalSec: z.number().int().min(10).max(300).optional(),
  })
  .strict();

// ─── Docker endpoint grammar (043-docker-remote-auth) ───────────────────────

/**
 * A parsed, validated Docker daemon endpoint.
 *
 * There is deliberately **no default/fallback variant**. The previous
 * `parseDockerUrl()` treated any unrecognised input as a Unix socket path,
 * which is the root cause of issue #181: `http://host:2375` silently became a
 * socket path, the request hit the *local* daemon, and the widget reported
 * success while showing the wrong host's containers. An input matching no
 * variant is now an error, never a coercion.
 *
 * See `specs/043-docker-remote-auth/data-model.md` § Value objects.
 */
export type DockerEndpoint =
  | { kind: 'unix'; socketPath: string }
  | { kind: 'tcp'; host: string; port: number }
  | { kind: 'https'; host: string; port: number }
  | { kind: 'ssh'; user?: string; host: string; port: number };

/** Default port per remote scheme (FR-003). */
const DOCKER_DEFAULT_PORTS = { tcp: 2375, https: 2376, ssh: 22 } as const;

export const DOCKER_ENDPOINT_MAX_LENGTH = 2048;

/**
 * Every rejection names all four accepted forms (FR-006). Operators reach this
 * text with a non-working endpoint in hand; telling them only what is wrong,
 * without telling them what is right, is what made #181 hard to self-diagnose.
 */
const DOCKER_ACCEPTED_FORMS =
  'Accepted formats: unix:///var/run/docker.sock, tcp://host:2375, https://host:2376, ssh://user@host:22';

/**
 * Hostname / IPv4 charset. Intentionally strict: for `ssh://` this value is
 * passed to the `ssh` binary as argv, so shell metacharacters, whitespace and
 * control characters must never survive validation (FR-030). The same rule is
 * applied to tcp/https for consistency — no legitimate Docker host needs them.
 */
const DOCKER_HOST_PATTERN = /^[A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?$/;

/** SSH usernames: POSIX-portable charset only, for the same argv-safety reason. */
const DOCKER_SSH_USER_PATTERN = /^[A-Za-z0-9._-]+$/;

/** Bracketed IPv6 literal, e.g. `[::1]` or `[fe80::1]`. */
const DOCKER_IPV6_PATTERN = /^\[[0-9A-Fa-f:.]+\]$/;

function isValidDockerHost(host: string): boolean {
  if (host.length === 0 || host.length > 255) return false;
  if (DOCKER_IPV6_PATTERN.test(host)) return true;
  return DOCKER_HOST_PATTERN.test(host);
}

/** Parse `[user@]host[:port]` for a remote scheme. Returns null if malformed. */
function parseDockerAuthority(
  authority: string,
  scheme: 'tcp' | 'https' | 'ssh',
): { user?: string; host: string; port: number } | null {
  let rest = authority;
  let user: string | undefined;

  const at = rest.lastIndexOf('@');
  if (at !== -1) {
    // user@ is only meaningful for ssh; tcp/https carry no credentials.
    if (scheme !== 'ssh') return null;
    user = rest.slice(0, at);
    rest = rest.slice(at + 1);
    if (!DOCKER_SSH_USER_PATTERN.test(user)) return null;
  }

  let host = rest;
  let port: number = DOCKER_DEFAULT_PORTS[scheme];

  // Split the port off, taking care not to split inside an IPv6 literal.
  const colon = host.lastIndexOf(':');
  const closingBracket = host.lastIndexOf(']');
  if (colon !== -1 && colon > closingBracket) {
    const portText = host.slice(colon + 1);
    host = host.slice(0, colon);
    if (!/^[0-9]{1,5}$/.test(portText)) return null;
    port = Number.parseInt(portText, 10);
    if (port < 1 || port > 65_535) return null;
  }

  if (!isValidDockerHost(host)) return null;

  return user === undefined ? { host, port } : { user, host, port };
}

/**
 * Parse a Docker endpoint string into its typed form.
 *
 * @returns the parsed endpoint, or a `{ error }` describing why it was rejected.
 * Callers that want an exception should use {@link parseDockerEndpointOrThrow}.
 */
export function parseDockerEndpoint(
  raw: string,
): { ok: true; endpoint: DockerEndpoint } | { ok: false; error: string } {
  const value = raw.trim();

  if (value.length === 0) {
    return { ok: false, error: `Docker endpoint is required. ${DOCKER_ACCEPTED_FORMS}` };
  }
  if (value.length > DOCKER_ENDPOINT_MAX_LENGTH) {
    return {
      ok: false,
      error: `Docker endpoint must be ${DOCKER_ENDPOINT_MAX_LENGTH} characters or fewer.`,
    };
  }
  // Control characters would be invisible in the settings field and dangerous
  // in argv; reject before any scheme-specific parsing.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\s]/.test(value)) {
    return {
      ok: false,
      error: `Docker endpoint must not contain spaces or control characters. ${DOCKER_ACCEPTED_FORMS}`,
    };
  }

  if (value.startsWith('unix://')) {
    const socketPath = value.slice('unix://'.length);
    if (!socketPath.startsWith('/')) {
      return {
        ok: false,
        error: `A unix:// endpoint needs an absolute socket path, e.g. unix:///var/run/docker.sock. ${DOCKER_ACCEPTED_FORMS}`,
      };
    }
    return { ok: true, endpoint: { kind: 'unix', socketPath } };
  }

  // `http://` is the single most common mistake and the one reported in #181,
  // so it gets its own message rather than the generic "unknown scheme" text.
  if (value.startsWith('http://')) {
    return {
      ok: false,
      error: `Use tcp:// for an unencrypted Docker daemon, not http:// — for example tcp://${value.slice('http://'.length) || 'host:2375'}. ${DOCKER_ACCEPTED_FORMS}`,
    };
  }

  for (const scheme of ['tcp', 'https', 'ssh'] as const) {
    const prefix = `${scheme}://`;
    if (!value.startsWith(prefix)) continue;

    const authority = value.slice(prefix.length);
    // A path component is meaningless for a daemon endpoint and usually means
    // the operator pasted a UI URL.
    const slash = authority.indexOf('/');
    if (slash !== -1) {
      const trailing = authority.slice(slash);
      if (trailing !== '/') {
        return {
          ok: false,
          error: `A ${scheme}:// Docker endpoint must not include a path. ${DOCKER_ACCEPTED_FORMS}`,
        };
      }
    }
    const parsed = parseDockerAuthority(
      slash === -1 ? authority : authority.slice(0, slash),
      scheme,
    );
    if (parsed === null) {
      return {
        ok: false,
        error: `"${value}" is not a valid ${scheme}:// Docker endpoint. ${DOCKER_ACCEPTED_FORMS}`,
      };
    }
    if (scheme === 'ssh') {
      return { ok: true, endpoint: { kind: 'ssh', ...parsed } };
    }
    return { ok: true, endpoint: { kind: scheme, host: parsed.host, port: parsed.port } };
  }

  if (!value.includes('://')) {
    return {
      ok: false,
      error: `"${value}" is missing a scheme. ${DOCKER_ACCEPTED_FORMS}`,
    };
  }

  return {
    ok: false,
    error: `"${value}" uses an unsupported scheme. ${DOCKER_ACCEPTED_FORMS}`,
  };
}

/**
 * Normalize the one unambiguous endpoint form accepted by older HomeDash
 * releases: an absolute Unix socket path without a scheme.
 *
 * This helper is only for persisted-data reconciliation during startup. API
 * schemas continue to call {@link parseDockerEndpoint} directly, so new input
 * such as `/var/run/docker.sock` remains invalid and must include `unix://`.
 */
export function normalizeLegacyPersistedDockerEndpoint(raw: string): string | null {
  const value = raw.trim();
  if (!value.startsWith('/')) return null;

  const normalized = `unix://${value}`;
  const parsed = parseDockerEndpoint(normalized);
  return parsed.ok && parsed.endpoint.kind === 'unix' ? normalized : null;
}

/** {@link parseDockerEndpoint}, throwing a classified `AppError` on rejection. */
export function parseDockerEndpointOrThrow(raw: string): DockerEndpoint {
  const result = parseDockerEndpoint(raw);
  if (!result.ok) {
    throw DockerErrors.invalidEndpoint(result.error);
  }
  return result.endpoint;
}

/**
 * Closed-set Zod parser for a Docker endpoint.
 *
 * Output is the normalised **string**, not the parsed union: `docker_url` is a
 * `TEXT` column and the API contract carries a string. Use
 * {@link parseDockerEndpoint} when the typed form is needed.
 */
export const DockerEndpointSchema = z.string().superRefine((value, ctx) => {
  const result = parseDockerEndpoint(value);
  if (!result.ok) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.error });
  }
});

export const CreateDockerConnectionSchema = z
  .object({
    name: z.string().min(1).max(100).default('Docker'),
    dockerUrl: DockerEndpointSchema,
  })
  .strict();

export const UpdateDockerConnectionSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    dockerUrl: DockerEndpointSchema.optional(),
  })
  .strict();

// ─── Pi-hole widget schemas (014-pihole-widget) ─────────────────────────────

export const PiholeConfigSchema = z
  .object({
    baseUrl: z
      .string()
      .url()
      .transform((u) => u.replace(/\/+$/, '')), // strip trailing slash
    apiToken: z.string().min(1).optional(), // required on create, optional on update
    pollIntervalSec: z.number().int().min(10).max(300).default(30),
  })
  .strict();

export const PiholeBlockingSchema = z
  .object({
    action: z.enum(['enable', 'disable']),
    duration: z.number().int().positive().nullable().optional(),
  })
  .strict();

export const PiholeDisplayConfigSchema = z
  .object({
    sections: z
      .array(z.enum(['controls', 'system', 'queries']))
      .min(1)
      .default(['controls', 'system', 'queries']),
    statsLayout: z.enum(['auto', 'stacked', 'side-by-side']).optional(),
    // Legacy fields — accepted but ignored when sections is present
    showSystemHealth: z.boolean().optional(),
    showBlocklistCount: z.boolean().optional(),
    displayMode: z.enum(['all', 'stats', 'controls']).optional(),
  })
  .strict();

widgetConfigSchemas['pihole'] = PiholeDisplayConfigSchema;

// ─── Single-Link widget schema (030-shortcuts-single-link) ──────────────────

export const SingleLinkDisplayConfigSchema = z
  .object({
    url: z
      .string()
      .url()
      .refine((u) => /^https?:\/\//i.test(u), { message: 'Only http/https URLs are allowed' })
      .or(z.literal('')),
    label: z.string().max(100).default(''),
    iconKey: z.string().max(200).nullable().default(null),
    subtitle: z.string().max(200).nullable().default(null),
    background: z.string().max(200).nullable().default(null),
  })
  .strict();

widgetConfigSchemas['single_link'] = SingleLinkDisplayConfigSchema;

// ─── UniFi Network widget schemas (023-unifi-widget) ────────────────────────

export const UnifiConfigSchema = z
  .object({
    baseUrl: z
      .string()
      .url()
      .transform((u) => u.replace(/\/+$/, '')),
    username: z.string().min(1),
    password: z.string().min(1),
    siteName: z.string().min(1).default('default'),
    pollIntervalSec: z.number().int().min(10).max(300).default(30),
  })
  .strict();

export const UnifiDisplayConfigSchema = z
  .object({
    showDevice: z.boolean().default(true),
    showWan: z.boolean().default(true),
    showNetwork: z.boolean().default(true),
    showClients: z.boolean().default(true),
    showDevices: z.boolean().default(true),
    showWifi: z.boolean().default(true),
    showIps: z.boolean().default(true),
    showHealth: z.boolean().default(true),
    layout: z.enum(['stacked', 'grid']).default('stacked'),
    sectionOrder: z
      .array(z.enum(['device', 'wan', 'network']))
      .default(['device', 'wan', 'network']),
    ispDomain: z.string().optional(),
  })
  .strict();

widgetConfigSchemas['unifi'] = UnifiDisplayConfigSchema;

// ─── Sonos Music widget schema (018-sonos-widget) ───────────────────────────

export const SonosMusicConfigSchema = z
  .object({
    householdId: z.string().optional(),
    defaultGroupId: z.string().optional(),
    showGrouping: z.boolean().default(true),
    compactMode: z.boolean().default(false),
  })
  .strict();

widgetConfigSchemas['sonos_music'] = SonosMusicConfigSchema;

// ─── Stocks widget config schema (021-stocks-widget) ─────────────────────────

function isValidStockTradeDate(value: string): boolean {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) ??
    /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(value) ??
    /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

const StockLotSchema = z.object({
  purchasePrice: z.number().finite().positive(),
  quantity: z.number().finite().positive(),
  // Preserve valid Yahoo formats accepted before 046 while rejecting malformed dates.
  tradeDate: z
    .string()
    .max(32)
    .refine(isValidStockTradeDate, 'Trade date must be a valid calendar date'),
});

const StockTickerSchema = z.object({
  symbol: z.string().min(1).max(20),
  lots: z.array(StockLotSchema).optional(),
});

const StockGroupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  currency: z.string().length(3),
  tickers: z.array(StockTickerSchema).max(30),
  collapsed: z.boolean().default(false),
  includeInTotal: z.boolean().default(true),
  csvFilename: z.string().optional(),
  lastImported: z.string().optional(),
});

export const StocksConfigSchema = z
  .object({
    groups: z.array(StockGroupSchema).default([]),
    displayCurrency: z.string().length(3).default('AUD'),
    refreshInterval: z.number().int().min(60).max(900).default(300),
    displayMode: z.enum(['minimized', 'compact', 'expanded']).default('compact'),
    showSparkline: z.boolean().default(false),
    reduceOffHours: z.boolean().default(true),
  })
  .passthrough();

widgetConfigSchemas['stocks'] = StocksConfigSchema;
