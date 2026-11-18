import { ensureAtlasGroup } from '../controls';
import { t } from '../i18n';
import { authManager } from '../auth/auth-manager';
import { getRightHud, removeRightHudIfEmpty } from '../hud-right';
import { atlasQuestsUrl } from '../deep-links';
import { openInAtlas } from '../links/open-in-atlas';
import { getShowQuestTracker, setShowQuestTracker } from '../settings';
import { fetchQuests, refreshQuests } from './quests-api';
import { countTrackedQuests, selectTrackedQuests } from './quest-selection';
import type { AtlasQuest } from '../atlas-types';

export { selectTrackedQuests };

const TRACKER_ID = 'atlas-foundry-quest-tracker';
const POLL_INTERVAL_MS = 5 * 60 * 1000;

let quests: AtlasQuest[] = [];
let loaded = false;
// Re-entrancy guard: auth, socket, poll and toggle can all trigger a load in a
// burst — only the most recent one may write the result.
let loadToken = 0;
let pollTimer: ReturnType<typeof setInterval> | null = null;

function removeTracker(): void {
  document.getElementById(TRACKER_ID)?.remove();
  removeRightHudIfEmpty();
}

function stopPolling(): void {
  if (pollTimer !== null) clearInterval(pollTimer);
  pollTimer = null;
}

/** Polls only while the tracker is expanded and the user is signed in. */
function syncPolling(): void {
  const shouldPoll = authManager.isLinked() && getShowQuestTracker();
  if (!shouldPoll) {
    stopPolling();
    return;
  }
  if (pollTimer === null) pollTimer = setInterval(() => void load(true), POLL_INTERVAL_MS);
}

function buildCard(quest: AtlasQuest): HTMLElement {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'atlas-foundry-quest-tracker-card';
  card.dataset.questId = quest.id;

  const name = document.createElement('span');
  name.className = 'atlas-foundry-quest-tracker-name';
  name.textContent = quest.name;
  card.appendChild(name);

  if (quest.entryPlainText) {
    const text = document.createElement('span');
    text.className = 'atlas-foundry-quest-tracker-text';
    text.textContent = quest.entryPlainText;
    card.appendChild(text);
  }

  card.addEventListener('click', () => void openInAtlas({ moduleType: 'quests', documentId: quest.id }));
  return card;
}

function openQuestList(): void {
  const campaignId = authManager.getLinkedCampaignId();
  if (campaignId) window.open(atlasQuestsUrl(campaignId), '_blank');
}

function buildCollapseButton(): HTMLElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'atlas-foundry-scene-links-collapse atlas-foundry-quest-tracker-collapse';
  button.title = t('ATLASFOUNDRY.Quests.Collapse');
  button.innerHTML = '<i class="fa-solid fa-chevron-up"></i>';
  button.addEventListener('click', () => void setShowQuestTracker(false));
  return button;
}

function buildPill(count: number): HTMLElement {
  const pill = document.createElement('button');
  pill.type = 'button';
  pill.className = 'atlas-foundry-scene-links-pill atlas-foundry-quest-tracker-pill';
  pill.title = t('ATLASFOUNDRY.Quests.ExpandPill', { count });
  const icon = document.createElement('i');
  icon.className = 'fa-solid fa-scroll';
  const number = document.createElement('span');
  number.textContent = String(count);
  pill.append(icon, number);
  pill.addEventListener('click', () => void setShowQuestTracker(true));
  return pill;
}

function buildMore(hidden: number): HTMLElement {
  const more = document.createElement('button');
  more.type = 'button';
  more.className = 'atlas-foundry-quest-tracker-more';
  more.title = t('ATLASFOUNDRY.Quests.AllInAtlas');
  more.textContent = t('ATLASFOUNDRY.Quests.More', { count: hidden });
  more.addEventListener('click', openQuestList);
  return more;
}

