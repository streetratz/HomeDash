/**
 * T015: Backend configuration loader for environment variables.
 * All env access goes through this module — never read process.env directly elsewhere.
 */

import { z } from 'zod';
import { randomBytes } from 'node:crypto';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(0).max(65535).default(3000),

  /** Absolute path to data directory (db, uploads, icon-cache). */
  HOMEDASH_DATA_DIR: z.string().default('./data'),

  /**
   * Secret used to sign server-side sessions.
   * Must be ≥32 chars in production.
   */
  HOMEDASH_SESSION_SECRET: z.string().min(32).optional(),
  SESSION_SECRET: z.string().min(32).optional(),

  /**
   * Whether to trust reverse-proxy forwarded headers.
   * Set to "1" when behind nginx/Caddy.
   */
  TRUST_PROXY: z
    .string()
    .optional()
    .transform((v) => v === '1' || v === 'true'),

  /**
   * Comma-separated list of allowed CORS origins.
   * Leave unset to disable CORS entirely (default for LAN deployments at same origin).
   */
  ALLOWED_ORIGINS: z
    .string()
    .optional()
    .transform((v) =>
      v
        ? v
            .split(',')
            .map((o) => o.trim())
            .filter(Boolean)
        : [],
    ),

  /** Microsoft OAuth credentials. */
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_REDIRECT_URI: z.string().optional(),

  /** Google OAuth credentials. */
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),

  /** Spotify OAuth credentials. */
  SPOTIFY_CLIENT_ID: z.string().optional(),
  SPOTIFY_CLIENT_SECRET: z.string().optional(),
  SPOTIFY_REDIRECT_URI: z.string().optional(),

  /** Log level for Pino. */
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  /** Optional log file path. When set, logs are also written to this file. */
  LOG_FILE: z.string().optional(),

  /**
   * SSH transport for `ssh://` Docker endpoints (043 / FR-031–FR-033).
   *
   * These are **paths and a flag only**. HomeDash never reads private key
   * contents into memory — the `ssh` binary opens the file itself — and no API
   * response or log line ever contains them. Defaults resolve under
   * `HOMEDASH_DATA_DIR` and are applied in `getSshTransportConfig()` rather
   * than here, because `HOMEDASH_DATA_DIR` is itself resolved at runtime.
   */
  HOMEDASH_SSH_KEY_PATH: z.string().optional(),
  HOMEDASH_SSH_KNOWN_HOSTS_PATH: z.string().optional(),

  /**
   * Host-key verification. Defaults to enabled and must be turned off
   * explicitly — an unverified SSH host key means the daemon you reach is not
   * necessarily the daemon you configured.
   */
  HOMEDASH_SSH_STRICT_HOST_KEY_CHECKING: z
    .string()
    .optional()
    .transform((v) => v !== 'false' && v !== '0'),

  /** Cookie secure flag — defaults to true in production. */
  COOKIE_SECURE: z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (v === 'true') return true;
      if (v === 'false') return false;
      // auto: secure=true in production unless explicitly overridden
      return ctx.path.join('.') === 'COOKIE_SECURE'
        ? undefined
        : process.env['NODE_ENV'] === 'production';
    })
    .pipe(z.boolean().optional()),
});

type ParsedEnv = z.infer<typeof EnvSchema>;

export type Env = Omit<ParsedEnv, 'HOMEDASH_SESSION_SECRET' | 'SESSION_SECRET'> & {
  SESSION_SECRET: string;
};

let _env: Env | undefined;

function resolveSessionSecret(env: ParsedEnv): string {
  const canonical = env.HOMEDASH_SESSION_SECRET;
  const legacy = env.SESSION_SECRET;

  if (canonical && legacy && canonical !== legacy) {
    throw new Error('HOMEDASH_SESSION_SECRET and SESSION_SECRET must match when both are set');
  }

  const configured = canonical ?? legacy;
  if (configured) return configured;

  if (env.NODE_ENV === 'production') {
    throw new Error(
      'HOMEDASH_SESSION_SECRET is required in production (SESSION_SECRET remains supported for existing deployments)',
    );
  }

  return randomBytes(32).toString('hex');
}

/** Parse and validate environment variables. Cached after first call. */
export function getEnv(): Env {
  if (_env) return _env;

  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.errors
      .map((e) => `  ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${formatted}`);
  }

  const env = { ...result.data };
  delete env.HOMEDASH_SESSION_SECRET;
  delete env.SESSION_SECRET;

  _env = {
    ...env,
    SESSION_SECRET: resolveSessionSecret(result.data),
  };
  return _env;
}

/** Reset cached env — only for tests. */
export function _resetEnvCache(): void {
  _env = undefined;
}
