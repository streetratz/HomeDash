/**
 * Docker SSH transport (043-docker-remote-auth, phase 03).
 *
 * Covers FR-030–FR-037 and SC-011. Every test runs against the stub `ssh`
 * fixture — no test contacts a real host (research.md R7).
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { _resetDataDirCache } from '../../src/config/dataDir.js';
import { _resetEnvCache } from '../../src/config/env.js';
import {
  _resetSshCommand,
  _setSshCommand,
  assertKeyPermissions,
  buildSshArgs,
  classifySshFailure,
  getSshTransportConfig,
  sshDockerRequest,
} from '../../src/services/dockerSshTransport.js';
import { listContainers, resetApiVersionCache } from '../../src/services/dockerService.js';
import { parseDockerEndpointOrThrow, type DockerEndpoint } from '../../src/lib/validation.js';

// vitest runs with the backend package as cwd; avoids `import.meta` so the
// file typechecks under the CommonJS test tsconfig.
const stubPath = path.resolve(process.cwd(), 'tests/fixtures/ssh-stub/ssh-stub.mjs');

let tmpDir: string;
let keyPath: string;

function sshEndpoint(url: string): Extract<DockerEndpoint, { kind: 'ssh' }> {
  const endpoint = parseDockerEndpointOrThrow(url);
  if (endpoint.kind !== 'ssh') throw new Error('expected an ssh endpoint');
  return endpoint;
}

/** Count live stub processes, to prove none are orphaned (SC-011). */
function stubProcessCount(): number {
  try {
    const out = execFileSync('/bin/sh', ['-c', `ps -eo args | grep -c "[s]sh-stub.mjs"`], {
      encoding: 'utf-8',
    });
    return Number.parseInt(out.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'homedash-ssh-'));
  keyPath = path.join(tmpDir, 'id_ed25519');
  fs.writeFileSync(keyPath, 'not-a-real-key', { mode: 0o600 });

  process.env['HOMEDASH_DATA_DIR'] = tmpDir;
  process.env['HOMEDASH_SSH_KEY_PATH'] = keyPath;
  process.env['HOMEDASH_SSH_KNOWN_HOSTS_PATH'] = path.join(tmpDir, 'known_hosts');
  delete process.env['HOMEDASH_SSH_STRICT_HOST_KEY_CHECKING'];
  process.env['SSH_STUB_MODE'] = 'ok';
  delete process.env['SSH_STUB_ARGV_OUT'];

  _resetEnvCache();
  _resetDataDirCache();
  resetApiVersionCache();
  _setSshCommand(stubPath);
});

