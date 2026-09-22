/**
 * T032: UA-based device context detection helper.
 * Determines whether a request originates from a mobile or web (desktop) client.
 */

import { UAParser } from 'ua-parser-js';
import type { FastifyRequest } from 'fastify';

export type DeviceContext = 'mobile' | 'web';

const MOBILE_TYPES = new Set(['mobile', 'tablet']);

/**
 * Detect whether the request is from a mobile/tablet UA.
 * Returns 'mobile' for phones and tablets, 'web' for everything else.
 */
export function detectDeviceContext(request: FastifyRequest): DeviceContext {
  const ua = request.headers['user-agent'] ?? '';
  const parser = new UAParser(ua);
  const deviceType = parser.getDevice().type?.toLowerCase() ?? '';
  return MOBILE_TYPES.has(deviceType) ? 'mobile' : 'web';
}

/**
 * Detect from a raw User-Agent string (no Fastify dependency — useful in tests).
 */
export function detectDeviceContextFromUA(ua: string): DeviceContext {
  const parser = new UAParser(ua);
  const deviceType = parser.getDevice().type?.toLowerCase() ?? '';
  return MOBILE_TYPES.has(deviceType) ? 'mobile' : 'web';
}
