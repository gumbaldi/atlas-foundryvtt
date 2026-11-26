import { t } from '../i18n';
import { MODULE_TYPE_ICONS } from '../constants';
import { linkVisibility } from '../links/link-visibility';
import { SearchApp } from '../search/search-app';
import { getDeadlineDocuments, setDeadlineDocuments } from '../settings';
import { MAX_DEADLINE_REFS, type DeadlineRef } from './deadline-refs';
import { addRef, removeRef } from './deadline-docs-state';

/** 'custom' isn't in MODULE_TYPE_ICONS. */
const CUSTOM_MODULE_ICON = 'fa-solid fa-puzzle-piece';

interface Row {
  ref: DeadlineRef;
  title?: string;
}

let instance: DeadlineDocsApp | null = null;

/** GM-only; a second call brings the open window to the front instead of opening another. */
export function openDeadlineDocsManager(): void {
  if (!game.user.isGM) return;
  if (instance) {
    void instance.render({ force: true });
    return;
  }
  instance = new DeadlineDocsApp();
  void instance.render(true);
}

/** Session reset: the resolved titles belong to the sign-in that loaded them. */
export function closeDeadlineDocsManager(): void {
  if (instance) void instance.close();
}

class DeadlineDocsApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS: foundry.applications.api.ApplicationV2Options = {
    classes: ['atlas-foundry', 'atlas-foundry-link-manager', 'atlas-foundry-deadline-docs'],
    window: { title: 'ATLASFOUNDRY.Deadlines.ManageTitle', icon: 'fa-solid fa-hourglass-half', resizable: true },
    position: { width: 480, height: 440 },
  };

  private rows: Row[] = [];
  private loading = true;

  constructor() {
    super();
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading = true;
    await this.render();

    const refs = getDeadlineDocuments();
    const result = await linkVisibility.check(refs);
    this.rows = refs.map((ref) => ({ ref, title: result.nameFor(ref) }));
    this.loading = false;
    await this.render();
  }

  protected async _renderHTML(): Promise<HTMLElement> {
    const esc = foundry.utils.escapeHTML;
    const root = document.createElement('section');
    root.className = 'atlas-foundry atlas-foundry-link-manager atlas-foundry-deadline-docs';
    root.innerHTML = `
      <p class="atlas-foundry-link-privacy-hint">${esc(t('ATLASFOUNDRY.Deadlines.ManageHint'))}</p>
      <div class="atlas-foundry-link-list" data-list>
        ${this.loading ? `<p class="atlas-foundry-status">${esc(t('ATLASFOUNDRY.Viewer.Loading'))}</p>` : this.renderRows()}
      </div>
      <button type="button" data-action="add"><i class="fa-solid fa-plus"></i> ${esc(t('ATLASFOUNDRY.Deadlines.ManageAdd'))}</button>
    `;
    return root;
  }

  private renderRows(): string {
    if (this.rows.length === 0) {
      return `<p class="atlas-foundry-status">${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Deadlines.ManageEmpty'))}</p>`;
    }
    return this.rows.map((row, index) => this.renderRow(row, index)).join('');
  }

  private renderRow(row: Row, index: number): string {
    const esc = foundry.utils.escapeHTML;
    const icon = (MODULE_TYPE_ICONS as Record<string, string | undefined>)[row.ref.moduleType] ?? CUSTOM_MODULE_ICON;
    const unresolved = row.title === undefined;
    const label = unresolved ? `${row.ref.moduleType} ${row.ref.documentId}` : row.title!;
    return `
      <div class="atlas-foundry-link-row${unresolved ? ' atlas-foundry-link-row-broken' : ''}" data-index="${index}">
        <div class="atlas-foundry-link-row-main">
          <strong><i class="${icon}"></i> ${esc(label)}</strong>
          ${unresolved ? `<span class="atlas-foundry-badge atlas-foundry-badge-restricted">${esc(t('ATLASFOUNDRY.Deadlines.ManageUnknown'))}</span>` : ''}
        </div>
        <div class="atlas-foundry-link-row-actions">
          <button type="button" data-action="remove" title="${esc(t('ATLASFOUNDRY.Links.Remove'))}"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    `;
  }

  protected async _replaceHTML(result: HTMLElement, content: HTMLElement): Promise<void> {
    content.replaceChildren(result);
    content.querySelector('[data-action="add"]')?.addEventListener('click', () => void this.handleAdd());
    content.querySelectorAll<HTMLElement>('[data-index]').forEach((row) => {
      const ref = this.rows[Number(row.dataset.index)]?.ref;
      if (ref) row.querySelector('[data-action="remove"]')?.addEventListener('click', () => void this.handleRemove(ref));
    });
  }

  private async handleAdd(): Promise<void> {
    const picked = await SearchApp.pick({ title: t('ATLASFOUNDRY.Links.PickTitle') });
    if (!picked) return;
    const result = addRef(getDeadlineDocuments(), { documentId: picked.id, moduleType: picked.moduleType });
    if (result.status === 'limit') {
      ui.notifications.warn(t('ATLASFOUNDRY.Deadlines.ManageLimit', { count: MAX_DEADLINE_REFS }));
      return;
    }
    if (result.status === 'duplicate') return;
    await setDeadlineDocuments(result.list);
    await this.load();
  }

  private async handleRemove(ref: DeadlineRef): Promise<void> {
    await setDeadlineDocuments(removeRef(getDeadlineDocuments(), ref));
    await this.load();
  }

  protected _onClose(options?: Record<string, unknown>): void {
    instance = null;
    super._onClose(options);
  }
}
