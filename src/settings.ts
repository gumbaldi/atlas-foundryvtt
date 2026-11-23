import { MODULE_ID } from './constants';
import { t } from './i18n';
import { parseDeadlineRefs, type DeadlineRef } from './deadlines/deadline-refs';

/** Strips trailing slashes / whitespace. Pure, no Foundry globals — kept testable. */
export function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export interface ParsedAtlasUrl {
  baseUrl: string;
  /** Empty unless the URL carries a real campaign id (24 hex chars). */
  campaignId: string;
  /** Lowercased campaign alias (e.g. `dvl`) when the URL's campaign segment is not a Mongo id, else empty. */
  campaignSlug: string;
}

/**
 * Splits what the GM pastes into the single Atlas URL field: either a plain base URL
 * (`https://atlas.example.com`) or a campaign URL from the browser
 * (`https://atlas.example.com/de/campaigns/<id>[/...]`) — base URL and campaign id are derived
 * from it. A locale segment (`de`/`en`) before `/campaigns/` is dropped. A segment that is not a
 * Mongo id (e.g. the alias `dvl`) is returned lowercased as `campaignSlug`: the backend only
 * resolves an alias after login, so it is kept apart from the campaign id. Pure, no Foundry globals.
 */
export function parseAtlasUrl(input: string): ParsedAtlasUrl {
  const cleaned = input.trim().replace(/[?#].*$/, '');
  const match = /^(.*?)(?:\/(?:de|en))?\/campaigns\/([^/]+)(?:\/.*)?$/i.exec(cleaned);
  if (!match) return { baseUrl: normalizeBaseUrl(cleaned), campaignId: '', campaignSlug: '' };
  let segment = match[2] ?? '';
  try {
    segment = decodeURIComponent(segment);
  } catch {
    // keep the raw segment
  }
  const isId = /^[0-9a-f]{24}$/i.test(segment);
  return {
    baseUrl: normalizeBaseUrl(match[1] ?? ''),
    campaignId: isId ? segment : '',
    campaignSlug: isId ? '' : segment.toLowerCase(),
  };
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
 * `baseUrl` and `campaignId` are both non-sensitive. `worldId` is intentionally
 * not a setting; Foundry always provides it live via `game.world.id`.
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
  // The alias from a pasted campaign URL (e.g. `dvl`); not a secret, resolved by Atlas after login.
  game.settings.register(MODULE_ID, 'campaignSlug', {
    name: 'ATLASFOUNDRY.Settings.CampaignSlug.Name',
    scope: 'world',
    config: false,
    type: String,
    default: '',
  });
  // The documents the GM picked so every player sees their deadlines: ids and module types only
  // (no names, nothing secret in a setting every client can read); names come from the backend.
  game.settings.register(MODULE_ID, 'deadlineDocuments', {
    scope: 'world',
    config: false,
    type: Array,
    default: [],
    onChange: () => Hooks.callAll('atlas-foundry.deadlineDocumentsChanged'),
  });
  // Client-scoped (per browser/localStorage, never synced to other clients) —
  // see the P3 plan's token storage risk assessment. Only the long-lived
  // Foundry user token lives here; the short-lived exchange JWT stays in memory.
  // Keyed by Foundry user id so a GM tab and a player tab in one browser each
  // keep their own sign-in.
  game.settings.register(MODULE_ID, 'userTokens', {
    scope: 'client',
    config: false,
    type: Object,
    default: {},
  });
  // Legacy browser-wide slots: registered only so discardLegacyUserToken() can empty them.
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
  // Client-scoped master switch for the whole right-hand HUD (bell, search, quests, links); toggled in the Atlas toolbar group.
  game.settings.register(MODULE_ID, 'showHud', {
    scope: 'client',
    config: false,
    type: Boolean,
    default: true,
    onChange: () => Hooks.callAll('atlas-foundry.showHudChanged'),
  });
  // Client-scoped, no settings-screen entry (config: false) — one switch for the quest and link panels of the right-hand HUD,
  // toggled through the Atlas toolbar tool, the Ctrl+Shift+Q keybinding or the HUD's own toggle button.
  game.settings.register(MODULE_ID, 'showHudPanels', {
    scope: 'client',
    config: false,
    type: Boolean,
    default: true,
    onChange: () => Hooks.callAll('atlas-foundry.showHudPanelsChanged'),
  });
  // Client-scoped list of the last typed search queries (text only, no document content);
  // cleared on logout / session reset.
  game.settings.register(MODULE_ID, 'recentSearches', {
    scope: 'client',
    config: false,
    type: Array,
    default: [],
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

/** The GM's picked deadline documents; a malformed stored value reads as `[]`. */
export function getDeadlineDocuments(): DeadlineRef[] {
  return parseDeadlineRefs(game.settings.get<unknown>(MODULE_ID, 'deadlineDocuments'));
}

export async function setDeadlineDocuments(refs: DeadlineRef[]): Promise<unknown> {
  return game.settings.set(MODULE_ID, 'deadlineDocuments', parseDeadlineRefs(refs));
}

export function getBaseUrl(): string {
  return game.settings.get<string>(MODULE_ID, 'baseUrl') ?? '';
}

export async function setBaseUrl(value: string): Promise<void> {
  await game.settings.set(MODULE_ID, 'baseUrl', normalizeBaseUrl(value));
}

/**
 * The pinned campaign id. Only a real Mongo id counts: older module versions stored a pasted
 * alias (e.g. `dvl`) here, and the backend rejects that as `campaignId` (HTTP 400), so such a
 * stale value is treated as "not pinned" instead of breaking the login.
 */
export function getCampaignId(): string {
  const value = game.settings.get<string>(MODULE_ID, 'campaignId') ?? '';
  return /^[0-9a-f]{24}$/i.test(value) ? value : '';
}

export async function setCampaignId(value: string): Promise<void> {
  await game.settings.set(MODULE_ID, 'campaignId', value);
}

export function getCampaignSlug(): string {
  return game.settings.get<string>(MODULE_ID, 'campaignSlug') ?? '';
}

export async function setCampaignSlug(value: string): Promise<void> {
  await game.settings.set(MODULE_ID, 'campaignSlug', value);
}

/**
 * Stores a parsed Atlas URL. The base URL is always stored. A campaign id replaces the alias; an
 * alias keeps the already pinned campaign id only when alias and base URL are unchanged
 * (otherwise a new login pins it again); a plain base URL clears both.
 */
export async function applyAtlasUrl(parsed: ParsedAtlasUrl): Promise<void> {
  const previousBaseUrl = getBaseUrl();
  const previousSlug = getCampaignSlug();
  const baseUrl = normalizeBaseUrl(parsed.baseUrl);
  await setBaseUrl(baseUrl);
  if (parsed.campaignId) {
    await setCampaignId(parsed.campaignId);
    await setCampaignSlug('');
  } else if (parsed.campaignSlug) {
    if (parsed.campaignSlug !== previousSlug || baseUrl !== previousBaseUrl) await setCampaignId('');
    await setCampaignSlug(parsed.campaignSlug);
  } else {
    await setCampaignId('');
    await setCampaignSlug('');
  }
}

interface StoredUserToken {
  token: string;
  tokenId: string;
}

function getUserTokens(): Record<string, StoredUserToken> {
  return game.settings.get<Record<string, StoredUserToken>>(MODULE_ID, 'userTokens') ?? {};
}

export function getUserToken(): string {
  return getUserTokens()[game.user.id]?.token ?? '';
}

export function getUserTokenId(): string {
  return getUserTokens()[game.user.id]?.tokenId ?? '';
}

export async function setUserToken(token: string, tokenId: string): Promise<void> {
  await game.settings.set(MODULE_ID, 'userTokens', { ...getUserTokens(), [game.user.id]: { token, tokenId } });
}

/** Recent search texts; anything that is not an array of strings reads as empty. */
export function getRecentSearchList(): string[] {
  const value = game.settings.get<unknown>(MODULE_ID, 'recentSearches');
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

export function setRecentSearchList(list: string[]): Promise<string[]> {
  return game.settings.set<string[]>(MODULE_ID, 'recentSearches', list);
}

/** Master switch: whether the right-hand HUD column is shown at all. */
export function getShowHud(): boolean {
  return game.settings.get<boolean>(MODULE_ID, 'showHud') ?? true;
}

export function setShowHud(value: boolean): Promise<boolean> {
  return game.settings.set<boolean>(MODULE_ID, 'showHud', value);
}

/** Whether the quest and link panels of the right-hand HUD are expanded (true) or folded into the toggle pill (false). */
export function getShowHudPanels(): boolean {
  return game.settings.get<boolean>(MODULE_ID, 'showHudPanels') ?? true;
}

export function setShowHudPanels(value: boolean): Promise<boolean> {
  return game.settings.set<boolean>(MODULE_ID, 'showHudPanels', value);
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
  const tokens = { ...getUserTokens() };
  delete tokens[game.user.id];
  await game.settings.set(MODULE_ID, 'userTokens', tokens);
}

/**
 * Tokens used to be one browser-wide slot shared by every Foundry user of the
 * browser. Those are discarded once (everyone reconnects); the Atlas profile
 * keeps listing the old link until it expires or is revoked there. Call once
 * from `ready`, before `authManager.restore()`.
 */
export async function discardLegacyUserToken(): Promise<void> {
  const legacyToken = game.settings.get<string>(MODULE_ID, 'userToken');
  const legacyTokenId = game.settings.get<string>(MODULE_ID, 'userTokenId');
  if (!legacyToken && !legacyTokenId) return;

  await game.settings.set(MODULE_ID, 'userToken', '');
  await game.settings.set(MODULE_ID, 'userTokenId', '');
  if (legacyToken) ui.notifications.info(t('ATLASFOUNDRY.Auth.LegacyTokenDiscarded'));
}
