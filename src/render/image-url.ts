/**
 * Image URLs come from the backend and are untrusted: only `http(s)` passes.
 * Relative URLs are resolved against the configured Atlas base URL. Returns an
 * empty string for anything else (including unparsable input).
 */
export function safeImageUrl(raw: string | undefined, baseUrl: string): string {
  if (!raw) return '';
  try {
    const url = new URL(raw, baseUrl || undefined);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch {
    return '';
  }
}
