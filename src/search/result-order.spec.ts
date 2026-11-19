import { describe, expect, it } from 'vitest';
import type { AtlasSearchResult } from '../atlas-types';
import { displayTitle, isTitleHit, orderSearchResults } from './result-order';

function hit(id: string, moduleType: string, name: string, sessionNumber?: number | null): AtlasSearchResult {
  return { id, moduleType, name, tags: [], sessionNumber: sessionNumber ?? null } as AtlasSearchResult;
}

describe('isTitleHit', () => {
  it('matches when every query word occurs in the title, ignoring case and accents', () => {
    expect(isTitleHit('Horan Kornfeld', 'horan')).toBe(true);
    expect(isTitleHit('Am Hof der Oger-Königin', 'konigin')).toBe(true);
    expect(isTitleHit('Horan Kornfeld', 'horan zzz')).toBe(false);
  });

  it('never matches an empty query', () => {
    expect(isTitleHit('Horan Kornfeld', '   ')).toBe(false);
  });
});

describe('orderSearchResults', () => {
  const results = [
    hit('t1', 'characters', 'Horan Kornfeld'),
    hit('x1', 'session-logs', 'Die Schlacht', 86),
    hit('x2', 'session-logs', 'Am Hof der Oger-Königin', 163),
    hit('x3', 'session-logs', 'Am Hof von Kaiser Hroka', 103),
    hit('x4', 'session-logs', 'Ankunft', 71),
  ];

  it('keeps the backend order for relevance', () => {
    expect(orderSearchResults(results, 'horan', 'relevance')).toBe(results);
  });

  it('puts title hits first and sorts each group A–Z by displayed title', () => {
    const ordered = orderSearchResults(
      [
        hit('b', 'session-logs', 'Zeta', 3),
        hit('a', 'session-logs', 'Alpha', 1),
        hit('c', 'characters', 'Horan Kornfeld'),
        hit('d', 'session-logs', 'Mitte', 2),
      ],
      'horan',
      'alphabetical',
    );
    expect(ordered.map((r) => r.id)).toEqual(['c', 'a', 'd', 'b']);
  });

  it('sorts session numbers numerically, not as text', () => {
    const ordered = orderSearchResults(results, 'horan', 'alphabetical');
    expect(ordered.slice(1).map((r) => displayTitle(r))).toEqual([
      '#71 - Ankunft',
      '#86 - Die Schlacht',
      '#103 - Am Hof von Kaiser Hroka',
      '#163 - Am Hof der Oger-Königin',
    ]);
  });

  it('does not modify the input array', () => {
    const copy = [...results];
    orderSearchResults(results, 'horan', 'alphabetical');
    expect(results).toEqual(copy);
  });
});
