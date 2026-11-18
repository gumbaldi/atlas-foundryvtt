import { t } from '../i18n';
import { MODULE_TYPE_ICONS, type ModuleType } from '../constants';
import { authManager } from '../auth/auth-manager';
import { getDocument } from '../api/documents';
import { safeImageUrl } from '../render/image-url';
import { getBaseUrl, getShowSceneLinks, setShowSceneLinks } from '../settings';
import { getLinks, removeLink, type AtlasLink } from './link-store';
import { linkVisibility, toRefs } from './link-visibility';
import { openLink } from './link-actions';
import { openLinksPopover } from './link-popover';
import { partitionChips, resolveLinkThumbnails } from './link-thumbnails';

const BAR_ID = 'atlas-foundry-scene-links-bar';
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

interface BuiltChip {
  chip: HTMLElement;
  /** Where the thumbnail goes once it resolves; holds the type icon until then (and again if the image fails). */
  thumb: HTMLElement;
}

function setThumbIcon(thumb: HTMLElement, moduleType: string): void {
  const icon = document.createElement('i');
  icon.className = iconFor(moduleType);
  thumb.replaceChildren(icon);
}

/**
 * `broken` (confirmed: the check ran and this ref wasn't returned — deleted
 * or otherwise gone) gets a GM-only remove shortcut. `unknown` (the check
 * itself failed — network/auth) never offers removal, since we can't tell a
 * mere outage from an actually-deleted target (plan: GM sees "?", not a
 * false "delete this").
 */
function buildChip(link: AtlasLink, name: string, state: ChipState): BuiltChip {
  const label = link.label ?? name;
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = `atlas-foundry-scene-link-chip atlas-foundry-scene-link-chip-${state}`;
  chip.title = label;

  const thumb = document.createElement('span');
  thumb.className = 'atlas-foundry-scene-link-thumb';
  setThumbIcon(thumb, link.moduleType);
  chip.appendChild(thumb);

  if (state === 'unknown') {
    const badge = document.createElement('i');
    badge.className = 'fa-solid fa-question';
    chip.appendChild(badge);
  }

  const text = document.createElement('span');
  text.className = 'atlas-foundry-scene-link-label';
  text.textContent = label;
  chip.appendChild(text);

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
    return { chip, thumb };
  }

  chip.addEventListener('click', () => openLink(link));
  return { chip, thumb };
}

function buildOverflowChip(links: AtlasLink[]): HTMLElement {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'atlas-foundry-scene-link-chip atlas-foundry-scene-link-chip-overflow';
  chip.title = t('ATLASFOUNDRY.Links.OverflowTitle', { count: links.length });
  chip.textContent = `+${links.length}`;
  chip.addEventListener('click', () => void openLinksPopover(links, chip));
  return chip;
}

function buildCollapseButton(): HTMLElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'atlas-foundry-scene-links-collapse';
  button.title = t('ATLASFOUNDRY.Links.Collapse');
  button.innerHTML = '<i class="fa-solid fa-chevron-up"></i>';
  button.addEventListener('click', () => void setShowSceneLinks(false));
  return button;
}

function buildPill(count: number): HTMLElement {
  const pill = document.createElement('button');
  pill.type = 'button';
  pill.className = 'atlas-foundry-scene-links-pill';
  pill.title = t('ATLASFOUNDRY.Links.ExpandPill', { count });
  const icon = document.createElement('i');
  icon.className = 'fa-solid fa-link';
  const number = document.createElement('span');
  number.textContent = String(count);
  pill.append(icon, number);
  pill.addEventListener('click', () => void setShowSceneLinks(true));
  return pill;
}

/** Patches resolved title images into the already rendered chips; an unusable URL or a load error keeps the type icon. */
async function patchThumbnails(token: number, bar: HTMLElement, entries: Array<{ link: AtlasLink; thumb: HTMLElement }>): Promise<void> {
  if (entries.length === 0) return;
  const images = await resolveLinkThumbnails(
    toRefs(entries.map((e) => e.link)),
    { getDocument: (moduleType, documentId) => getDocument(moduleType as ModuleType | 'custom', documentId) },
  );
  if (token !== renderToken || !bar.isConnected) return; // superseded while loading

  const baseUrl = getBaseUrl();
  for (const { link, thumb } of entries) {
    const src = safeImageUrl(images.get(link.documentId) ?? undefined, baseUrl);
    if (!src) continue;
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.alt = '';
    img.addEventListener('error', () => setThumbIcon(thumb, link.moduleType));
    img.src = src;
    thumb.replaceChildren(img);
  }
}

/**
 * Renders (or removes) the scene-links overlay for whatever scene is
 * currently on canvas. Deliberately DOM-appended to `#ui-top` (Foundry's own
 * top interface layer), never drawn onto the PIXI canvas — see plan's
 * "discreet horizontal bar at the top edge of the canvas". An empty bar is not
 * rendered at all (no UI noise for scenes with no links). Collapsed
 * (`showSceneLinks` off), only a small pill with the number of visible links
 * stays.
 */
export async function renderSceneLinksBar(): Promise<void> {
  const token = ++renderToken;
  const scene = canvas?.scene;

  if (!scene || !authManager.isLinked()) {
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

  const expanded = getShowSceneLinks();
  if (!expanded && visible.length === 0) {
    // Collapsed pill counts visible links only; a GM with nothing but broken ones sees no pill.
    removeBar();
    return;
  }

  const bar = document.getElementById(BAR_ID) ?? document.createElement('div');
  bar.id = BAR_ID;
  bar.className = `atlas-foundry atlas-foundry-scene-links-bar${expanded ? '' : ' atlas-foundry-scene-links-bar-collapsed'}`;
  bar.replaceChildren();

  const thumbEntries: Array<{ link: AtlasLink; thumb: HTMLElement }> = [];
  if (expanded) {
    const { shown, overflow } = partitionChips(visible);
    shown.forEach(({ link, name }) => {
      const built = buildChip(link, name, 'visible');
      bar.appendChild(built.chip);
      thumbEntries.push({ link, thumb: built.thumb });
    });
    broken.forEach((link) => bar.appendChild(buildChip(link, link.nameSnapshot, 'broken').chip));
    unknown.forEach((link) => bar.appendChild(buildChip(link, link.nameSnapshot, 'unknown').chip));
    if (overflow.length > 0) bar.appendChild(buildOverflowChip(overflow.map((o) => o.link)));
    bar.appendChild(buildCollapseButton());
  } else {
    bar.appendChild(buildPill(visible.length));
  }

  if (!bar.isConnected) {
    const host = document.getElementById('ui-top') ?? document.body;
    host.appendChild(bar);
  }

  void patchThumbnails(token, bar, thumbEntries);
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
