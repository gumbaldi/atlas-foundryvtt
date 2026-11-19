import { formatDocumentTitle } from '../render/document-title';
import { t } from '../i18n';
import { log } from '../log';
import { MODULE_TYPE_ICONS } from '../constants';
import { getDocument } from '../api/documents';
import { apiErrorMessageKey, AtlasForbiddenError, AtlasNotFoundError } from '../api/errors';
import { renderEntryHtml } from '../render/entry-renderer';
import { describeDeadline } from '../render/deadline-line';
import { safeImageUrl } from '../render/image-url';
import { openImageLightbox } from '../render/lightbox';
import { openInAtlas } from '../links/open-in-atlas';
import { authManager } from '../auth/auth-manager';
import { getBaseUrl } from '../settings';
import type { AtlasDocumentDetail, AtlasSearchResult } from '../atlas-types';

/** 'custom' isn't in MODULE_TYPE_ICONS (see @atlas/shared's fixed ModuleType) — a generic fallback icon. */
const CUSTOM_MODULE_ICON = 'fa-solid fa-puzzle-piece';

export interface FocusPaneOptions {
  /** Pick mode: shows the primary "Use as target" button instead of "Link…". */
  pickMode: boolean;
  /** Called by "Use as target" (pick mode only). */
  onUseAsTarget: (selection: AtlasSearchResult) => void;
  /** Called by "Link…" (game master, outside pick mode only). */
  onLink: (selection: AtlasSearchResult) => void;
}

const esc = (value: string): string => foundry.utils.escapeHTML(value);

/** Empty state until a hit is selected. */
export function renderFocusPaneHint(container: HTMLElement): void {
  container.replaceChildren();
  const hint = document.createElement('p');
  hint.className = 'atlas-foundry-focus-hint';
  hint.textContent = t('ATLASFOUNDRY.Search.FocusHint');
  container.appendChild(hint);
}

/**
 * Loads `selection` and renders it into `container` (header image, badges,
 * deadline, toolbar, entry, footer). Returns a cancel function: once called, a
 * slow load or entry render never touches the container, so an earlier
 * selection can't overwrite a newer one. A session reset cancels as well.
 */
