import { t } from '../i18n';
import { SOCKET_EVENT, type ModuleType } from '../constants';
import { authManager } from '../auth/auth-manager';
import { getAutoOpenGmSuggestions } from '../settings';
import { notificationStore } from './notification-store';
import { openDocumentViewer } from '../apps/viewer-app';
import { atlasCampaignDashboardUrl } from '../deep-links';
import type { AtlasMessage } from '../atlas-types';

type ListFilter = 'unread' | 'all';

/** Only 3 real `kind` values exist (see atlas-types.ts's AtlasMessage) — no dedicated DM/appointment/quest kind despite the plan's broader notification-type ambitions. */
const KIND_ICONS: Record<string, string> = {
  'gm-announcement': 'fa-solid fa-bullhorn',
  'document-new': 'fa-solid fa-file-circle-plus',
  'document-updated': 'fa-solid fa-file-pen',
  'document-media': 'fa-solid fa-photo-film',
  'support-ticket': 'fa-solid fa-life-ring',
  'diary-invite': 'fa-solid fa-book-bookmark',
  'diary-entry': 'fa-solid fa-book',
  'agent-content': 'fa-solid fa-robot',
};

const MANY_UNREAD_THRESHOLD = 20;
const SUGGEST_TOAST_ID = 'atlas-foundry-suggest-toast';
const SUGGEST_TOAST_TIMEOUT_MS = 20_000;

let activeCenter: NotificationCenterApp | null = null;

export function openNotificationCenter(): void {
  if (activeCenter) {
    activeCenter.bringToFront();
    return;
  }
  activeCenter = new NotificationCenterApp();
  void activeCenter.render(true);
}

function relativeTime(iso: string): string {
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (diffMin < 1) return t('ATLASFOUNDRY.Notifications.JustNow');
  if (diffMin < 60) return t('ATLASFOUNDRY.Notifications.MinutesAgo', { count: diffMin });
  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) return t('ATLASFOUNDRY.Notifications.HoursAgo', { count: diffHours });
  return t('ATLASFOUNDRY.Notifications.DaysAgo', { count: Math.round(diffHours / 24) });
}

/**
 * Notification-Center panel (plan P8). Read/unread/dismiss go through the
 * same per-user Messages API the web inbox uses (`notification-store.ts`)
 * — this component only renders the store's state and dispatches actions,
 * it never talks to the API directly.
 */
