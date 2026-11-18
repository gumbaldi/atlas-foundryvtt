// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const store: Record<string, unknown> = {};

function installStubs() {
  for (const key of Object.keys(store)) delete store[key];
  store.baseUrl = 'https://atlas.old';
  store.campaignId = '6af153b44755e79bfcd90d83';

  globalThis.game = {
    settings: {
      register: vi.fn(),
      get: vi.fn((_ns: string, key: string) => store[key]),
      set: vi.fn(async (_ns: string, key: string, value: unknown) => {
        store[key] = value;
        return value;
      }),
    },
    i18n: { lang: 'en', localize: (key: string) => key, format: (key: string) => key },
    user: { isGM: true },
    world: { id: 'w', title: 'W' },
  } as unknown as Game;
  globalThis.ui = { notifications: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } } as unknown as Ui;
  globalThis.Hooks = { on: vi.fn(), once: vi.fn(), off: vi.fn(), callAll: vi.fn() } as unknown as HooksStatic;

  class StubApp {
    element = document.createElement('div');
    render = vi.fn(async () => this);
    _onClose() {}
  }
  (globalThis as any).foundry = {
    applications: { api: { ApplicationV2: StubApp, DialogV2: StubApp } },
    utils: { escapeHTML: (s: string) => s.replace(/"/g, '&quot;').replace(/</g, '&lt;') },
  };
}

describe('AtlasSettingsApp', () => {
  beforeEach(() => {
    vi.resetModules();
    installStubs();
  });

  it('renders prefilled inputs without nesting a <form>', async () => {
    const { AtlasSettingsApp } = await import('./settings-app');
    const app = new AtlasSettingsApp();
    const result = (await (app as any)._renderHTML()) as HTMLElement;

    expect(result.querySelector('form')).toBeNull();
    expect(result.querySelector<HTMLInputElement>('input[name="atlasUrl"]')?.value).toBe('https://atlas.old/en/campaigns/6af153b44755e79bfcd90d83');
    expect(result.querySelector('input[name="campaignId"]')).toBeNull();
    expect(result.querySelector('button[type="submit"]')).not.toBeNull();
  });

  it('prefills the alias URL when an alias is stored', async () => {
    store.campaignSlug = 'dvl';
    const { AtlasSettingsApp } = await import('./settings-app');
    const app = new AtlasSettingsApp();
    const result = (await (app as any)._renderHTML()) as HTMLElement;

    expect(result.querySelector<HTMLInputElement>('input[name="atlasUrl"]')?.value).toBe('https://atlas.old/en/campaigns/dvl');
  });

  it('is configured as a form application with a submit handler', async () => {
    const { AtlasSettingsApp } = await import('./settings-app');
    expect(AtlasSettingsApp.DEFAULT_OPTIONS.tag).toBe('form');
    expect(AtlasSettingsApp.DEFAULT_OPTIONS.form?.handler).toBe(AtlasSettingsApp.onSubmit);
  });

  it('derives base URL and campaign id from the campaign URL on submit', async () => {
    const { AtlasSettingsApp } = await import('./settings-app');
    await AtlasSettingsApp.onSubmit({} as Event, {} as HTMLFormElement, {
      object: { atlasUrl: ' https://atlas.example/de/campaigns/6af153b44755e79bfcd90d83 ' },
    });

    expect(store.baseUrl).toBe('https://atlas.example');
    expect(store.campaignId).toBe('6af153b44755e79bfcd90d83');
    expect(ui.notifications.warn).not.toHaveBeenCalled();
  });

  it('still saves a base URL without scheme but warns', async () => {
    const { AtlasSettingsApp } = await import('./settings-app');
    await AtlasSettingsApp.onSubmit({} as Event, {} as HTMLFormElement, {
      object: { atlasUrl: 'atlas.example/campaigns/6af153b44755e79bfcd90d84' },
    });

    expect(store.baseUrl).toBe('atlas.example');
    expect(store.campaignId).toBe('6af153b44755e79bfcd90d84');
    expect(ui.notifications.warn).toHaveBeenCalledWith('ATLASFOUNDRY.Settings.BaseUrlMissingScheme');
  });

  it('stores the alias from an alias URL on submit', async () => {
    const { AtlasSettingsApp } = await import('./settings-app');
    await AtlasSettingsApp.onSubmit({} as Event, {} as HTMLFormElement, {
      object: { atlasUrl: 'https://atlas.example/de/campaigns/DVL' },
    });

    expect(store.baseUrl).toBe('https://atlas.example');
    expect(store.campaignSlug).toBe('dvl');
    expect(store.campaignId).toBe('');
  });

  it('clears the campaign id when only a base URL is entered', async () => {
    const { AtlasSettingsApp } = await import('./settings-app');
    await AtlasSettingsApp.onSubmit({} as Event, {} as HTMLFormElement, {
      object: { atlasUrl: 'https://atlas.example/' },
    });

    expect(store.baseUrl).toBe('https://atlas.example');
    expect(store.campaignId).toBe('');
  });
});
