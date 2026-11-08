import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../auth/auth-manager', () => ({
  authManager: { getLinkedCampaignId: vi.fn(() => 'camp-1') },
}));
vi.mock('../api/client', () => ({ request: vi.fn() }));

const { authManager } = await import('../auth/auth-manager');
const { request } = await import('../api/client');
const { listMessages, fetchUnreadCount, markMessageRead, dismissMessage } = await import('./notifications-api');
const { AtlasAuthError } = await import('../api/errors');

describe('listMessages', () => {
  beforeEach(() => {
    vi.mocked(request).mockReset();
    vi.mocked(authManager.getLinkedCampaignId).mockReturnValue('camp-1');
  });

  it('hits the same route the web frontend uses, with query params', async () => {
    vi.mocked(request).mockResolvedValue([{ id: 'm1' }]);
    const result = await listMessages({ unread: true, limit: 10 });
    expect(result).toEqual([{ id: 'm1' }]);
    expect(request).toHaveBeenCalledWith('/campaigns/camp-1/messages?unread=true&limit=10', expect.anything());
  });

  it('omits empty params from the query string', async () => {
    vi.mocked(request).mockResolvedValue([]);
    await listMessages({});
    expect(request).toHaveBeenCalledWith('/campaigns/camp-1/messages', expect.anything());
  });

  it('throws AtlasAuthError without calling request() when no campaign is linked', async () => {
    vi.mocked(authManager.getLinkedCampaignId).mockReturnValue(null as any);
    await expect(listMessages({})).rejects.toBeInstanceOf(AtlasAuthError);
    expect(request).not.toHaveBeenCalled();
  });
});

describe('fetchUnreadCount', () => {
  beforeEach(() => {
    vi.mocked(request).mockReset();
    vi.mocked(authManager.getLinkedCampaignId).mockReturnValue('camp-1');
  });

  it('unwraps the count field', async () => {
    vi.mocked(request).mockResolvedValue({ count: 3 });
    await expect(fetchUnreadCount()).resolves.toBe(3);
    expect(request).toHaveBeenCalledWith('/campaigns/camp-1/messages/unread-count', expect.anything());
  });
});

describe('markMessageRead / dismissMessage', () => {
  beforeEach(() => {
    vi.mocked(request).mockReset();
    vi.mocked(authManager.getLinkedCampaignId).mockReturnValue('camp-1');
  });

  it('PATCHes the read endpoint', async () => {
    vi.mocked(request).mockResolvedValue({ id: 'm1', isRead: true });
    const result = await markMessageRead('m1');
    expect(result).toEqual({ id: 'm1', isRead: true });
    expect(request).toHaveBeenCalledWith('/campaigns/camp-1/messages/m1/read', { method: 'PATCH' });
  });

  it('PATCHes the dismiss endpoint', async () => {
    vi.mocked(request).mockResolvedValue({ id: 'm1', dismissedFromSlider: true });
    const result = await dismissMessage('m1');
    expect(result).toEqual({ id: 'm1', dismissedFromSlider: true });
    expect(request).toHaveBeenCalledWith('/campaigns/camp-1/messages/m1/dismiss', { method: 'PATCH' });
  });
});
