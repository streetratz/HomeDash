import type { PublicWidgetType } from './publicVisibility.js';

export interface PublicWidgetSnapshot<T = unknown> {
  widgetId: string;
  type: PublicWidgetType;
  data: T;
  refreshedAt: string;
}

export interface SnapshotCachePolicy {
  freshMs: number;
  staleMs: number;
  failureBackoffMs: number;
}

interface SnapshotCacheEntry {
  value?: PublicWidgetSnapshot;
  freshUntil: number;
  staleUntil: number;
  retryAfter: number;
  refresh?: Promise<PublicWidgetSnapshot>;
}

export class PublicWidgetUnavailableError extends Error {
  constructor() {
    super('Public widget unavailable');
    this.name = 'PublicWidgetUnavailableError';
  }
}

const MAX_ENTRIES = 200;
const entries = new Map<string, SnapshotCacheEntry>();

function enforceBound(): void {
  while (entries.size > MAX_ENTRIES) {
    const oldestKey = entries.keys().next().value;
    if (!oldestKey) return;
    entries.delete(oldestKey);
  }
}

export async function getOrRefreshPublicSnapshot(
  key: string,
  policy: SnapshotCachePolicy,
  loader: () => Promise<PublicWidgetSnapshot>,
): Promise<PublicWidgetSnapshot> {
  const now = Date.now();
  const entry = entries.get(key);

  if (entry?.value && now < entry.freshUntil) return entry.value;
  if (entry?.refresh) {
    if (entry.value && now < entry.staleUntil) return entry.value;
    return entry.refresh;
  }
  if (entry && now < entry.retryAfter) {
    if (entry.value && now < entry.staleUntil) return entry.value;
    throw new PublicWidgetUnavailableError();
  }

  const current = entry ?? { freshUntil: 0, staleUntil: 0, retryAfter: 0 };
  entries.set(key, current);
  enforceBound();

  const refresh = loader()
    .then((value) => {
      const refreshedAt = Date.now();
      current.value = value;
      current.freshUntil = refreshedAt + policy.freshMs;
      current.staleUntil = current.freshUntil + policy.staleMs;
      current.retryAfter = 0;
      return value;
    })
    .catch(() => {
      current.retryAfter = Date.now() + policy.failureBackoffMs;
      throw new PublicWidgetUnavailableError();
    })
    .finally(() => {
      delete current.refresh;
    });

  current.refresh = refresh;

  if (current.value && now < current.staleUntil) {
    void refresh.catch(() => undefined);
    return current.value;
  }
  return refresh;
}

export function invalidatePublicWidgetSnapshot(widgetId: string): void {
  for (const key of entries.keys()) {
    if (key.includes(`:${widgetId}:`)) entries.delete(key);
  }
}

export function clearPublicWidgetSnapshotCache(): void {
  entries.clear();
}
