import { authManager } from '../auth/auth-manager';
import { request } from '../api/client';
import { documentCache, LIST_CACHE_PREFIX } from '../api/cache';
import { AtlasAuthError } from '../api/errors';
import type { AtlasQuestsResponse, AtlasQuestStatus } from '../atlas-types';

// Same 30s list TTL as P4/P6 (listDocuments/searchDocuments) — the plan
// explicitly falls back to this cache instead of polling until P8 supplies
// real invalidation events.
const QUESTS_TTL_MS = 30_000;

export interface FetchQuestsParams {
  status?: AtlasQuestStatus | 'all';
  limit?: number;
}

function buildQuestsPath(campaignId: string, params: FetchQuestsParams): string {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return `/foundry/campaigns/${campaignId}/quests${qs ? `?${qs}` : ''}`;
}

export async function fetchQuests(params: FetchQuestsParams = {}, options: { signal?: AbortSignal } = {}): Promise<AtlasQuestsResponse> {
  const campaignId = authManager.getLinkedCampaignId();
  if (!campaignId) throw new AtlasAuthError('/foundry/campaigns/*/quests', 'Not logged in');

  const path = buildQuestsPath(campaignId, params);
  return documentCache.getOrFetch(`${LIST_CACHE_PREFIX}${path}`, QUESTS_TTL_MS, () => request<AtlasQuestsResponse>(path, { signal: options.signal }));
}

/** Bypasses the cache entirely — backs the panel's "Refresh" action. */
export async function refreshQuests(params: FetchQuestsParams = {}): Promise<AtlasQuestsResponse> {
  const campaignId = authManager.getLinkedCampaignId();
  if (!campaignId) throw new AtlasAuthError('/foundry/campaigns/*/quests', 'Not logged in');

  const path = buildQuestsPath(campaignId, params);
  documentCache.delete(`${LIST_CACHE_PREFIX}${path}`);
  return fetchQuests(params);
}
