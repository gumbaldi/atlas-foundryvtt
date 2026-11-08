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
    user: { isGM, name: 'Tester' },
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
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    store = { baseUrl: 'https://atlas.example.com', campaignId: '', userToken: 'atlas_foundry_abc', userTokenId: 'token-1' };
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
    expect(store.userToken).toBe('');
    expect(store.userTokenId).toBe('');

    // A revoked state must not silently flip back to 'loggedOut' on the next call.
    await expect(manager.ensureAccessToken()).rejects.toThrow();
    expect(manager.getState()).toBe('revoked');
  });

  it('warns when /foundry/me reports a different campaign than the world is pinned to', async () => {
    store.campaignId = 'world-campaign';
    fetchMock.mockImplementation(async (url: string) => {
      if (url === EXCHANGE_URL) return jsonResponse(200, { accessToken: 'jwt-1', tokenType: 'Bearer', expiresIn: 900, scopes: [], campaignId: 'other-campaign', worldId: 'world-1' });
      if (url === ME_URL) return jsonResponse(200, { userId: 'u1', displayName: 'Bob', campaignId: 'other-campaign', campaignName: 'Andere Kampagne', role: 'player' });
      throw new Error(`unexpected fetch ${url}`);
    });

    const manager = new AuthManager();
    await manager.ensureAccessToken();

    expect(globalThis.ui.notifications.warn).toHaveBeenCalledOnce();
  });

  it('login() stores the device token and validates it immediately', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === EXCHANGE_URL) return jsonResponse(200, { accessToken: 'jwt-1', tokenType: 'Bearer', expiresIn: 900, scopes: [], campaignId: 'c1', worldId: 'world-1' });
      if (url === ME_URL) return jsonResponse(200, { userId: 'u1', displayName: 'Bob', campaignId: 'c1', campaignName: 'Testkampagne', role: 'player' });
      throw new Error(`unexpected fetch ${url}`);
    });

    store.userToken = '';
    store.userTokenId = '';
    const manager = new AuthManager();
    await manager.login('atlas_foundry_new', 'token-2');

    expect(store.userToken).toBe('atlas_foundry_new');
    expect(store.userTokenId).toBe('token-2');
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

    expect(store.userToken).toBe('');
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

    expect(store.userToken).toBe('');
    expect(manager.getState()).toBe('loggedOut');
    expect(globalThis.ui.notifications.warn).toHaveBeenCalledOnce();
  });
});
