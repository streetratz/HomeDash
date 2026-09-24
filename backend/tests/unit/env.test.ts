import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { _resetEnvCache, getEnv } from '../../src/config/env.js';

const CANONICAL_SECRET = 'canonical-session-secret-at-least-32-characters';
const LEGACY_SECRET = 'legacy-session-secret-at-least-32-characters-long';

const originalEnv = {
  NODE_ENV: process.env['NODE_ENV'],
  HOMEDASH_DATA_DIR: process.env['HOMEDASH_DATA_DIR'],
  HOMEDASH_SESSION_SECRET: process.env['HOMEDASH_SESSION_SECRET'],
  SESSION_SECRET: process.env['SESSION_SECRET'],
};

let tempDir: string;

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
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'homedash-env-'));
    process.env['NODE_ENV'] = 'production';
    process.env['HOMEDASH_DATA_DIR'] = tempDir;
    delete process.env['HOMEDASH_SESSION_SECRET'];
    delete process.env['SESSION_SECRET'];
    _resetEnvCache();
  });

  afterEach(() => {
    restore('NODE_ENV');
    restore('HOMEDASH_DATA_DIR');
    restore('HOMEDASH_SESSION_SECRET');
    restore('SESSION_SECRET');
    _resetEnvCache();
    vi.restoreAllMocks();
    fs.rmSync(tempDir, { recursive: true, force: true });
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

  it('creates and reuses a persistent production secret when neither variable is configured', () => {
    const chmodSpy = vi.spyOn(fs, 'chmodSync');
    const first = getEnv().SESSION_SECRET;
    const secretPath = path.join(tempDir, '.homedash-session-secret');

    expect(first).toHaveLength(64);
    expect(fs.readFileSync(secretPath, 'utf8').trim()).toBe(first);
    expect(chmodSpy).toHaveBeenCalledWith(secretPath, 0o600);
    expect(fs.statSync(secretPath).mode & 0o777).toBe(0o600);

    _resetEnvCache();
    expect(getEnv().SESSION_SECRET).toBe(first);
  });

  it('does not create a generated secret when an explicit variable is configured', () => {
    process.env['HOMEDASH_SESSION_SECRET'] = CANONICAL_SECRET;

    expect(getEnv().SESSION_SECRET).toBe(CANONICAL_SECRET);
    expect(fs.existsSync(path.join(tempDir, '.homedash-session-secret'))).toBe(false);
  });

  it('rejects an invalid persistent production secret', () => {
    fs.writeFileSync(path.join(tempDir, '.homedash-session-secret'), 'too-short\n');

    expect(() => getEnv()).toThrow('Persistent session secret is invalid');
  });

  it('generates a stable process-local secret outside production', () => {
    process.env['NODE_ENV'] = 'development';

    const first = getEnv().SESSION_SECRET;
    const second = getEnv().SESSION_SECRET;

    expect(first).toHaveLength(64);
    expect(second).toBe(first);
  });
});