export function renderFocusPane(container: HTMLElement, selection: AtlasSearchResult, options: FocusPaneOptions): () => void {
  let cancelled = false;
  const epoch = authManager.getSessionEpoch();
  const isLive = (): boolean => !cancelled && epoch === authManager.getSessionEpoch();

  const showError = (err: unknown): void => {
    log.warn('Atlas Foundry: failed to load document', err);
    const unavailable = err instanceof AtlasForbiddenError || err instanceof AtlasNotFoundError;
    container.innerHTML = `
      <div class="atlas-foundry-focus-error">
        ${unavailable ? `<p class="atlas-foundry-focus-unavailable">${esc(t('ATLASFOUNDRY.Viewer.Unavailable'))}</p>` : ''}
        <p>${esc(t(apiErrorMessageKey(err)))}</p>
        <button type="button" data-action="retry">${esc(t('ATLASFOUNDRY.Viewer.Retry'))}</button>
      </div>
    `;
    container.querySelector('[data-action="retry"]')?.addEventListener('click', () => void load());
  };

  const showDocument = async (doc: AtlasDocumentDetail): Promise<void> => {
    const root = document.createElement('article');
    root.className = 'atlas-foundry-focus-article';

    const updatedAt = new Intl.DateTimeFormat(game.i18n.lang, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(doc.updatedAt));
    const isPublic = doc.readAccess?.includes('all') ?? true;
    const icon = doc.moduleType === 'custom' ? CUSTOM_MODULE_ICON : MODULE_TYPE_ICONS[doc.moduleType];
    const typeLabel =
      doc.moduleType === 'custom' ? (doc.customModuleLabel ?? t('ATLASFOUNDRY.Search.CustomModule')) : t(`ATLASFOUNDRY.ModuleTypes.${doc.moduleType}`);

    const title = formatDocumentTitle(doc.moduleType, doc.name, selection.sessionNumber ?? doc.sessionNumber);
    const deadline = describeDeadline(doc);
    const deadlineLine = deadline
      ? `<div class="atlas-foundry-focus-deadline">${[
          deadline.stateKey ? `<span class="atlas-foundry-badge">${esc(t(deadline.stateKey))}</span>` : '',
          deadline.dueText ? `<span>${esc(deadline.dueText)}</span>` : '',
          deadline.remainingKey ? `<span>${esc(t(deadline.remainingKey, { count: deadline.remainingCount }))}</span>` : '',
        ].join(' ')}</div>`
      : '';

    const primaryAction = options.pickMode
      ? `<button type="button" class="atlas-foundry-primary" data-action="use-target"><i class="fa-solid fa-check"></i> ${esc(t('ATLASFOUNDRY.Search.UseAsTarget'))}</button>`
      : '';
    const linkAction =
      !options.pickMode && game.user.isGM
        ? `<button type="button" data-action="link"><i class="fa-solid fa-link"></i> ${esc(t('ATLASFOUNDRY.Search.Link'))}</button>`
        : '';

    root.innerHTML = `
      <header class="atlas-foundry-focus-header">
        <div class="atlas-foundry-focus-image" data-image hidden></div>
        <div class="atlas-foundry-focus-heading">
          <h2>${esc(title)}</h2>
          <div class="atlas-foundry-focus-badges">
            <span class="atlas-foundry-badge"><i class="${icon}"></i> ${esc(typeLabel)}</span>
            ${!isPublic ? `<span class="atlas-foundry-badge atlas-foundry-badge-restricted">${esc(t('ATLASFOUNDRY.Viewer.RestrictedBadge'))}</span>` : ''}
            ${doc.tags.map((tag) => `<span class="atlas-foundry-tag">${esc(tag)}</span>`).join('')}
          </div>
          ${deadlineLine}
        </div>
      </header>
      <div class="atlas-foundry-focus-toolbar">
        ${primaryAction}
        <button type="button" data-action="open-atlas"><i class="fa-solid fa-up-right-from-square"></i> ${esc(t('ATLASFOUNDRY.Viewer.OpenInAtlas'))}</button>
        ${linkAction}
      </div>
      <section class="atlas-foundry-focus-body" data-body></section>
      <footer class="atlas-foundry-focus-footer">${esc(t('ATLASFOUNDRY.Viewer.UpdatedAt', { date: updatedAt }))}</footer>
    `;

    // The title image URL is untrusted: only http(s) passes, and it is set as a DOM property, not as markup.
    const imageSrc = safeImageUrl(doc.heroImageUrl || doc.imageUrl || undefined, getBaseUrl());
    const imageSlot = root.querySelector<HTMLElement>('[data-image]');
    if (imageSrc && imageSlot) {
      const img = document.createElement('img');
      img.alt = title;
      img.title = t('ATLASFOUNDRY.Search.EnlargeImage');
      img.addEventListener('load', () => (imageSlot.hidden = false));
      img.addEventListener('error', () => imageSlot.remove());
      img.addEventListener('click', () => openImageLightbox(imageSrc, title));
      img.src = imageSrc;
      imageSlot.appendChild(img);
    }

    root.querySelector('[data-action="use-target"]')?.addEventListener('click', () => options.onUseAsTarget(selection));
    root.querySelector('[data-action="link"]')?.addEventListener('click', () => options.onLink(selection));
    root.querySelector('[data-action="open-atlas"]')?.addEventListener('click', () => {
      void openInAtlas({ moduleType: doc.moduleType, documentId: doc.id, customModuleId: doc.customModuleId });
    });

    const entryElement = await renderEntryHtml(doc.entry, {
      // Mentions never carry customModuleId; openInAtlas resolves it for custom documents.
      onMentionActivate: (moduleType, documentId) => void openInAtlas({ moduleType, documentId }),
    });
    if (!isLive()) return;
    root.querySelector('[data-body]')?.appendChild(entryElement);
    container.replaceChildren(root);
  };

  const load = async (): Promise<void> => {
    container.innerHTML = `<div class="atlas-foundry-focus-skeleton">${esc(t('ATLASFOUNDRY.Viewer.Loading'))}</div>`;
    try {
      const doc = await getDocument(selection.moduleType, selection.id);
      if (!isLive()) return;
      await showDocument(doc);
    } catch (err) {
      if (!isLive()) return;
      showError(err);
    }
  };

  void load();
  return () => {
    cancelled = true;
  };
}
