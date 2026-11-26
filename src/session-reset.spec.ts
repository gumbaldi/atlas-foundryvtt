import { describe, expect, it, vi } from 'vitest';

const documentCacheClear = vi.fn();
const clearInFlightGets = vi.fn();
const visibilityClear = vi.fn();
const clearQuestTracker = vi.fn();
const clearDeadlineSection = vi.fn();
const closeSearch = vi.fn();
const closeAllLinkManagers = vi.fn();
const closeDeadlineDocsManager = vi.fn();
const clearRecentSearches = vi.fn();
const closeAllNotificationPopups = vi.fn();
const clearDiaryInvitation = vi.fn();

vi.mock('./api/cache', () => ({ documentCache: { clear: documentCacheClear } }));
vi.mock('./api/client', () => ({ clearInFlightGets }));
vi.mock('./links/link-visibility', () => ({ linkVisibility: { clear: visibilityClear } }));
vi.mock('./quests/quest-tracker', () => ({ clearQuestTracker }));
vi.mock('./deadlines/deadline-section', () => ({ clearDeadlineSection }));
vi.mock('./search/search-app', () => ({ closeSearch }));
vi.mock('./links/link-manager-app', () => ({ closeAllLinkManagers }));
vi.mock('./deadlines/deadline-docs-app', () => ({ closeDeadlineDocsManager }));
vi.mock('./search/recent-searches', () => ({ clearRecentSearches }));
vi.mock('./notifications/notification-popups', () => ({ closeAllNotificationPopups }));
vi.mock('./diary/diary-invitation', () => ({ clearDiaryInvitation }));

const { resetSessionData } = await import('./session-reset');

describe('resetSessionData', () => {
  it('clears every cache and closes every window that shows Atlas content', () => {
    resetSessionData();

    for (const fn of [documentCacheClear, clearInFlightGets, visibilityClear, clearQuestTracker, clearDeadlineSection, closeSearch, closeAllLinkManagers, closeDeadlineDocsManager, clearRecentSearches, closeAllNotificationPopups, clearDiaryInvitation]) {
      expect(fn).toHaveBeenCalledOnce();
    }
  });
});
