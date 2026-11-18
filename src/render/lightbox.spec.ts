import { afterEach, describe, expect, it, vi } from 'vitest';

const { openImageLightbox } = await import('./lightbox');

describe('openImageLightbox', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens an ImagePopout with the source and the title', () => {
    const render = vi.fn();
    const ImagePopout = vi.fn(function (this: { render: typeof render }) {
      this.render = render;
    });
    const open = vi.fn();
    vi.stubGlobal('foundry', { applications: { apps: { ImagePopout } } });
    vi.stubGlobal('window', { open });

    openImageLightbox('https://atlas.example/a.png', 'Dragon');

    expect(ImagePopout).toHaveBeenCalledWith({ src: 'https://atlas.example/a.png', window: { title: 'Dragon' } });
    expect(render).toHaveBeenCalledWith(true);
    expect(open).not.toHaveBeenCalled();
  });

  it('falls back to a new tab when the class is missing', () => {
    const open = vi.fn();
    vi.stubGlobal('foundry', { applications: {} });
    vi.stubGlobal('window', { open });

    openImageLightbox('https://atlas.example/a.png', 'Dragon');

    expect(open).toHaveBeenCalledWith('https://atlas.example/a.png', '_blank');
  });

  it('does nothing for an empty source', () => {
    const open = vi.fn();
    const ImagePopout = vi.fn();
    vi.stubGlobal('foundry', { applications: { apps: { ImagePopout } } });
    vi.stubGlobal('window', { open });

    openImageLightbox('', 'Dragon');

    expect(ImagePopout).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });
});
