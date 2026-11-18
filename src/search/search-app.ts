import { t } from '../i18n';
import { MODULE_TYPES, type ModuleType } from '../constants';
import { safeImageUrl } from '../render/image-url';
import { getTypeStyle } from './type-style';
import { highlightTerms } from './highlight';
import { authManager } from '../auth/auth-manager';
import { openLoginDialog } from '../auth/login-app';
import { getBaseUrl, getCampaignId } from '../settings';
import { openInAtlas } from '../links/open-in-atlas';
import { SearchController, type SearchControllerState } from './search-controller';
import { renderFocusPane, renderFocusPaneHint } from './focus-pane';
import type { AtlasSearchResult } from '../atlas-types';

export interface SearchAppOptions {
  title?: string;
  pickMode?: boolean;
}

let activeSearchApp: SearchApp | null = null;

export function openSearch(): void {
  if (activeSearchApp) {
    if (activeSearchApp.minimized) void activeSearchApp.maximize();
    void activeSearchApp.render({ force: true });
    activeSearchApp.bringToFront();
    return;
  }
  activeSearchApp = new SearchApp();
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

  constructor(options: SearchAppOptions = {}) {
    super({ window: { title: options.title ?? 'ATLASFOUNDRY.Search.Title' } });
    this.pickMode = !!options.pickMode;
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
          <div class="atlas-foundry-search-chips" data-chips>
            ${MODULE_TYPES.map(
              (type) =>
                `<button type="button" class="atlas-foundry-chip" data-type="${type}">${foundry.utils.escapeHTML(t(`ATLASFOUNDRY.ModuleTypes.${type}`))}</button>`,
            ).join('')}
          </div>
          <label class="atlas-foundry-toggle">
            <input type="checkbox" name="nameOnly">
            ${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Search.NameOnly'))}
          </label>
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
  }

  protected _onClose(options?: Record<string, unknown>): void {
    if (activeSearchApp === this) activeSearchApp = null;
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

    content.querySelectorAll<HTMLButtonElement>('[data-chips] [data-type]').forEach((chip) => {
      chip.addEventListener('click', () => {
        const type = chip.dataset.type as ModuleType;
        if (this.selectedTypes.has(type)) this.selectedTypes.delete(type);
        else this.selectedTypes.add(type);
        chip.classList.toggle('active');
        this.triggerSearch(input?.value ?? '');
      });
    });

    content.querySelector<HTMLInputElement>('input[name="nameOnly"]')?.addEventListener('change', (event) => {
      this.nameOnly = (event.target as HTMLInputElement).checked;
      this.triggerSearch(input?.value ?? '');
    });
  }

  private searchFilters(): { types: ModuleType[]; nameOnly: boolean } {
    return { types: [...this.selectedTypes], nameOnly: this.nameOnly };
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
      this.controller.searchNow((event.target as HTMLInputElement).value, this.searchFilters());
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
        <strong>${foundry.utils.escapeHTML(item.name)}${item.postTitle ? ` — ${foundry.utils.escapeHTML(item.postTitle)}` : ''}</strong>
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
