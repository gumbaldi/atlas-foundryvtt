import { authManager } from '../auth/auth-manager';
import { getBaseUrl, getQuietMode } from '../settings';
import { safeImageUrl } from '../render/image-url';
import { NotificationPopupApp } from './notification-popup-app';
import { canOpenAnother, popupLayout } from './notification-popup-model';
import type { AtlasMessage } from '../atlas-types';

const open = new Set<NotificationPopupApp>();

function openPopup(message: AtlasMessage): void {
  if (getQuietMode() || !authManager.isLinked() || !canOpenAnother(open.size)) return;

  const layout = popupLayout(message, safeImageUrl(message.documentImageUrl, getBaseUrl()));
  const popup: NotificationPopupApp = new NotificationPopupApp(message, layout, open.size, () => {
    open.delete(popup);
  });
  open.add(popup);
  void popup.render(true);
}

/** Session end (sign-out, revoked token, base-URL change): the shown texts belong to the previous identity. */
export function closeAllNotificationPopups(): void {
  for (const popup of [...open]) void popup.close();
  open.clear();
}

/** Only calls `Hooks.on`, so it belongs in `init`. */
export function registerNotificationPopups(): void {
  Hooks.on('atlas-foundry.notificationArrived', openPopup);
  Hooks.on('atlas-foundry.authChanged', (payload: { state: string }) => {
    if (payload.state !== 'active') closeAllNotificationPopups();
  });
  Hooks.on('atlas-foundry.sessionReset', closeAllNotificationPopups);
}
