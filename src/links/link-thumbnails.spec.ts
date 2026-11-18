import { describe, expect, it } from 'vitest';
import { partitionChips, resolveLinkThumbnails, type ThumbnailDeps } from './link-thumbnails';

const ref = (id: string) => ({ documentId: id, moduleType: 'characters' });

describe('resolveLinkThumbnails', () => {
  it('prefers heroImageUrl over imageUrl', async () => {
    const deps: ThumbnailDeps = { getDocument: async () => ({ heroImageUrl: 'hero.png', imageUrl: 'img.png' }) };
    const map = await resolveLinkThumbnails([ref('a')], deps);
    expect(map.get('a')).toBe('hero.png');
  });

  it('falls back to imageUrl', async () => {
    const deps: ThumbnailDeps = { getDocument: async () => ({ imageUrl: 'img.png' }) };
    expect((await resolveLinkThumbnails([ref('a')], deps)).get('a')).toBe('img.png');
  });

  it('gives null for a document without any image', async () => {
    const deps: ThumbnailDeps = { getDocument: async () => ({}) };
    expect((await resolveLinkThumbnails([ref('a')], deps)).get('a')).toBeNull();
  });

  it('gives null for a rejecting getDocument without rejecting the call', async () => {
    const deps: ThumbnailDeps = {
      getDocument: async (_type, id) => {
        if (id === 'bad') throw new Error('nope');
        return { imageUrl: 'ok.png' };
      },
    };
    const map = await resolveLinkThumbnails([ref('bad'), ref('good')], deps);
    expect(map.get('bad')).toBeNull();
    expect(map.get('good')).toBe('ok.png');
  });

  it('never has more than 4 calls in flight', async () => {
    let inFlight = 0;
    let peak = 0;
    const deps: ThumbnailDeps = {
      getDocument: async () => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight--;
        return { imageUrl: 'x.png' };
      },
    };
    const refs = Array.from({ length: 12 }, (_, i) => ref(`d${i}`));
    const map = await resolveLinkThumbnails(refs, deps);
    expect(map.size).toBe(12);
    expect(peak).toBe(4);
  });
});

describe('partitionChips', () => {
  const items = (n: number) => Array.from({ length: n }, (_, i) => i);

  it('shows 3 items without overflow', () => {
    expect(partitionChips(items(3))).toEqual({ shown: [0, 1, 2], overflow: [] });
  });

  it('shows exactly 10 items without overflow', () => {
    const { shown, overflow } = partitionChips(items(10));
    expect(shown).toHaveLength(10);
    expect(overflow).toHaveLength(0);
  });

  it('moves the 11th item into overflow', () => {
    const { shown, overflow } = partitionChips(items(11));
    expect(shown).toHaveLength(10);
    expect(overflow).toEqual([10]);
  });

  it('handles an empty list', () => {
    expect(partitionChips([])).toEqual({ shown: [], overflow: [] });
  });
});
