/**
 * T031 (US7): Status check service — performs HTTP health checks against
 * configured LAN services and returns up/down/unknown results.
 */

export interface ServiceCheckInput {
  name: string;
  url: string;
  expectedStatus: number;
  timeoutSeconds: number;
}

export interface StatusCheckResult {
  name: string;
  url: string;
  status: 'up' | 'down' | 'unknown';
  responseTimeMs: number | null;
  checkedAt: string;
  error?: string;
}

/**
 * Execute health checks against a list of services in parallel.
 * Uses native fetch() with AbortSignal.timeout for cancellation.
 */
export async function executeChecks(services: ServiceCheckInput[]): Promise<StatusCheckResult[]> {
  return Promise.all(services.map(async (svc) => checkOne(svc)));
}

async function checkOne(svc: ServiceCheckInput): Promise<StatusCheckResult> {
  const checkedAt = new Date().toISOString();
  const start = performance.now();

  try {
    const res = await fetch(svc.url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(svc.timeoutSeconds * 1000),
    });

    const responseTimeMs = Math.round(performance.now() - start);
    const status = res.status === svc.expectedStatus ? 'up' : 'down';

    return {
      name: svc.name,
      url: svc.url,
      status,
      responseTimeMs,
      checkedAt,
      ...(status === 'down' ? { error: `Expected ${svc.expectedStatus}, got ${res.status}` } : {}),
    };
  } catch (err) {
    const responseTimeMs = Math.round(performance.now() - start);
    const message = err instanceof Error ? err.message : 'Unknown error';

    return {
      name: svc.name,
      url: svc.url,
      status: 'down',
      responseTimeMs,
      checkedAt,
      error: message,
    };
  }
}
