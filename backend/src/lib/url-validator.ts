import { timingSafeEqual } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

import type { DockerEndpoint } from './validation.js';

const blockedArtHosts = new BlockList();
blockedArtHosts.addSubnet('127.0.0.0', 8, 'ipv4');
blockedArtHosts.addSubnet('0.0.0.0', 8, 'ipv4');
blockedArtHosts.addSubnet('169.254.0.0', 16, 'ipv4');
blockedArtHosts.addAddress('::1', 'ipv6');
blockedArtHosts.addAddress('::', 'ipv6');
blockedArtHosts.addSubnet('fe80::', 10, 'ipv6');

function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return true;
  return blockedArtHosts.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

export async function isAllowedArtUrl(url: string): Promise<boolean> {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    let hostname = parsed.hostname;

    // Strip brackets from IPv6 literals (URL parser includes them)
    if (hostname.startsWith('[') && hostname.endsWith(']')) {
      hostname = hostname.slice(1, -1);
    }

    // If hostname is already an IP literal, check it directly
    const ipVersion = isIP(hostname);
    if (ipVersion !== 0) {
      return !isBlockedAddress(hostname);
    }

    const addresses = await lookup(hostname, {
      all: true,
      verbatim: true,
    });

    if (addresses.length === 0) {
      return false;
    }

    return addresses.every((entry) => !isBlockedAddress(entry.address));
  } catch {
    return false;
  }
}

/**
 * Addresses no Docker daemon should ever live at, for any transport.
 *
 * NOTE — this list deliberately does **not** block loopback or RFC1918, which
 * `blockedArtHosts` above does. That divergence is intentional and must not be
 * collapsed into a single shared block list (risk RK-6):
 *
 *   - `isAllowedArtUrl()` guards *outbound fetches of remote artwork*, where a
 *     loopback or private address means someone is trying to make the server
 *     read its own internal network — a classic SSRF.
 *   - A Docker daemon is *legitimately* on loopback (`tcp://127.0.0.1:2375`,
 *     the SSH-forwarded case) or on the LAN (`tcp://192.168.1.10:2375`). That
 *     is the normal, supported deployment, not an attack.
 *
 * The SSRF defence for Docker is therefore not "block private ranges" — it is
 * that the endpoint is resolved server-side from stored connection rows and is
 * never taken from the caller (FR-016). This function is the second line: it
 * rejects the address families that are never a real daemon and that are the
 * classic cloud-metadata / unspecified-address pivots.
 */
const blockedDockerHosts = new BlockList();
blockedDockerHosts.addSubnet('169.254.0.0', 16, 'ipv4'); // link-local + cloud metadata
blockedDockerHosts.addSubnet('0.0.0.0', 8, 'ipv4'); // "this network" / unspecified
blockedDockerHosts.addAddress('::', 'ipv6'); // unspecified
blockedDockerHosts.addSubnet('fe80::', 10, 'ipv6'); // link-local

function isBlockedDockerAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return true;
  return blockedDockerHosts.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

/**
 * Is this a Docker endpoint HomeDash is willing to dial? (FR-016)
 *
 * Applied *after* `parseDockerEndpoint()` has established the grammar. Unix
 * sockets are always allowed — they are local by construction and carry no
 * network reachability. `ssh://` grammar is validated without dialling: the
 * host is checked when it is an IP literal, but a hostname is left to `ssh`
 * itself to resolve, since SSH config aliases (`~/.ssh/config` `Host` entries)
 * are a supported and common way to name a Docker host and do not resolve in
 * DNS.
 */
export async function isAllowedDockerEndpoint(endpoint: DockerEndpoint): Promise<boolean> {
  if (endpoint.kind === 'unix') {
    return endpoint.socketPath.startsWith('/');
  }

  let hostname = endpoint.host;
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    hostname = hostname.slice(1, -1);
  }

  const ipVersion = isIP(hostname);
  if (ipVersion !== 0) {
    return !isBlockedDockerAddress(hostname);
  }

  // Hostname, not an IP literal.
  if (endpoint.kind === 'ssh') {
    // May be an ~/.ssh/config alias with no DNS record; do not require a lookup.
    return hostname.length > 0;
  }

  try {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    if (addresses.length === 0) return false;
    return addresses.every((entry) => !isBlockedDockerAddress(entry.address));
  } catch {
    return false;
  }
}

function safeHashEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function validateArtRequest(
  hash: string,
  sourceUrl: string,
  expectedHash: string,
): { valid: boolean; reason?: string } {
  if (!hash) {
    return { valid: false, reason: 'missing_hash' };
  }

  if (!sourceUrl) {
    return { valid: false, reason: 'missing_source_url' };
  }

  if (!expectedHash) {
    return { valid: false, reason: 'missing_expected_hash' };
  }

  if (!safeHashEquals(hash, expectedHash)) {
    return { valid: false, reason: 'hash_mismatch' };
  }

  return { valid: true };
}
