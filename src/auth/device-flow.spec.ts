import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pollDeviceFlow, startDeviceFlow, type DeviceFlowStart } from './device-flow';

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

describe('pollDeviceFlow', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const start: DeviceFlowStart = {
    deviceCode: 'device-code-1',
    userCode: 'ABCD-1234',
    verificationUri: 'https://atlas.example.com/link-foundry',
    verificationUriComplete: 'https://atlas.example.com/link-foundry?code=ABCD-1234',
    expiresIn: 30,
    interval: 5,
  };

  beforeEach(() => {
    mockGame('https://atlas.example.com');
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('polls at the given interval and resolves once approved', async () => {
    let call = 0;
    fetchMock.mockImplementation(async () => {
      call += 1;
      if (call < 3) return jsonResponse(200, { status: 'pending' });
      return jsonResponse(200, {
        status: 'approved',
        token: 'atlas_foundry_x',
        tokenId: 'tok-1',
        campaignId: 'camp-1',
        expiresAt: new Date().toISOString(),
      });
    });

    const controller = new AbortController();
    const resultPromise = pollDeviceFlow(start, controller.signal);

    await vi.advanceTimersByTimeAsync(5000);
    await vi.advanceTimersByTimeAsync(5000);
    await vi.advanceTimersByTimeAsync(5000);

    const result = await resultPromise;
    expect(result).toMatchObject({ status: 'approved', token: 'atlas_foundry_x' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('backs off by 5s on slow_down and keeps the longer interval afterwards', async () => {
    let call = 0;
    fetchMock.mockImplementation(async () => {
      call += 1;
      if (call === 1) return jsonResponse(200, { status: 'slow_down' });
      if (call === 2) return jsonResponse(200, { status: 'pending' });
      return jsonResponse(200, { status: 'denied' });
    });

    const controller = new AbortController();
    const resultPromise = pollDeviceFlow(start, controller.signal);

    await vi.advanceTimersByTimeAsync(5000); // t=5s -> slow_down, interval becomes 10s
    await vi.advanceTimersByTimeAsync(10000); // t=15s -> pending
    await vi.advanceTimersByTimeAsync(10000); // t=25s -> denied

    const result = await resultPromise;
    expect(result).toEqual({ status: 'denied' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('resolves expired once the deadline passes without a decision', async () => {
    fetchMock.mockImplementation(async () => jsonResponse(200, { status: 'pending' }));

    const controller = new AbortController();
    const resultPromise = pollDeviceFlow(start, controller.signal);

    // expiresIn=30s, interval=5s — six pending polls exhaust the window,
    // then the loop's own deadline check resolves it.
    for (let i = 0; i < 6; i += 1) {
      await vi.advanceTimersByTimeAsync(5000);
    }

    const result = await resultPromise;
    expect(result).toEqual({ status: 'expired' });
  });

  it('rejects with AbortError when the caller cancels', async () => {
    fetchMock.mockImplementation(async () => jsonResponse(200, { status: 'pending' }));
    const controller = new AbortController();
    const resultPromise = pollDeviceFlow(start, controller.signal);

    controller.abort();
    await expect(resultPromise).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('retries transient network failures at the same interval instead of failing the flow', async () => {
    let call = 0;
    fetchMock.mockImplementation(async () => {
      call += 1;
      if (call === 1) throw new TypeError('network error');
      return jsonResponse(200, { status: 'denied' });
    });

    const controller = new AbortController();
    const resultPromise = pollDeviceFlow(start, controller.signal);

    await vi.advanceTimersByTimeAsync(5000); // 1st poll throws, swallowed
    await vi.advanceTimersByTimeAsync(5000); // 2nd poll -> denied

    const result = await resultPromise;
    expect(result).toEqual({ status: 'denied' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('startDeviceFlow', () => {
  beforeEach(() => {
    mockGame('https://atlas.example.com');
  });

  it('posts to /foundry/device/start and returns the parsed response', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, {
        deviceCode: 'dc',
        userCode: 'AAAA-BBBB',
        verificationUri: 'x',
        verificationUriComplete: 'y',
        expiresIn: 600,
        interval: 5,
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await startDeviceFlow({ worldId: 'world-1' });
    expect(result.userCode).toBe('AAAA-BBBB');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://atlas.example.com/api/v1/foundry/device/start',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
