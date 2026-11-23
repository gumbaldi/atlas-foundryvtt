import { ensureAtlasGroup } from './controls';
import { authManager } from './auth/auth-manager';
import { t } from './i18n';
import { getRightHud, removeRightHudIfEmpty } from './hud-right';
import { getShowHud, getShowHudPanels, setShowHud, setShowHudPanels } from './settings';

/**
 * One shared expand/collapse switch for the quest, deadline and document panels of the
 * right HUD column. Each panel reports how many entries it has; the toggle at the
 * bottom of the column exists while at least one entry exists, as a chevron
 * when expanded and, when collapsed, as one pill with an icon and the count for
 * each panel that has entries. The panels draw themselves only while expanded.
 * A separate master switch hides the whole column.
 */

export const HUD_TOGGLE_ID = 'atlas-foundry-hud-toggle';

const counts = new Map<string, number>();

/** Collapsed pill content, in the order the panels appear in the column. */
const SECTION_ICONS: Array<[name: string, icon: string]> = [
  ['quests', 'fa-solid fa-scroll'],
  ['deadlines', 'fa-solid fa-hourglass-half'],
  ['links', 'fa-solid fa-link'],
];

/** Entry count of a panel (0 = nothing to show). Re-renders the toggle. */
export function reportHudSection(name: string, count: number): void {
  if (count > 0) counts.set(name, count);
  else counts.delete(name);
  renderHudToggle();
}

function totalCount(): number {
  let total = 0;
  for (const count of counts.values()) total += count;
  return total;
}

function removeToggle(): void {
  document.getElementById(HUD_TOGGLE_ID)?.remove();
  removeRightHudIfEmpty();
}

function buildToggle(): HTMLButtonElement {
  const button = document.createElement('button');
  button.id = HUD_TOGGLE_ID;
  button.type = 'button';
  button.addEventListener('click', () => void setShowHudPanels(!getShowHudPanels()));
  return button;
}

/** The master switch hides the whole column by a body class, so every part keeps rendering as usual. */
export function applyHudEnabled(): void {
  document.body?.classList?.toggle('atlas-foundry-hud-off', !getShowHud());
}

export function renderHudToggle(): void {
  applyHudEnabled();
  const total = totalCount();
  if (total === 0 || !authManager.isLinked()) {
    removeToggle();
    return;
  }

  const expanded = getShowHudPanels();
  const hud = getRightHud();
  const button = (document.getElementById(HUD_TOGGLE_ID) as HTMLButtonElement | null) ?? buildToggle();
  button.className = `atlas-foundry atlas-foundry-hud-toggle${expanded ? '' : ' atlas-foundry-hud-toggle-collapsed'}`;
  button.title = expanded ? t('ATLASFOUNDRY.Hud.Collapse') : t('ATLASFOUNDRY.Hud.Expand', { count: total });

  const icon = document.createElement('i');
  if (expanded) {
    icon.className = 'fa-solid fa-chevron-up';
    button.replaceChildren(icon);
  } else {
    button.replaceChildren();
    for (const [name, iconClass] of SECTION_ICONS) {
      const count = counts.get(name);
      if (!count) continue;
      const part = document.createElement('span');
      part.className = 'atlas-foundry-hud-toggle-part';
      const partIcon = document.createElement('i');
      partIcon.className = iconClass;
      const number = document.createElement('span');
      number.textContent = String(count);
      part.append(partIcon, number);
      button.appendChild(part);
    }
  }

  if (button.parentElement !== hud) hud.appendChild(button);
}

/** Folds the quest, deadline and document panels in or out — the same switch as the toolbar tool and the keybinding. */
export function toggleHudPanels(): Promise<boolean> {
  return setShowHudPanels(!getShowHudPanels());
}

/** Hook wiring (call from `init`; no setting is read here): the toolbar toggle and the follow-up renders. */
export function registerHudPanels(): void {
  Hooks.on('getSceneControlButtons', (controls: Record<string, any>) => {
    if (!authManager.isLinked()) return;
    const tools = ensureAtlasGroup(controls);
    tools.atlasHudSwitch = {
      name: 'atlasHudSwitch',
      title: 'ATLASFOUNDRY.Hud.SwitchTool',
      icon: 'fa-solid fa-eye',
      toggle: true,
      active: getShowHud(),
      order: 101,
      onChange: (_event: unknown, active: boolean) => void setShowHud(active),
    };
    tools.atlasHudToggle = {
      name: 'atlasHudToggle',
      title: 'ATLASFOUNDRY.Hud.ToggleTool',
      icon: 'fa-solid fa-scroll',
      toggle: true,
      active: getShowHudPanels(),
      order: 102,
      onChange: (_event: unknown, active: boolean) => void setShowHudPanels(active),
    };
  });
  Hooks.on('atlas-foundry.showHudPanelsChanged', () => {
    renderHudToggle();
    void ui.controls?.render();
  });
  Hooks.on('atlas-foundry.showHudChanged', () => {
    applyHudEnabled();
    void ui.controls?.render();
  });
  Hooks.on('atlas-foundry.authChanged', renderHudToggle);
  Hooks.on('renderSidebar', renderHudToggle);
}
