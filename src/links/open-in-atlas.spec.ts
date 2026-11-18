import { describe, expect, it, vi } from 'vitest';
import type { AtlasUrlDeps } from './open-in-atlas';

// open-in-atlas.ts imports the wiring modules statically; they touch Foundry globals, which the pure functions never do.
vi.mock('../auth/auth-manager', () => ({ authManager: { getLinkedCampaignId: vi.fn(() => null) } }));
vi.mock('../api/documents', () => ({ getDocument: vi.fn() }));
vi.mock('../deep-links', () => ({ atlasDocumentUrl: vi.fn() }));

const { notificationAtlasTarget, resolveAtlasUrl } = await import('./open-in-atlas');

function makeDeps(overrides: Partial<AtlasUrlDeps> = {}): AtlasUrlDeps {
  return {
    campaignId: 'camp-1',
    getDocument: vi.fn(async () => ({ customModuleId: 'mod-9' })),
    atlasDocumentUrl: vi.fn((campaignId, moduleType, documentId, customModuleId) =>
      moduleType === 'custom' ? `https://atlas/${campaignId}/custom/${customModuleId}/${documentId}` : `https://atlas/${campaignId}/${moduleType}/${documentId}`,
    ),
    ...overrides,
  };
}

describe('resolveAtlasUrl', () => {
  it('builds the URL of a fixed module type without calling getDocument', async () => {
    const deps = makeDeps();
    await expect(resolveAtlasUrl({ moduleType: 'characters', documentId: 'd1' }, deps)).resolves.toBe('https://atlas/camp-1/characters/d1');
    expect(deps.getDocument).not.toHaveBeenCalled();
  });

  it('uses a given customModuleId without calling getDocument', async () => {
    const deps = makeDeps();
    await expect(resolveAtlasUrl({ moduleType: 'custom', documentId: 'd1', customModuleId: 'mod-1' }, deps)).resolves.toBe('https://atlas/camp-1/custom/mod-1/d1');
    expect(deps.getDocument).not.toHaveBeenCalled();
  });

  it('resolves a missing customModuleId with one getDocument call', async () => {
    const deps = makeDeps();
    await expect(resolveAtlasUrl({ moduleType: 'custom', documentId: 'd1' }, deps)).resolves.toBe('https://atlas/camp-1/custom/mod-9/d1');
    expect(deps.getDocument).toHaveBeenCalledTimes(1);
    expect(deps.getDocument).toHaveBeenCalledWith('custom', 'd1');
  });

  it('returns null when getDocument does not yield a customModuleId', async () => {
    const deps = makeDeps({ getDocument: vi.fn(async () => ({})) });
    await expect(resolveAtlasUrl({ moduleType: 'custom', documentId: 'd1' }, deps)).resolves.toBeNull();
  });

  it('returns null without a linked campaign', async () => {
    const deps = makeDeps({ campaignId: null });
    await expect(resolveAtlasUrl({ moduleType: 'characters', documentId: 'd1' }, deps)).resolves.toBeNull();
    await expect(resolveAtlasUrl({ moduleType: 'custom', documentId: 'd1' }, deps)).resolves.toBeNull();
    expect(deps.getDocument).not.toHaveBeenCalled();
  });

  it('rejects when getDocument rejects', async () => {
    const deps = makeDeps({ getDocument: vi.fn(async () => Promise.reject(new Error('403'))) });
    await expect(resolveAtlasUrl({ moduleType: 'custom', documentId: 'd1' }, deps)).rejects.toThrow('403');
  });
});

describe('notificationAtlasTarget', () => {
  it('targets the document when id and module type are present', () => {
    expect(notificationAtlasTarget({ documentId: 'd1', documentModuleType: 'quests' })).toEqual({
      kind: 'document',
      ref: { moduleType: 'quests', documentId: 'd1', customModuleId: undefined },
    });
  });

  it('passes the customModuleId of a custom document along', () => {
    expect(notificationAtlasTarget({ documentId: 'd1', documentModuleType: 'custom', customModuleId: 'mod-1' })).toEqual({
      kind: 'document',
      ref: { moduleType: 'custom', documentId: 'd1', customModuleId: 'mod-1' },
    });
  });

  it('falls back to the dashboard when the module type is missing', () => {
    expect(notificationAtlasTarget({ documentId: 'd1' })).toEqual({ kind: 'dashboard' });
  });

  it('falls back to the dashboard without any document reference', () => {
    expect(notificationAtlasTarget({})).toEqual({ kind: 'dashboard' });
  });
});
