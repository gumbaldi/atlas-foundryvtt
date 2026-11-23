import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Guards the Foundry v14 start-up contract: evaluating the ES module must not
 * read any setting (they only exist after `init`), and every UI hook must be
 * registered by the end of `init` — v14 builds the scene controls before
 * `ready` fires.
 */

type Handler = (...args: any[]) => unknown;

interface HookHarness {
  handlers: Record<string, Handler[]>;
  fire: (name: string, ...args: any[]) => void;
}

function installFoundryStubs(): HookHarness & { registered: Set<string> } {
  const handlers: Record<string, Handler[]> = {};
  const registered = new Set<string>();

  globalThis.Hooks = {
    on: vi.fn((name: string, cb: Handler) => {
      (handlers[name] ??= []).push(cb);
      return (handlers[name] ?? []).length;
    }),
    once: vi.fn((name: string, cb: Handler) => {
      (handlers[name] ??= []).push(cb);
      return (handlers[name] ?? []).length;
    }),
    off: vi.fn(),
    callAll: vi.fn(),
  } as unknown as HooksStatic;

  globalThis.game = {
    settings: {
      register: vi.fn((_ns: string, key: string) => {
        registered.add(key);
      }),
      registerMenu: vi.fn(),
      get: vi.fn((_ns: string, key: string) => {
        if (!registered.has(key)) throw new Error(`"atlas-foundry.${key}" is not a registered game setting`);
        return undefined;
      }),
      set: vi.fn(async () => undefined),
    },
    keybindings: { register: vi.fn() },
    i18n: { lang: 'en', localize: (key: string) => key, format: (key: string) => key },
    user: { isGM: true },
    world: { id: 'test-world', title: 'Test World' },
    scenes: { get: vi.fn() },
    socket: { on: vi.fn() },
  } as unknown as Game;

  globalThis.ui = { notifications: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } } as unknown as Ui;

  class EmptyApp {}
  (globalThis as any).foundry = {
    applications: { api: { ApplicationV2: EmptyApp, DialogV2: EmptyApp } },
    utils: { escapeHTML: (s: string) => s },
  };

  return {
    handlers,
    registered,
    fire: (name, ...args) => (handlers[name] ?? []).forEach((cb) => cb(...args)),
  };
}

describe('main.ts start-up', () => {
  let harness: HookHarness & { registered: Set<string> };

  beforeEach(() => {
    vi.resetModules();
    harness = installFoundryStubs();
  });

  it('evaluates without reading unregistered settings and exposes the AtlasFoundry API', async () => {
    await import('./main');

    const api = (globalThis as any).AtlasFoundry;
    expect(api).toBeDefined();
    for (const key of ['openSearch', 'openSettings', 'openLogin', 'toggleHudPanels', 'openNotifications']) {
      expect(typeof api[key]).toBe('function');
    }
  });

  it('registers its settings and a scene-controls listener by the end of init', async () => {
    await import('./main');
    harness.fire('init');

    expect(harness.registered.has('showBell')).toBe(true);
    expect(harness.registered.has('showHudPanels')).toBe(true);
    expect((harness.handlers['getSceneControlButtons'] ?? []).length).toBeGreaterThan(0);
  });

  it('offers only the connect tool in the Atlas control group while signed out', async () => {
    await import('./main');
    harness.fire('init');

    const controls: Record<string, any> = { tokens: { tools: {} as Record<string, unknown> } };
    harness.fire('getSceneControlButtons', controls);

    expect(Object.keys(controls.atlas.tools)).toEqual(['atlasConnect']);
    expect(Object.keys(controls.tokens.tools)).toEqual([]);
  });

  it('adds the Atlas tools to the Atlas control group while signed in', async () => {
    // Signed in: the per-user token is stored under the Foundry user id.
    game.user.id = 'u1';
    vi.mocked(game.settings.get).mockImplementation((_ns: string, key: string) =>
      key === 'userTokens' ? { u1: { token: 'device-token', tokenId: 'tok-1' } } : undefined,
    );
    await import('./main');
    harness.fire('init');

    const controls: Record<string, any> = { tokens: { tools: {} as Record<string, unknown> } };
    harness.fire('getSceneControlButtons', controls);

    expect(Object.keys(controls.atlas.tools)).toEqual(
      expect.arrayContaining(['atlasSearch', 'atlasHudToggle', 'atlasNotifications', 'atlasSceneLinks']),
    );
    expect(controls.atlas.tools.atlasConnect).toBeUndefined();
  });

  it('hooks the V14 scene context menu and not the removed getSceneNavigationContext', async () => {
    await import('./main');
    harness.fire('init');

    expect((harness.handlers['getSceneContextOptions'] ?? []).length).toBeGreaterThan(0);
    expect(harness.handlers['getSceneNavigationContext']).toBeUndefined();
  });

  it('registers the scene bar, sheet header and scene context hooks but no renderTokenHUD listener', async () => {
    await import('./main');
    harness.fire('init');

    expect(harness.handlers['renderTokenHUD']).toBeUndefined();
    expect((harness.handlers['getHeaderControlsApplicationV2'] ?? []).length).toBeGreaterThan(0);
    expect((harness.handlers['getSceneContextOptions'] ?? []).length).toBeGreaterThan(0);
  });

  it('registers the GM settings as an official module menu and no renderSettings button', async () => {
    await import('./main');
    const { AtlasSettingsApp } = await import('./apps/settings-app');
    harness.fire('init');

    expect(game.settings.registerMenu).toHaveBeenCalledTimes(1);
    expect(game.settings.registerMenu).toHaveBeenCalledWith(
      'atlas-foundry',
      'connection',
      expect.objectContaining({ restricted: true, type: AtlasSettingsApp }),
    );
    expect(harness.handlers['renderSettings']).toBeUndefined();
  });
});
