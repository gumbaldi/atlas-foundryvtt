/**
 * The bell shows only while something is unread and the player has not turned
 * it off. The count stays valid while the store is in `error` (stale count).
 */
export function shouldShowBell(state: { unreadCount: number }, showBell: boolean): boolean {
  return showBell && state.unreadCount > 0;
}
