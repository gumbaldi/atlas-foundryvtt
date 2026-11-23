import { describe, expect, it } from 'vitest';
import { addRef, removeRef } from './deadline-docs-state';
import { MAX_DEADLINE_REFS, type DeadlineRef } from './deadline-refs';

const ref = (id: string, moduleType = 'locations'): DeadlineRef => ({ documentId: id, moduleType });

describe('addRef', () => {
  it('appends a new ref', () => {
    const result = addRef([ref('a')], ref('b'));
    expect(result.status).toBe('added');
    expect(result.list).toEqual([ref('a'), ref('b')]);
  });

  it('ignores a duplicate (same type and id)', () => {
    const list = [ref('a')];
    const result = addRef(list, ref('a'));
    expect(result.status).toBe('duplicate');
    expect(result.list).toEqual([ref('a')]);
  });

  it('treats the same id under another module type as a different document', () => {
    const result = addRef([ref('a', 'locations')], ref('a', 'factions'));
    expect(result.status).toBe('added');
    expect(result.list).toHaveLength(2);
  });

  it('refuses past the limit and says so', () => {
    const full = Array.from({ length: MAX_DEADLINE_REFS }, (_, i) => ref(`d${i}`));
    const result = addRef(full, ref('extra'));
    expect(result.status).toBe('limit');
    expect(result.list).toHaveLength(MAX_DEADLINE_REFS);
  });

  it('does not mutate the input list', () => {
    const list = [ref('a')];
    addRef(list, ref('b'));
    expect(list).toEqual([ref('a')]);
  });
});

describe('removeRef', () => {
  it('removes exactly that entry', () => {
    expect(removeRef([ref('a'), ref('b'), ref('a', 'factions')], ref('a'))).toEqual([ref('b'), ref('a', 'factions')]);
  });

  it('leaves a missing entry alone', () => {
    expect(removeRef([ref('a')], ref('zzz'))).toEqual([ref('a')]);
  });
});
