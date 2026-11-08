import { MODULE_ID } from './constants';
import { t } from './i18n';

const LEGACY_INTEGRATION_TOKEN_KEY = 'integrationToken';

/** Strips trailing slashes / whitespace. Pure, no Foundry globals — kept testable. */
export function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export interface BaseUrlValidation {
  normalized: string;
  warningKey?: string;
}

/** Normalizes and flags a missing http(s) scheme so the settings dialog can warn the GM. */
export function validateBaseUrl(url: string): BaseUrlValidation {
  const normalized = normalizeBaseUrl(url);
  if (normalized && !/^https?:\/\//i.test(normalized)) {
    return { normalized, warningKey: 'ATLASFOUNDRY.Settings.BaseUrlMissingScheme' };
  }
  return { normalized };
}

/**
 * Registers world-scoped settings. Per S1 fix, no secret is stored here:
 * `baseUrl` and `campaignId` are both non-sensitive. `integrationToken` stays
 * registered only long enough to detect and clear a pre-P1 value — see
 * `migrateLegacyIntegrationToken()`. `worldId` is intentionally not a
 * setting; Foundry always provides it live via `game.world.id`.
 */
export function registerSettings(): void {
  game.settings.register(MODULE_ID, 'baseUrl', {
    name: 'ATLASFOUNDRY.Settings.BaseUrl.Name',
    hint: 'ATLASFOUNDRY.Settings.BaseUrl.Hint',
    scope: 'world',
    config: false,
    type: String,
    default: '',
    // Lets auth-manager/atlas-socket invalidate their cached JWT + reconnect
    // without a direct import (avoids a settings.ts -> auth-manager.ts cycle).
    onChange: () => Hooks.callAll('atlas-foundry.baseUrlChanged'),
  });
  game.settings.register(MODULE_ID, 'campaignId', {
    name: 'ATLASFOUNDRY.Settings.CampaignId.Name',
    scope: 'world',
    config: false,
    type: String,
    default: '',
  });
  game.settings.register(MODULE_ID, LEGACY_INTEGRATION_TOKEN_KEY, {
    scope: 'world',
    config: false,
    type: String,
    default: '',
  });
  // Client-scoped (per browser/localStorage, never synced to other clients) —
  // see the P3 plan's token storage risk assessment. Only the long-lived
  // Foundry user token lives here; the short-lived exchange JWT stays in memory.
  game.settings.register(MODULE_ID, 'userToken', {
    scope: 'client',
    config: false,
    type: String,
    default: '',
  });
  game.settings.register(MODULE_ID, 'userTokenId', {
    scope: 'client',
    config: false,
    type: String,
    default: '',
  });
  // Client-scoped so each player can hide the overlay independently (plan P5 UI/UX note).
  // config: true — shown in Foundry's own "Configure Settings" screen, no custom UI needed.
  game.settings.register(MODULE_ID, 'showSceneLinks', {
    name: 'ATLASFOUNDRY.Settings.ShowSceneLinks.Name',
    hint: 'ATLASFOUNDRY.Settings.ShowSceneLinks.Hint',
    scope: 'client',
    config: true,
    type: Boolean,
    default: true,
    onChange: () => Hooks.callAll('atlas-foundry.showSceneLinksChanged'),
  });
  // Client-scoped, no UI (config: false) — written by quest-panel-app.ts on
  // close, read back on the next open so the panel reopens where it was left.
  game.settings.register(MODULE_ID, 'questPanelPosition', {
    scope: 'client',
    config: false,
    type: Object,
    default: {},
  });
  // Client-scoped (plan P8 UI/UX note) — suppresses the "new notification"
  // toast only; the bell badge/count always stays accurate regardless.
  game.settings.register(MODULE_ID, 'quietMode', {
    name: 'ATLASFOUNDRY.Settings.QuietMode.Name',
    hint: 'ATLASFOUNDRY.Settings.QuietMode.Hint',
    scope: 'client',
    config: true,
    type: Boolean,
    default: false,
  });
  // Client-scoped — GM-broadcast "suggest-open" toasts (P8) stay a manual
  // click-through by default; opting in auto-opens the viewer instead.
  game.settings.register(MODULE_ID, 'autoOpenGmSuggestions', {
    name: 'ATLASFOUNDRY.Settings.AutoOpenGmSuggestions.Name',
    hint: 'ATLASFOUNDRY.Settings.AutoOpenGmSuggestions.Hint',
    scope: 'client',
    config: true,
    type: Boolean,
    default: false,
  });
  // Client-scoped — the Notification Center stays reachable via the scene-controls
  // tool even with the floating bell hidden (plan's DOM-collision fallback).
  game.settings.register(MODULE_ID, 'showBell', {
    name: 'ATLASFOUNDRY.Settings.ShowBell.Name',
    hint: 'ATLASFOUNDRY.Settings.ShowBell.Hint',
    scope: 'client',
    config: true,
    type: Boolean,
    default: true,
    onChange: () => Hooks.callAll('atlas-foundry.showBellChanged'),
  });
}

