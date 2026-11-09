import { registerSettings, migrateLegacyIntegrationToken } from './settings';
import { registerControls } from './controls';
import { openSettingsDialog } from './apps/settings-app';
import { openLoginDialog } from './auth/login-app';
import { authManager, type AuthState } from './auth/auth-manager';
import { atlasSocket } from './socket/atlas-socket';
import { openSearch, SearchApp } from './search/search-app';
import { registerLinkEntryPoints } from './links/link-entry-points';
import { registerSceneLinksBar, renderSceneLinksBarNow } from './links/scene-links-bar';
import { registerTokenHud } from './links/token-hud';
import { pickLinkTarget } from './links/link-pick-target';
import { openQuestPanel, registerQuestPanel } from './quests/quest-panel-app';
import { notificationStore } from './notifications/notification-store';
import { registerBell } from './notifications/bell';
import { openNotificationCenter, registerGmBroadcastReceiver, registerNotificationsControl } from './notifications/notification-center-app';
import { MODULE_ID } from './constants';
import { log } from './log';
import type { AtlasSearchResult } from './atlas-types';

declare global {
  var AtlasFoundry: {
    openSearch: () => void;
    openSettings: () => Promise<void>;
    openLogin: () => Promise<void>;
    logout: () => Promise<void>;
    /** Attaches a search result to a Foundry object (P5) — see search-app.ts's "Verknüpfen…" action. */
    pickTarget?: (result: AtlasSearchResult) => void;
    /** Debug entry point for exercising the P5 picker contract from the console: `await AtlasFoundry.pickDocument()`. */
    pickDocument: (title?: string) => Promise<AtlasSearchResult | null>;
    /** Opens the P7 quest panel — same entry point as the scene-controls tool. */
    openQuests: () => void;
    /** Opens the P8 notification center — same entry point as the bell/scene-controls tool. */
    openNotifications: () => void;
  };
}

function registerSettingsMenuButton(): void {
  Hooks.on('renderSettings', (_app: unknown, html: unknown) => {
    if (!game.user.isGM) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.innerHTML = `<i class="fa-solid fa-book-open"></i> ${game.i18n.localize('ATLASFOUNDRY.Settings.MenuButton')}`;
    button.addEventListener('click', () => {
      openSettingsDialog().catch((err) => log.error('Failed to open settings dialog', err));
    });

    // v13 passed jQuery, v14 passes a plain HTMLElement — accept both.
    const root = html instanceof HTMLElement ? html : (html as { 0?: HTMLElement } | undefined)?.[0];
    root?.querySelector('#settings-game')?.append(button);
  });
}

/**
 * The only place AuthManager and AtlasSocket are wired together — both
 * modules stay decoupled and only talk through Hooks (see plan's event-bus
 * convention), so either can be unit-tested without the other.
 */
function registerAuthSocketWiring(): void {
  Hooks.on('atlas-foundry.authChanged', (payload: { state: AuthState }) => {
    if (payload.state === 'active') {
      atlasSocket.start();
    } else {
      atlasSocket.stop();
    }
  });
  Hooks.on('atlas-foundry.baseUrlChanged', () => {
    authManager.invalidateCache();
    if (atlasSocket.getStatus() !== 'disconnected') atlasSocket.restart();
  });
}

function registerSearchKeybinding(): void {
  game.keybindings.register(MODULE_ID, 'openSearch', {
    name: 'ATLASFOUNDRY.Search.KeybindingName',
    editable: [{ key: 'KeyK', modifiers: ['Control'] }],
    onDown: () => {
      openSearch();
      return true;
    },
  });
}

function registerQuestsKeybinding(): void {
  game.keybindings.register(MODULE_ID, 'openQuests', {
    name: 'ATLASFOUNDRY.Quests.KeybindingName',
    editable: [{ key: 'KeyQ', modifiers: ['Control', 'Shift'] }],
    onDown: () => {
      openQuestPanel();
      return true;
    },
  });
}

// Foundry v14 builds the scene controls (and the rest of the UI) before `ready`,
// so everything that only calls Hooks.on / keybindings.register belongs in `init`.
Hooks.once('init', () => {
  registerSettings();
  registerSearchKeybinding();
  registerQuestsKeybinding();
  registerControls(openSearch);
  registerAuthSocketWiring();
  registerLinkEntryPoints();
  registerSceneLinksBar();
  registerTokenHud();
  registerQuestPanel();
  registerNotificationsControl();
});

// Runtime work only: auth state, DOM, game.socket, network.
Hooks.once('ready', async () => {
  await migrateLegacyIntegrationToken();
  registerSettingsMenuButton();
  registerBell();
  registerGmBroadcastReceiver();
  notificationStore.start();
  renderSceneLinksBarNow();
  await authManager.restore();
  log.info('ready');
});

globalThis.AtlasFoundry = {
  openSearch,
  openSettings: openSettingsDialog,
  openLogin: openLoginDialog,
  logout: () => authManager.logout(),
  pickTarget: (result) => void pickLinkTarget(result),
  pickDocument: (title?: string) => SearchApp.pick({ title }),
  openQuests: openQuestPanel,
  openNotifications: openNotificationCenter,
};
