import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AtlasAuthError, AtlasForbiddenError, AtlasNetworkError, AtlasNotFoundError, AtlasServerError } from './errors';

vi.mock('../auth/auth-manager', () => ({
  authManager: {
    ensureAccessToken: vi.fn(async () => 'jwt-token'),
    invalidateCache: vi.fn(),
  },
}));

// Imported after the mock so both the module under test and the spec share the mocked instance.
const { authManager } = await import('../auth/auth-manager');
const { request } = await import('./client');

function mockGame(baseUrl: string) {
  globalThis.game = {
    settings: { register: vi.fn(), get: vi.fn(() => baseUrl), set: vi.fn() },
    i18n: { lang: 'en', localize: (key: string) => key, format: (key: string) => key },
    user: { isGM: true, name: 'Tester' },
    world: { id: 'world-1', title: 'Test World' },
  } as unknown as Game;
}

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe('request()', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockGame('https://atlas.example.com');
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    vi.mocked(authManager.ensureAccessToken).mockClear().mockResolvedValue('jwt-token');
    vi.mocked(authManager.invalidateCache).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves with the parsed JSON body on success', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));
    await expect(request('/foundry/me')).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://atlas.example.com/api/v1/foundry/me',
      expect.objectContaining({ method: 'GET', headers: expect.objectContaining({ Authorization: 'Bearer jwt-token' }) }),
    );
  });

  it('dedupes concurrent identical GETs into a single fetch', async () => {
    let resolveFetch!: (value: Response) => void;
    fetchMock.mockReturnValue(new Promise((resolve) => { resolveFetch = resolve; }));

    const first = request('/foundry/campaigns/c1/user-documents');
    const second = request('/foundry/campaigns/c1/user-documents');
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    resolveFetch(jsonResponse(200, { docs: [] }));
    await expect(first).resolves.toEqual({ docs: [] });
    await expect(second).resolves.toEqual({ docs: [] });
  });

  it('maps 403/404/5xx responses to the matching error class', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(403, { message: 'nope' }));
    await expect(request('/a')).rejects.toBeInstanceOf(AtlasForbiddenError);

    fetchMock.mockResolvedValueOnce(jsonResponse(404, { message: 'gone' }));
    await expect(request('/b')).rejects.toBeInstanceOf(AtlasNotFoundError);

    fetchMock.mockResolvedValueOnce(jsonResponse(500, { message: 'boom' }));
    await expect(request('/c')).rejects.toBeInstanceOf(AtlasServerError);
  });

  it('re-exchanges and retries exactly once on a 401, then gives up', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { message: 'expired' }));
    await expect(request('/d')).rejects.toBeInstanceOf(AtlasAuthError);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(authManager.invalidateCache).toHaveBeenCalledOnce();
  });

  it('succeeds after a single 401 retry once the token is fresh', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, {})).mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    await expect(request('/e')).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects with AtlasNetworkError on a fetch rejection', async () => {
    fetchMock.mockRejectedValue(new TypeError('network down'));
    await expect(request('/f')).rejects.toBeInstanceOf(AtlasNetworkError);
  });

  it('aborts and rejects with AtlasNetworkError once the timeout elapses', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    );

    const promise = request('/g', { timeoutMs: 1000 });
    const assertion = expect(promise).rejects.toBeInstanceOf(AtlasNetworkError);
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });

  it('rejects with AtlasAuthError when not logged in', async () => {
    vi.mocked(authManager.ensureAccessToken).mockRejectedValue(new Error('not logged in'));
    await expect(request('/h')).rejects.toBeInstanceOf(AtlasAuthError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
