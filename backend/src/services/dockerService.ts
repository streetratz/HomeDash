/**
 * Docker Engine API client — connects via Unix socket or TCP.
 *
 * Uses Node's built-in http module to call the Docker Engine REST API.
 * No external dependencies required.
 *
 * Docker API reference: https://docs.docker.com/engine/api/v1.43/
 */

import http from 'node:http';
import https from 'node:https';

import { DockerErrors, type AppError } from '../lib/errors.js';
import { parseDockerEndpoint, type DockerEndpoint } from '../lib/validation.js';
import { SshHttpError, sshDockerRequest } from './dockerSshTransport.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface DockerContainer {
  id: string;
  name: string;
  state: 'running' | 'paused' | 'exited' | 'dead' | 'created' | 'restarting' | 'removing';
  status: string;
  image: string;
  ports: Array<{
    ip?: string;
    privatePort: number;
    publicPort?: number;
    type: string;
  }>;
  created: number;
}

interface DockerApiContainer {
  Id: string;
  Names: string[];
  State: string;
  Status: string;
  Image: string;
  Ports: Array<{
    IP?: string;
    PrivatePort: number;
    PublicPort?: number;
    Type: string;
  }>;
  Created: number;
}

// ── HTTP helper ──────────────────────────────────────────────────────────────

/**
 * Resolve a stored endpoint string to its typed form.
 *
 * Read-time re-validation (FR-008, FR-023): a value stored before the endpoint
 * grammar existed may not conform. Such a value **fails closed** with an
 * actionable message rather than falling back to the local socket — that silent
 * fallback was a root cause of #181. A conforming stored value is unaffected.
 */
function resolveEndpoint(dockerUrl: string): DockerEndpoint {
  const result = parseDockerEndpoint(dockerUrl);
  if (!result.ok) {
    throw DockerErrors.invalidEndpoint(
      `The saved Docker endpoint is not valid and was not used. Re-enter it in the connection settings. ${result.error}`,
    );
  }
  return result.endpoint;
}

/**
 * Human-readable endpoint label for error messages (FR-011).
 *
 * Every connectivity failure names the endpoint that was actually attempted, so
 * a remote failure can never be mistaken for a local success. Contains no
 * credentials — SSH key material is never held by HomeDash at all.
 */
export function describeEndpoint(endpoint: DockerEndpoint): string {
  switch (endpoint.kind) {
    case 'unix':
      return `unix://${endpoint.socketPath}`;
    case 'ssh':
      return `ssh://${endpoint.user ? `${endpoint.user}@` : ''}${endpoint.host}:${endpoint.port}`;
    default:
      return `${endpoint.kind}://${endpoint.host}:${endpoint.port}`;
  }
}

/**
 * Non-2xx response from the daemon. Internal: carries the status and body so
 * version negotiation can recognise a client-version rejection. Converted to a
 * classified `AppError` before leaving this module.
 */
class DockerHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
    message: string,
  ) {
    super(message);
    this.name = 'DockerHttpError';
  }
}

async function dockerRequest(
  dockerUrl: string,
  path: string,
  method: 'GET' | 'POST' = 'GET',
): Promise<string> {
  const endpoint = resolveEndpoint(dockerUrl);
  const where = describeEndpoint(endpoint);

  if (endpoint.kind === 'ssh') {
    // Routed through the SSH transport, which spawns `ssh … docker system
    // dial-stdio` and speaks HTTP over the child's stdio.
    try {
      return await sshDockerRequest(endpoint, where, path, method);
    } catch (err) {
      if (err instanceof SshHttpError) {
        // Re-shape so version negotiation sees one error type regardless of
        // transport — otherwise an SSH host would silently skip the re-probe.
        throw new DockerHttpError(err.status, err.body, err.message);
      }
      throw err;
    }
  }

  return new Promise((resolve, reject) => {
    const lib = endpoint.kind === 'https' ? https : http;

    const options: http.RequestOptions = {
      path,
      method,
      headers: { 'Content-Type': 'application/json' },
      timeout: 10_000,
    };

    if (endpoint.kind === 'unix') {
      options.socketPath = endpoint.socketPath;
      options.hostname = 'localhost'; // required for Unix socket requests
    } else {
      options.hostname = endpoint.host;
      options.port = endpoint.port;
    }

    const req = lib.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf-8');
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body);
        } else {
          reject(
            new DockerHttpError(
              res.statusCode ?? 0,
              body,
              `Docker API at ${where} returned ${res.statusCode}: ${body.slice(0, 200)}`,
            ),
          );
        }
      });
    });

    req.on('error', (err) =>
      reject(
        DockerErrors.unreachable(`Could not reach the Docker daemon at ${where}: ${err.message}`),
      ),
    );
    req.on('timeout', () => {
      req.destroy();
      reject(DockerErrors.unreachable(`Timed out reaching the Docker daemon at ${where}.`));
    });
    req.end();
  });
}

