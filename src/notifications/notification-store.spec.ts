import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AtlasMessage } from '../atlas-types';

/**
 * Reinstalled fresh in every `beforeEach` (not once at module scope) — each
 * test's `NotificationStore` registers its own `setInterval`-backed polling
 * hook, and a shared/leftover Hooks registry across tests would keep every
 * previous test's store (and its still-ticking poll timer) alive and
 * reacting to this test's `Hooks.callAll()`, wildly inflating call counts.
 */
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

function mockGame() {
  globalThis.game = {
    i18n: { lang: 'en', localize: (key: string) => key, format: (key: string) => key },
  } as unknown as Game;
  globalThis.ui = { notifications: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } } as unknown as Ui;
}

vi.mock('../auth/auth-manager', () => ({
  authManager: { isLinked: vi.fn(() => true) },
}));
vi.mock('../socket/atlas-socket', () => ({
  atlasSocket: { getStatus: vi.fn(() => 'connected') },
}));
vi.mock('../settings', () => ({
  getQuietMode: vi.fn(() => false),
}));
vi.mock('./notifications-api', () => ({
  listMessages: vi.fn(),
  fetchUnreadCount: vi.fn(),
  markMessageRead: vi.fn(),
  dismissMessage: vi.fn(),
}));

const { authManager } = await import('../auth/auth-manager');
const { atlasSocket } = await import('../socket/atlas-socket');
const { getQuietMode } = await import('../settings');
const { listMessages, fetchUnreadCount, markMessageRead, dismissMessage } = await import('./notifications-api');
const { NotificationStore } = await import('./notification-store');

function makeMessage(over: Partial<AtlasMessage> = {}): AtlasMessage {
  return {
    id: 'm1',
    campaignId: 'camp-1',
    senderId: 's1',
    recipientId: 'u1',
    type: 'notification',
    body: '',
    channels: [],
    kind: 'gm-announcement',
    folder: 'notifications',
    isRead: false,
    createdAt: new Date().toISOString(),
    ...over,
  };
}

