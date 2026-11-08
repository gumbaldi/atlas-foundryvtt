import { describe, expect, it, vi, beforeEach } from 'vitest';

let nextId = 0;
globalThis.foundry = {
  utils: {
    escapeHTML: (v: string) => v,
    randomID: () => `id-${++nextId}`,
  },
} as unknown as typeof foundry;

const { addLink, getLinks, removeLink, updateLinkLabel } = await import('./link-store');

function fakeDoc(initial: unknown = undefined) {
  let stored = initial;
  return {
    getFlag: vi.fn(() => stored),
    setFlag: vi.fn(async (_scope: string, _key: string, value: unknown) => {
      stored = value;
      return value;
    }),
  };
}

describe('link-store', () => {
  beforeEach(() => {
    nextId = 0;
  });

  it('returns no links for a document that never had the flag set', () => {
    const doc = fakeDoc(undefined);
    expect(getLinks(doc)).toEqual([]);
  });

  it('adds a link with a generated id and createdAt, persisted via setFlag', async () => {
    const doc = fakeDoc();
    const created = await addLink(doc, { documentId: 'doc-1', moduleType: 'characters', nameSnapshot: 'Aria' });

    expect(created).toMatchObject({ id: 'id-1', documentId: 'doc-1', moduleType: 'characters', nameSnapshot: 'Aria' });
    expect(typeof created.createdAt).toBe('number');
    expect(doc.setFlag).toHaveBeenCalledWith('atlas-foundry', 'links', { version: 1, items: [created] });
    expect(getLinks(doc)).toEqual([created]);
  });

  it('trims a label and omits it entirely when blank', async () => {
    const doc = fakeDoc();
    const withLabel = await addLink(doc, { documentId: 'doc-1', moduleType: 'characters', nameSnapshot: 'Aria', label: '  My Label  ' });
    expect(withLabel.label).toBe('My Label');

    const withoutLabel = await addLink(doc, { documentId: 'doc-2', moduleType: 'items', nameSnapshot: 'Sword', label: '   ' });
    expect(withoutLabel.label).toBeUndefined();
  });

  it('appends multiple links instead of overwriting', async () => {
    const doc = fakeDoc();
    await addLink(doc, { documentId: 'doc-1', moduleType: 'characters', nameSnapshot: 'Aria' });
    await addLink(doc, { documentId: 'doc-2', moduleType: 'locations', nameSnapshot: 'Bryn Hall' });

    expect(getLinks(doc).map((l) => l.documentId)).toEqual(['doc-1', 'doc-2']);
  });

  it('updateLinkLabel changes only the matching link', async () => {
    const doc = fakeDoc();
    const a = await addLink(doc, { documentId: 'doc-1', moduleType: 'characters', nameSnapshot: 'Aria' });
    const b = await addLink(doc, { documentId: 'doc-2', moduleType: 'locations', nameSnapshot: 'Bryn Hall' });

    await updateLinkLabel(doc, a.id, 'Nemesis');
    const links = getLinks(doc);
    expect(links.find((l) => l.id === a.id)?.label).toBe('Nemesis');
    expect(links.find((l) => l.id === b.id)?.label).toBeUndefined();
  });

  it('updateLinkLabel with a blank value clears an existing label', async () => {
    const doc = fakeDoc();
    const a = await addLink(doc, { documentId: 'doc-1', moduleType: 'characters', nameSnapshot: 'Aria', label: 'Old' });
    await updateLinkLabel(doc, a.id, '   ');
    expect(getLinks(doc)[0]?.label).toBeUndefined();
  });

  it('removeLink drops only the matching link', async () => {
    const doc = fakeDoc();
    const a = await addLink(doc, { documentId: 'doc-1', moduleType: 'characters', nameSnapshot: 'Aria' });
    const b = await addLink(doc, { documentId: 'doc-2', moduleType: 'locations', nameSnapshot: 'Bryn Hall' });

    await removeLink(doc, a.id);
    expect(getLinks(doc)).toEqual([b]);
  });

  it('tolerates malformed legacy data instead of throwing', () => {
    expect(getLinks(fakeDoc({ not: 'the right shape' }))).toEqual([]);
    expect(getLinks(fakeDoc({ version: 2, items: [] }))).toEqual([]);
    expect(getLinks(fakeDoc({ version: 1, items: 'not-an-array' }))).toEqual([]);
    expect(getLinks(fakeDoc({ version: 1, items: [{ id: 'x' }, { id: 'y', documentId: 'd', moduleType: 'characters', nameSnapshot: 'N', createdAt: 1 }] }))).toEqual([
      { id: 'y', documentId: 'd', moduleType: 'characters', nameSnapshot: 'N', createdAt: 1 },
    ]);
  });
});