export class NotificationCenterApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS: foundry.applications.api.ApplicationV2Options = {
    id: 'atlas-notification-center',
    classes: ['atlas-foundry', 'atlas-foundry-notification-center'],
    window: { title: 'ATLASFOUNDRY.Notifications.Title', icon: 'fa-solid fa-bell', resizable: true },
    position: { width: 380, height: 520 },
  };

  private filter: ListFilter = 'unread';
  private markingAllRead = false;
  private readonly onStoreChange = (): void => {
    void this.render();
  };

  constructor() {
    super({});
    Hooks.on('atlas-foundry.notificationsChanged', this.onStoreChange);
  }

  protected async _renderHTML(): Promise<HTMLElement> {
    const root = document.createElement('section');
    root.className = 'atlas-foundry atlas-foundry-notification-center';

    const state = notificationStore.getState();
    const items = this.filter === 'unread' ? state.items.filter((m) => !m.isRead) : state.items;

    root.innerHTML = `
      <header class="atlas-foundry-notification-center-header">
        <div class="atlas-foundry-quest-panel-filters">
          ${(['unread', 'all'] as ListFilter[])
            .map(
              (f) =>
                `<button type="button" class="atlas-foundry-chip${this.filter === f ? ' active' : ''}" data-filter="${f}">${foundry.utils.escapeHTML(t(`ATLASFOUNDRY.Notifications.Filter.${f}`))}</button>`,
            )
            .join('')}
        </div>
        <button type="button" data-action="mark-all-read" ${this.markingAllRead ? 'disabled' : ''}>${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Notifications.MarkAllRead'))}</button>
      </header>
      <div class="atlas-foundry-notification-center-body" data-body></div>
    `;

    const body = root.querySelector<HTMLElement>('[data-body]')!;
    if (state.status === 'loading' && items.length === 0) {
      body.innerHTML = `<div class="atlas-foundry-status">${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Viewer.Loading'))}</div>`;
    } else if (state.status === 'error' && items.length === 0) {
      body.innerHTML = `<div class="atlas-foundry-status-error">${foundry.utils.escapeHTML(t('ATLASFOUNDRY.ApiError.Unknown'))}</div>`;
    } else if (items.length === 0) {
      body.innerHTML = `<div class="atlas-foundry-status">${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Notifications.Empty'))}</div>`;
    } else {
      items.forEach((item) => body.appendChild(this.renderItem(item)));
    }

    return root;
  }

  private renderItem(item: AtlasMessage): HTMLElement {
    const row = document.createElement('div');
    row.className = `atlas-foundry-notification-item${item.isRead ? '' : ' atlas-foundry-notification-item-unread'}`;
    row.dataset.messageId = item.id;

    const icon = KIND_ICONS[item.kind] ?? 'fa-solid fa-bell';
    const title = item.subject || item.documentName || t('ATLASFOUNDRY.Notifications.NoSubject');
    const canBroadcast = game.user.isGM && !!item.documentId && !!item.documentModuleType;

    row.innerHTML = `
      <div class="atlas-foundry-notification-item-main" data-action="open">
        <i class="${icon}"></i>
        <div class="atlas-foundry-notification-item-text">
          <strong>${foundry.utils.escapeHTML(title)}</strong>
          ${item.bodyPlainText ? `<p>${foundry.utils.escapeHTML(item.bodyPlainText)}</p>` : ''}
          <span class="atlas-foundry-notification-item-time">${foundry.utils.escapeHTML(relativeTime(item.createdAt))}</span>
        </div>
        ${!item.isRead ? '<span class="atlas-foundry-notification-item-dot"></span>' : ''}
      </div>
      <div class="atlas-foundry-notification-item-actions">
        ${!item.isRead ? `<button type="button" data-action="read" title="${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Notifications.MarkRead'))}"><i class="fa-solid fa-check"></i></button>` : ''}
        <button type="button" data-action="dismiss" title="${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Links.Remove'))}"><i class="fa-solid fa-xmark"></i></button>
        ${canBroadcast ? `<button type="button" data-action="broadcast" title="${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Notifications.Broadcast'))}"><i class="fa-solid fa-tower-broadcast"></i></button>` : ''}
      </div>
    `;

    return row;
  }

  protected async _replaceHTML(result: HTMLElement, content: HTMLElement): Promise<void> {
    content.replaceChildren(result);

    content.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((chip) => {
      chip.addEventListener('click', () => {
        this.filter = chip.dataset.filter as ListFilter;
        void this.render();
      });
    });

    content.querySelector('[data-action="mark-all-read"]')?.addEventListener('click', () => void this.markAllRead());

    content.querySelectorAll<HTMLElement>('[data-message-id]').forEach((row) => {
      const item = notificationStore.getState().items.find((m) => m.id === row.dataset.messageId);
      if (!item) return;

      row.querySelector('[data-action="open"]')?.addEventListener('click', () => this.openItem(item));
      row.querySelector('[data-action="read"]')?.addEventListener('click', (event) => {
        event.stopPropagation();
        void notificationStore.markRead(item.id);
      });
      row.querySelector('[data-action="dismiss"]')?.addEventListener('click', (event) => {
        event.stopPropagation();
        void notificationStore.dismiss(item.id);
      });
      row.querySelector('[data-action="broadcast"]')?.addEventListener('click', (event) => {
        event.stopPropagation();
        this.broadcast(item);
      });
    });
  }

  private openItem(item: AtlasMessage): void {
    if (!item.isRead) void notificationStore.markRead(item.id);

    if (item.documentId && item.documentModuleType) {
      openDocumentViewer({ moduleType: item.documentModuleType, documentId: item.documentId, name: item.documentName });
      return;
    }
    // No appointment/conversation reference fields exist on Message yet
    // (checked against message.schema.ts) — dashboard is the plan's own
    // documented fallback for exactly this case.
    const campaignId = authManager.getLinkedCampaignId();
    if (campaignId) window.open(atlasCampaignDashboardUrl(campaignId), '_blank');
  }

  private broadcast(item: AtlasMessage): void {
    if (!item.documentId || !item.documentModuleType) return;
    game.socket.emit(SOCKET_EVENT, {
      type: 'suggest-open',
      moduleType: item.documentModuleType,
      documentId: item.documentId,
      documentName: item.documentName,
    });
    ui.notifications.info(t('ATLASFOUNDRY.Notifications.BroadcastSent'));
  }

  private async markAllRead(): Promise<void> {
    // The badge counts every unread notification, the loaded list only the newest few.
    const { unreadCount } = notificationStore.getState();
    if (unreadCount > MANY_UNREAD_THRESHOLD) {
      ui.notifications.info(t('ATLASFOUNDRY.Notifications.MarkAllReadManyHint', { count: unreadCount }));
    }

    this.markingAllRead = true;
    await this.render();
    await notificationStore.markAllUnreadRead();
    this.markingAllRead = false;
    await this.render();
  }

  protected _onClose(options?: Record<string, unknown>): void {
    if (activeCenter === this) activeCenter = null;
    Hooks.off('atlas-foundry.notificationsChanged', this.onStoreChange);
    super._onClose(options);
  }
}

