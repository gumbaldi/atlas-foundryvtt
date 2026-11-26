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
const { fetchDiaryInvitation, refreshDiaryInvitation } = await import('./diary-api');
const { AtlasAuthError, AtlasNotFoundError, AtlasServerError } = await import('../api/errors');

const INVITATION = { sessionLog: { id: 'log-1', name: 'Into the Fog' }, hasDiaryEntry: false };

beforeEach(() => {
  documentCache.clear();
  vi.mocked(request).mockReset();
  vi.mocked(authManager.getLinkedCampaignId).mockReturnValue('camp-1');
});

describe('fetchDiaryInvitation', () => {
  it('asks the diary invitation route of the linked campaign', async () => {
    vi.mocked(request).mockResolvedValue(INVITATION);
    await expect(fetchDiaryInvitation()).resolves.toEqual(INVITATION);
    expect(request).toHaveBeenCalledWith('/foundry/campaigns/camp-1/diary/invitation', expect.anything());
  });

  it('caches for 30 s', async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(request).mockResolvedValue(INVITATION);
      await fetchDiaryInvitation();
      await fetchDiaryInvitation();
      expect(request).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(31_000);
      await fetchDiaryInvitation();
      expect(request).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('resolves to null on AtlasNotFoundError (route missing)', async () => {
    vi.mocked(request).mockRejectedValue(new AtlasNotFoundError('/x'));
    await expect(fetchDiaryInvitation()).resolves.toBeNull();
  });

  it('propagates other errors', async () => {
    vi.mocked(request).mockRejectedValue(new AtlasServerError('/x', 500));
    await expect(fetchDiaryInvitation()).rejects.toBeInstanceOf(AtlasServerError);
  });

  it('throws AtlasAuthError without calling request() when no campaign is linked', async () => {
    vi.mocked(authManager.getLinkedCampaignId).mockReturnValue(null as any);
    await expect(fetchDiaryInvitation()).rejects.toBeInstanceOf(AtlasAuthError);
    expect(request).not.toHaveBeenCalled();
  });
});

describe('refreshDiaryInvitation', () => {
  it('bypasses the cache and re-fetches', async () => {
    const v2 = { sessionLog: { id: 'log-2', name: 'Next' }, hasDiaryEntry: false };
    vi.mocked(request).mockResolvedValueOnce(INVITATION).mockResolvedValueOnce(v2);

    await fetchDiaryInvitation();
    await expect(refreshDiaryInvitation()).resolves.toEqual(v2);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('throws AtlasAuthError without a linked campaign', async () => {
    vi.mocked(authManager.getLinkedCampaignId).mockReturnValue(null as any);
    await expect(refreshDiaryInvitation()).rejects.toBeInstanceOf(AtlasAuthError);
  });
});
