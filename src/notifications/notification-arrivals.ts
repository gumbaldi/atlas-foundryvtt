import type { AtlasMessage } from '../atlas-types';

/**
 * Pure arrival detection: which messages in `items` are new since the last
 * sync. Unread, non-sender-copy, non-trashed messages whose id is not in
 * `seen` are arrivals (oldest first). The returned `seen` always contains
 * every id from the input set and from `items`.
 */
export function detectArrivals(
  items: AtlasMessage[],
  seen: Set<string>,
): { arrivals: AtlasMessage[]; seen: Set<string> } {
  const nextSeen = new Set(seen);
  const arrivals: AtlasMessage[] = [];
  for (const message of items) {
    if (!seen.has(message.id) && !message.isRead && !message.isSenderCopy && !message.trashedAt) {
      arrivals.push(message);
    }
    nextSeen.add(message.id);
  }
  arrivals.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return { arrivals, seen: nextSeen };
}
