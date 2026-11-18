import { getRecentSearchList, setRecentSearchList } from '../settings';

export const MAX_RECENT_SEARCHES = 8;
const MIN_RECENT_LENGTH = 2;

/** Pure: puts `query` first, drops a case-insensitive duplicate, caps the list. Short or blank queries are ignored. */
export function addRecent(list: readonly string[], query: string, max = MAX_RECENT_SEARCHES): string[] {
  const trimmed = query.trim();
  if (trimmed.length < MIN_RECENT_LENGTH) return [...list];
  const lower = trimmed.toLowerCase();
  return [trimmed, ...list.filter((entry) => entry.toLowerCase() !== lower)].slice(0, max);
}

export function clearRecent(): string[] {
  return [];
}

export function getRecentSearches(): string[] {
  return getRecentSearchList();
}

export async function saveRecentSearch(query: string): Promise<void> {
  const current = getRecentSearchList();
  const next = addRecent(current, query);
  if (next.length === current.length && next.every((entry, index) => entry === current[index])) return;
  await setRecentSearchList(next);
}

export async function clearRecentSearches(): Promise<void> {
  await setRecentSearchList(clearRecent());
}
