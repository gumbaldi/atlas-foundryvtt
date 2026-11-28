import { t } from '../i18n';
import { getBaseUrl } from '../settings';
import { safeImageUrl } from '../render/image-url';
import { openImageLightbox } from '../render/lightbox';
import { notificationAtlasTarget, openCampaignDashboard, openInAtlas } from '../links/open-in-atlas';
import { formatDocumentTitle } from '../render/document-title';
import { MODULE_TYPE_ICONS } from '../constants';
import { formatInWorldDate, formatRealDate, unreadSessionLogMessageIds } from '../diary/invitation-model';
import { notificationStore } from './notification-store';
import { KIND_ICONS, cascadeOffset, notificationTitle, popupBody, type PopupInvitation, type PopupLayout } from './notification-popup-model';
import type { AtlasMessage } from '../atlas-types';

const POPUP_WIDTH = 420;
/** The session-log invitation carries a picture plus text next to it, so it gets more room. */
const INVITATION_POPUP_WIDTH = 480;
const POPUP_APPROX_HEIGHT = 320;
const POPUP_MIN_TOP = 40;

function relativeTime(iso: string): string {
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (diffMin < 1) return t('ATLASFOUNDRY.Notifications.JustNow');
  if (diffMin < 60) return t('ATLASFOUNDRY.Notifications.MinutesAgo', { count: diffMin });
  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) return t('ATLASFOUNDRY.Notifications.HoursAgo', { count: diffHours });
  return t('ATLASFOUNDRY.Notifications.DaysAgo', { count: Math.round(diffHours / 24) });
}

/**
 * One window per arriving notification. Closing it never marks the
 * notification as read; only the explicit "Acknowledge" button does. `index`
 * is the number of popups already open and only shifts the window a little so
 * they cascade instead of covering each other.
 *
 * The `invitation` layout (diary invitation for the latest session log) is fed by `invitation`;
 * `message` is then the "new session log" notification it replaces, or `null` when the window
 * opens at login without any notification.
 */
