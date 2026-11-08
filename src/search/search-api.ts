import { authManager } from '../auth/auth-manager';
import { request } from '../api/client';
import { documentCache, LIST_CACHE_PREFIX } from '../api/cache';
import { AtlasAuthError } from '../api/errors';
import type { AtlasSearchResponse } from '../atlas-types';
import type { ModuleType } from '../constants';

// Same TTL/cache as P4's document lists — the plan explicitly asks for no
// caching scheme beyond that (30s per exact query key).
const SEARCH_TTL_MS = 30_000;

export interface SearchDocumentsParams {
  q: string;
  types?: ModuleType[];
  nameOnly?: boolean;
  limit?: number;
}

function buildSearchPath(campaignId: string, params: SearchDocumentsParams): string {
  const query = new URLSearchParams();
  query.set('q', params.q);
  if (params.types?.length) query.set('types', params.types.join(','));
  if (params.nameOnly) query.set('nameOnly', 'true');
  if (params.limit) query.set('limit', String(params.limit));
  return `/foundry/campaigns/${campaignId}/search?${query.toString()}`;
}

export async function searchDocuments(
  params: SearchDocumentsParams,
  options: { signal?: AbortSignal } = {},
): Promise<AtlasSearchResponse> {
  const campaignId = authManager.getLinkedCampaignId();
  if (!campaignId) throw new AtlasAuthError('/foundry/campaigns/*/search', 'Not logged in');

  const path = buildSearchPath(campaignId, params);
  return documentCache.getOrFetch(`${LIST_CACHE_PREFIX}${path}`, SEARCH_TTL_MS, () =>
    request<AtlasSearchResponse>(path, { signal: options.signal }),
  );
}
