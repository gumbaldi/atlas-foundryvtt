import { beforeEach, describe, expect, it, vi } from 'vitest';

const startDeviceFlow = vi.fn();
const pollDeviceFlow = vi.fn();
const login = vi.fn();
const setLinking = vi.fn();
const getMe = vi.fn(() => ({ displayName: 'Bob', campaignName: 'Kampagne' }));
const getCampaignId = vi.fn(() => '');
const setCampaignId = vi.fn(async () => undefined);

vi.mock('./device-flow', () => ({ startDeviceFlow, pollDeviceFlow }));
vi.mock('./auth-manager', () => ({
  authManager: { login, setLinking, getMe },
  revokeUnlinkedToken: vi.fn(),
}));
vi.mock('../settings', () => ({ getCampaignId, setCampaignId }));
vi.mock('../log', () => ({ log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() }, notifyError: vi.fn() }));

const START = {
  deviceCode: 'dev',
  userCode: 'ABCD-1234',
  verificationUri: 'https://atlas.example/link-foundry',
  verificationUriComplete: 'https://atlas.example/link-foundry?code=ABCD-1234',
  expiresIn: 600,
  interval: 5,
};
const APPROVED = { status: 'approved', token: 'atlas_foundry_new', tokenId: 'tid', campaignId: 'c1', expiresAt: '' };

interface Tab {
  location: { href: string };
  close: ReturnType<typeof vi.fn>;
  opener: unknown;
}

let tab: Tab;
let promptImpl: (options: any) => Promise<unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  getCampaignId.mockReturnValue('');
  startDeviceFlow.mockResolvedValue(START);
  login.mockResolvedValue(undefined);

  tab = { location: { href: '' }, close: vi.fn(), opener: 'foundry' };
  (globalThis as any).window = { open: vi.fn(() => tab) };
  globalThis.game = { user: { isGM: true, name: 'GM' }, world: { id: 'w', title: 'W' } } as unknown as Game;
  globalThis.ui = { notifications: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } } as unknown as Ui;

  const dialog = { element: { querySelector: () => null }, close: vi.fn(async () => undefined) };
  // Default: the dialog stays open until the poll closes it; individual tests override.
  promptImpl = (options) => {
    options.render?.({}, dialog);
    return new Promise(() => undefined);
  };
  (globalThis as any).foundry = {
    applications: { api: { DialogV2: { prompt: (options: any) => promptImpl(options) } } },
    utils: { escapeHTML: (s: string) => s },
  };
  globalThis.game.i18n = { localize: (k: string) => k, format: (k: string) => k } as unknown as GameI18n;
});

async function loadOpenLoginDialog() {
  return (await import('./login-app')).openLoginDialog;
}

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('openLoginDialog', () => {
  it('points the blank tab opened by the click at the Atlas confirmation page', async () => {
    const openLoginDialog = await loadOpenLoginDialog();
    void openLoginDialog();
    await flush();

    expect(window.open).toHaveBeenCalledWith('', '_blank');
    expect(tab.location.href).toBe(START.verificationUriComplete);
    expect(tab.opener).toBeNull();
  });

  it('closes the blank tab when the device flow cannot be started', async () => {
    startDeviceFlow.mockRejectedValue(new Error('down'));
    const openLoginDialog = await loadOpenLoginDialog();
    await openLoginDialog();

    expect(tab.close).toHaveBeenCalled();
    expect(tab.location.href).toBe('');
  });

  it('closes the blank tab and never starts the flow when prepare rejects', async () => {
    const openLoginDialog = await loadOpenLoginDialog();
    await openLoginDialog({ prepare: async () => Promise.reject(new Error('no url')) });

    expect(startDeviceFlow).not.toHaveBeenCalled();
    expect(tab.close).toHaveBeenCalled();
  });

  it('does not log in when the dialog was closed (X) before the poll was approved', async () => {
    let resolvePoll: (value: unknown) => void = () => undefined;
    pollDeviceFlow.mockImplementation(() => new Promise((resolve) => (resolvePoll = resolve)));
    const dialog = { element: { querySelector: () => null }, close: vi.fn(async () => undefined) };
    promptImpl = async (options) => {
      options.render?.({}, dialog);
      return undefined; // closed via X / Escape
    };

    const openLoginDialog = await loadOpenLoginDialog();
    await openLoginDialog();

    const signal = pollDeviceFlow.mock.calls[0]?.[1] as AbortSignal;
    expect(signal.aborted).toBe(true);

    resolvePoll(APPROVED);
    await flush();
    expect(login).not.toHaveBeenCalled();
    expect(setCampaignId).not.toHaveBeenCalled();
  });

  it('pins the world to the campaign only after login succeeded', async () => {
    const order: string[] = [];
    login.mockImplementation(async () => void order.push('login'));
    setCampaignId.mockImplementation(async () => void order.push('setCampaignId'));
    pollDeviceFlow.mockResolvedValue(APPROVED);

    const openLoginDialog = await loadOpenLoginDialog();
    void openLoginDialog();
    await flush();

    expect(order).toEqual(['login', 'setCampaignId']);
    expect(setCampaignId).toHaveBeenCalledWith('c1');
  });

  it('does not pin the world when login is rejected', async () => {
    login.mockRejectedValue(new Error('rejected'));
    pollDeviceFlow.mockResolvedValue(APPROVED);

    const openLoginDialog = await loadOpenLoginDialog();
    void openLoginDialog();
    await flush();

    expect(setCampaignId).not.toHaveBeenCalled();
  });
});
