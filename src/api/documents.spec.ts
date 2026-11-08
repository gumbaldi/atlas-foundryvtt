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
vi.mock('./client', () => ({ request: vi.fn() }));

const { authManager } = await import('../auth/auth-manager');
const { request } = await import('./client');
const { documentCache } = await import('./cache');
const { listDocuments, getDocument, refreshDocument } = await import('./documents');
const { AtlasAuthError, AtlasForbiddenError } = await import('./errors');

describe('listDocuments', () => {
  beforeEach(() => {
    documentCache.clear();
    vi.mocked(request).mockReset();
    vi.mocked(authManager.getLinkedCampaignId).mockReturnValue('camp-1');
  });

  it('builds the query string against the linked campaign and caches by full path', async () => {
    vi.mocked(request).mockResolvedValue([{ id: 'd1' }]);
    const result = await listDocuments({ q: 'dragon', moduleType: 'creatures', limit: 10 });
    expect(result).toEqual([{ id: 'd1' }]);
    expect(request).toHaveBeenCalledWith(
      '/foundry/campaigns/camp-1/user-documents?q=dragon&moduleType=creatures&limit=10',
      expect.anything(),
    );

    await listDocuments({ q: 'dragon', moduleType: 'creatures', limit: 10 });
    expect(request).toHaveBeenCalledTimes(1); // second call served from cache
  });

  it('omits empty params from the query string', async () => {
    vi.mocked(request).mockResolvedValue([]);
    await listDocuments({});
    expect(request).toHaveBeenCalledWith('/foundry/campaigns/camp-1/user-documents', expect.anything());
  });

  it('throws AtlasAuthError without calling request() when no campaign is linked', async () => {
    vi.mocked(authManager.getLinkedCampaignId).mockReturnValue(null);
    await expect(listDocuments({})).rejects.toBeInstanceOf(AtlasAuthError);
    expect(request).not.toHaveBeenCalled();
  });
});

describe('getDocument', () => {
  beforeEach(() => {
    documentCache.clear();
    vi.mocked(request).mockReset();
    vi.mocked(authManager.getLinkedCampaignId).mockReturnValue('camp-1');
  });

  it('fetches by moduleType/documentId and caches the result', async () => {
    vi.mocked(request).mockResolvedValue({ id: 'd1', name: 'Test' });
    const result = await getDocument('creatures', 'd1');
    expect(result).toEqual({ id: 'd1', name: 'Test' });
    expect(request).toHaveBeenCalledWith('/foundry/campaigns/camp-1/user-documents/creatures/d1', expect.anything());

    await getDocument('creatures', 'd1');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('evicts the cache entry on 403/404 so the next call re-fetches instead of staying stale', async () => {
    vi.mocked(request).mockRejectedValueOnce(new AtlasForbiddenError('/x'));
    await expect(getDocument('creatures', 'd1')).rejects.toBeInstanceOf(AtlasForbiddenError);

    vi.mocked(request).mockResolvedValueOnce({ id: 'd1', name: 'Now visible' });
    const result = await getDocument('creatures', 'd1');
    expect(result).toEqual({ id: 'd1', name: 'Now visible' });
    expect(request).toHaveBeenCalledTimes(2);
  });
});

describe('refreshDocument', () => {
  beforeEach(() => {
    documentCache.clear();
    vi.mocked(request).mockReset();
    vi.mocked(authManager.getLinkedCampaignId).mockReturnValue('camp-1');
  });

  it('bypasses the cache and re-fetches', async () => {
    vi.mocked(request).mockResolvedValueOnce({ id: 'd1', name: 'v1' }).mockResolvedValueOnce({ id: 'd1', name: 'v2' });

    await getDocument('creatures', 'd1');
    const refreshed = await refreshDocument('creatures', 'd1');
    expect(refreshed).toEqual({ id: 'd1', name: 'v2' });
    expect(request).toHaveBeenCalledTimes(2);
  });
});
