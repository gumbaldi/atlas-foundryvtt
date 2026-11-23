import { log, notifyError } from '../log';
import { authManager } from '../auth/auth-manager';
import { atlasSocket } from '../socket/atlas-socket';
import { listMessages, fetchUnreadCount, markMessageRead, dismissMessage } from './notifications-api';
import { detectArrivals } from './notification-arrivals';
import type { AtlasMessage } from '../atlas-types';

export type NotificationStoreStatus = 'idle' | 'loading' | 'error';

export interface NotificationStoreState {
  items: AtlasMessage[];
  unreadCount: number;
  status: NotificationStoreStatus;
}

const LIST_LIMIT = 30;
// markAllUnreadRead pages through the unread set; a safety cap against a server that keeps returning items.
const MARK_ALL_PAGE_LIMIT = 100;
const MARK_ALL_MAX_PAGES = 20;
// Socket disconnected/degraded → short fallback poll so new notifications still
// arrive promptly; socket connected → long drift-check only.
const POLL_INTERVAL_DEGRADED_MS = 30_000;
const POLL_INTERVAL_CONNECTED_MS = 10 * 60_000;

/**
 * The per-user Messages API is the source of truth (plan's core principle);
 * the `notification:new` socket event is only ever used as a wake-up signal
 * to trigger a resync — its `subject` is used for the toast text only (not
 * stored, not treated as authoritative), everything shown in the center
 * comes from `listMessages()`/`fetchUnreadCount()`.
 */
export class NotificationStore {
  private items: AtlasMessage[] = [];
  private unreadCount = 0;
  private status: NotificationStoreStatus = 'idle';
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private started = false;
  /** Ids of every message seen this session; null until the first successful sync (which only seeds it). */
  private seen: Set<string> | null = null;

  getState(): NotificationStoreState {
    return { items: this.items, unreadCount: this.unreadCount, status: this.status };
  }

  /** Idempotent — safe to call once from main.ts's `ready` hook alongside the other `register*()` calls. */
  start(): void {
    if (this.started) return;
    this.started = true;

    Hooks.on('atlas-foundry.authChanged', (payload: { state: string }) => {
      if (payload.state === 'active') void this.resync();
      else this.reset();
    });
    Hooks.on('atlas-foundry.socketEvent', (event: string) => {
      if (event !== 'notification:new') return;
      this.handleWakeup();
    });
    Hooks.on('atlas-foundry.socketStatusChanged', () => this.reschedulePolling());

    if (authManager.isLinked()) void this.resync();
    this.reschedulePolling();
  }

  /**
   * `quiet` (used by the poll timer) skips the loading state and the
   * notification before the answer when items are already loaded, and only
   * notifies afterwards when the count or the item ids actually changed.
   */
  async resync(options: { quiet?: boolean } = {}): Promise<void> {
    if (!authManager.isLinked()) {
      this.reset();
      return;
    }
    const quiet = options.quiet === true && this.seen !== null;
    if (!quiet) {
      this.status = 'loading';
      this.notify();
    }
    const epoch = authManager.getSessionEpoch();
    let arrivals: AtlasMessage[] = [];
    let changed: boolean;
    try {
      const [unreadCount, items] = await Promise.all([fetchUnreadCount(), listMessages({ limit: LIST_LIMIT })]);
      // Signed out or switched account while the request was in flight — the answer belongs to the old session.
      if (epoch !== authManager.getSessionEpoch()) {
        this.seen = null;
        return this.resync(options);
      }
      changed =
        !quiet ||
        this.status !== 'idle' ||
        unreadCount !== this.unreadCount ||
        items.length !== this.items.length ||
        items.some((m, i) => m.id !== this.items[i]?.id);
      this.unreadCount = unreadCount;
      this.items = items;
      this.status = 'idle';
      if (this.seen === null) {
        this.seen = new Set(items.map((m) => m.id));
      } else {
        const detected = detectArrivals(items, this.seen);
        this.seen = detected.seen;
        arrivals = detected.arrivals;
      }
    } catch (err) {
      if (epoch !== authManager.getSessionEpoch()) {
        this.seen = null;
        return this.resync(options);
      }
      changed = this.status !== 'error';
      this.status = 'error';
      log.warn('Atlas Foundry: notification sync failed', err);
    }
    if (changed) this.notify();
    for (const message of arrivals) Hooks.callAll('atlas-foundry.notificationArrived', message);
  }

  /**
   * Marks every unread notification in the module as read, not just the loaded
   * 30 — the bell's count comes from the server. No bulk endpoint exists, so it
   * pages through `unread=true` (cursor = createdAt of the previous page's last
   * item) and marks one by one, then resyncs to the server's truth.
   */
  async markAllUnreadRead(): Promise<void> {
    let cursor: string | undefined;
    let failed = 0;
    let lastError: unknown;

    for (let pageNumber = 0; pageNumber < MARK_ALL_MAX_PAGES; pageNumber++) {
      let batch: AtlasMessage[];
      try {
        batch = await listMessages({ unread: true, limit: MARK_ALL_PAGE_LIMIT, cursor });
      } catch (err) {
        failed += 1;
        lastError = err;
        break;
      }
      if (batch.length === 0) break;

      for (const message of batch) {
        const loaded = this.items.find((m) => m.id === message.id);
        if (loaded) loaded.isRead = true;
        try {
          await markMessageRead(message.id);
        } catch (err) {
          if (loaded) loaded.isRead = false;
          failed += 1;
          lastError = err;
        }
      }
      this.notify();
      cursor = batch[batch.length - 1]!.createdAt;
    }

    await this.resync();
    if (failed > 0) notifyError(lastError, 'ATLASFOUNDRY.Notifications.ActionFailed');
  }

  async markRead(messageId: string): Promise<void> {
    const item = this.items.find((m) => m.id === messageId);
    if (!item || item.isRead) return;

    item.isRead = true;
    this.unreadCount = Math.max(0, this.unreadCount - 1);
    this.notify();

    try {
      await markMessageRead(messageId);
    } catch (err) {
      item.isRead = false;
      this.unreadCount += 1;
      this.notify();
      notifyError(err, 'ATLASFOUNDRY.Notifications.ActionFailed');
    }
  }

  async dismiss(messageId: string): Promise<void> {
    const index = this.items.findIndex((m) => m.id === messageId);
    if (index === -1) return;
    const removed = this.items[index]!;
    const wasUnread = !removed.isRead;

    this.items = this.items.filter((m) => m.id !== messageId);
    if (wasUnread) this.unreadCount = Math.max(0, this.unreadCount - 1);
    this.notify();

    try {
      await dismissMessage(messageId);
    } catch (err) {
      this.items = [...this.items.slice(0, index), removed, ...this.items.slice(index)];
      if (wasUnread) this.unreadCount += 1;
      this.notify();
      notifyError(err, 'ATLASFOUNDRY.Notifications.ActionFailed');
    }
  }

  private handleWakeup(): void {
    void this.resync();
  }

  private reset(): void {
    this.seen = null;
    this.items = [];
    this.unreadCount = 0;
    this.status = 'idle';
    this.notify();
  }

  private reschedulePolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    const interval = atlasSocket.getStatus() === 'connected' ? POLL_INTERVAL_CONNECTED_MS : POLL_INTERVAL_DEGRADED_MS;
    this.pollTimer = setInterval(() => void this.resync({ quiet: true }), interval);
  }

  private notify(): void {
    Hooks.callAll('atlas-foundry.notificationsChanged', this.getState());
  }
}

export const notificationStore = new NotificationStore();
