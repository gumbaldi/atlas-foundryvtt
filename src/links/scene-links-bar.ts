import { t } from '../i18n';
import { MODULE_TYPE_ICONS } from '../constants';
import { authManager } from '../auth/auth-manager';
import { getShowSceneLinks } from '../settings';
import { getLinks, removeLink, type AtlasLink } from './link-store';
import { linkVisibility, toRefs } from './link-visibility';
import { openLink } from './link-actions';
import { openLinksPopover } from './link-popover';

const BAR_ID = 'atlas-foundry-scene-links-bar';
const MAX_VISIBLE_CHIPS = 6;
/** 'custom' isn't in MODULE_TYPE_ICONS (see viewer-app.ts's same fallback). */
const CUSTOM_MODULE_ICON = 'fa-solid fa-puzzle-piece';

// Re-entrancy guard: canvasReady/updateScene/authChanged can all fire in a
// tight burst (e.g. scene switch while the socket reconnects) — only the
// most recent render's result may touch the DOM.
let renderToken = 0;

function removeBar(): void {
  document.getElementById(BAR_ID)?.remove();
}

function iconFor(moduleType: string): string {
  return moduleType === 'custom' ? CUSTOM_MODULE_ICON : ((MODULE_TYPE_ICONS as Record<string, string | undefined>)[moduleType] ?? CUSTOM_MODULE_ICON);
}

type ChipState = 'visible' | 'broken' | 'unknown';

/**
 * `broken` (confirmed: the check ran and this ref wasn't returned — deleted
 * or otherwise gone) gets a GM-only remove shortcut. `unknown` (the check
 * itself failed — network/auth) never offers removal, since we can't tell a
 * mere outage from an actually-deleted target (plan: GM sees "?", not a
 * false "delete this").
 */
function buildChip(link: AtlasLink, name: string, state: ChipState): HTMLElement {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = `atlas-foundry-scene-link-chip atlas-foundry-scene-link-chip-${state}`;
  chip.title = link.label ?? name;
  const badge = state === 'unknown' ? '<i class="fa-solid fa-question"></i> ' : '';
  chip.innerHTML = `${badge}<i class="${iconFor(link.moduleType)}"></i> <span>${foundry.utils.escapeHTML(link.label ?? name)}</span>`;

  if (state === 'broken') {
    const remove = document.createElement('span');
    remove.className = 'atlas-foundry-scene-link-chip-remove';
    remove.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    remove.title = t('ATLASFOUNDRY.Links.Remove');
    remove.addEventListener('click', (event) => {
      event.stopPropagation();
      const scene = canvas?.scene;
      if (!scene) return;
      void removeLink(scene, link.id).then(() => void renderSceneLinksBar());
    });
    chip.appendChild(remove);
    return chip;
  }

  chip.addEventListener('click', (event) => {
    openLink(link, { external: event.shiftKey || event.ctrlKey || event.metaKey, currentName: name });
  });
  return chip;
}

function buildOverflowChip(links: AtlasLink[]): HTMLElement {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'atlas-foundry-scene-link-chip atlas-foundry-scene-link-chip-overflow';
  chip.textContent = `+${links.length}`;
  chip.addEventListener('click', () => void openLinksPopover(links, chip));
  return chip;
}

/**
 * Renders (or removes) the scene-links overlay for whatever scene is
 * currently on canvas. Deliberately DOM-appended to `#ui-top` (Foundry's own
 * top interface layer), never drawn onto the PIXI canvas — see plan's
 * "discreet horizontal bar at the top edge of the canvas". An empty bar is not
 * rendered at all (no UI noise for scenes with no links).
 */
export async function renderSceneLinksBar(): Promise<void> {
  const token = ++renderToken;
  const scene = canvas?.scene;

  if (!scene || !getShowSceneLinks() || !authManager.isLinked()) {
    removeBar();
    return;
  }

  const links = getLinks(scene);
  if (links.length === 0) {
    removeBar();
    return;
  }

  const result = await linkVisibility.check(toRefs(links));
  if (token !== renderToken || canvas?.scene !== scene) return; // superseded while awaiting

  const isGm = game.user.isGM;
  const visible = links.filter((link) => result.isVisible(link)).map((link) => ({ link, name: result.nameFor(link) ?? link.nameSnapshot }));
  // failed → we couldn't confirm anything either way, so a GM sees "?" chips
  // instead of the (wrong) inference that every ref is broken/deleted.
  const broken = isGm && !result.failed ? links.filter((link) => !result.isVisible(link)) : [];
  const unknown = isGm && result.failed ? links.filter((link) => !result.isVisible(link)) : [];

  if (visible.length === 0 && broken.length === 0 && unknown.length === 0) {
    // Players only ever reach this branch — a real network failure is
    // exactly as silent as "no links are visible" for them (plan: "no
    // error toasts per render"). GMs always see something via `broken`/`unknown`.
    removeBar();
    return;
  }

  const bar = document.getElementById(BAR_ID) ?? document.createElement('div');
  bar.id = BAR_ID;
  bar.className = 'atlas-foundry atlas-foundry-scene-links-bar';
  bar.replaceChildren();

  const shown = visible.slice(0, MAX_VISIBLE_CHIPS);
  const overflow = visible.slice(MAX_VISIBLE_CHIPS);
  shown.forEach(({ link, name }) => bar.appendChild(buildChip(link, name, 'visible')));
  broken.forEach((link) => bar.appendChild(buildChip(link, link.nameSnapshot, 'broken')));
  unknown.forEach((link) => bar.appendChild(buildChip(link, link.nameSnapshot, 'unknown')));
  if (overflow.length > 0) bar.appendChild(buildOverflowChip(overflow.map((o) => o.link)));

  if (!bar.isConnected) {
    const host = document.getElementById('ui-top') ?? document.body;
    host.appendChild(bar);
  }
}

function scheduleRender(): void {
  void renderSceneLinksBar();
}

/** One-off render for the scene already on the canvas — `canvasReady` has fired before `ready` runs. */
export function renderSceneLinksBarNow(): void {
  scheduleRender();
}

export function registerSceneLinksBar(): void {
  Hooks.on('canvasReady', scheduleRender);
  Hooks.on('updateScene', (scene: FoundryDocumentLike) => {
    if (canvas?.scene?.id === scene.id) scheduleRender();
  });
  Hooks.on('atlas-foundry.authChanged', scheduleRender);
  Hooks.on('atlas-foundry.showSceneLinksChanged', scheduleRender);
}
