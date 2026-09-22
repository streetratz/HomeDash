/**
 * Docker Engine API version negotiation (043-docker-remote-auth, phase 02).
 *
 * Covers FR-026, FR-027 and FR-029. The case that matters is
 * `clamp(1.43, 1.44, 1.52) = 1.44`: the previously hardcoded `/v1.43/` prefix
 * is *below* the minimum accepted by Engine 29.1.3, which returns HTTP 400
 * while the unversioned `/_ping` returns 200 — a passing connection test with
 * an empty widget (#181).
 */

import http from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  clampApiVersion,
  compareApiVersions,
  listContainers,
  resetApiVersionCache,
  testDockerListing,
} from '../../src/services/dockerService.js';

describe('compareApiVersions', () => {
  it('orders by major then minor', () => {
    expect(compareApiVersions('1.44', '1.43')).toBeGreaterThan(0);
    expect(compareApiVersions('1.43', '1.44')).toBeLessThan(0);
    expect(compareApiVersions('1.44', '1.44')).toBe(0);
  });

  it('compares minor versions numerically, not lexically', () => {
    // '1.9' < '1.44' numerically, but '1.9' > '1.44' as strings.
    expect(compareApiVersions('1.9', '1.44')).toBeLessThan(0);
  });

  it('treats a missing component as zero', () => {
    expect(compareApiVersions('2', '2.0')).toBe(0);
    expect(compareApiVersions('2', '1.99')).toBeGreaterThan(0);
  });
});

describe('clampApiVersion', () => {
  it('raises the preferred version to the daemon minimum (the #181 case)', () => {
    expect(clampApiVersion('1.43', '1.44', '1.52')).toBe('1.44');
  });

  it('lowers the preferred version to the daemon maximum', () => {
    expect(clampApiVersion('1.50', '1.12', '1.41')).toBe('1.41');
  });

  it('keeps the preferred version when it is inside the range', () => {
    expect(clampApiVersion('1.24', '1.12', '1.41')).toBe('1.24');
  });

  it('is exactly the daemon minimum when the whole range is above preferred', () => {
    expect(clampApiVersion('1.24', '1.44', '1.52')).toBe('1.44');
  });
});

/** Minimal fake daemon speaking just enough of the Engine API. */
interface FakeDaemon {
  url: string;
  paths: string[];
  close: () => Promise<void>;
  versionProbes: number;
}

async function startFakeDaemon(options: {
  apiVersion: string;
  minApiVersion: string;
  /** Requests below this version are rejected with a client-version 400. */
  rejectBelow?: string;
  /** Omit the /version endpoint entirely. */
  noVersionEndpoint?: boolean;
}): Promise<FakeDaemon> {
  const state = { versionProbes: 0 };
  const paths: string[] = [];

  const server = http.createServer((req, res) => {
    const path = req.url ?? '';
    paths.push(path);

    if (path === '/version') {
      if (options.noVersionEndpoint) {
        res.writeHead(404).end('no version endpoint');
        return;
      }
      state.versionProbes += 1;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          ApiVersion: options.apiVersion,
          MinAPIVersion: options.minApiVersion,
        }),
      );
      return;
    }

    const match = /^\/v(\d+\.\d+)\//.exec(path);
    const requested = match?.[1];
    if (options.rejectBelow && requested !== undefined) {
      const [reqMajor, reqMinor] = requested.split('.').map(Number);
      const [minMajor, minMinor] = options.rejectBelow.split('.').map(Number);
      const tooOld =
        (reqMajor ?? 0) < (minMajor ?? 0) ||
        ((reqMajor ?? 0) === (minMajor ?? 0) && (reqMinor ?? 0) < (minMinor ?? 0));
      if (tooOld) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            message: `client version ${requested} is too old. Minimum supported API version is ${options.rejectBelow}`,
          }),
        );
        return;
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('[]');
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `tcp://127.0.0.1:${port}`,
    paths,
    get versionProbes() {
      return state.versionProbes;
    },
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}

