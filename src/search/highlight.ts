const MIN_WORD_LENGTH = 2;
const MAX_WORDS = 5;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Returns HTML-escaped `text` with `<mark>` around case-insensitive matches of each
 * query word. The input is never trusted as HTML: it is escaped first, then marked
 * piecewise so entities the escaping produced are never split.
 */
export function highlightTerms(text: string, query: string): string {
  const words = [
    ...new Set(
      query
        .split(/\s+/)
        .filter((w) => w.length >= MIN_WORD_LENGTH)
        .slice(0, MAX_WORDS),
    ),
  ];
  if (words.length === 0) return escapeHtml(text);

  // Match on the raw text and escape each segment, so a query like "amp" can never
  // match inside an entity created by escaping.
  const pattern = new RegExp(words.map((w) => escapeRegExp(w)).join('|'), 'gi');
  let out = '';
  let last = 0;
  for (const m of text.matchAll(pattern)) {
    if (m[0].length === 0) continue;
    const start = m.index ?? 0;
    out += escapeHtml(text.slice(last, start)) + '<mark>' + escapeHtml(m[0]) + '</mark>';
    last = start + m[0].length;
  }
  return out + escapeHtml(text.slice(last));
}
