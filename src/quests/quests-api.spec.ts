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
const { fetchQuests, refreshQuests } = await import('./quests-api');
const { AtlasAuthError } = await import('../api/errors');

describe('fetchQuests', () => {
  beforeEach(() => {
    documentCache.clear();
    vi.mocked(request).mockReset();
    vi.mocked(authManager.getLinkedCampaignId).mockReturnValue('camp-1');
  });

  it('builds the query string against the linked campaign and caches by full path', async () => {
    const response = { quests: [], refs: { characters: [], locations: [] } };
    vi.mocked(request).mockResolvedValue(response);

    const result = await fetchQuests({ status: 'open', limit: 50 });
    expect(result).toEqual(response);
    expect(request).toHaveBeenCalledWith('/foundry/campaigns/camp-1/quests?status=open&limit=50', expect.anything());

    await fetchQuests({ status: 'open', limit: 50 });
    expect(request).toHaveBeenCalledTimes(1); // second call served from cache
  });

  it('omits empty params from the query string', async () => {
    vi.mocked(request).mockResolvedValue({ quests: [], refs: { characters: [], locations: [] } });
    await fetchQuests({});
    expect(request).toHaveBeenCalledWith('/foundry/campaigns/camp-1/quests', expect.anything());
  });

  it('throws AtlasAuthError without calling request() when no campaign is linked', async () => {
    vi.mocked(authManager.getLinkedCampaignId).mockReturnValue(null as any);
    await expect(fetchQuests({})).rejects.toBeInstanceOf(AtlasAuthError);
    expect(request).not.toHaveBeenCalled();
  });
});

describe('refreshQuests', () => {
  beforeEach(() => {
    documentCache.clear();
    vi.mocked(request).mockReset();
    vi.mocked(authManager.getLinkedCampaignId).mockReturnValue('camp-1');
  });

  it('bypasses the cache and re-fetches', async () => {
    const v1 = { quests: [{ id: 'q1' }], refs: { characters: [], locations: [] } };
    const v2 = { quests: [{ id: 'q1' }, { id: 'q2' }], refs: { characters: [], locations: [] } };
    vi.mocked(request).mockResolvedValueOnce(v1).mockResolvedValueOnce(v2);

    await fetchQuests({});
    const refreshed = await refreshQuests({});
    expect(refreshed).toEqual(v2);
    expect(request).toHaveBeenCalledTimes(2);

    await fetchQuests({});
    expect(request).toHaveBeenCalledTimes(2); // the refreshed value is cached again
  });
});
