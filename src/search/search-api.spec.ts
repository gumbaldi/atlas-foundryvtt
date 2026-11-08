import { beforeEach, describe, expect, it, vi } from 'vitest';

function mockHooks() {
  globalThis.Hooks = {
    on: vi.fn(),
    once: vi.fn(),
    off: vi.fn(),
    callAll: vi.fn(),
  } as unknown as HooksStatic;
}
mockHooks(); // ../api/cache.ts registers a Hooks.on listener at import time

vi.mock('../auth/auth-manager', () => ({
  authManager: { getLinkedCampaignId: vi.fn(() => 'camp-1') },
}));
vi.mock('../api/client', () => ({ request: vi.fn() }));

const { authManager } = await import('../auth/auth-manager');
const { request } = await import('../api/client');
const { documentCache } = await import('../api/cache');
const { searchDocuments } = await import('./search-api');
const { AtlasAuthError } = await import('../api/errors');

describe('searchDocuments', () => {
  beforeEach(() => {
    documentCache.clear();
    vi.mocked(request).mockReset();
    vi.mocked(authManager.getLinkedCampaignId).mockReturnValue('camp-1');
  });

  it('builds the search path with q/types/nameOnly/limit and caches by the full path', async () => {
    vi.mocked(request).mockResolvedValue({ data: [], total: 0, page: 1, limit: 10, totalPages: 0 });
    await searchDocuments({ q: 'dragon', types: ['creatures', 'items'], nameOnly: true, limit: 10 });
    expect(request).toHaveBeenCalledWith(
      '/foundry/campaigns/camp-1/search?q=dragon&types=creatures%2Citems&nameOnly=true&limit=10',
      expect.anything(),
    );

    await searchDocuments({ q: 'dragon', types: ['creatures', 'items'], nameOnly: true, limit: 10 });
    expect(request).toHaveBeenCalledTimes(1); // second call served from cache
  });

  it('omits absent filters from the query string', async () => {
    vi.mocked(request).mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 });
    await searchDocuments({ q: 'bear' });
    expect(request).toHaveBeenCalledWith('/foundry/campaigns/camp-1/search?q=bear', expect.anything());
  });

  it('throws AtlasAuthError without calling request() when no campaign is linked', async () => {
    vi.mocked(authManager.getLinkedCampaignId).mockReturnValue(null);
    await expect(searchDocuments({ q: 'bear' })).rejects.toBeInstanceOf(AtlasAuthError);
    expect(request).not.toHaveBeenCalled();
  });
});
