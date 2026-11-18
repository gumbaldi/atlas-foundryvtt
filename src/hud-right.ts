/**
 * Shared right-hand HUD column next to the Foundry sidebar. The notification
 * bell is its first child, the quest tracker appends below it. DOM access stays
 * inside the functions so the module can be imported in Node.
 */

export const HUD_RIGHT_ID = 'atlas-foundry-hud-right';
const SIDEBAR_ID = 'ui-right';
const FALLBACK_CLASS = 'atlas-foundry-hud-right-fixed';

/** Returns the column, creating it in `#ui-right` (or the body as fallback) if needed. Idempotent. */
export function getRightHud(): HTMLElement {
  const sidebar = document.getElementById(SIDEBAR_ID);
  const host = sidebar ?? document.body;

  let hud = document.getElementById(HUD_RIGHT_ID);
  if (!hud) {
    hud = document.createElement('div');
    hud.id = HUD_RIGHT_ID;
  }
  if (hud.parentElement !== host) host.appendChild(hud);
  hud.className = sidebar ? 'atlas-foundry-hud-right' : `atlas-foundry-hud-right ${FALLBACK_CLASS}`;

  // The column is positioned relative to the sidebar container.
  if (sidebar && typeof getComputedStyle === 'function' && getComputedStyle(sidebar).position === 'static') {
    sidebar.style.position = 'relative';
  }
  return hud;
}

/** Removes the column again once nothing lives in it. */
export function removeRightHudIfEmpty(): void {
  const hud = document.getElementById(HUD_RIGHT_ID);
  if (hud && hud.children.length === 0) hud.remove();
}
