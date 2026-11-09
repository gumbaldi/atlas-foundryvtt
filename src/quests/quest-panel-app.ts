import { t } from '../i18n';
import { authManager } from '../auth/auth-manager';
import { openLoginDialog } from '../auth/login-app';
import { getConnectionStatus } from '../auth/status';
import { getQuestPanelPosition, setQuestPanelPosition } from '../settings';
import { fetchQuests, refreshQuests } from './quests-api';
import { openDocumentViewer } from '../apps/viewer-app';
import { atlasDocumentUrl } from '../deep-links';
import { apiErrorMessageKey } from '../api/errors';
import type { AtlasQuest, AtlasQuestRef, AtlasQuestStatus, AtlasQuestsResponse } from '../atlas-types';

type PanelState = 'loading' | 'loaded' | 'error';
type StatusFilter = AtlasQuestStatus | 'all';

const STATUS_GROUPS: AtlasQuestStatus[] = ['open', 'completed', 'failed'];
const STATUS_ICONS: Record<AtlasQuestStatus, string> = {
  open: 'fa-solid fa-circle',
  completed: 'fa-solid fa-circle-check',
  failed: 'fa-solid fa-circle-xmark',
};

let activePanel: QuestPanelApp | null = null;

export function openQuestPanel(): void {
  if (activePanel) {
    activePanel.bringToFront();
    return;
  }
  activePanel = new QuestPanelApp();
  void activePanel.render(true);
}

interface QuestRow {
  quest: AtlasQuest;
  indented: boolean;
}

/**
 * Orders one status-group's quests: roots first, their direct same-status
 * children indented beneath them (plan: "sub-quests indented … max. 2
 * levels, rest flat"), everything else (grandchildren, cyclical
 * `parentId` chains) appended flat rather than nested — nesting is scoped
 * to quests sharing a status group, since a parent/child pair can land in
 * different groups and cross-group nesting has no sensible visual meaning.
 */
function orderQuestsForGroup(quests: AtlasQuest[]): QuestRow[] {
  const byId = new Map(quests.map((q) => [q.id, q]));

  function isCycleMember(quest: AtlasQuest): boolean {
    let current: AtlasQuest | undefined = quest;
    const visited = new Set<string>();
    while (current?.parentId) {
      if (visited.has(current.id)) return true;
      visited.add(current.id);
      const next = byId.get(current.parentId);
      if (next?.id === quest.id) return true;
      current = next;
    }
    return false;
  }

  const roots = quests.filter((q) => !q.parentId || !byId.has(q.parentId) || isCycleMember(q));
  const rootIds = new Set(roots.map((q) => q.id));
  const childrenOf = new Map<string, AtlasQuest[]>();
  for (const quest of quests) {
    if (rootIds.has(quest.id) || !quest.parentId) continue;
    if (!childrenOf.has(quest.parentId)) childrenOf.set(quest.parentId, []);
    childrenOf.get(quest.parentId)!.push(quest);
  }

  const rows: QuestRow[] = [];
  for (const root of roots) {
    rows.push({ quest: root, indented: false });
    for (const child of childrenOf.get(root.id) ?? []) {
      rows.push({ quest: child, indented: true });
    }
  }
  const placed = new Set(rows.map((r) => r.quest.id));
  for (const quest of quests) {
    if (!placed.has(quest.id)) rows.push({ quest, indented: false });
  }
  return rows;
}

/**
 * Standalone, dockable panel (plan's explicit choice over a Sidebar tab —
 * see the plan's "UI location"-decision). Read-only: Atlas has no `objectives`
 * field on quests (verified against quest.schema.ts, not assumed), so
 * there's no checklist here — only status, an entry snippet, and
 * mention-derived character/location reference chips.
 */
