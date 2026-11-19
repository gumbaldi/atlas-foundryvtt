import { t } from '../i18n';
import { MODULE_TYPES, type ModuleType } from '../constants';
import { safeImageUrl } from '../render/image-url';
import { getTypeStyle } from './type-style';
import { formatDocumentTitle } from '../render/document-title';
import { highlightTerms } from './highlight';
import { authManager } from '../auth/auth-manager';
import { openLoginDialog } from '../auth/login-app';
import { getBaseUrl, getCampaignId } from '../settings';
import { openInAtlas } from '../links/open-in-atlas';
import { SearchController, type SearchControllerState } from './search-controller';
import { renderFocusPane, renderFocusPaneHint } from './focus-pane';
import { clearRecentSearches, getRecentSearches, saveRecentSearch } from './recent-searches';
import type { AtlasSearchResult } from '../atlas-types';

export interface SearchAppOptions {
  title?: string;
  pickMode?: boolean;
  /** Query (and hit to select) to run as soon as the window is drawn. */
  initial?: OpenSearchOptions;
}

let activeSearchApp: SearchApp | null = null;

/** What the HUD search field hands over: the typed text and, when the user clicked one of its hits, that hit. */
export interface OpenSearchOptions {
  query?: string;
  select?: { moduleType: string; id: string };
}

export function openSearch(options: OpenSearchOptions = {}): void {
  if (activeSearchApp) {
    const app = activeSearchApp;
    if (app.minimized) void app.maximize();
    void app.render({ force: true }).then(() => app.applyQuery(options));
    app.bringToFront();
    return;
  }
  activeSearchApp = new SearchApp({ initial: options });
  void activeSearchApp.render(true);
}

