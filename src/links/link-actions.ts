import { openInAtlas } from './open-in-atlas';
import type { AtlasLink } from './link-store';

/**
 * Shared open-behavior for every link surface (popover, scene bar, link
 * manager): the document opens directly in Atlas in a new browser
 * tab. Custom-module links resolve their `customModuleId` through the API
 * (the link flag does not carry it); see `openInAtlas`.
 */
export function openLink(link: Pick<AtlasLink, 'documentId' | 'moduleType'>): void {
  void openInAtlas({ moduleType: link.moduleType, documentId: link.documentId });
}
