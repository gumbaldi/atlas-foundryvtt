import { t } from '../i18n';
import { log } from '../log';
import { MODULE_TYPE_ICONS, type ModuleType } from '../constants';
import { getDocument, refreshDocument } from '../api/documents';
import { apiErrorMessageKey, AtlasForbiddenError, AtlasNotFoundError } from '../api/errors';
import { renderEntryHtml } from '../render/entry-renderer';
import { atlasDocumentUrl } from '../deep-links';
import { authManager } from '../auth/auth-manager';
import type { AtlasDocumentDetail } from '../atlas-types';

type ViewerState = 'loading' | 'loaded' | 'error';

export interface AtlasViewerParams {
  moduleType: ModuleType | 'custom';
  documentId: string;
  /** Shown as the window title while the real name is still loading. */
  name?: string;
}

/** 'custom' isn't in MODULE_TYPE_ICONS (see @atlas/shared's fixed ModuleType) — a generic fallback icon. */
const CUSTOM_MODULE_ICON = 'fa-solid fa-puzzle-piece';

// One entry per open document — reopening the same document brings its
// window forward instead of spawning a duplicate (plan P4 step 7).
const openViewers = new Map<string, AtlasViewerApplication>();

export function openDocumentViewer(params: AtlasViewerParams): void {
  const existing = openViewers.get(params.documentId);
  if (existing) {
    existing.bringToFront();
    return;
  }
  new AtlasViewerApplication(params).render(true);
}

/**
 * Rebuilt from scratch for P4 (replaces the P1 port): loads its own data
 * (constructor takes only ids, never pre-fetched content — important for
 * P8, where a notification only carries an id), sanitizes+enriches its
 * entry, and never shows stale content after a 403/404 (content is cleared,
 * not left stale, per the plan's core "Atlas is the source of truth" rule).
 */
