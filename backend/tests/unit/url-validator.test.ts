import { describe, it, expect } from 'vitest';
import {
  isAllowedArtUrl,
  isAllowedDockerEndpoint,
  validateArtRequest,
} from '../../src/lib/url-validator.js';
import { parseDockerEndpointOrThrow } from '../../src/lib/validation.js';

describe('isAllowedArtUrl', () => {
  it('rejects non-http protocols', async () => {
    await expect(isAllowedArtUrl('ftp://192.168.1.20/art.jpg')).resolves.toBe(false);
  });

  it('rejects loopback, link-local, and metadata addresses', async () => {
    await expect(isAllowedArtUrl('http://127.0.0.1/art.jpg')).resolves.toBe(false);
    await expect(isAllowedArtUrl('http://169.254.1.10/art.jpg')).resolves.toBe(false);
    await expect(isAllowedArtUrl('http://169.254.169.254/latest/meta-data')).resolves.toBe(false);
  });

  it('rejects 0.0.0.0 and IPv6 unspecified addresses', async () => {
    await expect(isAllowedArtUrl('http://0.0.0.0/art.jpg')).resolves.toBe(false);
    await expect(isAllowedArtUrl('http://[::]/art.jpg')).resolves.toBe(false);
    await expect(isAllowedArtUrl('http://[::1]/art.jpg')).resolves.toBe(false);
  });

  it('allows RFC1918 LAN addresses for Sonos devices', async () => {
    await expect(isAllowedArtUrl('http://192.168.1.25/art.jpg')).resolves.toBe(true);
    await expect(isAllowedArtUrl('http://10.0.0.25/art.jpg')).resolves.toBe(true);
    await expect(isAllowedArtUrl('http://172.16.10.25/art.jpg')).resolves.toBe(true);
  });

  it('rejects localhost after DNS resolution', async () => {
    await expect(isAllowedArtUrl('http://localhost/art.jpg')).resolves.toBe(false);
  });
});

describe('validateArtRequest', () => {
  it('accepts matching hashes', () => {
    expect(validateArtRequest('abc123', 'https://example.com/art.jpg', 'abc123')).toEqual({
      valid: true,
    });
  });

  it('rejects mismatched hashes', () => {
    expect(validateArtRequest('abc123', 'https://example.com/art.jpg', 'xyz789')).toEqual({
      valid: false,
      reason: 'hash_mismatch',
    });
  });
});

describe('isAllowedDockerEndpoint', () => {
  const allow = async (url: string) => isAllowedDockerEndpoint(parseDockerEndpointOrThrow(url));

  it('allows a unix socket', async () => {
    await expect(allow('unix:///var/run/docker.sock')).resolves.toBe(true);
  });

  // FR-016 / RK-6: this is the deliberate divergence from isAllowedArtUrl().
  // A Docker daemon legitimately lives on loopback or the LAN; artwork does
  // not. These two policies must never be collapsed into one block list.
  it('allows loopback, unlike the art policy', async () => {
    await expect(allow('tcp://127.0.0.1:2375')).resolves.toBe(true);
    await expect(isAllowedArtUrl('http://127.0.0.1/art.jpg')).resolves.toBe(false);
  });

  it('allows RFC1918 addresses, unlike the art policy', async () => {
    await expect(allow('tcp://192.168.1.10:2375')).resolves.toBe(true);
    await expect(allow('https://10.0.0.5:2376')).resolves.toBe(true);
    await expect(allow('tcp://172.16.3.4:2375')).resolves.toBe(true);
  });

  it('denies link-local and cloud metadata addresses', async () => {
    await expect(allow('tcp://169.254.1.10:2375')).resolves.toBe(false);
    await expect(allow('tcp://169.254.169.254:2375')).resolves.toBe(false);
  });

  it('denies the unspecified address', async () => {
    await expect(allow('tcp://0.0.0.0:2375')).resolves.toBe(false);
  });

  it('denies IPv6 link-local and unspecified addresses', async () => {
    await expect(allow('tcp://[fe80::1]:2375')).resolves.toBe(false);
    await expect(allow('tcp://[::]:2375')).resolves.toBe(false);
  });

  it('allows an IPv6 unique-local address', async () => {
    await expect(allow('tcp://[fd00::1]:2375')).resolves.toBe(true);
  });

  it('denies a tcp host that does not resolve', async () => {
    await expect(allow('tcp://no-such-host.invalid:2375')).resolves.toBe(false);
  });

  it('allows an ssh host alias without requiring DNS resolution', async () => {
    // ~/.ssh/config Host aliases are a supported way to name a Docker host and
    // deliberately do not resolve in DNS.
    await expect(allow('ssh://docker-host')).resolves.toBe(true);
  });

  it('still denies an ssh endpoint pointed at a link-local literal', async () => {
    await expect(allow('ssh://user@[fe80::1]:22')).resolves.toBe(false);
  });
});
