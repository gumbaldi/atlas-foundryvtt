import { t } from '../i18n';
import { authManager } from '../auth/auth-manager';
import { getRightHud, removeRightHudIfEmpty } from '../hud-right';
import { reportHudSection } from '../hud-panels';
import { atlasQuestsUrl } from '../deep-links';
import { openInAtlas } from '../links/open-in-atlas';
import { getShowHudPanels } from '../settings';
import { fetchQuests, refreshQuests } from './quests-api';
import { countTrackedQuests, selectTrackedQuests } from './quest-selection';
import type { AtlasQuest } from '../atlas-types';

export { selectTrackedQuests };

const TRACKER_ID = 'atlas-foundry-quest-tracker';
const POLL_INTERVAL_MS = 5 * 60 * 1000;

let quests: AtlasQuest[] = [];
let moduleLabel: { de: string; en: string } | undefined;
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
  const shouldPoll = authManager.isLinked() && getShowHudPanels();
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

/** The module's name as the campaign set it, in the Foundry language (the shared default name when the backend sends none); opens the quest overview in Atlas. */
function buildTitle(): HTMLElement {
  const title = document.createElement('button');
  title.type = 'button';
  title.className = 'atlas-foundry-hud-heading atlas-foundry-hud-heading-link';
  title.title = t('ATLASFOUNDRY.Quests.AllInAtlas');
  const lang = game.i18n.lang === 'de' ? 'de' : 'en';
  const label = document.createElement('span');
  label.textContent = moduleLabel?.[lang] ?? t('ATLASFOUNDRY.ModuleTypes.quests');
  const icon = document.createElement('i');
  icon.className = 'fa-solid fa-arrow-up-right-from-square';
  title.append(label, icon);
  title.addEventListener('click', openQuestList);
  return title;
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
 * the search field. Nothing is drawn while signed out, before the first
 * response, when nothing is tracked, or while the HUD panels are collapsed; the
 * count still goes to the shared toggle, which stays as a pill.
 */
export function renderQuestTracker(): void {
  const total = loaded && authManager.isLinked() ? countTrackedQuests(quests) : 0;
  const expanded = getShowHudPanels();
  if (total === 0 || !expanded) {
    removeTracker();
    reportHudSection('quests', total);
    return;
  }

  const hud = getRightHud();
  const tracker = document.getElementById(TRACKER_ID) ?? document.createElement('div');
  tracker.id = TRACKER_ID;
  tracker.className = 'atlas-foundry atlas-foundry-quest-tracker';
  tracker.replaceChildren();

  tracker.appendChild(buildTitle());
  const shown = selectTrackedQuests(quests);
  shown.forEach((quest) => tracker.appendChild(buildCard(quest)));
  if (total > shown.length) tracker.appendChild(buildMore(total - shown.length));

  if (tracker.parentElement !== hud) hud.appendChild(tracker);
  reportHudSection('quests', total);
}

function clearTracker(): void {
  loadToken++;
  quests = [];
  moduleLabel = undefined;
  loaded = false;
  stopPolling();
  removeTracker();
  reportHudSection('quests', 0);
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
    moduleLabel = response.moduleLabel;
    loaded = true;
  } catch {
    // Keep what is shown; the next trigger (socket event, poll) tries again.
    return;
  }
  renderQuestTracker();
  syncPolling();
}

/** Session reset: the quest list belongs to the sign-in that loaded it. */
export function clearQuestTracker(): void {
  clearTracker();
}

/**
 * Hook wiring (call from `init`; no setting is read here): the refresh
 * triggers. The `socketEvent` hook is best-effort — no backend event carries
 * `documentModuleType` for quests yet — so the 5-minute poll is the real update
 * path while expanded.
 */
export function registerQuestTracker(): void {
  Hooks.on('atlas-foundry.authChanged', (payload: { state: string }) => {
    if (payload.state === 'active') void load(false);
    else clearTracker();
  });
  Hooks.on('atlas-foundry.sessionReset', clearTracker);
  Hooks.on('atlas-foundry.socketEvent', (_event: string, payload: unknown) => {
    const moduleType = (payload as { documentModuleType?: string } | null)?.documentModuleType;
    if (moduleType === 'quests') void load(true);
  });
  Hooks.on('atlas-foundry.showHudPanelsChanged', () => {
    renderQuestTracker();
    syncPolling();
  });
  Hooks.on('renderSidebar', renderQuestTracker);
}
