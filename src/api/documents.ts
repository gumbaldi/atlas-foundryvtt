import { authManager } from '../auth/auth-manager';
import { request } from './client';
import { documentCache, DOC_CACHE_PREFIX, LIST_CACHE_PREFIX } from './cache';
import { AtlasAuthError, AtlasForbiddenError, AtlasNotFoundError } from './errors';
import type { AtlasDocumentDetail, AtlasDocumentSummary } from '../atlas-types';
import type { ModuleType } from '../constants';

const LIST_TTL_MS = 30_000;
const DOC_TTL_MS = 60_000;

export interface ListDocumentsParams {
  q?: string;
  moduleType?: ModuleType;
  limit?: number;
}

interface FetchOptions {
  signal?: AbortSignal;
}

/**
 * The addon only ever talks to the P2 per-user routes, scoped to the
 * campaign the caller's own session token is bound to — never the public
 * routes, and never a campaignId supplied by the caller (see plan P4 step 3).
 */
function getLinkedCampaignIdOrThrow(path: string): string {
  const campaignId = authManager.getLinkedCampaignId();
  if (!campaignId) throw new AtlasAuthError(path, 'Not logged in');
  return campaignId;
}

function buildListPath(campaignId: string, params: ListDocumentsParams): string {
  const query = new URLSearchParams();
  if (params.q?.trim()) query.set('q', params.q.trim());
  if (params.moduleType) query.set('moduleType', params.moduleType);
  if (params.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return `/foundry/campaigns/${campaignId}/user-documents${qs ? `?${qs}` : ''}`;
}

export async function listDocuments(params: ListDocumentsParams = {}, options: FetchOptions = {}): Promise<AtlasDocumentSummary[]> {
  const campaignId = getLinkedCampaignIdOrThrow('/foundry/campaigns/*/user-documents');
  const path = buildListPath(campaignId, params);
  return documentCache.getOrFetch(`${LIST_CACHE_PREFIX}${path}`, LIST_TTL_MS, () =>
    request<AtlasDocumentSummary[]>(path, { signal: options.signal }),
  );
}

export async function getDocument(
  moduleType: ModuleType | 'custom',
  documentId: string,
  options: FetchOptions = {},
): Promise<AtlasDocumentDetail> {
  const campaignId = getLinkedCampaignIdOrThrow(`/foundry/campaigns/*/user-documents/${moduleType}/${documentId}`);
  const path = `/foundry/campaigns/${campaignId}/user-documents/${moduleType}/${documentId}`;
  const cacheKey = `${DOC_CACHE_PREFIX}${documentId}`;

  try {
    return await documentCache.getOrFetch(cacheKey, DOC_TTL_MS, () => request<AtlasDocumentDetail>(path, { signal: options.signal }));
  } catch (err) {
    // Belt-and-suspenders: getOrFetch never caches a rejected fetch, but a
    // permission revoked mid-TTL must not leave a stale hit for the next
    // caller either — see plan's "403/404 drops it from the cache at once".
    if (err instanceof AtlasForbiddenError || err instanceof AtlasNotFoundError) {
      documentCache.delete(cacheKey);
    }
    throw err;
  }
}

/** Bypasses the cache entirely — backs the viewer's "Refresh" action. */
export async function refreshDocument(moduleType: ModuleType | 'custom', documentId: string): Promise<AtlasDocumentDetail> {
  documentCache.delete(`${DOC_CACHE_PREFIX}${documentId}`);
  return getDocument(moduleType, documentId);
}
