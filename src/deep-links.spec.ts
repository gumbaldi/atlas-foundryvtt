import { describe, expect, it, vi } from 'vitest';
import { atlasCampaignDashboardUrl, atlasDocumentUrl, resolveLocale } from './deep-links';

function mockGame(lang: string, baseUrl: string) {
  globalThis.game = {
    settings: { register: vi.fn(), get: vi.fn(() => baseUrl), set: vi.fn() },
    i18n: { lang, localize: (key: string) => key, format: (key: string) => key },
    user: { isGM: true, name: 'Tester' },
    world: { id: 'world-1', title: 'Test World' },
  } as unknown as Game;
}

describe('resolveLocale', () => {
  it('resolves "de" for German locale variants', () => {
    mockGame('de', 'https://atlas.example.com');
    expect(resolveLocale()).toBe('de');
    mockGame('de-DE', 'https://atlas.example.com');
    expect(resolveLocale()).toBe('de');
  });

  it('falls back to "en" for anything else', () => {
    mockGame('en', 'https://atlas.example.com');
    expect(resolveLocale()).toBe('en');
    mockGame('en-US', 'https://atlas.example.com');
    expect(resolveLocale()).toBe('en');
    mockGame('fr', 'https://atlas.example.com');
    expect(resolveLocale()).toBe('en');
  });
});

describe('atlasDocumentUrl', () => {
  it('builds the campaign document deep link with the resolved locale', () => {
    mockGame('de', 'https://atlas.example.com');
    expect(atlasDocumentUrl('camp-1', 'characters', 'doc-1')).toBe(
      'https://atlas.example.com/de/campaigns/camp-1/characters/doc-1',
    );
  });

  it('uses the base URL exactly as stored, without adding a second slash', () => {
    mockGame('en', 'https://atlas.example.com');
    const url = atlasDocumentUrl('camp-1', 'locations', 'doc-2');
    expect(url).toBe('https://atlas.example.com/en/campaigns/camp-1/locations/doc-2');
    expect(url).not.toContain('//en');
  });

  it('inserts the customModuleId segment for a custom-module document', () => {
    mockGame('en', 'https://atlas.example.com');
    expect(atlasDocumentUrl('camp-1', 'custom', 'doc-3', 'module-9')).toBe(
      'https://atlas.example.com/en/campaigns/camp-1/custom/module-9/doc-3',
    );
  });
});

describe('atlasCampaignDashboardUrl', () => {
  it('builds the campaign dashboard link with the resolved locale', () => {
    mockGame('de', 'https://atlas.example.com');
    expect(atlasCampaignDashboardUrl('camp-1')).toBe('https://atlas.example.com/de/campaigns/camp-1');
  });
});