export class SearchApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS: foundry.applications.api.ApplicationV2Options = {
    id: 'atlas-search',
    classes: ['atlas-foundry', 'atlas-foundry-search'],
    window: { title: 'ATLASFOUNDRY.Search.Title', icon: 'fa-solid fa-search', resizable: true },
    position: { width: 960, height: 640 },
  };

  /** Reused as the P5 link-picker (plan step 5/7): resolves with the result confirmed via "Use as target". */
  static pick(options: { title?: string } = {}): Promise<AtlasSearchResult | null> {
    return new Promise((resolve) => {
      const app = new SearchApp({ title: options.title, pickMode: true });
      app.resolvePick = resolve;
      void app.render(true);
    });
  }

  private readonly pickMode: boolean;
  private resolvePick: ((result: AtlasSearchResult | null) => void) | null = null;
  private readonly controller: SearchController;
  private readonly selectedTypes = new Set<ModuleType>();
  private nameOnly = false;
  private selectedIndex = -1;
  private selectedItem: AtlasSearchResult | null = null;
  private cancelFocus: (() => void) | null = null;
  private rootElement: HTMLElement | null = null;
  private closeFilterMenu: (() => void) | null = null;
  private syncFilterUi: (() => void) | null = null;
  private initial: OpenSearchOptions | null;
  /** Hit to select once the next search has delivered results. */
  private pendingSelect: OpenSearchOptions['select'] = undefined;

  constructor(options: SearchAppOptions = {}) {
    super({ window: { title: options.title ?? 'ATLASFOUNDRY.Search.Title' } });
    this.pickMode = !!options.pickMode;
    this.initial = options.initial?.query ? options.initial : null;
    this.controller = new SearchController((state) => this.onSearchStateChange(state));
  }

  protected async _renderHTML(): Promise<HTMLElement> {
    const root = document.createElement('section');
    root.className = 'atlas-foundry atlas-foundry-search';

    if (!authManager.isLinked()) {
      root.innerHTML = this.renderConnectPromptHtml();
      return root;
    }

    root.innerHTML = `
      <div class="atlas-foundry-search-split">
        <div class="atlas-foundry-search-column">
          <div class="atlas-foundry-row">
            <input type="search" name="q" autofocus placeholder="${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Search.Placeholder'))}">
          </div>
          <div class="atlas-foundry-search-filters">
            <div class="atlas-foundry-filter" data-filter>
              <button type="button" class="atlas-foundry-filter-button" data-filter-button aria-haspopup="true" aria-expanded="false"></button>
              <div class="atlas-foundry-filter-menu" data-filter-menu hidden>
                <div class="atlas-foundry-filter-shortcuts">
                  <button type="button" data-filter-all>${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Search.FilterAll'))}</button>
                  <button type="button" data-filter-none>${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Search.FilterNone'))}</button>
                </div>
                ${MODULE_TYPES.map(
                  (type) =>
                    `<label class="atlas-foundry-filter-option"><input type="checkbox" data-type="${type}"> ${foundry.utils.escapeHTML(t(`ATLASFOUNDRY.ModuleTypes.${type}`))}</label>`,
                ).join('')}
              </div>
            </div>
            <label class="atlas-foundry-toggle">
              <input type="checkbox" name="nameOnly">
              ${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Search.NameOnly'))}
            </label>
          </div>
          <div class="atlas-foundry-status" data-status></div>
          <div class="atlas-foundry-search-results" data-results></div>
          <footer class="atlas-foundry-search-footer">${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Search.PermissionHint'))}</footer>
        </div>
        <div class="atlas-foundry-focus" data-focus></div>
      </div>
    `;
    return root;
  }

  protected async _replaceHTML(result: HTMLElement, content: HTMLElement): Promise<void> {
    content.replaceChildren(result);
    this.rootElement = content;

    if (!authManager.isLinked()) {
      this.wireConnectPrompt(content);
      return;
    }

    this.wireSearchUi(content);
    this.onSearchStateChange(this.controller.getState());
    this.showFocus();
    if (this.initial) {
      const initial = this.initial;
      this.initial = null;
      this.applyQuery(initial);
    }
  }

  /**
   * Puts `query` into the search field and runs it at once; `select` picks that hit when the results arrive.
   * The HUD field searches without filters, so type and names-only filters are reset here: the window then
   * shows exactly the hits the HUD listed, and no filter silently hides the clicked one.
   */
  applyQuery(options: OpenSearchOptions): void {
    const query = options.query?.trim();
    if (!query) return;
    const input = this.rootElement?.querySelector<HTMLInputElement>('input[name="q"]');
    if (!input) return;
    input.value = query;
    this.selectedTypes.clear();
    this.nameOnly = false;
    const nameOnlyBox = this.rootElement?.querySelector<HTMLInputElement>('input[name="nameOnly"]');
    if (nameOnlyBox) nameOnlyBox.checked = false;
    this.syncFilterUi?.();
    this.pendingSelect = options.select;
    this.controller.searchNow(query, this.searchFilters());
  }

  protected _onClose(options?: Record<string, unknown>): void {
    if (activeSearchApp === this) activeSearchApp = null;
    this.closeFilterMenu?.();
    this.closeFilterMenu = null;
    if (this.resolvePick) {
      const resolve = this.resolvePick;
      this.resolvePick = null;
      resolve(null);
    }
    this.cancelFocus?.();
    this.cancelFocus = null;
    this.controller.dispose();
    super._onClose(options);
  }

  private renderConnectPromptHtml(): string {
    const worldLinked = game.user.isGM || !!getCampaignId();
    const message = worldLinked ? t('ATLASFOUNDRY.NotConnected.Message') : t('ATLASFOUNDRY.Login.PlayerWaitingForGm');
    return `
      <div class="atlas-foundry-status">${foundry.utils.escapeHTML(message)}</div>
      <button type="button" data-action="connect" ${worldLinked ? '' : 'disabled'}>${foundry.utils.escapeHTML(t('ATLASFOUNDRY.NotConnected.ConnectButton'))}</button>
    `;
  }

  private wireConnectPrompt(content: HTMLElement): void {
    content.querySelector('[data-action="connect"]')?.addEventListener('click', () => {
      openLoginDialog().catch(() => undefined);
    });
  }

  private wireSearchUi(content: HTMLElement): void {
    const input = content.querySelector<HTMLInputElement>('input[name="q"]');
    input?.addEventListener('input', () => this.triggerSearch(input.value));
    input?.addEventListener('keydown', (event) => this.handleKeydown(event as KeyboardEvent));
    input?.focus();

    this.wireFilterMenu(content, () => this.triggerSearch(input?.value ?? ''));

    content.querySelector<HTMLInputElement>('input[name="nameOnly"]')?.addEventListener('change', (event) => {
      this.nameOnly = (event.target as HTMLInputElement).checked;
      this.triggerSearch(input?.value ?? '');
    });
  }

  /** Popover with one checkbox per document kind; an empty selection means "all types". */
  private wireFilterMenu(content: HTMLElement, onChange: () => void): void {
    this.closeFilterMenu?.();
    const button = content.querySelector<HTMLButtonElement>('[data-filter-button]');
    const menu = content.querySelector<HTMLElement>('[data-filter-menu]');
    const wrapper = content.querySelector<HTMLElement>('[data-filter]');
    if (!button || !menu || !wrapper) return;
    const boxes = [...menu.querySelectorAll<HTMLInputElement>('input[data-type]')];

    const refresh = (): void => {
      const n = this.selectedTypes.size;
      button.textContent = n === 0 || n === MODULE_TYPES.length ? t('ATLASFOUNDRY.Search.AllTypes') : t('ATLASFOUNDRY.Search.Types', { count: n });
      for (const box of boxes) box.checked = this.selectedTypes.has(box.dataset.type as ModuleType);
    };

    const onPointerDown = (event: Event): void => {
      if (!wrapper.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      // Esc closes the menu only; it must not also close the search window.
      event.preventDefault();
      event.stopPropagation();
      close();
    };
    const close = (): void => {
      menu.hidden = true;
      button.setAttribute('aria-expanded', 'false');
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };
    const open = (): void => {
      menu.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      document.addEventListener('pointerdown', onPointerDown, true);
      document.addEventListener('keydown', onKeyDown, true);
    };
    this.closeFilterMenu = close;
    this.syncFilterUi = refresh;

    button.addEventListener('click', () => (menu.hidden ? open() : close()));
    for (const box of boxes) {
      box.addEventListener('change', () => {
        const type = box.dataset.type as ModuleType;
        if (box.checked) this.selectedTypes.add(type);
        else this.selectedTypes.delete(type);
        refresh();
        onChange();
      });
    }
    menu.querySelector('[data-filter-all]')?.addEventListener('click', () => {
      MODULE_TYPES.forEach((type) => this.selectedTypes.add(type));
      refresh();
      onChange();
    });
    menu.querySelector('[data-filter-none]')?.addEventListener('click', () => {
      this.selectedTypes.clear();
      refresh();
      onChange();
    });
    refresh();
  }

  private searchFilters(): { types: ModuleType[]; nameOnly: boolean } {
    // Every type selected is the same as no restriction; keep the request small.
    const types = this.selectedTypes.size === MODULE_TYPES.length ? [] : [...this.selectedTypes];
    return { types, nameOnly: this.nameOnly };
  }

  private triggerSearch(q: string): void {
    this.controller.update(q, this.searchFilters());
  }

  private handleKeydown(event: KeyboardEvent): void {
    const state = this.controller.getState();

    if (event.key === 'Escape') {
      event.preventDefault();
      if (this.pickMode) this.resolveAndClose(null);
      else void this.close();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!state.results.length) return;
      this.selectIndex(Math.min(this.selectedIndex + 1, state.results.length - 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!state.results.length) return;
      this.selectIndex(Math.max(this.selectedIndex - 1, 0));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        if (this.selectedItem) {
          void openInAtlas({ moduleType: this.selectedItem.moduleType, documentId: this.selectedItem.id, customModuleId: this.selectedItem.customModuleId });
        }
        return;
      }
      // Enter only searches (no debounce); it never opens a hit.
      const value = (event.target as HTMLInputElement).value;
      void saveRecentSearch(value).catch(() => undefined);
      this.controller.searchNow(value, this.searchFilters());
    }
  }

  private onSearchStateChange(state: SearchControllerState): void {
    if (state.status === 'done') {
      // Keep the selection only while the selected hit is still in the new list.
      const keep = this.selectedItem ? state.results.findIndex((r) => r.id === this.selectedItem!.id && r.moduleType === this.selectedItem!.moduleType) : -1;
      if (keep >= 0) this.selectedIndex = keep;
      else this.clearSelection();
    } else if (state.status !== 'loading') {
      this.clearSelection();
    }
    this.renderResults(state);
    if (state.status === 'done' && this.pendingSelect) {
      const wanted = this.pendingSelect;
      this.pendingSelect = undefined;
      const index = state.results.findIndex((r) => r.id === wanted.id && r.moduleType === wanted.moduleType);
      if (index >= 0) this.selectIndex(index);
    }
  }

  private clearSelection(): void {
    const hadSelection = this.selectedItem !== null;
    this.selectedIndex = -1;
    this.selectedItem = null;
    if (hadSelection) this.showFocus();
  }

  private selectIndex(index: number): void {
    const item = this.controller.getState().results[index];
    if (!item) return;
    this.selectedIndex = index;
    this.selectedItem = item;
    void saveRecentSearch(this.controller.getState().query).catch(() => undefined);
    this.updateSelectionHighlight();
    this.showFocus();
  }

  /** Loads the selected hit into the focus pane; an earlier, slower load is cancelled first. */
  private showFocus(): void {
    this.cancelFocus?.();
    this.cancelFocus = null;
    const container = this.rootElement?.querySelector<HTMLElement>('[data-focus]');
    if (!container) return;
    if (!this.selectedItem) {
      renderFocusPaneHint(container);
      return;
    }
    this.cancelFocus = renderFocusPane(container, this.selectedItem, {
      pickMode: this.pickMode,
      onUseAsTarget: (item) => this.resolveAndClose(item),
      onLink: (item) => globalThis.AtlasFoundry.pickTarget?.(item),
    });
  }

  private renderResults(state: SearchControllerState): void {
    const status = this.rootElement?.querySelector<HTMLElement>('[data-status]');
    const results = this.rootElement?.querySelector<HTMLElement>('[data-results]');
    if (!status || !results) return;

    if (state.status === 'idle') {
      status.textContent = t('ATLASFOUNDRY.Search.MinLength');
      results.replaceChildren();
      this.renderRecent(results);
      return;
    }
    if (state.status === 'loading') {
      status.textContent = t('ATLASFOUNDRY.Search.Searching');
      return; // keep the previous result list visible while a new query is in flight
    }
    if (state.status === 'error') {
      status.textContent = t(state.errorKey ?? 'ATLASFOUNDRY.ApiError.Unknown');
      results.replaceChildren();
      return;
    }

    status.textContent = state.results.length
      ? t('ATLASFOUNDRY.Search.ResultCount', { count: state.results.length })
      : t('ATLASFOUNDRY.Search.NoResults');
    results.replaceChildren();
    state.results.forEach((item, index) => results.appendChild(this.renderResultCard(item, index, state.query)));
    this.updateSelectionHighlight();
  }

  /** Last typed searches as quick choices while the query is empty or too short. */
  private renderRecent(container: HTMLElement): void {
    const recent = getRecentSearches();
    if (!recent.length) return;

    const box = document.createElement('div');
    box.className = 'atlas-foundry-recent';
    const header = document.createElement('div');
    header.className = 'atlas-foundry-recent-header';
    const title = document.createElement('strong');
    title.textContent = t('ATLASFOUNDRY.Search.Recent');
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.textContent = t('ATLASFOUNDRY.Search.RecentClear');
    clear.addEventListener('click', () => {
      void clearRecentSearches()
        .catch(() => undefined)
        .then(() => this.renderResults(this.controller.getState()));
    });
    header.append(title, clear);
    box.appendChild(header);

    for (const query of recent) {
      const entry = document.createElement('button');
      entry.type = 'button';
      entry.className = 'atlas-foundry-recent-entry';
      entry.textContent = query;
      entry.addEventListener('click', () => {
        const input = this.rootElement?.querySelector<HTMLInputElement>('input[name="q"]');
        if (input) {
          input.value = query;
          input.focus();
        }
        this.controller.searchNow(query, this.searchFilters());
      });
      box.appendChild(entry);
    }
    container.appendChild(box);
  }

  private renderResultCard(item: AtlasSearchResult, index: number, query: string): HTMLElement {
    const card = document.createElement('div');
    card.className = 'atlas-foundry-search-card';
    card.dataset.index = String(index);

    const style = getTypeStyle(item.moduleType);
    card.style.setProperty('--atlas-type-color', style.color);
    const typeLabel =
      item.moduleType === 'custom' ? (item.customModuleLabel ?? t('ATLASFOUNDRY.Search.CustomModule')) : t(`ATLASFOUNDRY.ModuleTypes.${item.moduleType}`);
    // entryPlainText is plain text, not HTML (see search.service.ts's extractSnippet);
    // highlightTerms escapes it before marking, so it is safe for innerHTML.
    const snippet = item.entryPlainText ? highlightTerms(item.entryPlainText, query) : '';

    card.innerHTML = `
      <span class="atlas-foundry-search-card-thumb" data-thumb><i class="${style.icon}"></i></span>
      <div class="atlas-foundry-search-card-main">
        <strong>${foundry.utils.escapeHTML(formatDocumentTitle(item.moduleType, item.name, item.sessionNumber))}${item.postTitle ? ` — ${foundry.utils.escapeHTML(item.postTitle)}` : ''}</strong>
        <span class="atlas-foundry-search-card-type"><i class="${style.icon}"></i> ${foundry.utils.escapeHTML(typeLabel)}</span>
        ${snippet ? `<p class="atlas-foundry-search-card-snippet">${snippet}</p>` : ''}
        ${item.tags.length ? `<div class="atlas-foundry-search-card-badges">${item.tags.map((tag) => `<span class="atlas-foundry-tag">${foundry.utils.escapeHTML(tag)}</span>`).join('')}</div>` : ''}
      </div>
    `;

    // The backend may not fill imageUrl; without one (or when it fails to load) the
    // coloured icon tile stays. The image carries no data-action: clicking it only
    // selects the card, it never opens anything.
    const src = safeImageUrl(item.imageUrl ?? undefined, getBaseUrl());
    const thumb = card.querySelector<HTMLElement>('[data-thumb]');
    if (src && thumb) {
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.alt = '';
      img.draggable = false;
      img.addEventListener('load', () => thumb.classList.add('has-image'));
      img.addEventListener('error', () => img.remove());
      img.src = src;
      thumb.appendChild(img);
    }

    card.addEventListener('click', () => this.selectIndex(index));

    return card;
  }

  private updateSelectionHighlight(): void {
    const results = this.rootElement?.querySelector('[data-results]');
    if (!results) return;
    results.querySelectorAll('.atlas-foundry-search-card').forEach((card) => {
      card.classList.toggle('selected', Number((card as HTMLElement).dataset.index) === this.selectedIndex);
    });
    results.querySelector('.atlas-foundry-search-card.selected')?.scrollIntoView({ block: 'nearest' });
  }

  private resolveAndClose(item: AtlasSearchResult | null): void {
    const resolve = this.resolvePick;
    this.resolvePick = null;
    resolve?.(item);
    void this.close();
  }
}

/** Session reset: results belong to the sign-in that searched. A pending `pick()` resolves with null on close. */
export function closeSearch(): void {
  if (activeSearchApp) void activeSearchApp.close();
}
