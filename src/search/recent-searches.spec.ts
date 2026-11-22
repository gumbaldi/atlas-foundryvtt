import { describe, expect, it } from 'vitest';
import { addRecent, clearRecent } from './recent-searches';

describe('addRecent', () => {
  it('puts a new query at the front', () => {
    expect(addRecent(['goblin'], 'dragon')).toEqual(['dragon', 'goblin']);
  });

  it('moves a case-insensitive duplicate to the front instead of repeating it', () => {
    expect(addRecent(['goblin', 'Dragon', 'orc'], 'dragon')).toEqual(['dragon', 'goblin', 'orc']);
  });

  it('caps the list at 8 entries', () => {
    const list = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8'];
    const next = addRecent(list, 'new');
    expect(next).toHaveLength(8);
    expect(next[0]).toBe('new');
    expect(next).not.toContain('a8');
  });

  it('honours a custom max', () => {
    expect(addRecent(['a1', 'a2'], 'b1', 2)).toEqual(['b1', 'a1']);
  });

  it('ignores queries under 2 characters or only whitespace', () => {
    const list = ['goblin'];
    expect(addRecent(list, 'a')).toEqual(['goblin']);
    expect(addRecent(list, '   ')).toEqual(['goblin']);
    expect(addRecent(list, ' a ')).toEqual(['goblin']);
    expect(addRecent(list, '')).toEqual(['goblin']);
  });

  it('trims the stored query', () => {
    expect(addRecent([], '  dragon  ')).toEqual(['dragon']);
  });

  it('does not mutate the input list', () => {
    const list = ['goblin', 'orc'];
    const copy = [...list];
    addRecent(list, 'dragon');
    addRecent(list, 'GOBLIN');
    expect(list).toEqual(copy);
  });
});

describe('clearRecent', () => {
  it('returns an empty list', () => {
    expect(clearRecent()).toEqual([]);
  });
});
