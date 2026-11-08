import { sanitizeEntryHtml } from './sanitize';
import { t } from '../i18n';
import { log } from '../log';
import type { ModuleType } from '../constants';

export interface EntryRenderOptions {
  /**
   * Fired when a mention is activated. `openInAtlas` is true for a
   * shift-click or right-click (context menu) — the caller (viewer-app.ts)
   * decides what that means (deep link vs. in-Foundry viewer), since it
   * owns campaignId/locale, not this module.
   */
  onMentionActivate: (moduleType: ModuleType | 'custom', documentId: string, openInAtlas: boolean) => void;
}

function activateMentions(container: HTMLElement, onMentionActivate: EntryRenderOptions['onMentionActivate']): void {
  container.querySelectorAll<HTMLElement>('[data-document-id][data-module-type]').forEach((el) => {
    const moduleType = el.getAttribute('data-module-type') as ModuleType | 'custom';
    const documentId = el.getAttribute('data-document-id');
    if (!documentId) return;

    el.classList.add('atlas-mention');
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');

    el.addEventListener('click', (event) => {
      event.preventDefault();
      onMentionActivate(moduleType, documentId, (event as MouseEvent).shiftKey);
    });
    el.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      onMentionActivate(moduleType, documentId, true);
    });
    el.addEventListener('keydown', (event) => {
      const key = (event as KeyboardEvent).key;
      if (key === 'Enter' || key === ' ') {
        event.preventDefault();
        onMentionActivate(moduleType, documentId, false);
      }
    });
  });
}

/** Broken image → an inline text placeholder instead of a permanently-broken image icon. */
function activateImageFallbacks(container: HTMLElement): void {
  container.querySelectorAll('img').forEach((img) => {
    img.setAttribute('loading', 'lazy');
    img.addEventListener(
      'error',
      () => {
        const placeholder = document.createElement('span');
        placeholder.className = 'atlas-foundry-image-fallback';
        placeholder.textContent = t('ATLASFOUNDRY.Entry.ImageUnavailable');
        img.replaceWith(placeholder);
      },
      { once: true },
    );
  });
}

/**
 * sanitize → enrich → mentions/images (order matters, see P4 plan): the
 * sanitizer removes anything unsafe first, then Foundry's own `enrichHTML`
 * (trusted, since it's Foundry's own transformation) resolves `@UUID[...]`
 * and dice-roll syntax GMs may have written into an Atlas text.
 */
export async function renderEntryHtml(rawHtml: string, options: EntryRenderOptions): Promise<HTMLElement> {
  const sanitized = sanitizeEntryHtml(rawHtml);

  let enriched = sanitized;
  try {
    enriched = await foundry.applications.ux.TextEditor.implementation.enrichHTML(sanitized, { async: true });
  } catch (err) {
    log.warn('Atlas Foundry: enrichHTML failed, showing sanitized entry as-is', err);
  }

  const container = document.createElement('div');
  container.className = 'atlas-foundry-entry';
  container.innerHTML = enriched;

  activateMentions(container, options.onMentionActivate);
  activateImageFallbacks(container);

  return container;
}
