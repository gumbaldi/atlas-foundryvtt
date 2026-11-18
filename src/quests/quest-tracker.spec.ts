import { describe, expect, it } from 'vitest';
import { countTrackedQuests, selectTrackedQuests } from './quest-selection';
import type { AtlasQuest } from '../atlas-types';

function quest(id: string, overrides: Partial<AtlasQuest> = {}): AtlasQuest {
  return {
    id,
    name: `Quest ${id}`,
    status: 'open',
    category: null,
    parentId: null,
    tags: [],
    entryPlainText: '',
    isGmOnly: false,
    characterIds: [],
    locationIds: [],
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const ids = (quests: AtlasQuest[]) => quests.map((q) => q.id);

describe('selectTrackedQuests', () => {
  it('returns only pinned open quests once any open quest carries the isPinned field', () => {
    const quests = [quest('a', { isPinned: true }), quest('b', { isPinned: false }), quest('c', { isPinned: true }), quest('d')];
    expect(ids(selectTrackedQuests(quests))).toEqual(expect.arrayContaining(['a', 'c']));
    expect(selectTrackedQuests(quests)).toHaveLength(2);
  });

  it('sorts pinned quests by updatedAt, newest first', () => {
    const quests = [
      quest('old', { isPinned: true, updatedAt: '2026-01-01T00:00:00.000Z' }),
      quest('new', { isPinned: true, updatedAt: '2026-03-01T00:00:00.000Z' }),
      quest('mid', { isPinned: true, updatedAt: '2026-02-01T00:00:00.000Z' }),
    ];
    expect(ids(selectTrackedQuests(quests))).toEqual(['new', 'mid', 'old']);
  });

  it('caps the result at three by default and honours an explicit max', () => {
    const quests = ['a', 'b', 'c', 'd', 'e'].map((id, i) => quest(id, { isPinned: true, updatedAt: `2026-01-0${i + 1}T00:00:00.000Z` }));
    expect(ids(selectTrackedQuests(quests))).toEqual(['e', 'd', 'c']);
    expect(selectTrackedQuests(quests, 2)).toHaveLength(2);
  });

  it('includes pinned sub-quests next to top-level ones', () => {
    const quests = [quest('root', { isPinned: true }), quest('child', { isPinned: true, parentId: 'root' })];
    expect(selectTrackedQuests(quests)).toHaveLength(2);
  });

  it('falls back to the first three open top-level quests when no quest has the field', () => {
    const quests = [quest('a'), quest('sub', { parentId: 'a' }), quest('b'), quest('c'), quest('d')];
    expect(ids(selectTrackedQuests(quests))).toEqual(['a', 'b', 'c']);
  });

  it('shows nothing when the field is present on all quests but none is pinned', () => {
    const quests = [quest('a', { isPinned: false }), quest('b', { isPinned: false })];
    expect(selectTrackedQuests(quests)).toEqual([]);
  });

  it('never returns completed or failed quests, pinned or not', () => {
    const pinned = [quest('done', { status: 'completed', isPinned: true }), quest('lost', { status: 'failed', isPinned: true }), quest('live', { isPinned: true })];
    expect(ids(selectTrackedQuests(pinned))).toEqual(['live']);

    const unpinnedFallback = [quest('done', { status: 'completed' }), quest('lost', { status: 'failed' }), quest('live')];
    expect(ids(selectTrackedQuests(unpinnedFallback))).toEqual(['live']);
  });

  it('returns an empty list for an empty input', () => {
    expect(selectTrackedQuests([])).toEqual([]);
  });
});

describe('countTrackedQuests', () => {
  it('counts every quest the rule selects, beyond the display cap', () => {
    const quests = ['a', 'b', 'c', 'd', 'e'].map((id) => quest(id, { isPinned: true }));
    expect(countTrackedQuests(quests)).toBe(5);
    expect(selectTrackedQuests(quests)).toHaveLength(3);
  });
});
