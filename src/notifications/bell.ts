import { authManager } from '../auth/auth-manager';
import { getRightHud, removeRightHudIfEmpty } from '../hud-right';
import { getShowBell } from '../settings';
import { shouldShowBell } from './bell-visibility';
import { notificationStore } from './notification-store';
import { openNotificationCenter } from './notification-center-app';

export { shouldShowBell };

const BELL_ID = 'atlas-foundry-bell';

function removeBell(): void {
  document.getElementById(BELL_ID)?.remove();
  removeRightHudIfEmpty();
}

function buildBell(): HTMLElement {
  const bell = document.createElement('button');
  bell.id = BELL_ID;
  bell.type = 'button';
  bell.className = 'atlas-foundry-bell';
  bell.innerHTML = '<i class="fa-solid fa-bell"></i><span class="atlas-foundry-bell-badge" data-badge></span>';
  bell.addEventListener('click', () => openNotificationCenter());
  return bell;
}

/**
 * Foundry's scene-controls tools can't carry a badge, so the bell is a DOM
 * element in the shared right-hand HUD column. It exists only while something
 * is unread and is re-attached whenever Foundry re-renders the sidebar.
 */
export function renderBell(): void {
  const state = notificationStore.getState();
  if (!authManager.isLinked() || !shouldShowBell(state, getShowBell())) {
    removeBell();
    return;
  }

  const hud = getRightHud();
  let bell = document.getElementById(BELL_ID);
  if (!bell) bell = buildBell();
  if (bell.parentElement !== hud) hud.prepend(bell);

  const badge = bell.querySelector<HTMLElement>('[data-badge]');
  if (badge) badge.textContent = state.unreadCount > 99 ? '99+' : String(state.unreadCount);
}

export function registerBell(): void {
  Hooks.on('atlas-foundry.notificationsChanged', renderBell);
  Hooks.on('atlas-foundry.authChanged', renderBell);
  Hooks.on('atlas-foundry.showBellChanged', renderBell);
  Hooks.on('renderSidebar', renderBell);
  renderBell();
}
