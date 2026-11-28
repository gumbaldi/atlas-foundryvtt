import { describe, expect, it } from 'vitest';
import { parseDocumentChange } from './document-changes';

const VALID = {
  campaignId: 'camp-1',
  moduleType: 'quests',
  documentId: 'q-1',
  change: 'updated',
  updatedAt: '2026-11-26T10:00:00.000Z',
};

describe('parseDocumentChange', () => {
  it('returns the typed change for a valid payload', () => {
    expect(parseDocumentChange(VALID)).toEqual(VALID);
  });

  it('keeps customModuleId for custom module types', () => {
    expect(parseDocumentChange({ ...VALID, moduleType: 'custom', customModuleId: 'mod-1' })).toMatchObject({ customModuleId: 'mod-1' });
  });

  it('rejects malformed payloads', () => {
    expect(parseDocumentChange(null)).toBeNull();
    expect(parseDocumentChange('x')).toBeNull();
    expect(parseDocumentChange({ ...VALID, documentId: '' })).toBeNull();
    expect(parseDocumentChange({ ...VALID, change: 'renamed' })).toBeNull();
    expect(parseDocumentChange({ ...VALID, moduleType: 'not-a-type' })).toBeNull();
    expect(parseDocumentChange({ documentId: 'q-1' })).toBeNull();
  });
});
