/**
 * SSH transport for `ssh://` Docker endpoints (043-docker-remote-auth).
 *
 * Spawns the system `ssh` client running `docker system dial-stdio` on the
 * remote host, wraps the child's stdin/stdout as a `Duplex`, and hands that to
 * `http.request()` via `createConnection`. This is exactly what the Docker CLI
 * does for `DOCKER_HOST=ssh://…`, so the remote-side contract is stable.
 *
 * Why not the `ssh2` npm package: it would mean reimplementing `known_hosts`
 * parsing, key-format handling and `ssh_config` semantics ourselves, against a
 * native-adjacent crypto surface, for no functional gain. OpenSSH is far better
 * audited. Why not a managed `ssh -L` forward: it would materialise an
 * *unauthenticated Docker API on a local TCP port* of the HomeDash host, which
 * under host networking is reachable from the LAN — a worse posture than the
 * defect being fixed. See research.md R1.
 *
 * HomeDash never reads private key material. `ssh` opens the key file itself;
 * we pass a path.
 */

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { Duplex } from 'node:stream';

import { getDataSubDir } from '../config/dataDir.js';
import { getEnv } from '../config/env.js';
import { DockerErrors } from '../lib/errors.js';
import type { DockerEndpoint } from '../lib/validation.js';

/** Resolved SSH settings. Paths and a flag only — never key contents. */
export interface SshTransportConfig {
  keyPath: string;
  knownHostsPath: string;
  strictHostKeyChecking: boolean;
  connectTimeoutMs: number;
}

const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;

/** Longest a single dial may live, including the remote HTTP exchange. */
const DIAL_DEADLINE_MS = 15_000;

export function getSshTransportConfig(): SshTransportConfig {
  const env = getEnv();
  const sshDir = getDataSubDir('ssh');
  return {
    keyPath: env.HOMEDASH_SSH_KEY_PATH ?? path.join(sshDir, 'id_ed25519'),
    knownHostsPath: env.HOMEDASH_SSH_KNOWN_HOSTS_PATH ?? path.join(sshDir, 'known_hosts'),
    strictHostKeyChecking: env.HOMEDASH_SSH_STRICT_HOST_KEY_CHECKING,
    connectTimeoutMs: DEFAULT_CONNECT_TIMEOUT_MS,
  };
}

/**
 * Reject a private key that other users on the host can read (FR-033).
 *
 * OpenSSH enforces this itself and would fail the dial anyway, but its message
 * ("UNPROTECTED PRIVATE KEY FILE!") arrives as stderr noise after a spawn. A
 * preflight turns it into an actionable configuration error, and refuses to
 * proceed with a key that may already be compromised.
 */
export function assertKeyPermissions(keyPath: string): void {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(keyPath);
  } catch {
    throw DockerErrors.sshAuthFailed(
      `No SSH key found at ${keyPath}. Generate one (ssh-keygen -t ed25519 -f ${keyPath}) and authorise it on the Docker host, or set HOMEDASH_SSH_KEY_PATH.`,
    );
  }

  // Windows and some bind mounts do not report meaningful POSIX modes.
  if (process.platform === 'win32') return;

  if ((stat.mode & 0o077) !== 0) {
    throw DockerErrors.sshAuthFailed(
      `The SSH key at ${keyPath} is accessible to other users (mode ${(stat.mode & 0o777).toString(8)}). Run: chmod 600 ${keyPath}`,
    );
  }
}

/** Build the hardened `ssh` argv (FR-031, FR-032, FR-034). */
export function buildSshArgs(
  endpoint: Extract<DockerEndpoint, { kind: 'ssh' }>,
  config: SshTransportConfig,
): string[] {
  const target = endpoint.user ? `${endpoint.user}@${endpoint.host}` : endpoint.host;
  const args = [
    '-T', // no pseudo-terminal
    '-a', // no agent forwarding
    '-x', // no X11 forwarding
    '-o',
    'BatchMode=yes', // never prompt — a prompt would hang the request
    '-o',
    'ClearAllForwardings=yes', // no port forwarding, whatever ssh_config says
    '-o',
    `ConnectTimeout=${Math.ceil(config.connectTimeoutMs / 1000)}`,
    '-o',
    `StrictHostKeyChecking=${config.strictHostKeyChecking ? 'yes' : 'accept-new'}`,
    '-o',
    `UserKnownHostsFile=${config.knownHostsPath}`,
    '-o',
    'IdentitiesOnly=yes', // use only the configured key
    '-i',
    config.keyPath,
    '-o',
    'LogLevel=ERROR',
  ];

  if (endpoint.port !== 22) {
    args.push('-p', String(endpoint.port));
  }

  // `--` terminates option parsing: the host component is already validated
  // against a strict charset, and this is the second line of defence against a
  // hostname being read as a flag.
  args.push('--', target, 'docker system dial-stdio');
  return args;
}

