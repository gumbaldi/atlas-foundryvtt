import { describe, expect, it, vi } from 'vitest';

const documentCacheClear = vi.fn();
const clearInFlightGets = vi.fn();
const visibilityClear = vi.fn();
const closeAllViewers = vi.fn();
const closeQuestPanel = vi.fn();
const closeSearch = vi.fn();
const closeAllLinkManagers = vi.fn();

vi.mock('./api/cache', () => ({ documentCache: { clear: documentCacheClear } }));
vi.mock('./api/client', () => ({ clearInFlightGets }));
vi.mock('./links/link-visibility', () => ({ linkVisibility: { clear: visibilityClear } }));
vi.mock('./apps/viewer-app', () => ({ closeAllViewers }));
vi.mock('./quests/quest-panel-app', () => ({ closeQuestPanel }));
vi.mock('./search/search-app', () => ({ closeSearch }));
vi.mock('./links/link-manager-app', () => ({ closeAllLinkManagers }));

const { resetSessionData } = await import('./session-reset');

describe('resetSessionData', () => {
  it('clears every cache and closes every window that shows Atlas content', () => {
    resetSessionData();

    for (const fn of [documentCacheClear, clearInFlightGets, visibilityClear, closeAllViewers, closeQuestPanel, closeSearch, closeAllLinkManagers]) {
      expect(fn).toHaveBeenCalledOnce();
    }
  });
});
