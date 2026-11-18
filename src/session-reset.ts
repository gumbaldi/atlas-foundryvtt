import { documentCache } from './api/cache';
import { clearInFlightGets } from './api/client';
import { linkVisibility } from './links/link-visibility';
import { clearQuestTracker } from './quests/quest-tracker';
import { closeSearch } from './search/search-app';
import { closeAllLinkManagers } from './links/link-manager-app';

/**
 * Runs on `atlas-foundry.sessionReset` (sign-in, sign-out, revoked token,
 * base-URL change): everything that was loaded under the previous identity
 * is dropped. The notification store resets itself via `authChanged`.
 */
export function resetSessionData(): void {
  documentCache.clear();
  clearInFlightGets();
  linkVisibility.clear();
  clearQuestTracker();
  closeSearch();
  closeAllLinkManagers();
}