/**
 * Classify a failed dial from exit code and stderr (FR-036).
 *
 * Distinct categories, never collapsed: each one implies a different fix, and
 * a generic "connection failed" is what made #181 undiagnosable.
 */
export function classifySshFailure(where: string, stderr: string, code: number | null): Error {
  const text = stderr.toLowerCase();

  if (
    text.includes('host key verification failed') ||
    text.includes('remote host identification has changed')
  ) {
    return DockerErrors.sshHostKeyFailed(
      `Host key verification failed for ${where}. Add the host's key to the known_hosts file, or remove the stale entry if the host was rebuilt.`,
    );
  }
  if (
    text.includes('no route to host') ||
    text.includes('connection refused') ||
    text.includes('connection timed out') ||
    text.includes('could not resolve hostname') ||
    text.includes('network is unreachable')
  ) {
    return DockerErrors.unreachable(`Could not reach ${where} over SSH: ${truncate(stderr)}`);
  }
  if (text.includes('permission denied') && !text.includes('docker')) {
    return DockerErrors.sshAuthFailed(
      `SSH authentication was rejected by ${where}. Authorise HomeDash's public key on that host.`,
    );
  }
  if (text.includes('unprotected private key') || text.includes('bad permissions')) {
    return DockerErrors.sshAuthFailed(
      `The SSH key was rejected for unsafe file permissions. Run chmod 600 on the key file.`,
    );
  }
  if (text.includes('command not found') || text.includes('docker: not found')) {
    return DockerErrors.remoteUnavailable(
      `The docker CLI is not available on ${where}, so HomeDash cannot open a Docker API channel there.`,
    );
  }
  if (text.includes('permission denied') || text.includes('dial unix')) {
    return DockerErrors.remoteUnavailable(
      `The SSH user on ${where} cannot access the Docker socket. Add that user to the docker group.`,
    );
  }

  return DockerErrors.remoteUnavailable(
    `SSH dial to ${where} failed (exit ${code ?? 'unknown'}): ${truncate(stderr)}`,
  );
}

