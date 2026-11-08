import { authManager } from '../auth/auth-manager';
import { getShowBell } from '../settings';
import { notificationStore } from './notification-store';
import { openNotificationCenter } from './notification-center-app';

const BELL_ID = 'atlas-foundry-bell';

function removeBell(): void {
  document.getElementById(BELL_ID)?.remove();
}

function attachBell(bell: HTMLElement): void {
  // Foundry's player list is a stable v14 anchor; falls back to `document.body`
  // if a UI module has removed/renamed it (plan's DOM-collision risk note).
  const anchor = document.getElementById('players');
  if (anchor?.parentElement) {
    anchor.parentElement.insertBefore(bell, anchor);
  } else {
    document.body.appendChild(bell);
  }
}

function buildBell(): HTMLElement {
  const bell = document.createElement('button');
  bell.id = BELL_ID;
  bell.type = 'button';
  bell.className = 'atlas-foundry-bell';
  bell.innerHTML = '<i class="fa-solid fa-bell"></i><span class="atlas-foundry-bell-badge" data-badge hidden></span>';
  bell.addEventListener('click', () => openNotificationCenter());
  return bell;
}

/**
 * Foundry's scene-controls tools can't carry a badge (plan's UI note), so
 * the bell is a small fixed DOM element instead, re-attached whenever its
 * anchor re-renders (`renderPlayers`) since Foundry replaces that element
 * wholesale on every player-list update.
 */
export function renderBell(): void {
  if (!authManager.isLinked() || !getShowBell()) {
    removeBell();
    return;
  }

  let bell = document.getElementById(BELL_ID);
  if (!bell || !bell.isConnected) {
    bell = bell ?? buildBell();
    attachBell(bell);
  }

  const badge = bell.querySelector<HTMLElement>('[data-badge]');
  if (!badge) return;
  const { unreadCount } = notificationStore.getState();
  if (unreadCount > 0) {
    badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
    badge.hidden = false;
  } else {
    badge.hidden = true;
  }
}

export function registerBell(): void {
  Hooks.on('atlas-foundry.notificationsChanged', renderBell);
  Hooks.on('atlas-foundry.authChanged', renderBell);
  Hooks.on('atlas-foundry.showBellChanged', renderBell);
  Hooks.on('renderPlayers', renderBell);
  renderBell();
}
