import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthManager } from './auth-manager';

function mockGame(store: Record<string, unknown>, isGM = true) {
  globalThis.game = {
    settings: {
      register: vi.fn(),
      get: vi.fn((_namespace: string, key: string) => store[key]),
      set: vi.fn(async (_namespace: string, key: string, value: unknown) => {
        store[key] = value;
        return value;
      }),
    },
    i18n: { lang: 'en', localize: (key: string) => key, format: (key: string) => key },
    user: { isGM, name: 'Tester', id: 'u1' },
    world: { id: 'world-1', title: 'Test World' },
  } as unknown as Game;

  globalThis.ui = {
    notifications: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  } as unknown as Ui;
}

function mockHooks() {
  const handlers: Record<string, Array<(...args: any[]) => void>> = {};
  globalThis.Hooks = {
    on: vi.fn((hook: string, cb: any) => {
      (handlers[hook] ??= []).push(cb);
      return handlers[hook]!.length;
    }),
    once: vi.fn(),
    off: vi.fn((hook: string, cb: any) => {
      handlers[hook] = (handlers[hook] ?? []).filter((h) => h !== cb);
    }),
    callAll: vi.fn((hook: string, ...args: any[]) => {
      (handlers[hook] ?? []).forEach((cb) => cb(...args));
      return true;
    }),
  } as unknown as HooksStatic;
  return handlers;
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

const EXCHANGE_URL = 'https://atlas.example.com/api/v1/foundry/token-exchange';
const ME_URL = 'https://atlas.example.com/api/v1/foundry/me';
const REVOKE_URL = (id: string) => `https://atlas.example.com/api/v1/users/me/foundry-tokens/${id}`;

describe('AuthManager', () => {
  let store: Record<string, unknown>;
  const entry = () => (store.userTokens as Record<string, { token: string; tokenId: string }>).u1;
  const storedToken = () => entry()?.token ?? '';
  const storedTokenId = () => entry()?.tokenId ?? '';
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    store = { baseUrl: 'https://atlas.example.com', campaignId: '', userTokens: { u1: { token: 'atlas_foundry_abc', tokenId: 'token-1' } } };
    mockGame(store);
    mockHooks();
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('caches the exchanged JWT and only refreshes /foundry/me once per exchange', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === EXCHANGE_URL) {
        return jsonResponse(200, { accessToken: 'jwt-1', tokenType: 'Bearer', expiresIn: 900, scopes: [], campaignId: 'c1', worldId: 'world-1' });
      }
      if (url === ME_URL) {
        return jsonResponse(200, { userId: 'u1', displayName: 'Bob', campaignId: 'c1', campaignName: 'Testkampagne', role: 'player' });
      }
      throw new Error(`unexpected fetch ${url}`);
    });

    const manager = new AuthManager();
    const token = await manager.ensureAccessToken();
    expect(token).toBe('jwt-1');
    expect(manager.getState()).toBe('active');
    expect(manager.getMe()).toMatchObject({ displayName: 'Bob' });

    const second = await manager.ensureAccessToken();
    expect(second).toBe('jwt-1');
    expect(fetchMock).toHaveBeenCalledTimes(2); // one exchange + one /me, no repeat
  });

  it('re-exchanges once the cached JWT is within the 60s skew window', async () => {
    vi.useFakeTimers();
    const start = 1_700_000_000_000;
    vi.setSystemTime(start);

    let exchangeCalls = 0;
    fetchMock.mockImplementation(async (url: string) => {
      if (url === EXCHANGE_URL) {
        exchangeCalls += 1;
        return jsonResponse(200, { accessToken: `jwt-${exchangeCalls}`, tokenType: 'Bearer', expiresIn: 900, scopes: [], campaignId: 'c1', worldId: 'world-1' });
      }
      if (url === ME_URL) return jsonResponse(200, { userId: 'u1', displayName: 'Bob', campaignId: 'c1', campaignName: 'Testkampagne', role: 'player' });
      throw new Error(`unexpected fetch ${url}`);
    });

    const manager = new AuthManager();
    await manager.ensureAccessToken();
    expect(exchangeCalls).toBe(1);

    // 61s left — still above the 60s skew, must stay cached.
    vi.setSystemTime(start + 900_000 - 61_000);
    await manager.ensureAccessToken();
    expect(exchangeCalls).toBe(1);

    // 59s left — inside the skew window, must re-exchange.
    vi.setSystemTime(start + 900_000 - 59_000);
    const token = await manager.ensureAccessToken();
    expect(exchangeCalls).toBe(2);
    expect(token).toBe('jwt-2');
  });

  it('clears the stored token and transitions to revoked on a 401 exchange response', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === EXCHANGE_URL) return jsonResponse(401, {});
      throw new Error(`unexpected fetch ${url}`);
    });

    const manager = new AuthManager();
    await expect(manager.ensureAccessToken()).rejects.toThrow();

    expect(manager.getState()).toBe('revoked');
    expect(storedToken()).toBe('');

    // A revoked state must not silently flip back to 'loggedOut' on the next call.
    await expect(manager.ensureAccessToken()).rejects.toThrow();
    expect(manager.getState()).toBe('revoked');
  });

  it('refuses and revokes a token whose campaign differs from the world\'s campaign', async () => {
    store.campaignId = 'world-campaign';
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === EXCHANGE_URL) return jsonResponse(200, { accessToken: 'jwt-1', tokenType: 'Bearer', expiresIn: 900, scopes: [], campaignId: 'other-campaign', worldId: 'world-1' });
      if (url === REVOKE_URL('token-1') && init?.method === 'DELETE') return jsonResponse(204, {});
      throw new Error(`unexpected fetch ${url}`);
    });

    const manager = new AuthManager();
    await expect(manager.ensureAccessToken()).rejects.toThrow();

    expect(manager.getState()).toBe('revoked');
    expect(manager.getRevokedReason()).toBe('campaign-mismatch');
    expect(storedToken()).toBe('');
    expect(fetchMock).toHaveBeenCalledWith(REVOKE_URL('token-1'), expect.objectContaining({ method: 'DELETE' }));
  });

  it('drops an exchange result that finishes after the stored token changed', async () => {
    let releaseExchange: (() => void) | undefined;
    fetchMock.mockImplementation(async (url: string) => {
      if (url === EXCHANGE_URL) {
        await new Promise<void>((resolve) => {
          releaseExchange = resolve;
        });
        return jsonResponse(200, { accessToken: 'jwt-stale', tokenType: 'Bearer', expiresIn: 900, scopes: [], campaignId: 'c1', worldId: 'world-1' });
      }
      if (url === ME_URL) return jsonResponse(200, { userId: 'u1', displayName: 'Bob', campaignId: 'c1', campaignName: 'Testkampagne', role: 'player' });
      throw new Error(`unexpected fetch ${url}`);
    });

    const manager = new AuthManager();
    const pending = manager.ensureAccessToken();
    const assertion = expect(pending).rejects.toThrow();

    store.userTokens = { u1: { token: 'atlas_foundry_other', tokenId: 'token-9' } };
    releaseExchange?.();
    await assertion;

    expect(manager.getState()).not.toBe('active');
    expect(manager.getLinkedCampaignId()).toBeNull();
  });

  it('login() stores the device token and validates it immediately', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === EXCHANGE_URL) return jsonResponse(200, { accessToken: 'jwt-1', tokenType: 'Bearer', expiresIn: 900, scopes: [], campaignId: 'c1', worldId: 'world-1' });
      if (url === ME_URL) return jsonResponse(200, { userId: 'u1', displayName: 'Bob', campaignId: 'c1', campaignName: 'Testkampagne', role: 'player' });
      throw new Error(`unexpected fetch ${url}`);
    });

    store.userTokens = {};
    const manager = new AuthManager();
    await manager.login('atlas_foundry_new', 'token-2');

    expect(storedToken()).toBe('atlas_foundry_new');
    expect(storedTokenId()).toBe('token-2');
    expect(manager.getState()).toBe('active');
  });

  it('logout() revokes the token server-side and always clears local state, even offline', async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === EXCHANGE_URL) return jsonResponse(200, { accessToken: 'jwt-1', tokenType: 'Bearer', expiresIn: 900, scopes: [], campaignId: 'c1', worldId: 'world-1' });
      if (url === ME_URL) return jsonResponse(200, { userId: 'u1', displayName: 'Bob', campaignId: 'c1', campaignName: 'Testkampagne', role: 'player' });
      if (url === REVOKE_URL('token-1') && init?.method === 'DELETE') return jsonResponse(204, {});
      throw new Error(`unexpected fetch ${url}`);
    });

    const manager = new AuthManager();
    await manager.logout();

    expect(storedToken()).toBe('');
    expect(manager.getState()).toBe('loggedOut');
    expect(fetchMock).toHaveBeenCalledWith(REVOKE_URL('token-1'), expect.objectContaining({ method: 'DELETE' }));
  });

  it('logout() falls back to a local-only logout when the server is unreachable', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === EXCHANGE_URL) return jsonResponse(200, { accessToken: 'jwt-1', tokenType: 'Bearer', expiresIn: 900, scopes: [], campaignId: 'c1', worldId: 'world-1' });
      if (url === ME_URL) return jsonResponse(200, { userId: 'u1', displayName: 'Bob', campaignId: 'c1', campaignName: 'Testkampagne', role: 'player' });
      if (url === REVOKE_URL('token-1')) throw new Error('network down');
      throw new Error(`unexpected fetch ${url}`);
    });

    const manager = new AuthManager();
    await manager.logout();

    expect(storedToken()).toBe('');
    expect(manager.getState()).toBe('loggedOut');
    expect(globalThis.ui.notifications.warn).toHaveBeenCalledOnce();
  });

  describe('session epoch', () => {
    const okExchange = async (url: string, init?: RequestInit) => {
      if (url === EXCHANGE_URL) return jsonResponse(200, { accessToken: 'jwt-1', tokenType: 'Bearer', expiresIn: 900, scopes: [], campaignId: 'c1', worldId: 'world-1' });
      if (url === ME_URL) return jsonResponse(200, { userId: 'u1', displayName: 'Bob', campaignId: 'c1', campaignName: 'Testkampagne', role: 'player' });
      if (init?.method === 'DELETE') return jsonResponse(204, {});
      throw new Error(`unexpected fetch ${url}`);
    };

    beforeEach(() => {
      mockHooks();
      fetchMock.mockImplementation(okExchange);
    });

    const resets = () => (globalThis.Hooks.callAll as ReturnType<typeof vi.fn>).mock.calls.filter(([name]) => name === 'atlas-foundry.sessionReset').length;

    it('advances and announces on login()', async () => {
      const manager = new AuthManager();
      const before = manager.getSessionEpoch();
      await manager.login('atlas_foundry_new', 'token-2');
      expect(manager.getSessionEpoch()).toBeGreaterThan(before);
      expect(resets()).toBeGreaterThan(0);
    });

    it('advances and announces on logout()', async () => {
      const manager = new AuthManager();
      const before = manager.getSessionEpoch();
      await manager.logout();
      expect(manager.getSessionEpoch()).toBeGreaterThan(before);
      expect(resets()).toBeGreaterThan(0);
    });

    it('advances and announces when the exchange reports a revoked token', async () => {
      fetchMock.mockImplementation(async (url: string) => (url === EXCHANGE_URL ? jsonResponse(401, {}) : jsonResponse(500, {})));
      const manager = new AuthManager();
      const before = manager.getSessionEpoch();
      await expect(manager.ensureAccessToken()).rejects.toThrow();
      expect(manager.getSessionEpoch()).toBeGreaterThan(before);
      expect(resets()).toBeGreaterThan(0);
    });

    it('advances and announces on invalidateCache() (base URL change)', () => {
      const manager = new AuthManager();
      const before = manager.getSessionEpoch();
      manager.invalidateCache();
      expect(manager.getSessionEpoch()).toBeGreaterThan(before);
      expect(resets()).toBeGreaterThan(0);
    });

    it('stays put on a plain token renewal', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(1_700_000_000_000);
      const manager = new AuthManager();
      await manager.ensureAccessToken();
      const before = manager.getSessionEpoch();
      const callsBefore = resets();

      vi.setSystemTime(1_700_000_000_000 + 900_000 - 30_000);
      await manager.ensureAccessToken();

      expect(manager.getSessionEpoch()).toBe(before);
      expect(resets()).toBe(callsBefore);
    });
  });
});
