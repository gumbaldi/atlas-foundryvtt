import { describe, expect, it } from 'vitest';
import { parseDeadlineRefs, refsToQuery } from './deadline-refs';

describe('parseDeadlineRefs', () => {
  it('keeps valid entries', () => {
    expect(parseDeadlineRefs([{ documentId: 'a', moduleType: 'characters' }])).toEqual([{ documentId: 'a', moduleType: 'characters' }]);
  });

  it('drops non-arrays', () => {
    expect(parseDeadlineRefs(null)).toEqual([]);
    expect(parseDeadlineRefs(undefined)).toEqual([]);
    expect(parseDeadlineRefs('x')).toEqual([]);
    expect(parseDeadlineRefs({ documentId: 'a', moduleType: 'b' })).toEqual([]);
  });

  it('drops non-objects and entries with a non-string or empty field', () => {
    expect(
      parseDeadlineRefs([
        null,
        'x',
        42,
        { documentId: 1, moduleType: 'characters' },
        { documentId: 'a', moduleType: 2 },
        { documentId: '', moduleType: 'characters' },
        { documentId: 'a', moduleType: '' },
        { documentId: 'a' },
        { documentId: 'ok', moduleType: 'locations' },
      ]),
    ).toEqual([{ documentId: 'ok', moduleType: 'locations' }]);
  });

  it('de-duplicates by moduleType and documentId', () => {
    expect(
      parseDeadlineRefs([
        { documentId: 'a', moduleType: 'characters' },
        { documentId: 'a', moduleType: 'characters' },
        { documentId: 'a', moduleType: 'locations' },
      ]),
    ).toEqual([
      { documentId: 'a', moduleType: 'characters' },
      { documentId: 'a', moduleType: 'locations' },
    ]);
  });

  it('caps at 50 entries', () => {
    const raw = Array.from({ length: 80 }, (_, i) => ({ documentId: `d${i}`, moduleType: 'notes' }));
    expect(parseDeadlineRefs(raw)).toHaveLength(50);
  });

  it('strips extra fields', () => {
    expect(parseDeadlineRefs([{ documentId: 'a', moduleType: 'notes', name: 'Secret' }])).toEqual([{ documentId: 'a', moduleType: 'notes' }]);
  });
});

describe('refsToQuery', () => {
  it('joins type:id pairs with commas', () => {
    expect(
      refsToQuery([
        { documentId: 'a', moduleType: 'characters' },
        { documentId: 'b', moduleType: 'locations' },
      ]),
    ).toBe('characters:a,locations:b');
  });

  it('is empty for no refs', () => {
    expect(refsToQuery([])).toBe('');
  });
});
