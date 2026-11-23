import { t } from '../i18n';
import { getBaseUrl } from '../settings';
import { safeImageUrl } from '../render/image-url';
import { openImageLightbox } from '../render/lightbox';
import { notificationAtlasTarget, openCampaignDashboard, openInAtlas } from '../links/open-in-atlas';
import { notificationStore } from './notification-store';
import { KIND_ICONS, cascadeOffset, popupBody, popupTitle, type PopupLayout } from './notification-popup-model';
import type { AtlasMessage } from '../atlas-types';

const POPUP_WIDTH = 420;
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
 */
export class NotificationPopupApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS: foundry.applications.api.ApplicationV2Options = {
    classes: ['atlas-foundry', 'atlas-foundry-notification-popup'],
    window: { title: 'ATLASFOUNDRY.Notifications.Title', icon: 'fa-solid fa-bell', resizable: false },
    position: { width: POPUP_WIDTH },
  };

  private readonly message: AtlasMessage;
  private readonly layout: PopupLayout;
  private readonly onClosed: () => void;

  constructor(message: AtlasMessage, layout: PopupLayout, index: number, onClosed: () => void) {
    const offset = cascadeOffset(index);
    super({
      id: `atlas-notification-popup-${message.id}`,
      position: {
        width: POPUP_WIDTH,
        left: Math.max(0, Math.round((window.innerWidth - POPUP_WIDTH) / 2) + offset),
        top: Math.max(POPUP_MIN_TOP, Math.round((window.innerHeight - POPUP_APPROX_HEIGHT) / 2) + offset),
      },
    });
    this.message = message;
    this.layout = layout;
    this.onClosed = onClosed;
  }

  protected async _renderHTML(): Promise<HTMLElement> {
    const esc = foundry.utils.escapeHTML;
    const message = this.message;
    const title = popupTitle(message, t('ATLASFOUNDRY.Notifications.NoSubject'));
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

  protected async _replaceHTML(result: HTMLElement, content: HTMLElement): Promise<void> {
    content.replaceChildren(result);

    const title = popupTitle(this.message, t('ATLASFOUNDRY.Notifications.NoSubject'));
    content.querySelector<HTMLElement>('[data-action="zoom"]')?.addEventListener('click', (event) => {
      openImageLightbox((event.currentTarget as HTMLImageElement).src, title);
    });
    content.querySelector('[data-action="open"]')?.addEventListener('click', () => this.openInAtlas());
    content.querySelector('[data-action="acknowledge"]')?.addEventListener('click', () => {
      void notificationStore.markRead(this.message.id);
      void this.close();
    });
  }

  /** Opening never acknowledges; the window stays open. */
  private openInAtlas(): void {
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
