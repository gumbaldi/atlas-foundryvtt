import type { LinkRef } from './link-visibility';

/** Maximum number of chips rendered in the scene link bar; the rest goes into the `+N` popover. */
export const MAX_CHIPS = 10;
/** Maximum number of concurrent `getDocument` calls while resolving thumbnails. */
export const MAX_IN_FLIGHT = 4;

interface ImageFields {
  heroImageUrl?: string;
  imageUrl?: string;
}

export interface ThumbnailDeps {
  getDocument(moduleType: string, documentId: string): Promise<ImageFields>;
}

/**
 * Resolves the title image of each linked document (`heroImageUrl || imageUrl`)
 * with at most `MAX_IN_FLIGHT` requests running at once. A document without an
 * image or a failing request yields `null` for that ref only. The raw URLs are
 * untrusted — callers pass them through `safeImageUrl` before use.
 */
export async function resolveLinkThumbnails(refs: LinkRef[], deps: ThumbnailDeps): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  let next = 0;

  async function worker(): Promise<void> {
    while (next < refs.length) {
      const entry = refs[next++];
      if (!entry) continue;
      try {
        const doc = await deps.getDocument(entry.moduleType, entry.documentId);
        result.set(entry.documentId, doc.heroImageUrl || doc.imageUrl || null);
      } catch {
        result.set(entry.documentId, null);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(MAX_IN_FLIGHT, refs.length) }, () => worker()));
  return result;
}

/** Splits the visible chips into the rendered ones and the `+N` overflow. */
export function partitionChips<T>(items: T[], max: number = MAX_CHIPS): { shown: T[]; overflow: T[] } {
  return { shown: items.slice(0, max), overflow: items.slice(max) };
}