// ── API version negotiation (043 / FR-026, FR-027, FR-029) ───────────────────

/**
 * Lowest API version HomeDash is willing to speak (OQ-1).
 *
 * Chosen as the floor, not the ceiling: the daemon's `MinAPIVersion` clamps it
 * *up* when the daemon is newer, so a low preferred value costs nothing against
 * modern engines while keeping old ones reachable.
 *
 * 1.24 is the oldest version that serves every field this client parses from
 * `/containers/json` — `Id`, `Names`, `State`, `Status`, `Image`, `Ports`,
 * `Created` — all stable since Docker 1.12. Going lower would buy compatibility
 * with daemons that cannot satisfy the response shape; going higher would
 * exclude old daemons for no benefit, which is the mistake the hardcoded
 * `/v1.43/` made in reverse (#181: Engine 29.1.3 has MinAPIVersion 1.44 and
 * rejects 1.43 outright).
 */
const PREFERRED_API_VERSION = '1.24';

/** Version probes are cached in memory only — never persisted (FR-027). */
const VERSION_CACHE_TTL_MS = 10 * 60 * 1000;

interface DockerApiVersion {
  apiVersion: string;
  minApiVersion: string;
  effective: string;
  probedAt: number;
}

const versionCache = new Map<string, DockerApiVersion>();

