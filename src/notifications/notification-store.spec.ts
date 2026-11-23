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
  authManager: { isLinked: vi.fn(() => true), getSessionEpoch: vi.fn(() => 0) },
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
    vi.mocked(authManager.getSessionEpoch).mockReturnValue(0);
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

  it('resyncs exactly once on a notification:new wakeup', async () => {
    const store = freshStore();
    store.start();
    await vi.advanceTimersByTimeAsync(0);
    vi.mocked(fetchUnreadCount).mockResolvedValue(1);
    vi.mocked(listMessages).mockClear();
    vi.mocked(listMessages).mockResolvedValue([makeMessage()]);

    Hooks.callAll('atlas-foundry.socketEvent', 'notification:new', { messageId: 'm1', campaignId: 'camp-1', subject: 'Hello' });
    await vi.advanceTimersByTimeAsync(0);

    expect(store.getState().unreadCount).toBe(1);
    expect(listMessages).toHaveBeenCalledTimes(1);
    expect(ui.notifications.info).not.toHaveBeenCalled();
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

  it('drops a resync answer that arrives after sign-out', async () => {
    let resolveList!: (items: AtlasMessage[]) => void;
    vi.mocked(listMessages).mockReturnValue(new Promise((resolve) => (resolveList = resolve)));
    vi.mocked(fetchUnreadCount).mockResolvedValue(3);

    const store = freshStore();
    store.start();
    await vi.advanceTimersByTimeAsync(0);

    // Sign out while the list request is still pending.
    vi.mocked(authManager.getSessionEpoch).mockReturnValue(1);
    vi.mocked(authManager.isLinked).mockReturnValue(false);
    Hooks.callAll('atlas-foundry.authChanged', { state: 'loggedOut' });

    resolveList([makeMessage()]);
    await vi.advanceTimersByTimeAsync(0);

    expect(store.getState().items).toEqual([]);
    expect(store.getState().unreadCount).toBe(0);
  });

  describe('markAllUnreadRead', () => {
    const page = (count: number, startAt = 0) =>
      Array.from({ length: count }, (_, i) =>
        makeMessage({ id: `m${startAt + i}`, createdAt: new Date(Date.UTC(2026, 0, 1) - (startAt + i) * 60_000).toISOString() }),
      );

    beforeEach(() => {
      vi.mocked(markMessageRead).mockResolvedValue(makeMessage({ isRead: true }));
    });

    it('pages through every unread notification, then resyncs', async () => {
      const first = page(45);
      vi.mocked(listMessages).mockReset().mockResolvedValueOnce(first).mockResolvedValueOnce([]).mockResolvedValue([]);

      const store = freshStore();
      await store.markAllUnreadRead();

      expect(markMessageRead).toHaveBeenCalledTimes(45);
      expect(listMessages).toHaveBeenNthCalledWith(1, { unread: true, limit: 100, cursor: undefined });
      expect(listMessages).toHaveBeenNthCalledWith(2, { unread: true, limit: 100, cursor: first[44]!.createdAt });
      // The final resync fetches the plain list + unread count.
      expect(fetchUnreadCount).toHaveBeenCalled();
    });

    it('does nothing but resync when there is nothing unread', async () => {
      vi.mocked(listMessages).mockReset().mockResolvedValue([]);

      const store = freshStore();
      await store.markAllUnreadRead();

      expect(markMessageRead).not.toHaveBeenCalled();
      expect(fetchUnreadCount).toHaveBeenCalledOnce();
    });

    it('stops after 20 pages when the server keeps returning full pages', async () => {
      vi.mocked(listMessages).mockReset().mockImplementation(async () => page(100));

      const store = freshStore();
      await store.markAllUnreadRead();

      // 20 paging requests + 1 for the final resync's list.
      expect(vi.mocked(listMessages).mock.calls.filter(([params]) => params?.unread).length).toBe(20);
    });

    it('keeps going when one item fails and reports a single error', async () => {
      vi.mocked(listMessages).mockReset().mockResolvedValueOnce(page(3)).mockResolvedValue([]);
      vi.mocked(markMessageRead).mockRejectedValueOnce(new Error('boom')).mockResolvedValue(makeMessage({ isRead: true }));

      const store = freshStore();
      await store.markAllUnreadRead();

      expect(markMessageRead).toHaveBeenCalledTimes(3);
      expect(ui.notifications.error).toHaveBeenCalledOnce();
    });
  });

  it('polls every 10 minutes while the socket is connected, every 30 seconds while degraded or disconnected', async () => {
    vi.mocked(atlasSocket.getStatus).mockReturnValue('connected');
    const store = freshStore();
    store.start();
    await vi.advanceTimersByTimeAsync(0);
    vi.mocked(listMessages).mockClear();

    await vi.advanceTimersByTimeAsync(9 * 60_000);
    expect(listMessages).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1 * 60_000 + 1);
    expect(listMessages).toHaveBeenCalledTimes(1);

    for (const status of ['degraded', 'disconnected'] as const) {
      vi.mocked(atlasSocket.getStatus).mockReturnValue(status);
      Hooks.callAll('atlas-foundry.socketStatusChanged', status);
      vi.mocked(listMessages).mockClear();

      await vi.advanceTimersByTimeAsync(29_000);
      expect(listMessages).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1_000 + 1);
      expect(listMessages).toHaveBeenCalledTimes(1);
    }
  });

  describe('arrival detection', () => {
    function arrivedCalls() {
      return vi.mocked(Hooks.callAll).mock.calls.filter((c) => c[0] === 'atlas-foundry.notificationArrived');
    }

    it('seeds on the first sync, then emits each new unread message once', async () => {
      vi.mocked(listMessages).mockResolvedValue([makeMessage({ id: 'old' })]);
      const store = freshStore();
      store.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(arrivedCalls()).toHaveLength(0);

      const fresh = makeMessage({ id: 'new' });
      vi.mocked(listMessages).mockResolvedValue([fresh, makeMessage({ id: 'old' })]);
      await store.resync();
      expect(arrivedCalls()).toHaveLength(1);
      expect(arrivedCalls()[0]![1]).toEqual(fresh);

      await store.resync();
      expect(arrivedCalls()).toHaveLength(1);
    });

    it('seeds again after a reset (sign-out) and a later active resync', async () => {
      vi.mocked(listMessages).mockResolvedValue([makeMessage({ id: 'old' })]);
      const store = freshStore();
      store.start();
      await vi.advanceTimersByTimeAsync(0);

      Hooks.callAll('atlas-foundry.authChanged', { state: 'loggedOut' });
      vi.mocked(listMessages).mockResolvedValue([makeMessage({ id: 'old' }), makeMessage({ id: 'other' })]);
      Hooks.callAll('atlas-foundry.authChanged', { state: 'active' });
      await vi.advanceTimersByTimeAsync(0);

      expect(arrivedCalls()).toHaveLength(0);
    });

    it('emits arrivals after the state notification', async () => {
      const store = freshStore();
      store.start();
      await vi.advanceTimersByTimeAsync(0);
      vi.mocked(listMessages).mockResolvedValue([makeMessage({ id: 'new' })]);
      vi.mocked(Hooks.callAll).mockClear();

      await store.resync();
      const hooks = vi.mocked(Hooks.callAll).mock.calls.map((c) => c[0]);
      expect(hooks.lastIndexOf('atlas-foundry.notificationsChanged')).toBeLessThan(
        hooks.indexOf('atlas-foundry.notificationArrived'),
      );
    });
  });

  describe('quiet resync', () => {
    function changedCount() {
      return vi.mocked(Hooks.callAll).mock.calls.filter((c) => c[0] === 'atlas-foundry.notificationsChanged').length;
    }

    it('does not notify before the answer when items are loaded, and notifies once after a change', async () => {
      vi.mocked(listMessages).mockResolvedValue([makeMessage({ id: 'a' })]);
      const store = freshStore();
      store.start();
      await vi.advanceTimersByTimeAsync(0);

      let release!: (items: AtlasMessage[]) => void;
      vi.mocked(listMessages).mockReturnValue(new Promise((resolve) => (release = resolve)));
      vi.mocked(Hooks.callAll).mockClear();

      const pending = store.resync({ quiet: true });
      expect(changedCount()).toBe(0);
      expect(store.getState().status).toBe('idle');

      release([makeMessage({ id: 'a' }), makeMessage({ id: 'b' })]);
      await pending;
      expect(changedCount()).toBe(1);
    });

    it('does not notify at all when nothing changed', async () => {
      vi.mocked(listMessages).mockResolvedValue([makeMessage({ id: 'a' })]);
      const store = freshStore();
      store.start();
      await vi.advanceTimersByTimeAsync(0);
      vi.mocked(Hooks.callAll).mockClear();

      await store.resync({ quiet: true });
      expect(changedCount()).toBe(0);
    });

    it('the poll timer resyncs quietly', async () => {
      vi.mocked(atlasSocket.getStatus).mockReturnValue('degraded');
      vi.mocked(listMessages).mockResolvedValue([makeMessage({ id: 'a' })]);
      const store = freshStore();
      store.start();
      await vi.advanceTimersByTimeAsync(0);
      vi.mocked(Hooks.callAll).mockClear();

      await vi.advanceTimersByTimeAsync(30_000 + 1);
      expect(listMessages).toHaveBeenCalledTimes(2);
      expect(changedCount()).toBe(0);
    });
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
