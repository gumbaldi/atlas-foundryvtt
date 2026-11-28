import { t } from '../i18n';
import { authManager } from '../auth/auth-manager';
import { getRightHud, removeRightHudIfEmpty } from '../hud-right';
import { reportHudSection } from '../hud-panels';
import { openInAtlas } from '../links/open-in-atlas';
import { safeImageUrl } from '../render/image-url';
import { getTypeStyle } from '../search/type-style';
import { getBaseUrl, getDeadlineDocuments, getShowHud, getShowHudPanels } from '../settings';
import type { ModuleType } from '../constants';
import { fetchDeadlineOverview, refreshDeadlineOverview } from './deadlines-api';
import { openDeadlineDocsManager } from './deadline-docs-app';
import { ensureAtlasGroup } from '../controls';
import { buildDeadlineGroups, countDeadlines, type DeadlineGroup, type DeadlineRow } from './deadline-overview';
import { isDeadlineRelevantChange } from './deadline-refs';
import { debounce } from '../socket/debounce';
import type { DocumentChange } from '../atlas-types';

const SECTION_ID = 'atlas-foundry-deadline-section';
const POLL_INTERVAL_MS = 5 * 60 * 1000;
/** A bulk change (e.g. an import) arrives as many events; one refresh after the burst is enough. */
const RELOAD_DEBOUNCE_MS = 1000;

let groups: DeadlineGroup[] = [];
let loaded = false;
// Re-entrancy guard: auth, socket, poll, settings and toggle can all trigger a
// load in a burst — only the most recent one may write the result.
let loadToken = 0;
let pollTimer: ReturnType<typeof setInterval> | null = null;
const reloadSoon = debounce(() => void load(true), RELOAD_DEBOUNCE_MS);

function removeSection(): void {
  document.getElementById(SECTION_ID)?.remove();
  removeRightHudIfEmpty();
}

function stopPolling(): void {
  if (pollTimer !== null) clearInterval(pollTimer);
  pollTimer = null;
}

/** Polls only while the HUD and its panels are expanded and the user is signed in. */
function syncPolling(): void {
  const shouldPoll = authManager.isLinked() && getShowHud() && getShowHudPanels();
  if (!shouldPoll) {
    stopPolling();
    return;
  }
  if (pollTimer === null) pollTimer = setInterval(() => void load(true), POLL_INTERVAL_MS);
}

/** A tile in the type colour; the title image covers it once loaded and is dropped when it fails. */
function buildThumb(moduleType: string, imageUrl: string | undefined): HTMLElement {
  const thumb = document.createElement('span');
  thumb.className = 'atlas-foundry-deadline-thumb';
  const style = getTypeStyle(moduleType as ModuleType | 'custom');
  thumb.style.setProperty('--atlas-type-color', style.color);
  const icon = document.createElement('i');
  icon.className = style.icon;
  thumb.appendChild(icon);

  const src = safeImageUrl(imageUrl, getBaseUrl());
  if (src) {
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.alt = '';
    img.draggable = false;
    img.addEventListener('error', () => img.remove());
    img.src = src;
    thumb.appendChild(img);
  }
  return thumb;
}

function buildDocumentButton(group: DeadlineGroup): HTMLElement {
  const { document: doc } = group;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'atlas-foundry-deadline-doc';
  button.title = t('ATLASFOUNDRY.Deadlines.OpenDeadlineTab');

  const title = document.createElement('span');
  title.className = 'atlas-foundry-deadline-doc-title';
  title.textContent = doc.title;
  button.append(buildThumb(doc.moduleType, doc.imageUrl), title);

  button.addEventListener('click', () => void openInAtlas({ moduleType: doc.moduleType, documentId: doc.id, customModuleId: doc.customModuleId, tab: 'deadlines' }));
  return button;
}

function buildRow(row: DeadlineRow): HTMLElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'atlas-foundry-deadline-row';
  button.dataset.deadlineId = row.id;

  const name = document.createElement('span');
  name.className = 'atlas-foundry-deadline-name';
  name.textContent = row.name;
  button.append(buildThumb('deadlines', row.imageUrl), name);

  if (row.remainingKey) {
    const remaining = document.createElement('span');
    remaining.className = `atlas-foundry-deadline-remaining${row.overdue ? ' atlas-foundry-deadline-overdue' : ''}`;
    remaining.textContent = t(row.remainingKey, { count: row.remainingCount ?? 0 });
    button.appendChild(remaining);
  }

  button.addEventListener('click', () => void openInAtlas({ moduleType: 'deadlines', documentId: row.id }));
  return button;
}

