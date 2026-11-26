import { beforeEach, describe, expect, it, vi } from 'vitest';

function mockHooks() {
  globalThis.Hooks = {
    on: vi.fn(),
    once: vi.fn(),
    off: vi.fn(),
    callAll: vi.fn(),
  } as unknown as HooksStatic;
}
mockHooks(); // cache.ts registers a Hooks.on listener at import time

vi.mock('../auth/auth-manager', () => ({
  authManager: { getLinkedCampaignId: vi.fn(() => 'camp-1') },
}));
vi.mock('../api/client', () => ({ request: vi.fn() }));

const { authManager } = await import('../auth/auth-manager');
const { request } = await import('../api/client');
const { documentCache } = await import('../api/cache');
const { fetchDeadlineOverview, refreshDeadlineOverview } = await import('./deadlines-api');
const { AtlasAuthError, AtlasNotFoundError, AtlasServerError } = await import('../api/errors');

const OVERVIEW = { groups: [] };

describe('fetchDeadlineOverview', () => {
  beforeEach(() => {
    documentCache.clear();
    vi.mocked(request).mockReset();
    vi.mocked(authManager.getLinkedCampaignId).mockReturnValue('camp-1');
  });

  it('builds the path without refs', async () => {
    vi.mocked(request).mockResolvedValue(OVERVIEW);
    await fetchDeadlineOverview([]);
    expect(request).toHaveBeenCalledWith('/foundry/campaigns/camp-1/deadlines/overview', expect.anything());
  });

  it('builds the path with refs', async () => {
    vi.mocked(request).mockResolvedValue(OVERVIEW);
    await fetchDeadlineOverview([
      { documentId: 'a', moduleType: 'characters' },
      { documentId: 'b', moduleType: 'locations' },
    ]);
    expect(request).toHaveBeenCalledWith(
      `/foundry/campaigns/camp-1/deadlines/overview?refs=${encodeURIComponent('characters:a,locations:b')}`,
      expect.anything(),
    );
  });

  it('caches for 30 s', async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(request).mockResolvedValue(OVERVIEW);
      await fetchDeadlineOverview([]);
      await fetchDeadlineOverview([]);
      expect(request).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(31_000);
      await fetchDeadlineOverview([]);
      expect(request).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('resolves to null on AtlasNotFoundError', async () => {
    vi.mocked(request).mockRejectedValue(new AtlasNotFoundError('/x'));
    await expect(fetchDeadlineOverview([])).resolves.toBeNull();
  });

  it('propagates other errors', async () => {
    vi.mocked(request).mockRejectedValue(new AtlasServerError('/x', 500));
    await expect(fetchDeadlineOverview([])).rejects.toBeInstanceOf(AtlasServerError);
  });

  it('throws AtlasAuthError without calling request() when no campaign is linked', async () => {
    vi.mocked(authManager.getLinkedCampaignId).mockReturnValue(null as any);
    await expect(fetchDeadlineOverview([])).rejects.toBeInstanceOf(AtlasAuthError);
    expect(request).not.toHaveBeenCalled();
  });
});

describe('refreshDeadlineOverview', () => {
  beforeEach(() => {
    documentCache.clear();
    vi.mocked(request).mockReset();
    vi.mocked(authManager.getLinkedCampaignId).mockReturnValue('camp-1');
  });

  it('bypasses the cache and re-fetches', async () => {
    const v2 = { groups: [{ source: 'selected' }] };
    vi.mocked(request).mockResolvedValueOnce(OVERVIEW).mockResolvedValueOnce(v2);

    await fetchDeadlineOverview([]);
    const refreshed = await refreshDeadlineOverview([]);
    expect(refreshed).toEqual(v2);
    expect(request).toHaveBeenCalledTimes(2);
  });
});
