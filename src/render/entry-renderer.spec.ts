// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderEntryHtml } from './entry-renderer';

function mockFoundryGlobals(enrichImpl: (html: string) => Promise<string> = async (html) => html) {
  globalThis.game = {
    i18n: { lang: 'en', localize: (key: string) => key, format: (key: string) => key },
  } as unknown as Game;

  (globalThis as unknown as { foundry: unknown }).foundry = {
    applications: {
      ux: {
        TextEditor: { implementation: { enrichHTML: vi.fn(enrichImpl) } },
      },
    },
  };
}

describe('renderEntryHtml', () => {
  beforeEach(() => mockFoundryGlobals());

  it('renders sanitized+enriched HTML into a container', async () => {
    const container = await renderEntryHtml('<p>hello</p>', { onMentionActivate: vi.fn() });
    expect(container.innerHTML).toContain('hello');
    expect(container.className).toBe('atlas-foundry-entry');
  });

  it('strips dangerous markup before it ever reaches enrichHTML', async () => {
    const enrich = vi.fn(async (html: string) => html);
    mockFoundryGlobals(enrich);
    await renderEntryHtml('<script>alert(1)</script><p>safe</p>', { onMentionActivate: vi.fn() });
    expect(enrich).toHaveBeenCalledWith(expect.not.stringContaining('script'), expect.anything());
  });

  it('activates a mention: a plain click calls back with openInAtlas=false', async () => {
    const onMentionActivate = vi.fn();
    const container = await renderEntryHtml('<a data-document-id="d1" data-module-type="characters">Bob</a>', {
      onMentionActivate,
    });
    const mention = container.querySelector('[data-document-id]') as HTMLElement;
    expect(mention.classList.contains('atlas-mention')).toBe(true);

    mention.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(onMentionActivate).toHaveBeenCalledWith('characters', 'd1', false);
  });

  it('treats a shift-click as "open in Atlas"', async () => {
    const onMentionActivate = vi.fn();
    const container = await renderEntryHtml('<a data-document-id="d1" data-module-type="characters">Bob</a>', {
      onMentionActivate,
    });
    const mention = container.querySelector('[data-document-id]') as HTMLElement;
    mention.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, shiftKey: true }));
    expect(onMentionActivate).toHaveBeenCalledWith('characters', 'd1', true);
  });

  it('treats a context-menu activation as "open in Atlas"', async () => {
    const onMentionActivate = vi.fn();
    const container = await renderEntryHtml('<a data-document-id="d1" data-module-type="characters">Bob</a>', {
      onMentionActivate,
    });
    const mention = container.querySelector('[data-document-id]') as HTMLElement;
    mention.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    expect(onMentionActivate).toHaveBeenCalledWith('characters', 'd1', true);
  });

  it('replaces a broken image with a text fallback', async () => {
    const container = await renderEntryHtml('<img src="https://atlas.example.com/x.png">', { onMentionActivate: vi.fn() });
    const img = container.querySelector('img')!;
    img.dispatchEvent(new Event('error'));
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.atlas-foundry-image-fallback')).not.toBeNull();
  });

  it('falls back to the sanitized HTML if enrichHTML throws', async () => {
    mockFoundryGlobals(async () => {
      throw new Error('enrich failed');
    });
    const container = await renderEntryHtml('<p>hello</p>', { onMentionActivate: vi.fn() });
    expect(container.innerHTML).toContain('hello');
  });
});
