import type { AtlasSearchResult } from '../atlas-types';
import { formatDocumentTitle } from '../render/document-title';

/**
 * `relevance` keeps the order the backend sends (title hits first, then text hits).
 * `alphabetical` keeps that split and sorts each group by its displayed title, so
 * title hits still come first and text hits follow, each group A–Z.
 */
export type SearchSort = 'relevance' | 'alphabetical';

/** Numeric-aware, so session logs read "#71, #86, #103, #163" and not "#103, #163, #71". */
const collator = new Intl.Collator('de', { numeric: true, sensitivity: 'base' });

function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/** The title as the list shows it ("#86 - Title" for session logs). */
export function displayTitle(result: AtlasSearchResult): string {
  return formatDocumentTitle(result.moduleType, result.name, result.sessionNumber);
}

/** A title hit: every word of the query occurs in the title (case and accents ignored). */
export function isTitleHit(title: string, query: string): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;
  const folded = fold(title);
  return words.every((word) => folded.includes(word));
}

/** Pure: returns `results` unchanged for relevance, otherwise a new array with title hits before text hits, each A–Z. */
export function orderSearchResults(results: AtlasSearchResult[], query: string, sort: SearchSort): AtlasSearchResult[] {
  if (sort === 'relevance') return results;

  return results
    .map((result) => {
      const title = displayTitle(result);
      return { result, title, group: isTitleHit(title, query) ? 0 : 1 };
    })
    .sort((a, b) => a.group - b.group || collator.compare(a.title, b.title))
    .map((entry) => entry.result);
}