export class QuestPanelApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS: foundry.applications.api.ApplicationV2Options = {
    id: 'atlas-quest-panel',
    classes: ['atlas-foundry', 'atlas-foundry-quest-panel'],
    window: { title: 'ATLASFOUNDRY.Quests.Title', icon: 'fa-solid fa-scroll', resizable: true },
    position: { width: 380, height: 560 },
  };

  private state: PanelState = 'loading';
  private errorKey: string | null = null;
  private data: AtlasQuestsResponse | null = null;
  private statusFilter: StatusFilter = 'open';
  private collapsedGroups = new Set<AtlasQuestStatus>(['completed', 'failed']);
  private rootElement: HTMLElement | null = null;

  constructor() {
    // Read the stored position here, not in DEFAULT_OPTIONS: static fields run
    // while the ES module is evaluated, before `init` has registered the setting.
    super({ position: { width: 380, height: 560, ...getQuestPanelPosition() } });
    void this.load();
  }

  private async load(): Promise<void> {
    this.state = 'loading';
    await this.render();
    try {
      this.data = await fetchQuests({ status: this.statusFilter });
      this.state = 'loaded';
      this.errorKey = null;
    } catch (err) {
      this.data = null;
      this.state = 'error';
      this.errorKey = apiErrorMessageKey(err);
    }
    await this.render();
  }

  /** Public so `registerQuestPanel()`'s socket-invalidation hook (below) can trigger it on the active instance. */
  async refresh(): Promise<void> {
    this.state = 'loading';
    await this.render();
    try {
      this.data = await refreshQuests({ status: this.statusFilter });
      this.state = 'loaded';
      this.errorKey = null;
    } catch (err) {
      this.data = null;
      this.state = 'error';
      this.errorKey = apiErrorMessageKey(err);
    }
    await this.render();
  }

  private async setStatusFilter(filter: StatusFilter): Promise<void> {
    if (this.statusFilter === filter) return;
    this.statusFilter = filter;
    await this.load();
  }

  protected async _renderHTML(): Promise<HTMLElement> {
    const root = document.createElement('section');
    root.className = 'atlas-foundry atlas-foundry-quest-panel';

    if (!authManager.isLinked()) {
      root.innerHTML = `
        <div class="atlas-foundry-status">${foundry.utils.escapeHTML(t('ATLASFOUNDRY.NotConnected.Message'))}</div>
        <button type="button" data-action="connect">${foundry.utils.escapeHTML(t('ATLASFOUNDRY.NotConnected.ConnectButton'))}</button>
      `;
      return root;
    }

    const status = getConnectionStatus();
    root.innerHTML = `
      <header class="atlas-foundry-quest-panel-header">
        <div class="atlas-foundry-status-row">
          <span class="atlas-foundry-dot atlas-foundry-dot-${status.color}"></span>
          <span data-header-status>${foundry.utils.escapeHTML(t(status.messageKey, status.messageData))}</span>
          <button type="button" data-action="refresh" title="${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Viewer.Refresh'))}"><i class="fa-solid fa-rotate"></i></button>
        </div>
        <div class="atlas-foundry-quest-panel-filters" data-filters>
          ${(['open', 'completed', 'failed', 'all'] as StatusFilter[])
            .map(
              (filter) =>
                `<button type="button" class="atlas-foundry-chip${this.statusFilter === filter ? ' active' : ''}" data-filter="${filter}">${foundry.utils.escapeHTML(t(`ATLASFOUNDRY.Quests.Filter.${filter}`))}</button>`,
            )
            .join('')}
        </div>
      </header>
      <div class="atlas-foundry-quest-panel-body" data-body></div>
    `;

    const body = root.querySelector<HTMLElement>('[data-body]')!;
    body.appendChild(this.renderBody());
    return root;
  }

  private renderBody(): HTMLElement {
    const body = document.createElement('div');

    if (this.state === 'loading') {
      body.innerHTML = `<div class="atlas-foundry-status">${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Viewer.Loading'))}</div>`;
      return body;
    }
    if (this.state === 'error') {
      body.innerHTML = `
        <div class="atlas-foundry-viewer-error">
          <p>${foundry.utils.escapeHTML(t(this.errorKey ?? 'ATLASFOUNDRY.ApiError.Unknown'))}</p>
          <button type="button" data-action="retry">${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Viewer.Retry'))}</button>
        </div>
      `;
      return body;
    }

    const quests = this.data?.quests ?? [];
    if (quests.length === 0) {
      body.innerHTML = `<div class="atlas-foundry-status">${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Quests.Empty'))}</div>`;
      return body;
    }

    const refsByType = { characters: this.buildRefLookup(this.data?.refs.characters), locations: this.buildRefLookup(this.data?.refs.locations) };
    const groups = this.statusFilter === 'all' ? STATUS_GROUPS : [this.statusFilter as AtlasQuestStatus];

    for (const status of groups) {
      const inGroup = quests.filter((q) => q.status === status);
      if (inGroup.length === 0) continue;
      body.appendChild(this.renderGroup(status, inGroup, refsByType));
    }

    return body;
  }

  private buildRefLookup(refs?: AtlasQuestRef[]): Map<string, string> {
    return new Map((refs ?? []).map((r) => [r.id, r.name]));
  }

  private renderGroup(status: AtlasQuestStatus, quests: AtlasQuest[], refsByType: { characters: Map<string, string>; locations: Map<string, string> }): HTMLElement {
    const section = document.createElement('div');
    section.className = 'atlas-foundry-quest-group';
    const collapsed = this.collapsedGroups.has(status);

    const header = document.createElement('button');
    header.type = 'button';
    header.className = 'atlas-foundry-quest-group-header';
    header.dataset.groupToggle = status;
    header.innerHTML = `<i class="fa-solid fa-chevron-${collapsed ? 'right' : 'down'}"></i> ${foundry.utils.escapeHTML(t(`ATLASFOUNDRY.Quests.Filter.${status}`))} (${quests.length})`;
    section.appendChild(header);

    if (!collapsed) {
      const list = document.createElement('div');
      list.className = 'atlas-foundry-quest-group-list';
      for (const row of orderQuestsForGroup(quests)) {
        list.appendChild(this.renderQuestCard(row, refsByType));
      }
      section.appendChild(list);
    }

    return section;
  }

  private renderQuestCard(row: QuestRow, refsByType: { characters: Map<string, string>; locations: Map<string, string> }): HTMLElement {
    const { quest } = row;
    const card = document.createElement('div');
    card.className = `atlas-foundry-quest-card${row.indented ? ' atlas-foundry-quest-card-indented' : ''}`;
    card.dataset.questId = quest.id;

    const chips = [
      ...quest.characterIds.map((id) => ({ id, moduleType: 'characters' as const, name: refsByType.characters.get(id) })),
      ...quest.locationIds.map((id) => ({ id, moduleType: 'locations' as const, name: refsByType.locations.get(id) })),
    ].filter((c): c is { id: string; moduleType: 'characters' | 'locations'; name: string } => !!c.name);

    card.innerHTML = `
      <div class="atlas-foundry-quest-card-title">
        <i class="${STATUS_ICONS[quest.status]} atlas-foundry-quest-status-icon atlas-foundry-quest-status-${quest.status}"></i>
        <span data-action="open-viewer">${foundry.utils.escapeHTML(quest.name)}</span>
        ${quest.isGmOnly ? `<i class="fa-solid fa-shield-halved atlas-foundry-quest-gm-icon" title="${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Quests.GmOnlyHint'))}"></i>` : ''}
        <button type="button" data-action="open-atlas" title="${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Viewer.OpenInAtlas'))}"><i class="fa-solid fa-up-right-from-square"></i></button>
      </div>
      ${quest.entryPlainText ? `<p class="atlas-foundry-quest-card-snippet">${foundry.utils.escapeHTML(quest.entryPlainText)}</p>` : ''}
      ${chips.length ? `<div class="atlas-foundry-quest-card-refs">${chips.map((c) => `<button type="button" class="atlas-foundry-tag" data-ref-id="${foundry.utils.escapeHTML(c.id)}" data-ref-type="${c.moduleType}">${foundry.utils.escapeHTML(c.name)}</button>`).join('')}</div>` : ''}
    `;

    return card;
  }

  protected async _replaceHTML(result: HTMLElement, content: HTMLElement): Promise<void> {
    content.replaceChildren(result);
    this.rootElement = content;

    content.querySelector('[data-action="connect"]')?.addEventListener('click', () => {
      openLoginDialog().catch(() => undefined);
    });
    content.querySelector('[data-action="refresh"]')?.addEventListener('click', () => void this.refresh());
    content.querySelector('[data-action="retry"]')?.addEventListener('click', () => void this.load());

    content.querySelectorAll<HTMLButtonElement>('[data-filters] [data-filter]').forEach((chip) => {
      chip.addEventListener('click', () => void this.setStatusFilter(chip.dataset.filter as StatusFilter));
    });

    content.querySelectorAll<HTMLButtonElement>('[data-group-toggle]').forEach((header) => {
      header.addEventListener('click', () => {
        const status = header.dataset.groupToggle as AtlasQuestStatus;
        if (this.collapsedGroups.has(status)) this.collapsedGroups.delete(status);
        else this.collapsedGroups.add(status);
        void this.render();
      });
    });

    content.querySelectorAll<HTMLElement>('[data-quest-id]').forEach((card) => {
      const questId = card.dataset.questId!;
      const quest = this.data?.quests.find((q) => q.id === questId);
      if (!quest) return;

      card.querySelector('[data-action="open-viewer"]')?.addEventListener('click', () => {
        openDocumentViewer({ moduleType: 'quests', documentId: quest.id, name: quest.name });
      });
      card.querySelector('[data-action="open-atlas"]')?.addEventListener('click', (event) => {
        event.stopPropagation();
        const campaignId = authManager.getLinkedCampaignId();
        if (campaignId) window.open(atlasDocumentUrl(campaignId, 'quests', quest.id), '_blank');
      });
      card.querySelectorAll<HTMLButtonElement>('[data-ref-id]').forEach((chip) => {
        chip.addEventListener('click', (event) => {
          event.stopPropagation();
          const moduleType = chip.dataset.refType as 'characters' | 'locations';
          openDocumentViewer({ moduleType, documentId: chip.dataset.refId!, name: chip.textContent ?? undefined });
        });
      });
    });
  }

  protected _onClose(options?: Record<string, unknown>): void {
    if (activePanel === this) activePanel = null;
    const { top, left, width, height } = this.position;
    void setQuestPanelPosition({ top, left, width, height });
    super._onClose(options);
  }
}

/**
 * Scene-controls tool (visible to everyone, players track quests too —
 * unlike P5's GM-only link tools) + best-effort live invalidation: no
 * backend event carries `documentModuleType` yet (that's P8, unbuilt), so
 * this is presently inert and the 30s cache TTL + manual refresh are the
 * real update path, exactly as the plan anticipates.
 */
export function registerQuestPanel(): void {
  Hooks.on('getSceneControlButtons', (controls: Record<string, any>) => {
    const tokens = controls.tokens;
    if (!tokens?.tools) return;
    tokens.tools.atlasQuests = {
      name: 'atlasQuests',
      title: 'ATLASFOUNDRY.Quests.ControlTool',
      icon: 'fa-solid fa-scroll',
      button: true,
      order: 102,
      onChange: () => openQuestPanel(),
    };
  });

  Hooks.on('atlas-foundry.socketEvent', (_event: string, payload: unknown) => {
    const moduleType = (payload as { documentModuleType?: string } | null)?.documentModuleType;
    if (moduleType === 'quests' && activePanel) void activePanel.refresh();
  });
}

/** Session reset: the quest list belongs to the sign-in that loaded it. */
export function closeQuestPanel(): void {
  if (activePanel) void activePanel.close();
}
