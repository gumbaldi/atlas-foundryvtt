import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearUserToken,
  discardLegacyUserToken,
  getBaseUrl,
  getCampaignId,
  getUserToken,
  getUserTokenId,
  setUserToken,
  migrateLegacyIntegrationToken,
  normalizeBaseUrl,
  setBaseUrl,
  setCampaignId,
  validateBaseUrl,
} from './settings';
import { MODULE_ID } from './constants';

function mockGame(store: Record<string, unknown>, isGM = true, userId = 'u1') {
  globalThis.game = {
    settings: {
      register: vi.fn(),
      get: vi.fn((_namespace: string, key: string) => store[key]),
      set: vi.fn(async (_namespace: string, key: string, value: unknown) => {
        store[key] = value;
        return value;
      }),
    },
    i18n: {
      lang: 'en',
      localize: (key: string) => key,
      format: (key: string) => key,
    },
    user: { isGM, id: userId },
    world: { id: 'test-world', title: 'Test World' },
  } as unknown as Game;

  globalThis.ui = {
    notifications: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  } as unknown as Ui;
}

describe('normalizeBaseUrl', () => {
  it('strips trailing slashes and surrounding whitespace', () => {
    expect(normalizeBaseUrl('  https://atlas.example.com/// ')).toBe('https://atlas.example.com');
  });

  it('leaves a URL without a trailing slash untouched', () => {
    expect(normalizeBaseUrl('https://atlas.example.com')).toBe('https://atlas.example.com');
  });
});

describe('validateBaseUrl', () => {
  it('flags a missing http(s) scheme', () => {
    const result = validateBaseUrl('atlas.example.com');
    expect(result.normalized).toBe('atlas.example.com');
    expect(result.warningKey).toBe('ATLASFOUNDRY.Settings.BaseUrlMissingScheme');
  });

  it('accepts a URL with an explicit scheme', () => {
    const result = validateBaseUrl('https://atlas.example.com/');
    expect(result.normalized).toBe('https://atlas.example.com');
    expect(result.warningKey).toBeUndefined();
  });

  it('does not warn on an empty value', () => {
    expect(validateBaseUrl('').warningKey).toBeUndefined();
  });
});

describe('settings helpers', () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = { baseUrl: '', campaignId: '', integrationToken: '' };
    mockGame(store);
  });

  it('round-trips baseUrl through the mocked game.settings store', async () => {
    await setBaseUrl('https://atlas.example.com/');
    expect(getBaseUrl()).toBe('https://atlas.example.com');
  });

  it('round-trips campaignId', async () => {
    await setCampaignId('64f0000000000000000000ab');
    expect(getCampaignId()).toBe('64f0000000000000000000ab');
  });

  it('clears a legacy integration token and warns the GM', async () => {
    store.integrationToken = 'atlas_foundry_legacy';
    await migrateLegacyIntegrationToken();

    expect(store.integrationToken).toBe('');
    expect(globalThis.ui.notifications.warn).toHaveBeenCalledOnce();
  });

  it('does nothing when there is no legacy token', async () => {
    await migrateLegacyIntegrationToken();

    expect(globalThis.game.settings.set).not.toHaveBeenCalledWith(MODULE_ID, 'integrationToken', '');
    expect(globalThis.ui.notifications.warn).not.toHaveBeenCalled();
  });

  it('does not attempt to write the world-scoped setting on a player client', async () => {
    store.integrationToken = 'atlas_foundry_legacy';
    mockGame(store, false);

    await migrateLegacyIntegrationToken();

    expect(store.integrationToken).toBe('atlas_foundry_legacy');
    expect(globalThis.game.settings.set).not.toHaveBeenCalled();
    expect(globalThis.ui.notifications.warn).not.toHaveBeenCalled();
  });
});

describe('per-user Foundry token', () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = { userTokens: {}, userToken: '', userTokenId: '' };
  });

  it('keeps one sign-in per Foundry user in the same browser', async () => {
    mockGame(store, true, 'u1');
    await setUserToken('token-u1', 'id-u1');

    mockGame(store, false, 'u2');
    expect(getUserToken()).toBe('');
    await setUserToken('token-u2', 'id-u2');

    mockGame(store, true, 'u1');
    expect(getUserToken()).toBe('token-u1');
    expect(getUserTokenId()).toBe('id-u1');

    mockGame(store, false, 'u2');
    expect(getUserToken()).toBe('token-u2');
    expect(getUserTokenId()).toBe('id-u2');
  });

  it('clearUserToken only removes the current user\'s entry', async () => {
    mockGame(store, true, 'u1');
    await setUserToken('token-u1', 'id-u1');
    mockGame(store, false, 'u2');
    await setUserToken('token-u2', 'id-u2');

    await clearUserToken();

    expect(getUserToken()).toBe('');
    mockGame(store, true, 'u1');
    expect(getUserToken()).toBe('token-u1');
  });
});

describe('discardLegacyUserToken', () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = { userTokens: {}, userToken: '', userTokenId: '' };
    mockGame(store);
  });

  it('empties a filled browser-wide token and tells the user to reconnect once', async () => {
    store.userToken = 'atlas_foundry_old';
    store.userTokenId = 'old-id';

    await discardLegacyUserToken();

    expect(store.userToken).toBe('');
    expect(store.userTokenId).toBe('');
    expect(globalThis.ui.notifications.info).toHaveBeenCalledOnce();
  });

  it('does nothing when there is no legacy token', async () => {
    await discardLegacyUserToken();

    expect(globalThis.game.settings.set).not.toHaveBeenCalled();
    expect(globalThis.ui.notifications.info).not.toHaveBeenCalled();
  });
});
