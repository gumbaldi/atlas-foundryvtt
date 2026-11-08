import { authManager } from '../auth/auth-manager';
import { atlasDocumentUrl } from '../deep-links';
import { openDocumentViewer } from '../apps/viewer-app';
import type { AtlasLink } from './link-store';
import type { ModuleType } from '../constants';

export interface OpenLinkOptions {
  /** Shift/Ctrl/Meta-click — open an Atlas tab instead of the in-Foundry viewer, where possible. */
  external?: boolean;
  /** The live name from a visibility-check, preferred over the link's `nameSnapshot`. */
  currentName?: string;
}

/**
 * Shared open-behavior for every link surface (popover, scene bar, token
 * HUD). Custom-module links never open externally directly — like mentions
 * (viewer-app.ts's `handleMentionActivate`), the flag data doesn't carry
 * `customModuleId`, so only the viewer (which resolves it via the API) can
 * offer a working "Open in Atlas" button for those.
 */
export function openLink(link: Pick<AtlasLink, 'documentId' | 'moduleType' | 'label' | 'nameSnapshot'>, options: OpenLinkOptions = {}): void {
  const displayName = options.currentName ?? link.label ?? link.nameSnapshot;

  if (options.external && link.moduleType !== 'custom') {
    const campaignId = authManager.getLinkedCampaignId();
    if (campaignId) {
      window.open(atlasDocumentUrl(campaignId, link.moduleType as ModuleType, link.documentId), '_blank');
      return;
    }
  }

  openDocumentViewer({ moduleType: link.moduleType as ModuleType | 'custom', documentId: link.documentId, name: displayName });
}