/**
 * Renders (or removes) the tracker in the shared right-hand HUD column, below
 * the bell. Nothing is drawn while signed out, before the first response, or
 * when nothing is tracked (no empty pill). Collapsed
 * (`showQuestTracker` off), only a pill with the number of tracked quests stays.
 */
export function renderQuestTracker(): void {
  const total = loaded && authManager.isLinked() ? countTrackedQuests(quests) : 0;
  if (total === 0) {
    removeTracker();
    return;
  }

  const hud = getRightHud();
  const tracker = document.getElementById(TRACKER_ID) ?? document.createElement('div');
  tracker.id = TRACKER_ID;
  const expanded = getShowQuestTracker();
  tracker.className = `atlas-foundry atlas-foundry-quest-tracker${expanded ? '' : ' atlas-foundry-quest-tracker-collapsed'}`;
  tracker.replaceChildren();

  if (expanded) {
    const shown = selectTrackedQuests(quests);
    shown.forEach((quest) => tracker.appendChild(buildCard(quest)));
    const footer = document.createElement('div');
    footer.className = 'atlas-foundry-quest-tracker-footer';
    if (total > shown.length) footer.appendChild(buildMore(total - shown.length));
    footer.appendChild(buildCollapseButton());
    tracker.appendChild(footer);
  } else {
    tracker.appendChild(buildPill(total));
  }

  if (tracker.parentElement !== hud) hud.appendChild(tracker);
}

function clearTracker(): void {
  loadToken++;
  quests = [];
  loaded = false;
  stopPolling();
  removeTracker();
}

async function load(bypassCache: boolean): Promise<void> {
  if (!authManager.isLinked()) {
    clearTracker();
    return;
  }
  const token = ++loadToken;
  try {
    const response = bypassCache ? await refreshQuests({ status: 'open' }) : await fetchQuests({ status: 'open' });
    if (token !== loadToken) return; // superseded or cleared while loading
    quests = response.quests;
    loaded = true;
  } catch {
    // Keep what is shown; the next trigger (socket event, poll) tries again.
    return;
  }
  renderQuestTracker();
  syncPolling();
}

/** Switches between the full tracker and the collapsed pill. */
export function toggleQuestTracker(): Promise<boolean> {
  return setShowQuestTracker(!getShowQuestTracker());
}

/** Session reset: the quest list belongs to the sign-in that loaded it. */
export function clearQuestTracker(): void {
  clearTracker();
}

/**
 * Hook wiring (call from `init`; no setting is read here): the toggle tool in
 * the Atlas group and the refresh triggers. The `socketEvent` hook is
 * best-effort — no backend event carries `documentModuleType` for quests yet —
 * so the 5-minute poll is the real update path while expanded.
 */
export function registerQuestTracker(): void {
  Hooks.on('getSceneControlButtons', (controls: Record<string, any>) => {
    ensureAtlasGroup(controls).atlasQuestsToggle = {
      name: 'atlasQuestsToggle',
      title: 'ATLASFOUNDRY.Quests.ToggleTool',
      icon: 'fa-solid fa-scroll',
      toggle: true,
      active: getShowQuestTracker(),
      order: 103,
      onChange: (_event: unknown, active: boolean) => void setShowQuestTracker(active),
    };
  });

  Hooks.on('atlas-foundry.authChanged', (payload: { state: string }) => {
    if (payload.state === 'active') void load(false);
    else clearTracker();
  });
  Hooks.on('atlas-foundry.sessionReset', clearTracker);
  Hooks.on('atlas-foundry.socketEvent', (_event: string, payload: unknown) => {
    const moduleType = (payload as { documentModuleType?: string } | null)?.documentModuleType;
    if (moduleType === 'quests') void load(true);
  });
  Hooks.on('atlas-foundry.showQuestTrackerChanged', () => {
    renderQuestTracker();
    syncPolling();
    void ui.controls?.render();
  });
  Hooks.on('renderSidebar', renderQuestTracker);
}