describe('NotificationStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockHooks();
    mockGame();
    vi.mocked(authManager.isLinked).mockReturnValue(true);
    vi.mocked(atlasSocket.getStatus).mockReturnValue('connected');
    vi.mocked(getQuietMode).mockReturnValue(false);
    vi.mocked(listMessages).mockReset().mockResolvedValue([]);
    vi.mocked(fetchUnreadCount).mockReset().mockResolvedValue(0);
    vi.mocked(markMessageRead).mockReset();
    vi.mocked(dismissMessage).mockReset();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function freshStore() {
    return new NotificationStore();
  }

  it('performs an initial sync on start() when already linked', async () => {
    vi.mocked(fetchUnreadCount).mockResolvedValue(2);
    vi.mocked(listMessages).mockResolvedValue([makeMessage()]);
    const store = freshStore();

    store.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(store.getState()).toEqual({ items: [makeMessage()], unreadCount: 2, status: 'idle' });
  });

  it('does not sync on start() when not linked', async () => {
    vi.mocked(authManager.isLinked).mockReturnValue(false);
    const store = freshStore();
    store.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(listMessages).not.toHaveBeenCalled();
  });

  it('resyncs and shows a toast on a notification:new wakeup, unless quietMode is on', async () => {
    const store = freshStore();
    store.start();
    await vi.advanceTimersByTimeAsync(0);
    vi.mocked(fetchUnreadCount).mockResolvedValue(1);
    vi.mocked(listMessages).mockResolvedValue([makeMessage()]);

    Hooks.callAll('atlas-foundry.socketEvent', 'notification:new', { messageId: 'm1', campaignId: 'camp-1', subject: 'Hello' });
    await vi.advanceTimersByTimeAsync(0);

    expect(store.getState().unreadCount).toBe(1);
    expect(ui.notifications.info).toHaveBeenCalledTimes(1);

    vi.mocked(getQuietMode).mockReturnValue(true);
    Hooks.callAll('atlas-foundry.socketEvent', 'notification:new', { messageId: 'm2', campaignId: 'camp-1', subject: 'Quiet' });
    await vi.advanceTimersByTimeAsync(0);
    expect(ui.notifications.info).toHaveBeenCalledTimes(1); // still 1 — suppressed while quiet
  });

  it('ignores unrelated socket events', async () => {
    const store = freshStore();
    store.start();
    await vi.advanceTimersByTimeAsync(0);
    vi.mocked(listMessages).mockClear();

    Hooks.callAll('atlas-foundry.socketEvent', 'foundry:something-else', { foo: 'bar' });
    await vi.advanceTimersByTimeAsync(0);
    expect(listMessages).not.toHaveBeenCalled();
  });

  it('resets state when auth becomes inactive, resyncs when it becomes active', async () => {
    vi.mocked(authManager.isLinked).mockReturnValue(false);
    const store = freshStore();
    store.start();
    await vi.advanceTimersByTimeAsync(0);

    vi.mocked(authManager.isLinked).mockReturnValue(true);
    vi.mocked(fetchUnreadCount).mockResolvedValue(5);
    vi.mocked(listMessages).mockResolvedValue([makeMessage()]);
    Hooks.callAll('atlas-foundry.authChanged', { state: 'active' });
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getState().unreadCount).toBe(5);

    Hooks.callAll('atlas-foundry.authChanged', { state: 'loggedOut' });
    expect(store.getState()).toEqual({ items: [], unreadCount: 0, status: 'idle' });
  });

  it('polls every 10 minutes while the socket is connected, every 3 minutes while degraded', async () => {
    vi.mocked(atlasSocket.getStatus).mockReturnValue('connected');
    const store = freshStore();
    store.start();
    await vi.advanceTimersByTimeAsync(0);
    vi.mocked(listMessages).mockClear();

    await vi.advanceTimersByTimeAsync(9 * 60_000);
    expect(listMessages).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1 * 60_000 + 1);
    expect(listMessages).toHaveBeenCalledTimes(1);

    vi.mocked(atlasSocket.getStatus).mockReturnValue('degraded');
    Hooks.callAll('atlas-foundry.socketStatusChanged', 'degraded');
    vi.mocked(listMessages).mockClear();

    await vi.advanceTimersByTimeAsync(2 * 60_000);
    expect(listMessages).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1 * 60_000 + 1);
    expect(listMessages).toHaveBeenCalledTimes(1);
  });

  it('markRead optimistically flips isRead and decrements unreadCount, committing on success', async () => {
    vi.mocked(fetchUnreadCount).mockResolvedValue(1);
    vi.mocked(listMessages).mockResolvedValue([makeMessage({ isRead: false })]);
    const store = freshStore();
    store.start();
    await vi.advanceTimersByTimeAsync(0);

    vi.mocked(markMessageRead).mockResolvedValue(makeMessage({ isRead: true }));
    await store.markRead('m1');

    expect(store.getState().items[0]?.isRead).toBe(true);
    expect(store.getState().unreadCount).toBe(0);
  });

  it('markRead rolls back on API failure', async () => {
    vi.mocked(fetchUnreadCount).mockResolvedValue(1);
    vi.mocked(listMessages).mockResolvedValue([makeMessage({ isRead: false })]);
    const store = freshStore();
    store.start();
    await vi.advanceTimersByTimeAsync(0);

    vi.mocked(markMessageRead).mockRejectedValue(new Error('network'));
    await store.markRead('m1');

    expect(store.getState().items[0]?.isRead).toBe(false);
    expect(store.getState().unreadCount).toBe(1);
  });

  it('dismiss optimistically removes the item and rolls back at the same index on failure', async () => {
    const a = makeMessage({ id: 'a', isRead: false });
    const b = makeMessage({ id: 'b', isRead: true });
    vi.mocked(fetchUnreadCount).mockResolvedValue(1);
    vi.mocked(listMessages).mockResolvedValue([a, b]);
    const store = freshStore();
    store.start();
    await vi.advanceTimersByTimeAsync(0);

    vi.mocked(dismissMessage).mockRejectedValue(new Error('network'));
    await store.dismiss('a');

    expect(store.getState().items.map((m: any) => m.id)).toEqual(['a', 'b']); // rolled back
    expect(store.getState().unreadCount).toBe(1);
  });

  it('dismiss commits removal on success', async () => {
    const a = makeMessage({ id: 'a', isRead: false });
    vi.mocked(fetchUnreadCount).mockResolvedValue(1);
    vi.mocked(listMessages).mockResolvedValue([a]);
    const store = freshStore();
    store.start();
    await vi.advanceTimersByTimeAsync(0);

    vi.mocked(dismissMessage).mockResolvedValue(makeMessage({ id: 'a', dismissedFromSlider: true }));
    await store.dismiss('a');

    expect(store.getState().items).toEqual([]);
    expect(store.getState().unreadCount).toBe(0);
  });
});
