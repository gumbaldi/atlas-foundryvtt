import { authManager } from '../auth/auth-manager';
import { request } from '../api/client';
import { AtlasAuthError } from '../api/errors';
import type { AtlasMessage, AtlasUnreadCount } from '../atlas-types';

/**
 * Deliberately hits the SAME route the web frontend uses
 * (`/campaigns/:campaignId/messages`, not a `/foundry/...` mirror) — the P8
 * plan's whole point is that Foundry tokens now carry the `notify:user`
 * scope for this existing controller (`FoundryScopesGuard`), so Foundry and
 * web read from one identical source of truth.
 */
export interface ListMessagesParams {
  folder?: string;
  unread?: boolean;
  limit?: number;
  cursor?: string;
}

function messagesPath(suffix: string): string {
  const campaignId = authManager.getLinkedCampaignId();
  if (!campaignId) throw new AtlasAuthError(`/campaigns/*/messages${suffix}`, 'Not logged in');
  return `/campaigns/${campaignId}/messages${suffix}`;
}

export async function listMessages(params: ListMessagesParams = {}, options: { signal?: AbortSignal } = {}): Promise<AtlasMessage[]> {
  const query = new URLSearchParams();
  if (params.folder) query.set('folder', params.folder);
  if (params.unread) query.set('unread', 'true');
  if (params.limit) query.set('limit', String(params.limit));
  if (params.cursor) query.set('cursor', params.cursor);
  const qs = query.toString();
  return request<AtlasMessage[]>(messagesPath(qs ? `?${qs}` : ''), { signal: options.signal });
}

export async function fetchUnreadCount(options: { signal?: AbortSignal } = {}): Promise<number> {
  const result = await request<AtlasUnreadCount>(messagesPath('/unread-count'), { signal: options.signal });
  return result.count;
}

export async function markMessageRead(messageId: string): Promise<AtlasMessage> {
  return request<AtlasMessage>(messagesPath(`/${messageId}/read`), { method: 'PATCH' });
}

export async function dismissMessage(messageId: string): Promise<AtlasMessage> {
  return request<AtlasMessage>(messagesPath(`/${messageId}/dismiss`), { method: 'PATCH' });
}
