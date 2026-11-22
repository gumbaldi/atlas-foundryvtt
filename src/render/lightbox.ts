/**
 * Shows an image large. Uses Foundry's ImagePopout when the class exists
 * (its path is not verified for every Foundry version, see docs/SMOKE-TEST.md)
 * and falls back to a new browser tab. The caller passes a URL that already went
 * through `safeImageUrl`; an empty `src` does nothing.
 */
export function openImageLightbox(src: string, title: string): void {
  if (!src) return;

  const ImagePopout = (globalThis as { foundry?: typeof foundry }).foundry?.applications?.apps?.ImagePopout;
  if (typeof ImagePopout === 'function') {
    try {
      void new ImagePopout({ src, window: { title } }).render(true);
      return;
    } catch {
      // fall through to the plain tab below
    }
  }
  window.open(src, '_blank');
}
