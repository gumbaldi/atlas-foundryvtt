import { t } from '../i18n';
import { MODULE_TYPE_ICONS } from '../constants';
import { linkVisibility, toRefs } from './link-visibility';
import { openLink } from './link-actions';
import type { AtlasLink } from './link-store';

/** 'custom' isn't in MODULE_TYPE_ICONS (see viewer-app.ts's same fallback). */
const CUSTOM_MODULE_ICON = 'fa-solid fa-puzzle-piece';

let activePopover: HTMLElement | null = null;
let activeCloseHandler: ((event: MouseEvent) => void) | null = null;

function closeActivePopover(): void {
  if (activePopover) {
    activePopover.remove();
    activePopover = null;
  }
  if (activeCloseHandler) {
    document.removeEventListener('pointerdown', activeCloseHandler, true);
    activeCloseHandler = null;
  }
}

function positionPopover(panel: HTMLElement, anchor: HTMLElement): void {
  const rect = anchor.getBoundingClientRect();
  panel.style.position = 'fixed';
  panel.style.top = `${rect.bottom + 4}px`;
  panel.style.left = `${rect.left}px`;
}

/**
 * Lightweight floating panel, not an ApplicationV2 — a transient,
 * anchor-positioned popover closer to Foundry's own ContextMenu than a
 * window. Shared by the sheet header's read-only view, the token HUD's
 * multi-link case, and the scene bar's overflow chip (plan's three
 * "read-only" entry points). Always re-checks visibility on open rather
 * than trusting a caller-supplied result, since links can go stale between
 * renders.
 */
export async function openLinksPopover(links: AtlasLink[], anchor: HTMLElement): Promise<void> {
  closeActivePopover();

  const panel = document.createElement('div');
  panel.className = 'atlas-foundry atlas-foundry-links-popover';
  panel.innerHTML = `<div class="atlas-foundry-status">${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Viewer.Loading'))}</div>`;
  document.body.appendChild(panel);
  positionPopover(panel, anchor);
  activePopover = panel;

  activeCloseHandler = (event: MouseEvent) => {
    if (panel.contains(event.target as Node) || anchor.contains(event.target as Node)) return;
    closeActivePopover();
  };
  document.addEventListener('pointerdown', activeCloseHandler, true);

  const result = await linkVisibility.check(toRefs(links));
  if (activePopover !== panel) return; // closed while the check was in flight

  if (result.failed) {
    panel.innerHTML = `<div class="atlas-foundry-status-error">${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Links.CheckFailed'))}</div>`;
    return;
  }

  const visibleLinks = links.filter((link) => result.isVisible(link));
  if (visibleLinks.length === 0) {
    panel.innerHTML = `<div class="atlas-foundry-status">${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Links.NoneVisible'))}</div>`;
    return;
  }

  panel.innerHTML = visibleLinks
    .map((link) => {
      const icon = link.moduleType === 'custom' ? CUSTOM_MODULE_ICON : ((MODULE_TYPE_ICONS as Record<string, string | undefined>)[link.moduleType] ?? CUSTOM_MODULE_ICON);
      const label = link.label ?? result.nameFor(link) ?? link.nameSnapshot;
      return `
        <button type="button" class="atlas-foundry-links-popover-item" data-link-id="${foundry.utils.escapeHTML(link.id)}">
          <i class="${icon}"></i> <span>${foundry.utils.escapeHTML(label)}</span>
        </button>
      `;
    })
    .join('');

  panel.querySelectorAll<HTMLButtonElement>('[data-link-id]').forEach((button) => {
    const link = visibleLinks.find((l) => l.id === button.dataset.linkId);
    if (!link) return;
    button.addEventListener('click', (event) => {
      closeActivePopover();
      openLink(link, { external: event.shiftKey || event.ctrlKey || event.metaKey, currentName: result.nameFor(link) });
    });
  });
}