function showSuggestOpenToast(documentName: string, onOpen: () => void): void {
  document.getElementById(SUGGEST_TOAST_ID)?.remove();

  const toast = document.createElement('div');
  toast.id = SUGGEST_TOAST_ID;
  toast.className = 'atlas-foundry atlas-foundry-suggest-toast';
  toast.innerHTML = `
    <span>${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Notifications.SuggestOpenToast', { name: documentName }))}</span>
    <button type="button" data-action="open">${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Notifications.SuggestOpenButton'))}</button>
    <button type="button" data-action="close" title="${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Login.Cancel'))}"><i class="fa-solid fa-xmark"></i></button>
  `;
  document.body.appendChild(toast);

  const remove = () => toast.remove();
  toast.querySelector('[data-action="open"]')?.addEventListener('click', () => {
    onOpen();
    remove();
  });
  toast.querySelector('[data-action="close"]')?.addEventListener('click', remove);
  setTimeout(remove, SUGGEST_TOAST_TIMEOUT_MS);
}

/** Fallback entry point (plan: "the center stays reachable via the scene control") for when the bell is hidden or its DOM anchor collides with another module. */
export function registerNotificationsControl(): void {
  Hooks.on('getSceneControlButtons', (controls: Record<string, any>) => {
    const tokens = controls.tokens;
    if (!tokens?.tools) return;
    tokens.tools.atlasNotifications = {
      name: 'atlasNotifications',
      title: 'ATLASFOUNDRY.Notifications.ControlTool',
      icon: 'fa-solid fa-bell',
      button: true,
      order: 103,
      onChange: () => openNotificationCenter(),
    };
  });
}

/**
 * Receiving side of the GM broadcast (plan: "no automatic window;
 * deliberately — a client setting autoOpenGmSuggestions allows opt-in"). The
 * payload never carries content, only ids — permission is re-checked
 * server-side the moment the viewer fetches the document with the
 * recipient's own token.
 */
export function registerGmBroadcastReceiver(): void {
  game.socket.on(SOCKET_EVENT, (data: unknown) => {
    const payload = data as { type?: string; moduleType?: ModuleType | 'custom'; documentId?: string; documentName?: string } | null;
    if (payload?.type !== 'suggest-open' || !payload.moduleType || !payload.documentId) return;

    const openIt = () => openDocumentViewer({ moduleType: payload.moduleType!, documentId: payload.documentId!, name: payload.documentName });

    if (getAutoOpenGmSuggestions()) {
      openIt();
      return;
    }
    showSuggestOpenToast(payload.documentName ?? '', openIt);
  });
}
