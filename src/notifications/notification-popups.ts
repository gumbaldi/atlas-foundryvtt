import { authManager } from '../auth/auth-manager';
import { getBaseUrl, getQuietMode } from '../settings';
import { safeImageUrl } from '../render/image-url';
import { resolveArrivalLayout } from '../diary/diary-invitation';
import { NotificationPopupApp } from './notification-popup-app';
import { canOpenAnother, popupLayout, type PopupInvitation } from './notification-popup-model';
import type { AtlasMessage } from '../atlas-types';

const open = new Set<NotificationPopupApp>();

function canOpen(): boolean {
  return !getQuietMode() && authManager.isLinked() && canOpenAnother(open.size);
}

function show(make: (index: number, onClosed: () => void) => NotificationPopupApp): void {
  const popup: NotificationPopupApp = make(open.size, () => {
    open.delete(popup);
  });
  open.add(popup);
  void popup.render(true);
}

function openPopup(message: AtlasMessage): void {
  if (!canOpen()) return;

  const layout = popupLayout(message, safeImageUrl(message.documentImageUrl, getBaseUrl()));
  show((index, onClosed) => new NotificationPopupApp(message, layout, index, onClosed));
}

/**
 * The diary invitation window. Same quiet-mode, linked and three-window rules as every popup;
 * `message` is the "new session log" notification it stands in for, `null` at login.
 */
export function openInvitationPopup(invitation: PopupInvitation, message: AtlasMessage | null = null): void {
  if (!canOpen()) return;
  show((index, onClosed) => new NotificationPopupApp(message, 'invitation', index, onClosed, invitation));
}

async function onArrival(message: AtlasMessage): Promise<void> {
  if (!canOpen()) return;

  // Only a new session log can turn into the diary invitation (it asks the backend); everything
  // else opens at once, in its own layout.
  const resolved = await resolveArrivalLayout(message);
  if (resolved.layout === 'invitation') {
    openInvitationPopup({ sessionLog: resolved.sessionLog }, message);
    return;
  }
  openPopup(message);
}

/** Session end (sign-out, revoked token, base-URL change): the shown texts belong to the previous identity. */
export function closeAllNotificationPopups(): void {
  for (const popup of [...open]) void popup.close();
  open.clear();
}

/** Only calls `Hooks.on`, so it belongs in `init`. */
export function registerNotificationPopups(): void {
  Hooks.on('atlas-foundry.notificationArrived', (message: AtlasMessage) => void onArrival(message));
  Hooks.on('atlas-foundry.authChanged', (payload: { state: string }) => {
    if (payload.state !== 'active') closeAllNotificationPopups();
  });
  Hooks.on('atlas-foundry.sessionReset', closeAllNotificationPopups);
}