/** Compare dotted numeric versions. Returns <0, 0 or >0. */
export function compareApiVersions(left: string, right: string): number {
  const a = left.split('.').map((part) => Number.parseInt(part, 10));
  const b = right.split('.').map((part) => Number.parseInt(part, 10));
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * `clamp(PREFERRED, MinAPIVersion, ApiVersion)`.
 *
 * The daemon's minimum wins over our preference — that is the whole point of
 * negotiation. If the daemon's own range is inverted or unparseable we fall
 * back to its advertised `ApiVersion`.
 */
export function clampApiVersion(preferred: string, minimum: string, maximum: string): string {
  let effective = preferred;
  if (compareApiVersions(effective, minimum) < 0) effective = minimum;
  if (compareApiVersions(effective, maximum) > 0) effective = maximum;
  return effective;
}

/** Cache key: the normalised endpoint, so two widgets on one host share a probe. */
function versionCacheKey(endpoint: DockerEndpoint): string {
  return describeEndpoint(endpoint);
}

/** Test seam — clears negotiated versions. */
export function resetApiVersionCache(): void {
  versionCache.clear();
}

interface DockerVersionResponse {
  ApiVersion?: string;
  MinAPIVersion?: string;
}

/**
 * Probe `GET /version` (unversioned — it is the one endpoint that always
 * answers regardless of negotiation) and cache the result.
 *
 * Returns `null` when the daemon cannot be probed, in which case callers fall
 * back to unversioned request paths rather than guessing a prefix.
 */
async function negotiateApiVersion(
  dockerUrl: string,
  force = false,
): Promise<DockerApiVersion | null> {
  const endpoint = resolveEndpoint(dockerUrl);
  const key = versionCacheKey(endpoint);

  const cached = versionCache.get(key);
  if (!force && cached && Date.now() - cached.probedAt < VERSION_CACHE_TTL_MS) {
    return cached;
  }

  let parsed: DockerVersionResponse;
  try {
    parsed = JSON.parse(await dockerRequest(dockerUrl, '/version')) as DockerVersionResponse;
  } catch {
    return null;
  }

  const apiVersion = parsed.ApiVersion;
  if (!apiVersion) return null;
  const minApiVersion = parsed.MinAPIVersion ?? apiVersion;

  const negotiated: DockerApiVersion = {
    apiVersion,
    minApiVersion,
    effective: clampApiVersion(PREFERRED_API_VERSION, minApiVersion, apiVersion),
    probedAt: Date.now(),
  };
  versionCache.set(key, negotiated);
  return negotiated;
}

/** Does this 400 mean "your client version is unacceptable"? */
function isClientVersionMismatch(status: number, body: string): boolean {
  if (status !== 400) return false;
  const text = body.toLowerCase();
  return text.includes('client version') || text.includes('api version');
}

function versionPrefix(version: DockerApiVersion | null): string {
  return version ? `/v${version.effective}` : '';
}

/**
 * Issue a request against the negotiated API version.
 *
 * On a client-version `400` the cache entry is invalidated and the daemon is
 * re-probed **exactly once** (FR-029); a second rejection raises
 * `api_version_unsupported` naming the daemon's range and what we asked for,
 * rather than a bare "Docker API 400" that tells the operator nothing.
 */
async function versionedRequest(
  dockerUrl: string,
  buildPath: (prefix: string) => string,
  method: 'GET' | 'POST' = 'GET',
): Promise<string> {
  const version = await negotiateApiVersion(dockerUrl);
  try {
    return await dockerRequest(dockerUrl, buildPath(versionPrefix(version)), method);
  } catch (err) {
    if (!(err instanceof DockerHttpError) || !isClientVersionMismatch(err.status, err.body)) {
      throw err;
    }

    const reprobed = await negotiateApiVersion(dockerUrl, true);
    if (reprobed) {
      try {
        return await dockerRequest(dockerUrl, buildPath(versionPrefix(reprobed)), method);
      } catch (retryErr) {
        if (
          retryErr instanceof DockerHttpError &&
          isClientVersionMismatch(retryErr.status, retryErr.body)
        ) {
          throw unsupportedVersionError(dockerUrl, reprobed);
        }
        throw retryErr;
      }
    }
    throw unsupportedVersionError(dockerUrl, version);
  }
}

function unsupportedVersionError(dockerUrl: string, version: DockerApiVersion | null): AppError {
  const where = describeEndpoint(resolveEndpoint(dockerUrl));
  if (!version) {
    return DockerErrors.apiVersionUnsupported(
      `The Docker daemon at ${where} rejected HomeDash's API version and did not report a supported range.`,
    );
  }
  return DockerErrors.apiVersionUnsupported(
    `The Docker daemon at ${where} supports API ${version.minApiVersion}–${version.apiVersion}; HomeDash requested ${version.effective}. Upgrade HomeDash or the daemon so the ranges overlap.`,
  );
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Convert an internal transport error into a classified `AppError` (FR-010).
 * `DockerHttpError` must never escape this module: it carries no category, and
 * an unclassified failure is exactly what made #181 undiagnosable.
 */
function classify(err: unknown): never {
  if (err instanceof DockerHttpError) {
    throw DockerErrors.remoteUnavailable(err.message);
  }
  throw err;
}

/**
 * List Docker containers.
 * @param dockerUrl - configured Docker endpoint (unix/tcp/https/ssh)
 * @param all - Include stopped containers (default: true to show all states)
 */
export async function listContainers(dockerUrl: string, all = true): Promise<DockerContainer[]> {
  const raw = await versionedRequest(
    dockerUrl,
    (prefix) => `${prefix}/containers/json?all=${all}`,
  ).catch(classify);
  const containers = JSON.parse(raw) as DockerApiContainer[];

  return containers.map((c) => ({
    id: c.Id.slice(0, 12),
    name: (c.Names[0] ?? '').replace(/^\//, ''),
    state: c.State.toLowerCase() as DockerContainer['state'],
    status: c.Status,
    image: c.Image.replace(/^(docker\.io\/|library\/)/, ''),
    ports: (c.Ports ?? []).map((p) => ({
      ...(p.IP != null ? { ip: p.IP } : {}),
      privatePort: p.PrivatePort,
      ...(p.PublicPort != null ? { publicPort: p.PublicPort } : {}),
      type: p.Type,
    })),
    created: c.Created,
  }));
}

/**
 * Perform a container action (start, stop, restart).
 */
export async function containerAction(
  dockerUrl: string,
  containerId: string,
  action: 'start' | 'stop' | 'restart',
): Promise<void> {
  await versionedRequest(
    dockerUrl,
    (prefix) => `${prefix}/containers/${containerId}/${action}`,
    'POST',
  ).catch(classify);
}

/**
 * Test a Docker endpoint by performing the same kind of versioned call the
 * widget will make (FR-028, SC-009).
 *
 * Deliberately **not** a `/_ping`. `/_ping` is unversioned, so it answered 200
 * against Engine 29.1.3 while `/v1.43/containers/json` returned 400 — the test
 * button reported success and the widget stayed empty, which is the reported
 * symptom in #181. A green test must mean the listing works.
 */
export async function testDockerListing(
  dockerUrl: string,
): Promise<{ success: true } | { success: false; message: string }> {
  try {
    await versionedRequest(dockerUrl, (prefix) => `${prefix}/containers/json?limit=1`).catch(
      classify,
    );
    return { success: true };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Connection failed' };
  }
}

/**
 * Ping the Docker daemon to test connectivity.
 *
 * @deprecated Use {@link testDockerListing}. A successful ping does not imply a
 * successful container listing — see #181.
 */
export async function pingDocker(dockerUrl: string): Promise<boolean> {
  try {
    await dockerRequest(dockerUrl, '/_ping');
    return true;
  } catch {
    return false;
  }
}
