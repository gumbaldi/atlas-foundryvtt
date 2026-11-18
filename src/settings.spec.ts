import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyAtlasUrl,
  clearUserToken,
  discardLegacyUserToken,
  getBaseUrl,
  getCampaignId,
  getCampaignSlug,
  getUserToken,
  getUserTokenId,
  setUserToken,
  normalizeBaseUrl,
  parseAtlasUrl,
  setBaseUrl,
  setCampaignId,
  setCampaignSlug,
  validateBaseUrl,
} from './settings';

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

describe('parseAtlasUrl', () => {
  const ID = '6af153b44755e79bfcd90d83';

  it('derives base URL and campaign id from a campaign URL', () => {
    expect(parseAtlasUrl(`https://atlas.ucuri.de/de/campaigns/${ID}`)).toEqual({
      baseUrl: 'https://atlas.ucuri.de',
      campaignId: ID,
      campaignSlug: '',
    });
  });

  it('keeps a lowercased alias as campaignSlug', () => {
    expect(parseAtlasUrl('https://atlas.example/de/campaigns/DVL')).toEqual({
      baseUrl: 'https://atlas.example',
      campaignId: '',
      campaignSlug: 'dvl',
    });
  });

  it('ignores sub-pages, query, hash, whitespace and a missing locale', () => {
    expect(parseAtlasUrl(` https://atlas.example/campaigns/${ID}/quests/x?a=1#h `)).toEqual({
      baseUrl: 'https://atlas.example',
      campaignId: ID,
      campaignSlug: '',
    });
    expect(parseAtlasUrl('https://atlas.example/en/campaigns/dvl/quests/x?a=1#h')).toEqual({
      baseUrl: 'https://atlas.example',
      campaignId: '',
      campaignSlug: 'dvl',
    });
  });

  it('keeps a path prefix in front of the locale', () => {
    expect(parseAtlasUrl('https://example.com/atlas/en/campaigns/dvl').baseUrl).toBe('https://example.com/atlas');
  });

  it('treats a plain base URL as base URL without campaign', () => {
    expect(parseAtlasUrl('https://atlas.example/')).toEqual({ baseUrl: 'https://atlas.example', campaignId: '', campaignSlug: '' });
    expect(parseAtlasUrl('')).toEqual({ baseUrl: '', campaignId: '', campaignSlug: '' });
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
    store = { baseUrl: '', campaignId: '' };
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

  it('round-trips campaignSlug', async () => {
    await setCampaignSlug('dvl');
    expect(getCampaignSlug()).toBe('dvl');
  });
});

describe('applyAtlasUrl', () => {
  const ID = '64f0000000000000000000ab';
  const OTHER_ID = '64f0000000000000000000cd';
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = { baseUrl: 'https://atlas.example', campaignId: ID, campaignSlug: 'dvl' };
    mockGame(store);
  });

  it('stores an id URL and clears the alias', async () => {
    await applyAtlasUrl({ baseUrl: 'https://atlas.example', campaignId: OTHER_ID, campaignSlug: '' });
    expect(store).toMatchObject({ baseUrl: 'https://atlas.example', campaignId: OTHER_ID, campaignSlug: '' });
  });

  it('clears a pinned id when the alias changes', async () => {
    await applyAtlasUrl({ baseUrl: 'https://atlas.example', campaignId: '', campaignSlug: 'other' });
    expect(store).toMatchObject({ campaignId: '', campaignSlug: 'other' });
  });

  it('keeps the pinned id when alias and base URL are unchanged', async () => {
    await applyAtlasUrl({ baseUrl: 'https://atlas.example', campaignId: '', campaignSlug: 'dvl' });
    expect(store).toMatchObject({ campaignId: ID, campaignSlug: 'dvl' });
  });

  it('clears the pinned id when only the base URL changes', async () => {
    await applyAtlasUrl({ baseUrl: 'https://atlas.other', campaignId: '', campaignSlug: 'dvl' });
    expect(store).toMatchObject({ baseUrl: 'https://atlas.other', campaignId: '', campaignSlug: 'dvl' });
  });

  it('clears id and alias for a plain base URL', async () => {
    await applyAtlasUrl({ baseUrl: 'https://atlas.example', campaignId: '', campaignSlug: '' });
    expect(store).toMatchObject({ baseUrl: 'https://atlas.example', campaignId: '', campaignSlug: '' });
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
