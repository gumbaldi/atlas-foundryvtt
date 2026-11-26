/**
 * Shared right-hand HUD column next to the Foundry sidebar. The notification
 * bell is its first child, the quest tracker appends below it. DOM access stays
 * inside the functions so the module can be imported in Node.
 */

export const HUD_RIGHT_ID = 'atlas-foundry-hud-right';
const SIDEBAR_ID = 'ui-right';
const FALLBACK_CLASS = 'atlas-foundry-hud-right-fixed';

/** Space between the visible sidebar edge and the column, in px. */
const GAP_PX = 8;

let watchingWindow = false;
let observer: ResizeObserver | null = null;
const observed = new WeakSet<Element>();

/**
 * Pure: the top of the column. The first sidebar tab wins, then the tab strip,
 * then the sidebar itself; `null` when nothing is measurable. Never negative.
 */
export function resolveHudTop(input: { firstTabTop: number | null; tabsTop: number | null; sidebarTop: number | null }): number | null {
  const top = input.firstTabTop ?? input.tabsTop ?? input.sidebarTop;
  return top === null ? null : Math.max(0, top);
}

/** Top edge of the first visible tab button of the sidebar tab strip (the Chat tab), or `null`. */
function measureFirstTabTop(tabs: HTMLElement | null): number | null {
  if (!tabs || typeof tabs.querySelectorAll !== 'function') return null;
  for (const el of Array.from(tabs.querySelectorAll<HTMLElement>('button, [data-tab], li'))) {
    const rect = el.getBoundingClientRect();
    if (rect.height > 0) return rect.top;
  }
  return null;
}

/**
 * Pins the column to the visible right-hand sidebar: left of the open panel, or
 * left of the tab strip when collapsed. `#ui-right` is wider than what is
 * visible, so the CSS `right: 100%` rule alone lands too far left. Without a
 * measurable sidebar the column keeps the CSS placement.
 */
function placeRightHud(hud: HTMLElement): void {
  const sidebar = document.getElementById(SIDEBAR_ID);
  const edges = ['sidebar', 'sidebar-tabs']
    .map((id) => document.getElementById(id))
    .filter((el): el is HTMLElement => !!el && typeof el.getBoundingClientRect === 'function')
    .map((el) => el.getBoundingClientRect())
    .filter((rect) => rect.width > 0);

  if (!sidebar || edges.length === 0 || typeof window === 'undefined') {
    hud.style.position = '';
    hud.style.top = '';
    hud.style.right = '';
    hud.style.margin = '';
    return;
  }

  const left = Math.min(...edges.map((rect) => rect.left));
  const tabs = document.getElementById('sidebar-tabs');
  const top = resolveHudTop({
    firstTabTop: measureFirstTabTop(tabs),
    tabsTop: tabs && typeof tabs.getBoundingClientRect === 'function' ? tabs.getBoundingClientRect().top : null,
    sidebarTop: sidebar.getBoundingClientRect().top,
  });
  if (top === null) {
    hud.style.position = '';
    hud.style.top = '';
    hud.style.right = '';
    hud.style.margin = '';
    return;
  }
  hud.style.position = 'fixed';
  hud.style.top = `${top}px`;
  hud.style.right = `${window.innerWidth - left + GAP_PX}px`;
  hud.style.margin = '0';
}

function refreshRightHud(): void {
  const hud = document.getElementById(HUD_RIGHT_ID);
  if (hud) placeRightHud(hud);
}

/** Re-pins the column on window resize and when the sidebar changes size (collapse, expand). Set up once and skipped without DOM, so the module still imports in Node. */
function watchSidebar(sidebar: HTMLElement): void {
  if (typeof window === 'undefined') return;
  if (!watchingWindow) {
    window.addEventListener('resize', refreshRightHud);
    watchingWindow = true;
  }
  if (typeof ResizeObserver === 'undefined') return;
  observer ??= new ResizeObserver(refreshRightHud);
  for (const el of [sidebar, document.getElementById('sidebar'), document.getElementById('sidebar-tabs')]) {
    if (el && !observed.has(el)) {
      observed.add(el);
      observer.observe(el);
    }
  }
}

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
  if (sidebar) watchSidebar(sidebar);
  placeRightHud(hud);
  return hud;
}

/** Removes the column again once nothing lives in it. */
export function removeRightHudIfEmpty(): void {
  const hud = document.getElementById(HUD_RIGHT_ID);
  if (hud && hud.children.length === 0) hud.remove();
}
