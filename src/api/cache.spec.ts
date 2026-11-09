import { describe, expect, it, vi } from 'vitest';

function mockHooks() {
  const handlers: Record<string, Array<(...args: any[]) => void>> = {};
  globalThis.Hooks = {
    on: vi.fn((hook: string, cb: any) => {
      (handlers[hook] ??= []).push(cb);
      return handlers[hook]!.length;
    }),
    once: vi.fn(),
    off: vi.fn(),
    callAll: vi.fn((hook: string, ...args: any[]) => {
      (handlers[hook] ?? []).forEach((cb) => cb(...args));
      return true;
    }),
  } as unknown as HooksStatic;
}

// cache.ts registers its Hooks.on listener as a module-load side effect, so
// the mock must exist before the (single) import below.
mockHooks();
const { TtlCache, documentCache, LIST_CACHE_PREFIX, DOC_CACHE_PREFIX } = await import('./cache');

describe('TtlCache', () => {
  it('caches a value until the TTL expires', async () => {
    vi.useFakeTimers();
    const start = 1_700_000_000_000;
    vi.setSystemTime(start);

    const cache = new TtlCache();
    const fetcher = vi.fn(async () => 'value-1');
    await expect(cache.getOrFetch('k', 1000, fetcher)).resolves.toBe('value-1');
    await expect(cache.getOrFetch('k', 1000, fetcher)).resolves.toBe('value-1');
    expect(fetcher).toHaveBeenCalledTimes(1);

    vi.setSystemTime(start + 1001);
    fetcher.mockResolvedValue('value-2');
    await expect(cache.getOrFetch('k', 1000, fetcher)).resolves.toBe('value-2');
    expect(fetcher).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('dedupes concurrent in-flight fetches for the same key', async () => {
    const cache = new TtlCache();
    let resolveFetch!: (value: string) => void;
    const fetcher = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const first = cache.getOrFetch('k', 1000, fetcher);
    const second = cache.getOrFetch('k', 1000, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);

    resolveFetch('value');
    await expect(first).resolves.toBe('value');
    await expect(second).resolves.toBe('value');
  });

  it('does not cache a rejected fetch', async () => {
    const cache = new TtlCache();
    const fetcher = vi.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce('ok');
    await expect(cache.getOrFetch('k', 1000, fetcher)).rejects.toThrow('fail');
    await expect(cache.getOrFetch('k', 1000, fetcher)).resolves.toBe('ok');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('invalidate() drops every key sharing a prefix, leaving others untouched', async () => {
    const cache = new TtlCache();
    await cache.getOrFetch('list:a', 1000, async () => 1);
    await cache.getOrFetch('doc:x', 1000, async () => 3);

    cache.invalidate('list:');

    const listFetcher = vi.fn(async () => 99);
    await cache.getOrFetch('list:a', 1000, listFetcher);
    expect(listFetcher).toHaveBeenCalledTimes(1); // re-fetched — was invalidated

    const docFetcher = vi.fn(async () => 100);
    await cache.getOrFetch('doc:x', 1000, docFetcher);
    expect(docFetcher).not.toHaveBeenCalled(); // untouched, still cached
  });
});

describe('socket-driven invalidation', () => {
  it('drops the matching document and every list entry when a socket event names a documentId', async () => {
    documentCache.clear();
    await documentCache.getOrFetch(`${DOC_CACHE_PREFIX}doc-1`, 60_000, async () => 'detail');
    await documentCache.getOrFetch(`${LIST_CACHE_PREFIX}q`, 30_000, async () => 'list');

    Hooks.callAll('atlas-foundry.socketEvent', 'foundry:notification', { documentId: 'doc-1' });

    const docFetcher = vi.fn(async () => 'detail-2');
    const listFetcher = vi.fn(async () => 'list-2');
    await expect(documentCache.getOrFetch(`${DOC_CACHE_PREFIX}doc-1`, 60_000, docFetcher)).resolves.toBe('detail-2');
    await expect(documentCache.getOrFetch(`${LIST_CACHE_PREFIX}q`, 30_000, listFetcher)).resolves.toBe('list-2');
    expect(docFetcher).toHaveBeenCalledTimes(1);
    expect(listFetcher).toHaveBeenCalledTimes(1);
  });

  it('ignores socket events without a documentId', async () => {
    documentCache.clear();
    await documentCache.getOrFetch(`${LIST_CACHE_PREFIX}q`, 30_000, async () => 'list');

    Hooks.callAll('atlas-foundry.socketEvent', 'foundry:something-else', { foo: 'bar' });

    const listFetcher = vi.fn(async () => 'should-not-run');
    await expect(documentCache.getOrFetch(`${LIST_CACHE_PREFIX}q`, 30_000, listFetcher)).resolves.toBe('list');
    expect(listFetcher).not.toHaveBeenCalled();
  });
});

describe('TtlCache generation guard', () => {
  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => (resolve = r));
    return { promise, resolve };
  }

  it('does not store a fetch result that finished after clear()', async () => {
    const cache = new TtlCache();
    const slow = deferred<string>();
    const first = cache.getOrFetch('k', 60_000, () => slow.promise);
    cache.clear();
    slow.resolve('stale');
    await first;

    const fetcher = vi.fn(async () => 'fresh');
    expect(await cache.getOrFetch('k', 60_000, fetcher)).toBe('fresh');
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('does not store a fetch result that finished after invalidate(prefix)', async () => {
    const cache = new TtlCache();
    const slow = deferred<string>();
    const first = cache.getOrFetch('list:a', 60_000, () => slow.promise);
    cache.invalidate('list:');
    slow.resolve('stale');
    await first;

    const fetcher = vi.fn(async () => 'fresh');
    expect(await cache.getOrFetch('list:a', 60_000, fetcher)).toBe('fresh');
  });

  it('still caches when nothing was cleared in between', async () => {
    const cache = new TtlCache();
    await cache.getOrFetch('k', 60_000, async () => 'v');
    const fetcher = vi.fn(async () => 'other');
    expect(await cache.getOrFetch('k', 60_000, fetcher)).toBe('v');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
