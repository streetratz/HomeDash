/**
 * T018: Helmet security headers configuration.
 * Import and register this with the Fastify instance during server bootstrap.
 */

import type { FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';

/**
 * Register Helmet with HomeDash-appropriate CSP and security header settings.
 * Fastify plugin registration — call `await registerSecurityHeaders(app)`.
 */
export async function registerSecurityHeaders(app: FastifyInstance): Promise<void> {
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // inline theme script in index.html
        styleSrc: ["'self'", "'unsafe-inline'"], // Tailwind uses inline styles in some cases
        imgSrc: ["'self'", 'data:', 'blob:', 'https:', 'http:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'", 'https://cdn.jsdelivr.net'],
        upgradeInsecureRequests: null, // LAN HTTP deployment — don't force HTTPS
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    referrerPolicy: { policy: 'same-origin' },
    // Disable HSTS for LAN HTTP deployments; reverse proxy can add it when TLS is terminated
    strictTransportSecurity: false,
    crossOriginEmbedderPolicy: false, // Avoid COEP issues for LAN asset serving
  });
}