export class NotificationPopupApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS: foundry.applications.api.ApplicationV2Options = {
    classes: ['atlas-foundry', 'atlas-foundry-notification-popup'],
    window: { title: 'ATLASFOUNDRY.Notifications.Title', icon: 'fa-solid fa-bell', resizable: false },
    position: { width: POPUP_WIDTH },
  };

  private readonly message: AtlasMessage | null;
  private readonly layout: PopupLayout;
  private readonly onClosed: () => void;
  private readonly invitation: PopupInvitation | undefined;

  constructor(message: AtlasMessage | null, layout: PopupLayout, index: number, onClosed: () => void, invitation?: PopupInvitation) {
    const offset = cascadeOffset(index);
    const width = layout === 'invitation' ? INVITATION_POPUP_WIDTH : POPUP_WIDTH;
    super({
      id: message ? `atlas-notification-popup-${message.id}` : `atlas-diary-invitation-${invitation?.sessionLog.id ?? 'unknown'}`,
      ...(layout === 'invitation' ? { window: { title: 'ATLASFOUNDRY.Diary.InviteTitle', icon: 'fa-solid fa-book-bookmark', resizable: false } } : {}),
      position: {
        width,
        left: Math.max(0, Math.round((window.innerWidth - width) / 2) + offset),
        top: Math.max(POPUP_MIN_TOP, Math.round((window.innerHeight - POPUP_APPROX_HEIGHT) / 2) + offset),
      },
    });
    this.message = message;
    this.layout = layout;
    this.onClosed = onClosed;
    this.invitation = invitation;
  }

  protected async _renderHTML(): Promise<HTMLElement> {
    if (this.layout === 'invitation' && this.invitation) return this.renderInvitation(this.invitation);

    const esc = foundry.utils.escapeHTML;
    const message = this.message;
    if (!message) return document.createElement('section');
    const title = notificationTitle(message, t('ATLASFOUNDRY.Notifications.NoSubject'));
    const body = popupBody(message);
    const imageSrc = safeImageUrl(message.documentImageUrl, getBaseUrl());
    const target = notificationAtlasTarget(message);
    const openLabel = target.kind === 'document' ? 'ATLASFOUNDRY.Notifications.PopupOpenInAtlas' : 'ATLASFOUNDRY.Notifications.PopupOpenDashboard';

    const root = document.createElement('section');
    root.className = `atlas-foundry atlas-foundry-notification-popup-content atlas-foundry-notification-popup-${this.layout}`;

    const buttons = `
      <div class="atlas-foundry-notification-popup-buttons">
        <button type="button" data-action="open"><i class="fa-solid fa-arrow-up-right-from-square"></i> ${esc(t(openLabel))}</button>
        <button type="button" class="atlas-foundry-acknowledge" data-action="acknowledge"><i class="fa-solid fa-check"></i> ${esc(t('ATLASFOUNDRY.Notifications.MarkRead'))}</button>
      </div>`;

    if (this.layout === 'image' && imageSrc) {
      root.innerHTML = `
        <img class="atlas-foundry-notification-popup-image" data-action="zoom" alt="">
        <p class="atlas-foundry-notification-popup-title"><strong>${esc(title)}</strong></p>
        ${buttons}`;
      const img = root.querySelector<HTMLImageElement>('[data-action="zoom"]')!;
      img.src = imageSrc;
      img.alt = title;
    } else {
      const icon = KIND_ICONS[message.kind] ?? 'fa-solid fa-bell';
      root.innerHTML = `
        <div class="atlas-foundry-notification-popup-head">
          <i class="${icon}"></i>
          <strong class="atlas-foundry-notification-popup-title">${esc(title)}</strong>
        </div>
        ${body ? `<p class="atlas-foundry-notification-popup-body">${esc(body)}</p>` : ''}
        ${imageSrc ? '<img class="atlas-foundry-notification-popup-picture" data-action="zoom" alt="">' : ''}
        <span class="atlas-foundry-notification-item-time">${esc(relativeTime(message.createdAt))}</span>
        ${buttons}`;
      const img = root.querySelector<HTMLImageElement>('[data-action="zoom"]');
      if (img) {
        img.src = imageSrc;
        img.alt = title;
      }
    }

    return root;
  }

  private renderInvitation(invitation: PopupInvitation): HTMLElement {
    const esc = foundry.utils.escapeHTML;
    const log = invitation.sessionLog;
    const title = formatDocumentTitle('session-logs', log.name, log.sessionNumber);
    const imageSrc = safeImageUrl(log.imageUrl, getBaseUrl());
    const realDate = formatRealDate(log.sessionDate, game.i18n.lang);
    const inWorldDate = formatInWorldDate(log.inWorldDate, log.calendarName);

    const root = document.createElement('section');
    root.className = 'atlas-foundry atlas-foundry-notification-popup-content atlas-foundry-notification-popup-invitation';
    root.innerHTML = `
      <div class="atlas-foundry-diary-invite-main">
        ${imageSrc ? '<img class="atlas-foundry-diary-invite-picture" data-action="zoom" alt="">' : `<span class="atlas-foundry-diary-invite-tile"><i class="${MODULE_TYPE_ICONS['session-logs']}"></i></span>`}
        <div class="atlas-foundry-diary-invite-text">
          <strong class="atlas-foundry-notification-popup-title">${esc(title)}</strong>
          ${realDate ? `<span class="atlas-foundry-diary-invite-date">${esc(t('ATLASFOUNDRY.Diary.InviteRealDate', { date: realDate }))}</span>` : ''}
          ${inWorldDate ? `<span class="atlas-foundry-diary-invite-date">${esc(t('ATLASFOUNDRY.Diary.InviteInWorldDate', { date: inWorldDate }))}</span>` : ''}
          <p class="atlas-foundry-notification-popup-body">${esc(t('ATLASFOUNDRY.Diary.InviteText'))}</p>
        </div>
      </div>
      <div class="atlas-foundry-notification-popup-buttons">
        ${invitation.onDismiss ? `<button type="button" class="atlas-foundry-diary-invite-dismiss" data-action="dismiss">${esc(t('ATLASFOUNDRY.Diary.InviteDismiss'))}</button>` : ''}
        <button type="button" data-action="open-log"><i class="fa-solid fa-book-bookmark"></i> ${esc(t('ATLASFOUNDRY.Diary.InviteOpen'))}</button>
      </div>`;
    const img = root.querySelector<HTMLImageElement>('[data-action="zoom"]');
    if (img) {
      img.src = imageSrc;
      img.alt = title;
    }
    return root;
  }

  protected async _replaceHTML(result: HTMLElement, content: HTMLElement): Promise<void> {
    content.replaceChildren(result);

    const title = this.invitation
      ? formatDocumentTitle('session-logs', this.invitation.sessionLog.name, this.invitation.sessionLog.sessionNumber)
      : this.message
        ? notificationTitle(this.message, t('ATLASFOUNDRY.Notifications.NoSubject'))
        : '';
    content.querySelector<HTMLElement>('[data-action="zoom"]')?.addEventListener('click', (event) => {
      openImageLightbox((event.currentTarget as HTMLImageElement).src, title);
    });
    content.querySelector('[data-action="open"]')?.addEventListener('click', () => this.openInAtlas());
    content.querySelector('[data-action="open-log"]')?.addEventListener('click', () => this.openLogAndAcknowledge());
    content.querySelector('[data-action="dismiss"]')?.addEventListener('click', () => {
      this.invitation?.onDismiss?.();
      void this.close();
    });
    content.querySelector('[data-action="acknowledge"]')?.addEventListener('click', () => {
      if (this.message) void notificationStore.markRead(this.message.id);
      void this.close();
    });
  }

  /**
   * Opens the session log itself in Atlas. The "new session log" notification (this window's own
   * or an unread one in the store) is acknowledged with it, so the bell keeps no second pending item.
   */
  private openLogAndAcknowledge(): void {
    const log = this.invitation?.sessionLog;
    if (!log) return;
    void openInAtlas({ moduleType: 'session-logs', documentId: log.id });

    const ids = new Set(unreadSessionLogMessageIds(notificationStore.getState().items, log.id));
    if (this.message) ids.add(this.message.id);
    for (const id of ids) void notificationStore.markRead(id);
    void this.close();
  }

  /** Opening never acknowledges; the window stays open. */
  private openInAtlas(): void {
    if (!this.message) return;
    const target = notificationAtlasTarget(this.message);
    if (target.kind === 'document') {
      void openInAtlas(target.ref);
      return;
    }
    openCampaignDashboard();
  }

  protected _onClose(options?: Record<string, unknown>): void {
    super._onClose(options);
    this.onClosed();
  }
}
