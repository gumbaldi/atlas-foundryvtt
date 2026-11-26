import { authManager } from '../auth/auth-manager';
import { request } from '../api/client';
import { documentCache, LIST_CACHE_PREFIX } from '../api/cache';
import { AtlasAuthError, AtlasNotFoundError } from '../api/errors';
import type { AtlasDeadlineOverview } from '../atlas-types';
import { refsToQuery, type DeadlineRef } from './deadline-refs';

// Same 30s list TTL as the quests (see quests-api.ts).
const DEADLINES_TTL_MS = 30_000;

function buildOverviewPath(campaignId: string, refs: DeadlineRef[]): string {
  const base = `/foundry/campaigns/${campaignId}/deadlines/overview`;
  return refs.length > 0 ? `${base}?refs=${encodeURIComponent(refsToQuery(refs))}` : base;
}

/**
 * The running deadlines of the caller's characters plus the given documents. Resolves to `null`
 * while the backend has no such route yet (404), which callers treat as "nothing to show".
 */
export async function fetchDeadlineOverview(
  refs: DeadlineRef[] = [],
  options: { signal?: AbortSignal } = {},
): Promise<AtlasDeadlineOverview | null> {
  const campaignId = authManager.getLinkedCampaignId();
  if (!campaignId) throw new AtlasAuthError('/foundry/campaigns/*/deadlines/overview', 'Not logged in');

  const path = buildOverviewPath(campaignId, refs);
  try {
    return await documentCache.getOrFetch(`${LIST_CACHE_PREFIX}${path}`, DEADLINES_TTL_MS, () =>
      request<AtlasDeadlineOverview>(path, { signal: options.signal }),
    );
  } catch (error) {
    if (error instanceof AtlasNotFoundError) return null;
    throw error;
  }
}

/** Bypasses the cache entirely. */
export async function refreshDeadlineOverview(refs: DeadlineRef[] = []): Promise<AtlasDeadlineOverview | null> {
  const campaignId = authManager.getLinkedCampaignId();
  if (!campaignId) throw new AtlasAuthError('/foundry/campaigns/*/deadlines/overview', 'Not logged in');

  documentCache.delete(`${LIST_CACHE_PREFIX}${buildOverviewPath(campaignId, refs)}`);
  return fetchDeadlineOverview(refs);
}
