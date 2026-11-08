interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Deliberately minimal in-memory cache — Atlas stays the source of truth
 * (P4 plan). Nothing here is ever persisted (no localStorage, no Foundry
 * settings/journals): a page reload starts with an empty cache.
 */
export class TtlCache {
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private readonly inFlight = new Map<string, Promise<unknown>>();

  async getOrFetch<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
    const cached = this.store.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as T;
    }

    const existing = this.inFlight.get(key);
    if (existing) return existing as Promise<T>;

    const promise = fetcher()
      .then((value) => {
        this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
        return value;
      })
      .finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, promise);
    return promise;
  }

  /** Drops every entry whose key starts with `prefix` (e.g. `'list:'` invalidates all list queries at once). */
  invalidate(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
    for (const key of this.inFlight.keys()) {
      if (key.startsWith(prefix)) this.inFlight.delete(key);
    }
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
    this.inFlight.clear();
  }
}

export const LIST_CACHE_PREFIX = 'list:';
export const DOC_CACHE_PREFIX = 'doc:';

export const documentCache = new TtlCache();

/**
 * Self-invalidating: any incoming Atlas socket event that names a document
 * (currently `foundry:notification`, see P8) drops that document's detail
 * entry plus every cached list, since we can't know which list queries
 * included it. Event-name-agnostic on purpose so future event types work
 * without touching this file.
 */
Hooks.on('atlas-foundry.socketEvent', (_event: string, payload: unknown) => {
  const documentId = (payload as { documentId?: unknown } | null)?.documentId;
  if (typeof documentId !== 'string' || !documentId) return;
  documentCache.invalidate(LIST_CACHE_PREFIX);
  documentCache.delete(`${DOC_CACHE_PREFIX}${documentId}`);
});