afterEach(() => {
  _resetSshCommand();
  _resetEnvCache();
  _resetDataDirCache();
  delete process.env['SSH_STUB_MODE'];
  delete process.env['SSH_STUB_ARGV_OUT'];
  delete process.env['HOMEDASH_SSH_KEY_PATH'];
  delete process.env['HOMEDASH_SSH_KNOWN_HOSTS_PATH'];
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('buildSshArgs — argv hardening (FR-031, FR-032, FR-034)', () => {
  it('includes every hardening flag', () => {
    const args = buildSshArgs(sshEndpoint('ssh://deploy@dockerhost'), getSshTransportConfig());
    const joined = args.join(' ');

    expect(args).toContain('-T'); // no tty
    expect(args).toContain('-a'); // no agent forwarding
    expect(args).toContain('-x'); // no X11
    expect(joined).toContain('BatchMode=yes'); // never prompt
    expect(joined).toContain('ClearAllForwardings=yes'); // no port forwarding
    expect(joined).toContain('StrictHostKeyChecking=yes');
    expect(joined).toContain('IdentitiesOnly=yes');
    expect(joined).toContain('LogLevel=ERROR');
    expect(joined).toContain('ConnectTimeout=');
    expect(joined).toContain(`UserKnownHostsFile=${path.join(tmpDir, 'known_hosts')}`);
    expect(args).toContain('-i');
    expect(args).toContain(keyPath);
  });

  it('runs docker system dial-stdio against the target', () => {
    const args = buildSshArgs(sshEndpoint('ssh://deploy@dockerhost'), getSshTransportConfig());
    expect(args[args.length - 1]).toBe('docker system dial-stdio');
    expect(args[args.length - 2]).toBe('deploy@dockerhost');
    expect(args[args.length - 3]).toBe('--');
  });

  it('omits the user when the endpoint does not specify one', () => {
    const args = buildSshArgs(sshEndpoint('ssh://dockerhost'), getSshTransportConfig());
    expect(args[args.length - 2]).toBe('dockerhost');
  });

  it('passes a non-default port and omits it for 22', () => {
    const custom = buildSshArgs(sshEndpoint('ssh://host:2222'), getSshTransportConfig());
    expect(custom).toContain('-p');
    expect(custom).toContain('2222');

    const standard = buildSshArgs(sshEndpoint('ssh://host:22'), getSshTransportConfig());
    expect(standard).not.toContain('-p');
  });

  it('terminates option parsing with -- before the host', () => {
    // Defence in depth: the grammar already rejects a host starting with '-'.
    const args = buildSshArgs(sshEndpoint('ssh://host'), getSshTransportConfig());
    expect(args.indexOf('--')).toBeLessThan(args.indexOf('host'));
  });

  it('relaxes host-key checking only when explicitly disabled', () => {
    process.env['HOMEDASH_SSH_STRICT_HOST_KEY_CHECKING'] = 'false';
    _resetEnvCache();
    const args = buildSshArgs(sshEndpoint('ssh://host'), getSshTransportConfig());
    expect(args.join(' ')).toContain('StrictHostKeyChecking=accept-new');
  });
});

describe('assertKeyPermissions (FR-033)', () => {
  it('accepts a 0600 key', () => {
    expect(() => assertKeyPermissions(keyPath)).not.toThrow();
  });

  it.each([0o644, 0o640, 0o666, 0o604])('rejects mode %s', (mode) => {
    fs.chmodSync(keyPath, mode);
    expect(() => assertKeyPermissions(keyPath)).toThrowError(/chmod 600/);
  });

  it('reports a missing key with generation instructions', () => {
    expect(() => assertKeyPermissions(path.join(tmpDir, 'absent'))).toThrowError(/ssh-keygen/);
  });

  it('never includes key contents in the error', () => {
    fs.chmodSync(keyPath, 0o644);
    try {
      assertKeyPermissions(keyPath);
    } catch (err) {
      expect((err as Error).message).not.toContain('not-a-real-key');
    }
  });
});

describe('classifySshFailure (FR-036)', () => {
  const cases: Array<[string, string, string]> = [
    ['Host key verification failed.', 'DOCKER_SSH_HOST_KEY_FAILED', 'known_hosts'],
    ['REMOTE HOST IDENTIFICATION HAS CHANGED!', 'DOCKER_SSH_HOST_KEY_FAILED', 'known_hosts'],
    ['Permission denied (publickey).', 'DOCKER_SSH_AUTH_FAILED', 'public key'],
    ['ssh: connect to host h port 22: No route to host', 'DOCKER_ENDPOINT_UNREACHABLE', 'SSH'],
    ['ssh: Could not resolve hostname h', 'DOCKER_ENDPOINT_UNREACHABLE', 'SSH'],
    ['bash: docker: command not found', 'DOCKER_REMOTE_UNAVAILABLE', 'docker CLI'],
    [
      'Cannot connect to the Docker daemon at unix:///var/run/docker.sock: permission denied',
      'DOCKER_REMOTE_UNAVAILABLE',
      'docker group',
    ],
  ];

  it.each(cases)('classifies %s', (stderr, code, hint) => {
    const err = classifySshFailure('ssh://user@host:22', stderr, 255) as unknown as {
      code: string;
      message: string;
    };
    expect(err.code).toBe(code);
    expect(err.message).toContain(hint);
  });

  it('falls back to a categorised error rather than a generic one', () => {
    const err = classifySshFailure('ssh://user@host:22', 'something unexpected', 3) as unknown as {
      code: string;
      message: string;
    };
    expect(err.code).toBe('DOCKER_REMOTE_UNAVAILABLE');
    expect(err.message).toContain('ssh://user@host:22');
  });
});

describe('sshDockerRequest against the stub', () => {
  it('returns a framed JSON response', async () => {
    await expect(
      sshDockerRequest(sshEndpoint('ssh://dockerhost'), 'ssh://dockerhost:22', '/containers/json'),
    ).resolves.toBe('[]');
  });

  it('ignores trailing bytes after the framed response', async () => {
    // The daemon emits {"message":"context canceled"} after the body on some
    // routes; Content-Length framing must exclude it.
    process.env['SSH_STUB_MODE'] = 'ok-trailing';
    await expect(
      sshDockerRequest(sshEndpoint('ssh://dockerhost'), 'ssh://dockerhost:22', '/containers/json'),
    ).resolves.toBe('[]');
  });

  it('passes the hardened argv to the client', async () => {
    const argvOut = path.join(tmpDir, 'argv.json');
    process.env['SSH_STUB_ARGV_OUT'] = argvOut;

    await sshDockerRequest(
      sshEndpoint('ssh://deploy@dockerhost:2222'),
      'ssh://deploy@dockerhost:2222',
      '/containers/json',
    );

    const argv = JSON.parse(fs.readFileSync(argvOut, 'utf-8')) as string[];
    expect(argv).toContain('-T');
    expect(argv.join(' ')).toContain('BatchMode=yes');
    expect(argv[argv.length - 1]).toBe('docker system dial-stdio');
  });

  it.each([
    ['host-key', 'DOCKER_SSH_HOST_KEY_FAILED'],
    ['auth', 'DOCKER_SSH_AUTH_FAILED'],
    ['unreachable', 'DOCKER_ENDPOINT_UNREACHABLE'],
    ['no-docker', 'DOCKER_REMOTE_UNAVAILABLE'],
    ['socket-denied', 'DOCKER_REMOTE_UNAVAILABLE'],
  ])('classifies stub failure mode %s', async (mode, expected) => {
    process.env['SSH_STUB_MODE'] = mode;
    await expect(
      sshDockerRequest(sshEndpoint('ssh://dockerhost'), 'ssh://dockerhost:22', '/containers/json'),
    ).rejects.toMatchObject({ code: expected });
  });

  it('reports a missing ssh binary as a configuration error (FR-035)', async () => {
    _setSshCommand(path.join(tmpDir, 'no-such-ssh'));
    await expect(
      sshDockerRequest(sshEndpoint('ssh://dockerhost'), 'ssh://dockerhost:22', '/containers/json'),
    ).rejects.toMatchObject({ code: 'DOCKER_SSH_CLIENT_MISSING', statusCode: 500 });
  });

  it('refuses to dial with an unsafe key, before spawning anything', async () => {
    fs.chmodSync(keyPath, 0o644);
    await expect(
      sshDockerRequest(sshEndpoint('ssh://dockerhost'), 'ssh://dockerhost:22', '/containers/json'),
    ).rejects.toThrowError(/chmod 600/);
  });
});

describe('process cleanup (FR-037, SC-011)', () => {
  const settle = async (): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, 250));
  };

  it('leaves no child process after a success', async () => {
    const before = stubProcessCount();
    await sshDockerRequest(
      sshEndpoint('ssh://dockerhost'),
      'ssh://dockerhost:22',
      '/containers/json',
    );
    await settle();
    expect(stubProcessCount()).toBeLessThanOrEqual(before);
  });

  it('leaves no child process after a failure', async () => {
    const before = stubProcessCount();
    process.env['SSH_STUB_MODE'] = 'auth';
    await expect(
      sshDockerRequest(sshEndpoint('ssh://dockerhost'), 'ssh://dockerhost:22', '/containers/json'),
    ).rejects.toThrow();
    await settle();
    expect(stubProcessCount()).toBeLessThanOrEqual(before);
  });

  it('kills a hung dial and leaves no child process', async () => {
    const before = stubProcessCount();
    process.env['SSH_STUB_MODE'] = 'hang';

    await expect(
      sshDockerRequest(sshEndpoint('ssh://dockerhost'), 'ssh://dockerhost:22', '/containers/json'),
    ).rejects.toThrow();

    await settle();
    expect(stubProcessCount()).toBeLessThanOrEqual(before);
  }, 30_000);
});

describe('transport selection (FR-030)', () => {
  it('routes an ssh:// endpoint through the SSH transport, with version negotiation', async () => {
    const containers = await listContainers('ssh://dockerhost');
    expect(containers).toEqual([]);
  });

  it('surfaces a client-version 400 over SSH as api_version_unsupported', async () => {
    process.env['SSH_STUB_MODE'] = 'http-400';
    await expect(listContainers('ssh://dockerhost')).rejects.toMatchObject({
      code: 'DOCKER_API_VERSION_UNSUPPORTED',
    });
  });
});
