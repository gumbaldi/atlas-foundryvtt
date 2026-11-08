import { TtlCache } from '../api/cache';
import { request } from '../api/client';
import { authManager } from '../auth/auth-manager';
import { AtlasAuthError } from '../api/errors';
import type { AtlasLink } from './link-store';

export interface LinkRef {
  documentId: string;
  moduleType: string;
}

interface VisibilityCheckResponse {
  visible: Array<{ documentId: string; moduleType: string; name: string }>;
}

/** What a batch of `check()` calls resolved to — absence from `visible` means "server didn't confirm", not necessarily "deleted" (see plan's no-existence-oracle rule). */
export interface VisibilityCheckResult {
  isVisible(ref: LinkRef): boolean;
  nameFor(ref: LinkRef): string | undefined;
  /** True if the visibility check itself couldn't be completed (network/auth) — callers must not treat this the same as "not visible". */
  failed: boolean;
}

const CACHE_TTL_MS = 60_000;
const DEBOUNCE_MS = 250;
const MAX_REFS_PER_REQUEST = 100;

function refKey(ref: LinkRef): string {
  return `${ref.moduleType}:${ref.documentId}`;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/**
 * Batches every ref passed to `check()` within a 250ms window into as few
 * `/foundry/campaigns/:id/documents/visibility-check` requests as possible
 * (plan step: debounce + batch), and caches each ref's per-user outcome for
 * 60s via a dedicated TtlCache (plan: "P4-TtlCache, Key pro documentId").
 *
 * `null` is a valid, cacheable outcome ("server checked, not visible") —
 * only a thrown/rejected fetch (network, 401 after retry) is left uncached
 * by TtlCache and surfaces as `failed` on the result, so a transient outage
 * doesn't get remembered as "link is broken" for a full minute.
 */
export class LinkVisibilityChecker {
  private readonly cache = new TtlCache();
  private readonly queued = new Map<string, LinkRef>();
  private readonly resolvers = new Map<string, { resolve: (name: string | null) => void; reject: (err: unknown) => void }>();
  private timer: ReturnType<typeof setTimeout> | null = null;

  async check(refs: LinkRef[]): Promise<VisibilityCheckResult> {
    const names = new Map<string, string>();
    let failed = false;

    await Promise.all(
      refs.map(async (ref) => {
        const key = refKey(ref);
        try {
          const name = await this.cache.getOrFetch(key, CACHE_TTL_MS, () => this.enqueue(ref));
          if (name !== null) names.set(key, name);
        } catch {
          failed = true;
        }
      }),
    );

    return {
      isVisible: (ref) => names.has(refKey(ref)),
      nameFor: (ref) => names.get(refKey(ref)),
      failed,
    };
  }

  /** Convenience for a single link — same batching/caching, just one ref. */
  async isVisible(ref: LinkRef): Promise<{ visible: boolean; name?: string; failed: boolean }> {
    const result = await this.check([ref]);
    return { visible: result.isVisible(ref), name: result.nameFor(ref), failed: result.failed };
  }

  private enqueue(ref: LinkRef): Promise<string | null> {
    const key = refKey(ref);
    return new Promise((resolve, reject) => {
      this.queued.set(key, ref);
      this.resolvers.set(key, { resolve, reject });
      if (this.timer === null) {
        this.timer = setTimeout(() => {
          this.timer = null;
          void this.flush();
        }, DEBOUNCE_MS);
      }
    });
  }

  private async flush(): Promise<void> {
    const refs = [...this.queued.values()];
    const resolvers = new Map(this.resolvers);
    this.queued.clear();
    this.resolvers.clear();
    if (refs.length === 0) return;

    try {
      const campaignId = authManager.getLinkedCampaignId();
      if (!campaignId) throw new AtlasAuthError('/foundry/campaigns/*/documents/visibility-check', 'Not logged in');

      const visibleByKey = new Map<string, string>();
      for (const batch of chunk(refs, MAX_REFS_PER_REQUEST)) {
        const response = await request<VisibilityCheckResponse>(`/foundry/campaigns/${campaignId}/documents/visibility-check`, {
          method: 'POST',
          body: { refs: batch.map((ref) => ({ documentId: ref.documentId, moduleType: ref.moduleType })) },
        });
        for (const item of response.visible) {
          visibleByKey.set(`${item.moduleType}:${item.documentId}`, item.name);
        }
      }
      for (const [key, resolver] of resolvers) {
        resolver.resolve(visibleByKey.has(key) ? visibleByKey.get(key)! : null);
      }
    } catch (err) {
      for (const resolver of resolvers.values()) resolver.reject(err);
    }
  }
}

export const linkVisibility = new LinkVisibilityChecker();

/** Convenience: refs straight from `getLinks(doc)`, for call sites that already have `AtlasLink[]` on hand. */
export function toRefs(links: AtlasLink[]): LinkRef[] {
  return links.map((link) => ({ documentId: link.documentId, moduleType: link.moduleType }));
}
