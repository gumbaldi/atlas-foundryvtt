import { beforeEach, describe, expect, it, vi } from 'vitest';

function mockHooks() {
  globalThis.Hooks = {
    on: vi.fn(),
    once: vi.fn(),
    off: vi.fn(),
    callAll: vi.fn(),
  } as unknown as HooksStatic;
}
mockHooks(); // link-visibility.ts pulls in api/cache.ts, which registers a Hooks.on listener at import time

vi.mock('../auth/auth-manager', () => ({
  authManager: { getLinkedCampaignId: vi.fn(() => 'camp-1') },
}));
vi.mock('../api/client', () => ({ request: vi.fn() }));

const { authManager } = await import('../auth/auth-manager');
const { request } = await import('../api/client');
const { LinkVisibilityChecker } = await import('./link-visibility');

describe('LinkVisibilityChecker', () => {
  beforeEach(() => {
    vi.mocked(request).mockReset();
    vi.mocked(authManager.getLinkedCampaignId).mockReturnValue('camp-1');
  });

  it('batches concurrent check() calls issued within the debounce window into a single request', async () => {
    vi.useFakeTimers();
    vi.mocked(request).mockResolvedValue({ visible: [{ documentId: 'd1', moduleType: 'characters', name: 'Aria' }] });

    const checker = new LinkVisibilityChecker();
    const p1 = checker.check([{ documentId: 'd1', moduleType: 'characters' }]);
    const p2 = checker.check([{ documentId: 'd2', moduleType: 'characters' }]);

    await vi.advanceTimersByTimeAsync(250);
    const [r1, r2] = await Promise.all([p1, p2]);

    expect(request).toHaveBeenCalledTimes(1);
    expect(r1.isVisible({ documentId: 'd1', moduleType: 'characters' })).toBe(true);
    expect(r1.nameFor({ documentId: 'd1', moduleType: 'characters' })).toBe('Aria');
    expect(r2.isVisible({ documentId: 'd2', moduleType: 'characters' })).toBe(false);
    expect(r2.failed).toBe(false);

    vi.useRealTimers();
  });

  it('caches a positive result for the TTL without re-fetching', async () => {
    vi.useFakeTimers();
    vi.mocked(request).mockResolvedValue({ visible: [{ documentId: 'd1', moduleType: 'characters', name: 'Aria' }] });
    const checker = new LinkVisibilityChecker();

    const first = checker.check([{ documentId: 'd1', moduleType: 'characters' }]);
    await vi.advanceTimersByTimeAsync(250);
    await first;
    expect(request).toHaveBeenCalledTimes(1);

    const second = await checker.check([{ documentId: 'd1', moduleType: 'characters' }]);
    expect(request).toHaveBeenCalledTimes(1);
    expect(second.isVisible({ documentId: 'd1', moduleType: 'characters' })).toBe(true);

    vi.useRealTimers();
  });

  it('caches a negative result too, so a repeated miss stays cheap', async () => {
    vi.useFakeTimers();
    vi.mocked(request).mockResolvedValue({ visible: [] });
    const checker = new LinkVisibilityChecker();

    const first = checker.check([{ documentId: 'gone', moduleType: 'characters' }]);
    await vi.advanceTimersByTimeAsync(250);
    await first;
    expect(request).toHaveBeenCalledTimes(1);

    const second = await checker.check([{ documentId: 'gone', moduleType: 'characters' }]);
    expect(request).toHaveBeenCalledTimes(1);
    expect(second.isVisible({ documentId: 'gone', moduleType: 'characters' })).toBe(false);
    expect(second.failed).toBe(false);

    vi.useRealTimers();
  });

  it('does not cache a failed request, and reports failed=true instead of treating it as "not visible"', async () => {
    vi.useFakeTimers();
    vi.mocked(request).mockRejectedValue(new Error('network down'));
    const checker = new LinkVisibilityChecker();

    const first = checker.check([{ documentId: 'd1', moduleType: 'characters' }]);
    await vi.advanceTimersByTimeAsync(250);
    const result = await first;
    expect(result.failed).toBe(true);
    expect(result.isVisible({ documentId: 'd1', moduleType: 'characters' })).toBe(false);

    vi.mocked(request).mockResolvedValue({ visible: [{ documentId: 'd1', moduleType: 'characters', name: 'Aria' }] });
    const second = checker.check([{ documentId: 'd1', moduleType: 'characters' }]);
    await vi.advanceTimersByTimeAsync(250);
    const result2 = await second;
    expect(result2.isVisible({ documentId: 'd1', moduleType: 'characters' })).toBe(true);
    expect(request).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('splits more than 100 refs into multiple requests (backend DTO limit)', async () => {
    vi.useFakeTimers();
    vi.mocked(request).mockImplementation(async (_path: string, opts: any) => {
      const refs = opts.body.refs as Array<{ documentId: string }>;
      return { visible: refs.map((r) => ({ documentId: r.documentId, moduleType: 'characters', name: r.documentId })) };
    });

    const checker = new LinkVisibilityChecker();
    const refs = Array.from({ length: 150 }, (_, i) => ({ documentId: `d${i}`, moduleType: 'characters' }));
    const resultPromise = checker.check(refs);
    await vi.advanceTimersByTimeAsync(250);
    const result = await resultPromise;

    expect(request).toHaveBeenCalledTimes(2);
    expect(result.isVisible({ documentId: 'd0', moduleType: 'characters' })).toBe(true);
    expect(result.isVisible({ documentId: 'd149', moduleType: 'characters' })).toBe(true);

    vi.useRealTimers();
  });

  it('isVisible() wraps a single ref with a plain {visible, name, failed} shape', async () => {
    vi.useFakeTimers();
    vi.mocked(request).mockResolvedValue({ visible: [{ documentId: 'd1', moduleType: 'characters', name: 'Aria' }] });
    const checker = new LinkVisibilityChecker();

    const resultPromise = checker.isVisible({ documentId: 'd1', moduleType: 'characters' });
    await vi.advanceTimersByTimeAsync(250);
    const result = await resultPromise;
    expect(result).toEqual({ visible: true, name: 'Aria', failed: false });

    vi.useRealTimers();
  });

  it('fails without calling request() when no campaign is linked', async () => {
    vi.useFakeTimers();
    vi.mocked(authManager.getLinkedCampaignId).mockReturnValue(null as any);
    const checker = new LinkVisibilityChecker();

    const resultPromise = checker.check([{ documentId: 'd1', moduleType: 'characters' }]);
    await vi.advanceTimersByTimeAsync(250);
    const result = await resultPromise;
    expect(result.failed).toBe(true);
    expect(request).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});
