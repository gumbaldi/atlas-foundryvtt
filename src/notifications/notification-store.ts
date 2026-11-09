import { t } from '../i18n';
import { log, notifyError } from '../log';
import { authManager } from '../auth/auth-manager';
import { atlasSocket } from '../socket/atlas-socket';
import { getQuietMode } from '../settings';
import { listMessages, fetchUnreadCount, markMessageRead, dismissMessage } from './notifications-api';
import type { AtlasMessage } from '../atlas-types';

export type NotificationStoreStatus = 'idle' | 'loading' | 'error';

export interface NotificationStoreState {
  items: AtlasMessage[];
  unreadCount: number;
  status: NotificationStoreStatus;
}

const LIST_LIMIT = 30;
// Socket disconnected/degraded → shorter fallback poll; socket connected →
// long drift-check only (plan: "3 min (Socket down) / 10 min (Socket ok)").
const POLL_INTERVAL_DEGRADED_MS = 3 * 60_000;
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
    Hooks.on('atlas-foundry.socketEvent', (event: string, payload: unknown) => {
      if (event !== 'notification:new') return;
      this.handleWakeup(payload);
    });
    Hooks.on('atlas-foundry.socketStatusChanged', () => this.reschedulePolling());

    if (authManager.isLinked()) void this.resync();
    this.reschedulePolling();
  }

  async resync(): Promise<void> {
    if (!authManager.isLinked()) {
      this.reset();
      return;
    }
    this.status = 'loading';
    this.notify();
    const epoch = authManager.getSessionEpoch();
    try {
      const [unreadCount, items] = await Promise.all([fetchUnreadCount(), listMessages({ limit: LIST_LIMIT })]);
      // Signed out or switched account while the request was in flight — the answer belongs to the old session.
      if (epoch !== authManager.getSessionEpoch()) return this.resync();
      this.unreadCount = unreadCount;
      this.items = items;
      this.status = 'idle';
    } catch (err) {
      if (epoch !== authManager.getSessionEpoch()) return this.resync();
      this.status = 'error';
      log.warn('Atlas Foundry: notification sync failed', err);
    }
    this.notify();
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

  private handleWakeup(payload: unknown): void {
    const data = payload as { subject?: string } | null;
    if (data?.subject && !getQuietMode()) {
      ui.notifications.info(t('ATLASFOUNDRY.Notifications.NewToast', { subject: data.subject }));
    }
    void this.resync();
  }

  private reset(): void {
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
    this.pollTimer = setInterval(() => void this.resync(), interval);
  }

  private notify(): void {
    Hooks.callAll('atlas-foundry.notificationsChanged', this.getState());
  }
}

export const notificationStore = new NotificationStore();