function buildHeading(): HTMLElement {
  const heading = document.createElement('div');
  heading.className = 'atlas-foundry-hud-heading';
  const icon = document.createElement('i');
  icon.className = 'fa-solid fa-hourglass-half';
  const label = document.createElement('span');
  label.textContent = t('ATLASFOUNDRY.Deadlines.Heading');
  heading.append(icon, label);
  if (game.user.isGM) {
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'atlas-foundry-hud-heading-edit';
    edit.title = t('ATLASFOUNDRY.Deadlines.ManageEdit');
    const pencil = document.createElement('i');
    pencil.className = 'fa-solid fa-pencil';
    edit.appendChild(pencil);
    edit.addEventListener('click', openDeadlineDocsManager);
    heading.appendChild(edit);
  }
  return heading;
}

/**
 * Renders (or removes) the "Deadlines" section in the shared right-hand HUD
 * column. Nothing is drawn while signed out, before the first response, when no
 * deadline runs, or while the HUD panels are collapsed; the count still goes to
 * the shared toggle.
 */
export function renderDeadlineSection(): void {
  const total = loaded && authManager.isLinked() ? countDeadlines(groups) : 0;
  const expanded = getShowHudPanels();
  if (total === 0 || !expanded) {
    removeSection();
    reportHudSection('deadlines', total);
    return;
  }

  const hud = getRightHud();
  const section = document.getElementById(SECTION_ID) ?? document.createElement('div');
  section.id = SECTION_ID;
  section.className = 'atlas-foundry atlas-foundry-deadlines';
  section.replaceChildren();

  const scroll = document.createElement('div');
  scroll.className = 'atlas-foundry-deadlines-scroll';
  for (const group of groups) {
    if (group.rows.length === 0) continue;
    scroll.appendChild(buildDocumentButton(group));
    group.rows.forEach((row) => scroll.appendChild(buildRow(row)));
  }
  section.append(buildHeading(), scroll);

  if (section.parentElement !== hud) hud.appendChild(section);
  reportHudSection('deadlines', total);
}

function clearSection(): void {
  reloadSoon.cancel();
  loadToken++;
  groups = [];
  loaded = false;
  stopPolling();
  removeSection();
  reportHudSection('deadlines', 0);
}

async function load(bypassCache: boolean): Promise<void> {
  if (!authManager.isLinked()) {
    clearSection();
    return;
  }
  const token = ++loadToken;
  try {
    const refs = getDeadlineDocuments();
    const overview = bypassCache ? await refreshDeadlineOverview(refs) : await fetchDeadlineOverview(refs);
    if (token !== loadToken) return; // superseded or cleared while loading
    groups = buildDeadlineGroups(overview); // null (route missing) yields no groups
    loaded = true;
  } catch {
    // Keep what is shown; the next trigger (socket event, poll, settings change) tries again.
    return;
  }
  renderDeadlineSection();
  syncPolling();
}

/** Session reset: the deadlines belong to the sign-in that loaded them. */
export function clearDeadlineSection(): void {
  clearSection();
}

/**
 * Hook wiring (call from `init`; no setting is read here): the refresh
 * triggers. Document changes from the socket refresh the section within about a
 * second; the 5-minute poll stays as the fallback while expanded.
 */
export function registerDeadlineSection(): void {
  Hooks.on('atlas-foundry.authChanged', (payload: { state: string }) => {
    if (payload.state === 'active') void load(false);
    else clearSection();
  });
  Hooks.on('atlas-foundry.sessionReset', clearSection);
  Hooks.on('atlas-foundry.deadlineDocumentsChanged', () => void load(true));
  Hooks.on('atlas-foundry.documentChanged', (change: DocumentChange) => {
    if (isDeadlineRelevantChange(change, getDeadlineDocuments())) reloadSoon.call();
  });
  const onVisibilityChanged = (): void => {
    renderDeadlineSection();
    syncPolling();
  };
  Hooks.on('atlas-foundry.showHudPanelsChanged', onVisibilityChanged);
  Hooks.on('atlas-foundry.showHudChanged', onVisibilityChanged);
  Hooks.on('renderSidebar', renderDeadlineSection);
  // GM-only, always available: the HUD section (and its pencil) is hidden while nothing runs.
  Hooks.on('getSceneControlButtons', (controls: Record<string, any>) => {
    if (!game.user.isGM || !authManager.isLinked()) return;
    ensureAtlasGroup(controls).atlasDeadlineDocs = {
      name: 'atlasDeadlineDocs',
      title: 'ATLASFOUNDRY.Deadlines.ManageTool',
      icon: 'fa-solid fa-hourglass-half',
      button: true,
      order: 104,
      onChange: () => openDeadlineDocsManager(),
    };
  });
}
