import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { _resetEnvCache, getEnv } from '../../src/config/env.js';

const CANONICAL_SECRET = 'canonical-session-secret-at-least-32-characters';
const LEGACY_SECRET = 'legacy-session-secret-at-least-32-characters-long';

const originalEnv = {
  NODE_ENV: process.env['NODE_ENV'],
  HOMEDASH_SESSION_SECRET: process.env['HOMEDASH_SESSION_SECRET'],
  SESSION_SECRET: process.env['SESSION_SECRET'],
};

function restore(name: keyof typeof originalEnv): void {
  const value = originalEnv[name];
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

describe('session secret environment configuration', () => {
  beforeEach(() => {
    process.env['NODE_ENV'] = 'production';
    delete process.env['HOMEDASH_SESSION_SECRET'];
    delete process.env['SESSION_SECRET'];
    _resetEnvCache();
  });

  afterEach(() => {
    restore('NODE_ENV');
    restore('HOMEDASH_SESSION_SECRET');
    restore('SESSION_SECRET');
    _resetEnvCache();
  });

  it('uses HOMEDASH_SESSION_SECRET as the canonical variable', () => {
    process.env['HOMEDASH_SESSION_SECRET'] = CANONICAL_SECRET;

    expect(getEnv().SESSION_SECRET).toBe(CANONICAL_SECRET);
  });

  it('keeps SESSION_SECRET as a compatible legacy variable', () => {
    process.env['SESSION_SECRET'] = LEGACY_SECRET;

    expect(getEnv().SESSION_SECRET).toBe(LEGACY_SECRET);
  });

  it('accepts both variables when their values match', () => {
    process.env['HOMEDASH_SESSION_SECRET'] = CANONICAL_SECRET;
    process.env['SESSION_SECRET'] = CANONICAL_SECRET;

    expect(getEnv().SESSION_SECRET).toBe(CANONICAL_SECRET);
  });

  it('rejects conflicting variables without including either value', () => {
    process.env['HOMEDASH_SESSION_SECRET'] = CANONICAL_SECRET;
    process.env['SESSION_SECRET'] = LEGACY_SECRET;

    expect(() => getEnv()).toThrow(
      'HOMEDASH_SESSION_SECRET and SESSION_SECRET must match when both are set',
    );

    try {
      getEnv();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).not.toContain(CANONICAL_SECRET);
      expect(message).not.toContain(LEGACY_SECRET);
    }
  });

  it('rejects production startup when neither variable is configured', () => {
    expect(() => getEnv()).toThrow('HOMEDASH_SESSION_SECRET is required in production');
  });

  it('generates a stable process-local secret outside production', () => {
    process.env['NODE_ENV'] = 'development';

    const first = getEnv().SESSION_SECRET;
    const second = getEnv().SESSION_SECRET;

    expect(first).toHaveLength(64);
    expect(second).toBe(first);
  });
});
