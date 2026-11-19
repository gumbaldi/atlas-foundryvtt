import { t } from '../i18n';
import { authManager } from '../auth/auth-manager';
import { getRightHud, removeRightHudIfEmpty } from '../hud-right';
import { getTypeStyle } from './type-style';
import { formatDocumentTitle } from '../render/document-title';
import { safeImageUrl } from '../render/image-url';
import { getBaseUrl } from '../settings';
import { openSearch } from './search-app';
import { SearchController, type SearchControllerState } from './search-controller';

const SEARCH_ID = 'atlas-foundry-search-hud';
/** Hits listed under the field; the rest is one click away in the search window. */
const MAX_INLINE_HITS = 5;

let controller: SearchController | null = null;

function removeSearch(): void {
  controller?.dispose();
  controller = null;
  document.getElementById(SEARCH_ID)?.remove();
  removeRightHudIfEmpty();
}

function typeLabel(moduleType: string, customLabel?: string | null): string {
  return moduleType === 'custom' ? (customLabel ?? t('ATLASFOUNDRY.Search.CustomModule')) : t(`ATLASFOUNDRY.ModuleTypes.${moduleType}`);
}

function renderHits(list: HTMLElement, state: SearchControllerState, onPick: () => void): void {
  const query = state.query.trim();
  list.replaceChildren();
  if (state.status === 'idle') {
    list.hidden = true;
    return;
  }
  list.hidden = false;

  if (state.status === 'loading') {
    list.appendChild(note(t('ATLASFOUNDRY.Search.Searching')));
    return;
  }
  if (state.status === 'error') {
    list.appendChild(note(t(state.errorKey ?? 'ATLASFOUNDRY.ApiError.Unknown')));
    return;
  }
  if (state.results.length === 0) {
    list.appendChild(note(t('ATLASFOUNDRY.Search.NoResults')));
    return;
  }

  for (const hit of state.results.slice(0, MAX_INLINE_HITS)) {
    const style = getTypeStyle(hit.moduleType);
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'atlas-foundry-search-hud-hit';
    row.style.setProperty('--atlas-type-color', style.color);
    row.title = typeLabel(hit.moduleType, hit.customModuleLabel);

    // Title image first (a tile in the type colour until it loads, or when the hit has none), then the module icon, then the title.
    const thumb = document.createElement('span');
    thumb.className = 'atlas-foundry-search-hud-thumb';
    const src = safeImageUrl(hit.imageUrl ?? undefined, getBaseUrl());
    if (src) {
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.alt = '';
      img.draggable = false;
      img.addEventListener('error', () => img.remove());
      img.src = src;
      thumb.appendChild(img);
    }
    const icon = document.createElement('i');
    icon.className = style.icon;
    const name = document.createElement('span');
    name.className = 'atlas-foundry-search-hud-name';
    name.textContent = formatDocumentTitle(hit.moduleType, hit.name, hit.sessionNumber);
    row.append(thumb, icon, name);

    row.addEventListener('click', () => {
      onPick();
      openSearch({ query, select: { moduleType: hit.moduleType, id: hit.id } });
    });
    list.appendChild(row);
  }
  if (state.results.length > MAX_INLINE_HITS) {
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'atlas-foundry-search-hud-more';
    more.textContent = t('ATLASFOUNDRY.Quests.More', { count: state.results.length - MAX_INLINE_HITS });
    more.addEventListener('click', () => {
      onPick();
      openSearch({ query });
    });
    list.appendChild(more);
  }
}

function note(text: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'atlas-foundry-search-hud-note';
  el.textContent = text;
  return el;
}

function buildSearch(): HTMLElement {
  const root = document.createElement('div');
  root.id = SEARCH_ID;
  root.className = 'atlas-foundry atlas-foundry-search-hud';

  const field = document.createElement('div');
  field.className = 'atlas-foundry-search-hud-field';
  const input = document.createElement('input');
  input.type = 'search';
  input.placeholder = t('ATLASFOUNDRY.Search.HudPlaceholder');
  input.autocomplete = 'off';
  const lens = document.createElement('button');
  lens.type = 'button';
  lens.title = t('ATLASFOUNDRY.Search.OpenWindow');
  lens.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i>';
  field.append(input, lens);

  const list = document.createElement('div');
  list.className = 'atlas-foundry-search-hud-results';
  list.hidden = true;
  root.append(field, list);

  const reset = (): void => {
    controller?.update('');
    input.value = '';
  };
  controller = new SearchController((state) => renderHits(list, state, reset));

  input.addEventListener('input', () => controller?.update(input.value));
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      reset();
      input.blur();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      openFromField(input, reset);
    }
  });
  lens.addEventListener('click', () => openFromField(input, reset));
  // Keep the hits while the pointer is on them, hide them once focus leaves the whole widget.
  root.addEventListener('focusout', (event) => {
    if (!root.contains((event as FocusEvent).relatedTarget as Node | null)) list.hidden = true;
  });
  input.addEventListener('focus', () => {
    if (controller && controller.getState().status !== 'idle') list.hidden = false;
  });
  return root;
}

/** Enter or the magnifier: the search window opens with the typed text (or empty), and the field is free again. */
function openFromField(input: HTMLInputElement, reset: () => void): void {
  const query = input.value.trim();
  reset();
  openSearch(query ? { query } : {});
}

/**
 * The always-visible search field in the right-hand HUD column, below the bell.
 * Typing lists the first hits right on the screen; Enter or the magnifier opens
 * the search window with that text, a click on a hit opens the window with the
 * hit selected. Exists only while signed in.
 */
export function renderSearchHud(): void {
  if (!authManager.isLinked()) {
    removeSearch();
    return;
  }
  const hud = getRightHud();
  let root = document.getElementById(SEARCH_ID);
  if (!root) root = buildSearch();
  if (root.parentElement !== hud) hud.appendChild(root);
}

export function registerSearchHud(): void {
  Hooks.on('atlas-foundry.authChanged', renderSearchHud);
  Hooks.on('atlas-foundry.sessionReset', removeSearch);
  Hooks.on('renderSidebar', renderSearchHud);
  renderSearchHud();
}
