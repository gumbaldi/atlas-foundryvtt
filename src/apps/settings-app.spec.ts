// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const store: Record<string, unknown> = {};

function installStubs() {
  for (const key of Object.keys(store)) delete store[key];
  store.baseUrl = 'https://atlas.old';
  store.campaignId = 'old-campaign';

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
    expect(result.querySelector<HTMLInputElement>('input[name="baseUrl"]')?.value).toBe('https://atlas.old');
    expect(result.querySelector<HTMLInputElement>('input[name="campaignId"]')?.value).toBe('old-campaign');
    expect(result.querySelector('button[type="submit"]')).not.toBeNull();
  });

  it('is configured as a form application with a submit handler', async () => {
    const { AtlasSettingsApp } = await import('./settings-app');
    expect(AtlasSettingsApp.DEFAULT_OPTIONS.tag).toBe('form');
    expect(AtlasSettingsApp.DEFAULT_OPTIONS.form?.handler).toBe(AtlasSettingsApp.onSubmit);
  });

  it('stores the trimmed base URL and campaign id on submit', async () => {
    const { AtlasSettingsApp } = await import('./settings-app');
    await AtlasSettingsApp.onSubmit({} as Event, {} as HTMLFormElement, {
      object: { baseUrl: ' https://atlas.example/ ', campaignId: ' c1 ' },
    });

    expect(store.baseUrl).toBe('https://atlas.example');
    expect(store.campaignId).toBe('c1');
    expect(ui.notifications.warn).not.toHaveBeenCalled();
  });

  it('still saves a base URL without scheme but warns', async () => {
    const { AtlasSettingsApp } = await import('./settings-app');
    await AtlasSettingsApp.onSubmit({} as Event, {} as HTMLFormElement, {
      object: { baseUrl: 'atlas.example', campaignId: 'c2' },
    });

    expect(store.baseUrl).toBe('atlas.example');
    expect(store.campaignId).toBe('c2');
    expect(ui.notifications.warn).toHaveBeenCalledWith('ATLASFOUNDRY.Settings.BaseUrlMissingScheme');
  });
});