export class AtlasViewerApplication extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS: foundry.applications.api.ApplicationV2Options = {
    classes: ['atlas-foundry-viewer'],
    window: { title: 'ATLASFOUNDRY.Viewer.Title', icon: 'fa-solid fa-scroll', resizable: true },
    position: { width: 700, height: 680 },
  };

  private readonly moduleType: ModuleType | 'custom';
  private readonly documentId: string;
  private state: ViewerState = 'loading';
  private doc: AtlasDocumentDetail | null = null;
  private errorKey: string | null = null;
  private notFoundOrForbidden = false;

  constructor(params: AtlasViewerParams) {
    super({
      id: `atlas-viewer-${params.documentId}`,
      window: { title: params.name ?? 'ATLASFOUNDRY.Viewer.Title' },
    });
    this.moduleType = params.moduleType;
    this.documentId = params.documentId;
    openViewers.set(params.documentId, this);
    void this.load();
  }

  private async load(): Promise<void> {
    this.state = 'loading';
    try {
      this.doc = await getDocument(this.moduleType, this.documentId);
      this.state = 'loaded';
      this.errorKey = null;
      this.notFoundOrForbidden = false;
    } catch (err) {
      this.applyError(err);
    }
    await this.render();
  }

  private async refresh(): Promise<void> {
    this.state = 'loading';
    await this.render();
    try {
      this.doc = await refreshDocument(this.moduleType, this.documentId);
      this.state = 'loaded';
      this.errorKey = null;
      this.notFoundOrForbidden = false;
    } catch (err) {
      this.applyError(err);
    }
    await this.render();
  }

  private applyError(err: unknown): void {
    log.warn('Atlas Foundry: failed to load document', err);
    this.doc = null;
    this.state = 'error';
    this.errorKey = apiErrorMessageKey(err);
    this.notFoundOrForbidden = err instanceof AtlasForbiddenError || err instanceof AtlasNotFoundError;
  }

  private handleMentionActivate(moduleType: ModuleType | 'custom', documentId: string, openInAtlas: boolean): void {
    // Mentions never carry customModuleId (the frontend's own mention markup
    // doesn't attach it either) — a direct deep link isn't buildable yet, so
    // fall back to the in-Foundry viewer, which resolves it and offers its
    // own working "Open in Atlas" button once the document has loaded.
    if (openInAtlas && moduleType !== 'custom') {
      const campaignId = this.doc?.campaignId ?? authManager.getLinkedCampaignId();
      if (campaignId) window.open(atlasDocumentUrl(campaignId, moduleType, documentId), '_blank');
      return;
    }
    openDocumentViewer({ moduleType, documentId });
  }

  private openInAtlas(): void {
    if (!this.doc) return;
    const url =
      this.doc.moduleType === 'custom'
        ? // toDto() always sets customModuleId when moduleType is 'custom' (see foundry-user-documents.service.ts).
          atlasDocumentUrl(this.doc.campaignId, 'custom', this.doc.id, this.doc.customModuleId!)
        : atlasDocumentUrl(this.doc.campaignId, this.doc.moduleType, this.doc.id);
    window.open(url, '_blank');
  }

  protected async _renderHTML(): Promise<HTMLElement> {
    const root = document.createElement('article');
    root.className = 'atlas-foundry-viewer';

    if (this.state === 'loading') {
      root.innerHTML = `<div class="atlas-foundry-viewer-skeleton">${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Viewer.Loading'))}</div>`;
      return root;
    }

    if (this.state === 'error') {
      root.innerHTML = `
        <div class="atlas-foundry-viewer-error">
          ${this.notFoundOrForbidden ? `<p class="atlas-foundry-viewer-unavailable">${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Viewer.Unavailable'))}</p>` : ''}
          <p>${foundry.utils.escapeHTML(t(this.errorKey ?? 'ATLASFOUNDRY.ApiError.Unknown'))}</p>
          <button type="button" data-action="retry">${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Viewer.Retry'))}</button>
        </div>
      `;
      return root;
    }

    const doc = this.doc!;
    const image = doc.heroImageUrl || doc.imageUrl || '';
    const updatedAt = new Intl.DateTimeFormat(game.i18n.lang, { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(doc.updatedAt),
    );
    const isPublic = doc.readAccess?.includes('all') ?? true;
    const icon = doc.moduleType === 'custom' ? CUSTOM_MODULE_ICON : MODULE_TYPE_ICONS[doc.moduleType];
    const typeLabel =
      doc.moduleType === 'custom' ? (doc.customModuleLabel ?? t('ATLASFOUNDRY.Search.CustomModule')) : t(`ATLASFOUNDRY.ModuleTypes.${doc.moduleType}`);

    root.innerHTML = `
      <header class="atlas-foundry-viewer-header">
        ${image ? `<img src="${foundry.utils.escapeHTML(image)}" alt="">` : ''}
        <div class="atlas-foundry-viewer-heading">
          <h2>${foundry.utils.escapeHTML(doc.name)}</h2>
          <div class="atlas-foundry-viewer-badges">
            <span class="atlas-foundry-badge"><i class="${icon}"></i> ${foundry.utils.escapeHTML(typeLabel)}</span>
            ${!isPublic ? `<span class="atlas-foundry-badge atlas-foundry-badge-restricted">${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Viewer.RestrictedBadge'))}</span>` : ''}
            ${doc.tags.map((tag) => `<span class="atlas-foundry-tag">${foundry.utils.escapeHTML(tag)}</span>`).join('')}
          </div>
        </div>
      </header>
      <div class="atlas-foundry-viewer-toolbar">
        <button type="button" data-action="refresh">${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Viewer.Refresh'))}</button>
        <button type="button" data-action="open-atlas">${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Viewer.OpenInAtlas'))}</button>
      </div>
      <section class="atlas-foundry-viewer-body" data-body></section>
      <footer class="atlas-foundry-viewer-footer">${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Viewer.UpdatedAt', { date: updatedAt }))}</footer>
    `;

    const bodyContainer = root.querySelector<HTMLElement>('[data-body]');
    const entryElement = await renderEntryHtml(doc.entry, {
      onMentionActivate: (moduleType, documentId, openInAtlas) => this.handleMentionActivate(moduleType, documentId, openInAtlas),
    });
    bodyContainer?.appendChild(entryElement);

    return root;
  }

  protected async _replaceHTML(result: HTMLElement, content: HTMLElement): Promise<void> {
    content.replaceChildren(result);

    content.querySelector('[data-action="retry"]')?.addEventListener('click', () => {
      void this.load();
    });
    content.querySelector('[data-action="refresh"]')?.addEventListener('click', () => {
      void this.refresh();
    });
    content.querySelector('[data-action="open-atlas"]')?.addEventListener('click', () => this.openInAtlas());
  }

  protected _onClose(options?: Record<string, unknown>): void {
    openViewers.delete(this.documentId);
    super._onClose(options);
  }
}
