import { t } from '../i18n';
import { MODULE_TYPE_ICONS } from '../constants';
import { openDocumentViewer } from '../apps/viewer-app';
import { SearchApp } from '../search/search-app';
import { addLink, getLinks, removeLink, updateLinkLabel, type AtlasLink, type FlagCapableDocument } from './link-store';
import { linkVisibility, toRefs } from './link-visibility';
import type { ModuleType } from '../constants';

/** 'custom' isn't in MODULE_TYPE_ICONS (see viewer-app.ts's same fallback). */
const CUSTOM_MODULE_ICON = 'fa-solid fa-puzzle-piece';

export interface LinkManagerTarget {
  doc: FlagCapableDocument;
  /** Shown in the window title — the Foundry object's own name (Scene/Actor/Token/... name), not an Atlas document. */
  name: string;
}

interface RowState {
  link: AtlasLink;
  currentName?: string;
  broken: boolean;
}

export function openLinkManager(target: LinkManagerTarget): void {
  new LinkManagerApp(target).render(true);
}

/**
 * GM-only dialog (plan step 4/9) for the links stored on a single Foundry
 * object. Always runs its own visibility-check — even for the GM, who has
 * read access to everything readAccess-wise — purely to detect targets that
 * no longer resolve at all (deleted Atlas document, wrong campaign), which
 * `buildReadFilter`'s GM bypass wouldn't otherwise surface as "broken".
 */
const openManagers = new Set<LinkManagerApp>();

export class LinkManagerApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS: foundry.applications.api.ApplicationV2Options = {
    classes: ['atlas-foundry', 'atlas-foundry-link-manager'],
    window: { title: 'ATLASFOUNDRY.Links.ManagerTitle', icon: 'fa-solid fa-link', resizable: true },
    position: { width: 480, height: 480 },
  };

  private readonly target: LinkManagerTarget;
  private rows: RowState[] = [];
  private loading = true;
  private checkFailed = false;

  constructor(target: LinkManagerTarget) {
    super({ window: { title: target.name } });
    this.target = target;
    openManagers.add(this);
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading = true;
    await this.render();

    const links = getLinks(this.target.doc);
    const result = await linkVisibility.check(toRefs(links));
    this.rows = links.map((link) => ({
      link,
      currentName: result.nameFor(link),
      broken: !result.isVisible(link),
    }));
    this.checkFailed = result.failed;
    this.loading = false;
    await this.render();
  }

  protected async _renderHTML(): Promise<HTMLElement> {
    const root = document.createElement('section');
    root.className = 'atlas-foundry atlas-foundry-link-manager';
    root.innerHTML = `
      <p class="atlas-foundry-link-privacy-hint">${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Links.PrivacyHint'))}</p>
      ${this.checkFailed ? `<p class="atlas-foundry-status-error">${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Links.CheckFailed'))}</p>` : ''}
      <div class="atlas-foundry-link-list" data-list>
        ${this.loading ? `<p class="atlas-foundry-status">${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Viewer.Loading'))}</p>` : this.renderRows()}
      </div>
      <button type="button" data-action="add"><i class="fa-solid fa-plus"></i> ${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Links.AddButton'))}</button>
    `;
    return root;
  }

  private renderRows(): string {
    if (this.rows.length === 0) {
      return `<p class="atlas-foundry-status">${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Links.Empty'))}</p>`;
    }
    return this.rows.map((row) => this.renderRow(row)).join('');
  }

  private renderRow(row: RowState): string {
    const icon = row.link.moduleType === 'custom' ? CUSTOM_MODULE_ICON : (MODULE_TYPE_ICONS as Record<string, string | undefined>)[row.link.moduleType] ?? CUSTOM_MODULE_ICON;
    const displayName = row.currentName ?? row.link.nameSnapshot;
    const typeLabel =
      row.link.moduleType === 'custom' ? t('ATLASFOUNDRY.Search.CustomModule') : (t(`ATLASFOUNDRY.ModuleTypes.${row.link.moduleType}`) || row.link.moduleType);

    return `
      <div class="atlas-foundry-link-row${row.broken ? ' atlas-foundry-link-row-broken' : ''}" data-link-id="${foundry.utils.escapeHTML(row.link.id)}">
        <div class="atlas-foundry-link-row-main">
          <strong><i class="${icon}"></i> ${foundry.utils.escapeHTML(displayName)}</strong>
          <span class="atlas-foundry-link-row-type">${foundry.utils.escapeHTML(typeLabel)}</span>
          ${row.broken ? `<span class="atlas-foundry-badge atlas-foundry-badge-restricted">${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Links.Broken'))}</span>` : ''}
          <input
            type="text"
            class="atlas-foundry-link-label-input"
            data-action="label"
            value="${foundry.utils.escapeHTML(row.link.label ?? '')}"
            placeholder="${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Links.LabelPlaceholder'))}"
          >
        </div>
        <div class="atlas-foundry-link-row-actions">
          <button type="button" data-action="open" title="${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Viewer.Title'))}"><i class="fa-solid fa-eye"></i></button>
          <button type="button" data-action="remove" title="${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Links.Remove'))}"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    `;
  }

  protected async _replaceHTML(result: HTMLElement, content: HTMLElement): Promise<void> {
    content.replaceChildren(result);

    content.querySelector('[data-action="add"]')?.addEventListener('click', () => void this.handleAdd());

    content.querySelectorAll<HTMLElement>('[data-link-id]').forEach((row) => {
      const linkId = row.dataset.linkId!;
      row.querySelector('[data-action="open"]')?.addEventListener('click', () => this.handleOpen(linkId));
      row.querySelector('[data-action="remove"]')?.addEventListener('click', () => void this.handleRemove(linkId));

      const labelInput = row.querySelector<HTMLInputElement>('[data-action="label"]');
      labelInput?.addEventListener('change', () => void this.handleLabelChange(linkId, labelInput.value));
    });
  }

  private async handleAdd(): Promise<void> {
    const picked = await SearchApp.pick({ title: t('ATLASFOUNDRY.Links.PickTitle') });
    if (!picked) return;

    await addLink(this.target.doc, {
      documentId: picked.id,
      moduleType: picked.moduleType,
      nameSnapshot: picked.name,
    });
    await this.load();
  }

  private handleOpen(linkId: string): void {
    const row = this.rows.find((r) => r.link.id === linkId);
    if (!row) return;
    openDocumentViewer({
      moduleType: row.link.moduleType as ModuleType | 'custom',
      documentId: row.link.documentId,
      name: row.currentName ?? row.link.nameSnapshot,
    });
  }

  private async handleRemove(linkId: string): Promise<void> {
    await removeLink(this.target.doc, linkId);
    await this.load();
  }

  private async handleLabelChange(linkId: string, value: string): Promise<void> {
    await updateLinkLabel(this.target.doc, linkId, value);
    await this.load();
  }

  protected _onClose(options?: Record<string, unknown>): void {
    openManagers.delete(this);
    super._onClose(options);
  }
}

/** Session reset: link rows (names resolved per user) belong to the sign-in that loaded them. */
export function closeAllLinkManagers(): void {
  for (const manager of [...openManagers]) void manager.close();
}