describe('version negotiation against a daemon', () => {
  let daemon: FakeDaemon | undefined;

  beforeEach(() => {
    resetApiVersionCache();
  });

  afterEach(async () => {
    await daemon?.close();
    daemon = undefined;
  });

  it('uses the daemon minimum when it exceeds our preferred version (#181)', async () => {
    daemon = await startFakeDaemon({
      apiVersion: '1.52',
      minApiVersion: '1.44',
      rejectBelow: '1.44',
    });

    await expect(listContainers(daemon.url)).resolves.toEqual([]);
    expect(daemon.paths).toContain('/version');
    expect(daemon.paths.some((p) => p.startsWith('/v1.44/containers/json'))).toBe(true);
    expect(daemon.paths.some((p) => p.startsWith('/v1.43/'))).toBe(false);
  });

  it('caches the probe across calls to the same endpoint', async () => {
    daemon = await startFakeDaemon({ apiVersion: '1.52', minApiVersion: '1.44' });

    await listContainers(daemon.url);
    await listContainers(daemon.url);
    await listContainers(daemon.url);

    expect(daemon.versionProbes).toBe(1);
  });

  it('re-probes after the cache is reset', async () => {
    daemon = await startFakeDaemon({ apiVersion: '1.52', minApiVersion: '1.44' });

    await listContainers(daemon.url);
    resetApiVersionCache();
    await listContainers(daemon.url);

    expect(daemon.versionProbes).toBe(2);
  });

  it('falls back to unversioned paths when /version is unavailable', async () => {
    daemon = await startFakeDaemon({
      apiVersion: '1.52',
      minApiVersion: '1.44',
      noVersionEndpoint: true,
    });

    await expect(listContainers(daemon.url)).resolves.toEqual([]);
    expect(daemon.paths.some((p) => p.startsWith('/containers/json'))).toBe(true);
    expect(daemon.paths.some((p) => /^\/v\d/.test(p))).toBe(false);
  });

  it('raises api_version_unsupported naming the range when negotiation cannot succeed', async () => {
    // Daemon advertises 1.40 but actually refuses anything below 1.44 — an
    // irreconcilable range, so we must report rather than retry forever.
    daemon = await startFakeDaemon({
      apiVersion: '1.40',
      minApiVersion: '1.30',
      rejectBelow: '1.44',
    });

    await expect(listContainers(daemon.url)).rejects.toMatchObject({
      code: 'DOCKER_API_VERSION_UNSUPPORTED',
      statusCode: 502,
    });

    await expect(listContainers(daemon.url)).rejects.toThrowError(
      /supports API 1\.30–1\.40; HomeDash requested 1\.30/,
    );
  });

  it('re-probes exactly once on a client-version 400', async () => {
    daemon = await startFakeDaemon({
      apiVersion: '1.40',
      minApiVersion: '1.30',
      rejectBelow: '1.44',
    });

    await expect(listContainers(daemon.url)).rejects.toThrow();

    // One initial probe plus exactly one re-probe — never a retry loop.
    expect(daemon.versionProbes).toBe(2);
  });
});

describe('testDockerListing (FR-028, SC-009)', () => {
  let daemon: FakeDaemon | undefined;

  beforeEach(() => {
    resetApiVersionCache();
  });

  afterEach(async () => {
    await daemon?.close();
    daemon = undefined;
  });

  it('succeeds by listing containers, not by pinging', async () => {
    daemon = await startFakeDaemon({
      apiVersion: '1.52',
      minApiVersion: '1.44',
      rejectBelow: '1.44',
    });

    await expect(testDockerListing(daemon.url)).resolves.toEqual({ success: true });
    expect(daemon.paths.some((p) => p.includes('/containers/json'))).toBe(true);
    expect(daemon.paths).not.toContain('/_ping');
  });

  it('fails when the listing fails, even though a ping would have passed', async () => {
    daemon = await startFakeDaemon({
      apiVersion: '1.40',
      minApiVersion: '1.30',
      rejectBelow: '1.44',
    });

    const result = await testDockerListing(daemon.url);
    expect(result.success).toBe(false);
    expect(result.success === false && result.message).toMatch(/supports API/);
  });

  it('reports an invalid stored endpoint rather than silently using the local socket', async () => {
    const result = await testDockerListing('http://192.168.1.10:2375');
    expect(result.success).toBe(false);
    expect(result.success === false && result.message).toMatch(/tcp:\/\//);
  });
});
