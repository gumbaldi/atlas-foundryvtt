import { authManager } from '../auth/auth-manager';
import { request } from '../api/client';
import { documentCache, LIST_CACHE_PREFIX } from '../api/cache';
import { AtlasAuthError, AtlasNotFoundError } from '../api/errors';
import type { AtlasDiaryInvitation } from '../atlas-types';

// Same 30s list TTL as the quests and deadlines.
const DIARY_TTL_MS = 30_000;

function invitationPath(campaignId: string): string {
  return `/foundry/campaigns/${campaignId}/diary/invitation`;
}

/**
 * The latest session log and whether the caller already wrote a diary entry for it. Resolves to
 * `null` while the backend has no such route yet (404), which callers treat as "no invitation".
 */
export async function fetchDiaryInvitation(options: { signal?: AbortSignal } = {}): Promise<AtlasDiaryInvitation | null> {
  const campaignId = authManager.getLinkedCampaignId();
  if (!campaignId) throw new AtlasAuthError('/foundry/campaigns/*/diary/invitation', 'Not logged in');

  const path = invitationPath(campaignId);
  try {
    return await documentCache.getOrFetch(`${LIST_CACHE_PREFIX}${path}`, DIARY_TTL_MS, () =>
      request<AtlasDiaryInvitation>(path, { signal: options.signal }),
    );
  } catch (error) {
    if (error instanceof AtlasNotFoundError) return null;
    throw error;
  }
}

/** Bypasses the cache entirely. */
export async function refreshDiaryInvitation(): Promise<AtlasDiaryInvitation | null> {
  const campaignId = authManager.getLinkedCampaignId();
  if (!campaignId) throw new AtlasAuthError('/foundry/campaigns/*/diary/invitation', 'Not logged in');

  documentCache.delete(`${LIST_CACHE_PREFIX}${invitationPath(campaignId)}`);
  return fetchDiaryInvitation();
}
