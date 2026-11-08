import { t } from '../i18n';
import { MODULE_TYPES, MODULE_TYPE_ICONS, type ModuleType } from '../constants';
import { authManager } from '../auth/auth-manager';
import { openLoginDialog } from '../auth/login-app';
import { getCampaignId } from '../settings';
import { atlasDocumentUrl } from '../deep-links';
import { openDocumentViewer } from '../apps/viewer-app';
import { SearchController, type SearchControllerState } from './search-controller';
import type { AtlasSearchResult } from '../atlas-types';

/**
 * "Verknüpfen…" (attach an Atlas result to a Foundry object) — P5's
 * feature, wired to `AtlasFoundry.pickTarget` (link-pick-target.ts). Link
 * management is GM-only (see plan's Auth-/Berechtigungsanforderungen), so
 * the button itself only ever renders for a GM.
 */
const LINKING_ENABLED = true;

export interface SearchAppOptions {
  title?: string;
  pickMode?: boolean;
}

let activeSearchApp: SearchApp | null = null;

export function openSearch(): void {
  if (activeSearchApp) {
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
    position: { width: 560, height: 640 },
  };

  /** Reused as the P5 link-picker (plan step 5/7): resolves with the chosen result instead of opening a viewer. */
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
  }

  protected _onClose(options?: Record<string, unknown>): void {
    if (activeSearchApp === this) activeSearchApp = null;
    if (this.resolvePick) {
      const resolve = this.resolvePick;
      this.resolvePick = null;
      resolve(null);
    }
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

  private triggerSearch(q: string): void {
    this.controller.update(q, { types: [...this.selectedTypes], nameOnly: this.nameOnly });
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
      this.selectedIndex = Math.min(this.selectedIndex + 1, state.results.length - 1);
      this.updateSelectionHighlight();
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!state.results.length) return;
      this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
      this.updateSelectionHighlight();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const item = state.results[this.selectedIndex];
      if (item) this.activateResult(item, this.selectedIndex);
    }
  }

  private onSearchStateChange(state: SearchControllerState): void {
    this.selectedIndex = state.results.length ? 0 : -1;
    this.renderResults(state);
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
    state.results.forEach((item, index) => results.appendChild(this.renderResultCard(item, index)));
    this.updateSelectionHighlight();
  }

  private renderResultCard(item: AtlasSearchResult, index: number): HTMLElement {
    const card = document.createElement('div');
    card.className = 'atlas-foundry-search-card';
    card.dataset.index = String(index);

    const icon = item.moduleType === 'custom' ? 'fa-solid fa-puzzle-piece' : MODULE_TYPE_ICONS[item.moduleType];
    const typeLabel =
      item.moduleType === 'custom' ? (item.customModuleLabel ?? t('ATLASFOUNDRY.Search.CustomModule')) : t(`ATLASFOUNDRY.ModuleTypes.${item.moduleType}`);
    // entryPlainText is plain text, not HTML (see search.service.ts's extractSnippet) —
    // escaped for safe innerHTML insertion, not run through the P4 HTML sanitizer,
    // which expects markup and would be the wrong tool for content that has none.
    const snippet = item.entryPlainText ? foundry.utils.escapeHTML(item.entryPlainText) : '';

    card.innerHTML = `
      <div class="atlas-foundry-search-card-main">
        <strong><i class="${icon}"></i> ${foundry.utils.escapeHTML(item.name)}${item.postTitle ? ` — ${foundry.utils.escapeHTML(item.postTitle)}` : ''}</strong>
        <span class="atlas-foundry-search-card-type">${foundry.utils.escapeHTML(typeLabel)}</span>
        ${snippet ? `<p class="atlas-foundry-search-card-snippet">${snippet}</p>` : ''}
        ${item.tags.length ? `<div class="atlas-foundry-search-card-badges">${item.tags.map((tag) => `<span class="atlas-foundry-tag">${foundry.utils.escapeHTML(tag)}</span>`).join('')}</div>` : ''}
      </div>
      <div class="atlas-foundry-search-card-actions">
        <button type="button" data-action="open-atlas" title="${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Viewer.OpenInAtlas'))}"><i class="fa-solid fa-up-right-from-square"></i></button>
        ${LINKING_ENABLED && game.user.isGM ? `<button type="button" data-action="link" title="${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Search.LinkAction'))}"><i class="fa-solid fa-link"></i></button>` : ''}
      </div>
    `;

    card.addEventListener('click', (event) => {
      if ((event.target as HTMLElement).closest('[data-action]')) return;
      this.activateResult(item, index);
    });
    card.querySelector('[data-action="open-atlas"]')?.addEventListener('click', (event) => {
      event.stopPropagation();
      this.openInAtlas(item);
    });
    if (LINKING_ENABLED && game.user.isGM) {
      card.querySelector('[data-action="link"]')?.addEventListener('click', (event) => {
        event.stopPropagation();
        globalThis.AtlasFoundry.pickTarget?.(item);
      });
    }

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

  private activateResult(item: AtlasSearchResult, index: number): void {
    this.selectedIndex = index;
    if (this.pickMode) {
      this.resolveAndClose(item);
      return;
    }
    openDocumentViewer({ moduleType: item.moduleType, documentId: item.id, name: item.name });
  }

  private openInAtlas(item: AtlasSearchResult): void {
    const campaignId = authManager.getLinkedCampaignId();
    if (!campaignId) return;
    const url =
      item.moduleType === 'custom'
        ? // Search results carry customModuleId directly (search.service.ts's DTO), unlike mentions.
          atlasDocumentUrl(campaignId, 'custom', item.id, item.customModuleId!)
        : atlasDocumentUrl(campaignId, item.moduleType, item.id);
    window.open(url, '_blank');
  }

  private resolveAndClose(item: AtlasSearchResult | null): void {
    const resolve = this.resolvePick;
    this.resolvePick = null;
    resolve?.(item);
    void this.close();
  }
}