export function getBaseUrl(): string {
  return game.settings.get<string>(MODULE_ID, 'baseUrl') ?? '';
}

export async function setBaseUrl(value: string): Promise<void> {
  await game.settings.set(MODULE_ID, 'baseUrl', normalizeBaseUrl(value));
}

export function getCampaignId(): string {
  return game.settings.get<string>(MODULE_ID, 'campaignId') ?? '';
}

export async function setCampaignId(value: string): Promise<void> {
  await game.settings.set(MODULE_ID, 'campaignId', value);
}

export function getUserToken(): string {
  return game.settings.get<string>(MODULE_ID, 'userToken') ?? '';
}

export function getUserTokenId(): string {
  return game.settings.get<string>(MODULE_ID, 'userTokenId') ?? '';
}

export async function setUserToken(token: string, tokenId: string): Promise<void> {
  await game.settings.set(MODULE_ID, 'userToken', token);
  await game.settings.set(MODULE_ID, 'userTokenId', tokenId);
}

export function getShowSceneLinks(): boolean {
  return game.settings.get<boolean>(MODULE_ID, 'showSceneLinks') ?? true;
}

export interface QuestPanelPosition {
  top?: number;
  left?: number;
  width?: number;
  height?: number;
}

export function getQuestPanelPosition(): QuestPanelPosition {
  return game.settings.get<QuestPanelPosition>(MODULE_ID, 'questPanelPosition') ?? {};
}

export async function setQuestPanelPosition(position: QuestPanelPosition): Promise<void> {
  await game.settings.set(MODULE_ID, 'questPanelPosition', position);
}

export function getQuietMode(): boolean {
  return game.settings.get<boolean>(MODULE_ID, 'quietMode') ?? false;
}

export function getAutoOpenGmSuggestions(): boolean {
  return game.settings.get<boolean>(MODULE_ID, 'autoOpenGmSuggestions') ?? false;
}

export function getShowBell(): boolean {
  return game.settings.get<boolean>(MODULE_ID, 'showBell') ?? true;
}

export async function clearUserToken(): Promise<void> {
  await game.settings.set(MODULE_ID, 'userToken', '');
  await game.settings.set(MODULE_ID, 'userTokenId', '');
}

/**
 * One-time migration off the removed world-scoped integration token (S1).
 * Clears any leftover value and tells the GM to revoke it in Atlas and use
 * the new login flow (P3). Call once from the `ready` hook.
 *
 * GM-only: world-scoped settings can only be written by a GM client, so a
 * player client running this would fail the `set` call (and would have
 * nothing useful to migrate on behalf of everyone else anyway).
 */
export async function migrateLegacyIntegrationToken(): Promise<void> {
  if (!game.user.isGM) return;

  const legacyValue = game.settings.get<string>(MODULE_ID, LEGACY_INTEGRATION_TOKEN_KEY);
  if (!legacyValue) return;

  await game.settings.set(MODULE_ID, LEGACY_INTEGRATION_TOKEN_KEY, '');
  ui.notifications.warn(t('ATLASFOUNDRY.Settings.LegacyTokenMigrated'));
}
