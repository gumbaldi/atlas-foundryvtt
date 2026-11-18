import { authManager } from '../auth/auth-manager';
import { getDocument } from '../api/documents';
import { atlasDocumentUrl } from '../deep-links';
import { t } from '../i18n';
import type { ModuleType } from '../constants';
import type { AtlasMessage } from '../atlas-types';

/** Where a document lives in Atlas. `customModuleId` is only needed for `custom` and is resolved through the API when absent. */
export interface AtlasDocumentRef {
  moduleType: ModuleType | 'custom' | string;
  documentId: string;
  customModuleId?: string;
}

export interface AtlasUrlDeps {
  campaignId: string | null;
  getDocument: (moduleType: ModuleType | 'custom', documentId: string) => Promise<{ customModuleId?: string }>;
  atlasDocumentUrl: (campaignId: string, moduleType: ModuleType | 'custom', documentId: string, customModuleId?: string) => string;
}

/**
 * The URL when it can be built without a network call: a string, `null`
 * (no linked campaign) or `undefined` (a `custom` document whose module id
 * still has to be fetched).
 */
function directAtlasUrl(ref: AtlasDocumentRef, deps: AtlasUrlDeps): string | null | undefined {
  if (!deps.campaignId) return null;
  if (ref.moduleType !== 'custom') return deps.atlasDocumentUrl(deps.campaignId, ref.moduleType as ModuleType, ref.documentId);
  if (ref.customModuleId) return deps.atlasDocumentUrl(deps.campaignId, 'custom', ref.documentId, ref.customModuleId);
  return undefined;
}

/**
 * Pure: resolves the Atlas URL of a document. `null` when the world is not
 * linked or a custom document's module id cannot be determined; rejects when
 * the `getDocument` lookup fails (the caller shows the warning).
 */
export async function resolveAtlasUrl(ref: AtlasDocumentRef, deps: AtlasUrlDeps): Promise<string | null> {
  const direct = directAtlasUrl(ref, deps);
  if (direct !== undefined) return direct;

  const detail = await deps.getDocument('custom', ref.documentId);
  if (!detail.customModuleId || !deps.campaignId) return null;
  return deps.atlasDocumentUrl(deps.campaignId, 'custom', ref.documentId, detail.customModuleId);
}

export type NotificationAtlasTarget = { kind: 'document'; ref: AtlasDocumentRef } | { kind: 'dashboard' };

/** Pure: a notification with a document reference opens that document, any other one the campaign dashboard. */
export function notificationAtlasTarget(item: Pick<AtlasMessage, 'documentId' | 'documentModuleType' | 'customModuleId'>): NotificationAtlasTarget {
  if (item.documentId && item.documentModuleType) {
    return { kind: 'document', ref: { moduleType: item.documentModuleType, documentId: item.documentId, customModuleId: item.customModuleId } };
  }
  return { kind: 'dashboard' };
}

/**
 * Opens a document in Atlas in a new browser tab. Fixed module types open
 * synchronously inside the click handler (popup blockers allow that). For a
 * custom document the module id needs an async lookup, so a blank tab is
 * opened first and pointed at the URL once known; it is closed on failure.
 */
export async function openInAtlas(ref: AtlasDocumentRef): Promise<void> {
  const deps: AtlasUrlDeps = {
    campaignId: authManager.getLinkedCampaignId(),
    getDocument: (moduleType, documentId) => getDocument(moduleType, documentId),
    atlasDocumentUrl: (campaignId, moduleType, documentId, customModuleId) =>
      moduleType === 'custom' ? atlasDocumentUrl(campaignId, 'custom', documentId, customModuleId ?? '') : atlasDocumentUrl(campaignId, moduleType, documentId),
  };

  if (!deps.campaignId) {
    ui.notifications.warn(t('ATLASFOUNDRY.NotConnected.Message'));
    return;
  }

  const direct = directAtlasUrl(ref, deps);
  if (direct) {
    window.open(direct, '_blank');
    return;
  }

  const tab = window.open('', '_blank');
  try {
    const url = await resolveAtlasUrl(ref, deps);
    if (!url) throw new Error('Atlas URL could not be resolved');
    if (tab) tab.location.href = url;
    else window.open(url, '_blank');
  } catch {
    tab?.close();
    ui.notifications.warn(t('ATLASFOUNDRY.Links.OpenUnavailable'));
  }
}
