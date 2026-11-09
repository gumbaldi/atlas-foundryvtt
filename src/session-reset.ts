import { documentCache } from './api/cache';
import { clearInFlightGets } from './api/client';
import { linkVisibility } from './links/link-visibility';
import { closeAllViewers } from './apps/viewer-app';
import { closeQuestPanel } from './quests/quest-panel-app';
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
  closeAllViewers();
  closeQuestPanel();
  closeSearch();
  closeAllLinkManagers();
}