function truncate(text: string, max = 300): string {
  const clean = text.trim().replace(/\s+/g, ' ');
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

/** Overridable for tests — never reads an env var at call sites. */
let sshCommand = 'ssh';
export function _setSshCommand(command: string): void {
  sshCommand = command;
}
export function _resetSshCommand(): void {
  sshCommand = 'ssh';
}

interface DialHandle {
  socket: Duplex;
  /** Resolves once the child has exited and been reaped. */
  done: Promise<void>;
  /**
   * The classified failure, once the child has exited non-zero.
   *
   * Read *after* awaiting `done`: when `ssh` dies the HTTP request fails first
   * with `ECONNRESET`/"socket hang up", which is the symptom. The cause is on
   * stderr, and is only complete once the child has closed.
   */
  failure: () => Error | undefined;
  destroy: () => void;
}

/**
 * Wrap a spawned `ssh` child's stdio as a Duplex suitable for `http.request()`.
 *
 * The deadline, the SIGKILL and the reap all live here so that success, error
 * and timeout share one cleanup path (FR-037, SC-011) — the failure mode this
 * guards against is an orphaned `ssh` per poll, which at a 30 s widget interval
 * accumulates quickly.
 */
function dial(
  endpoint: Extract<DockerEndpoint, { kind: 'ssh' }>,
  where: string,
  config: SshTransportConfig,
): DialHandle {
  assertKeyPermissions(config.keyPath);

  let child: ChildProcessWithoutNullStreams;
  try {
    child = spawn(sshCommand, buildSshArgs(endpoint, config), {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (err) {
    throw toSpawnError(err, where);
  }

  let stderr = '';
  child.stderr.setEncoding('utf-8');
  child.stderr.on('data', (chunk: string) => {
    // Bounded: a chatty remote must not be able to grow this without limit.
    if (stderr.length < 4096) stderr += chunk;
  });

  const socket = Duplex.from({ readable: child.stdout, writable: child.stdin });

  let settled = false;
  let timedOut = false;
  let failure: Error | undefined;

  const cleanup = (): void => {
    clearTimeout(deadline);
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL');
    }
  };

  const deadline = setTimeout(() => {
    timedOut = true;
    failure = DockerErrors.unreachable(`SSH dial to ${where} timed out.`);
    cleanup();
    socket.destroy(failure);
  }, DIAL_DEADLINE_MS);
  // Do not hold the event loop open on the deadline timer.
  deadline.unref?.();

  const done = new Promise<void>((resolve) => {
    child.once('error', (err) => {
      if (settled) return;
      settled = true;
      failure = toSpawnError(err, where);
      cleanup();
      socket.destroy(failure);
      resolve();
    });

    child.once('close', (code) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (!timedOut && code !== 0) {
        // Recorded, not thrown: a non-zero exit *after* a complete response is
        // the documented `context canceled` quirk and must not be reported as
        // a failure. Only a request that also failed consults this.
        failure = classifySshFailure(where, stderr, code);
      }
      resolve();
    });
  });

  return { socket, done, failure: () => failure, destroy: cleanup };
}

function toSpawnError(err: unknown, where: string): Error {
  if ((err as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') {
    return DockerErrors.sshClientMissing(
      `SSH client not available in this image, so ${where} cannot be reached. Install openssh-client, or use a tcp:// or https:// endpoint.`,
    );
  }
  return DockerErrors.remoteUnavailable(
    `Could not start the SSH client for ${where}: ${err instanceof Error ? err.message : String(err)}`,
  );
}

/**
 * Perform one Docker Engine API request over SSH.
 *
 * One spawn per request; no pooling in v1 (see the cost measurement in
 * `logs/03-phase-ssh-transport.md` — pooling stays deferred unless measured
 * need justifies it).
 */
export async function sshDockerRequest(
  endpoint: Extract<DockerEndpoint, { kind: 'ssh' }>,
  where: string,
  requestPath: string,
  method: 'GET' | 'POST' = 'GET',
): Promise<string> {
  const config = getSshTransportConfig();
  const handle = dial(endpoint, where, config);

  try {
    return await new Promise<string>((resolve, reject) => {
      const req = http.request(
        {
          method,
          path: requestPath,
          // The remote daemon does not route on Host, but HTTP/1.1 requires it.
          host: 'docker',
          headers: { 'Content-Type': 'application/json', Connection: 'close' },
          createConnection: () => handle.socket,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => {
            // Framing is by Content-Length/chunked encoding, so trailing bytes
            // after the response body (the `context canceled` quirk) are
            // already excluded here.
            const body = Buffer.concat(chunks).toString('utf-8');
            const status = res.statusCode ?? 0;
            if (status >= 200 && status < 300) {
              resolve(body);
            } else {
              reject(
                new SshHttpError(
                  status,
                  body,
                  `Docker API at ${where} returned ${status}: ${body.slice(0, 200)}`,
                ),
              );
            }
          });
        },
      );

      req.on('error', (err) => {
        // Wait for the child to close so its stderr is complete, then prefer
        // the classified cause over the transport symptom.
        void handle.done.then(
          () => reject(handle.failure() ?? err),
          () => reject(err),
        );
      });
      req.end();
    });
  } finally {
    handle.destroy();
    await handle.done.catch(() => undefined);
    if (!handle.socket.destroyed) handle.socket.destroy();
  }
}

/** Non-2xx from the daemon over SSH. Mirrors the HTTP transport's shape. */
export class SshHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
    message: string,
  ) {
    super(message);
    this.name = 'SshHttpError';
  }
}
