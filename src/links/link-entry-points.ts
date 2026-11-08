import { openLinkManager } from './link-manager-app';
import { openLinksPopover } from './link-popover';
import { getLinks } from './link-store';

interface ApplicationV2HeaderControl {
  icon: string;
  label: string;
  action: string;
  onClick?: (event: Event) => void;
}

interface DocumentSheetApp {
  document?: FoundryDocumentLike;
}

interface ContextMenuEntry {
  name: string;
  icon: string;
  condition?: (target: HTMLElement) => boolean;
  callback: (target: HTMLElement) => void;
}

/**
 * GM: opens the full link manager (add/edit/remove). Everyone else: opens a
 * read-only popover of whichever links their own visibility-check confirms
 * — the button itself only renders when the object has *any* stored links
 * (that much — id/label existence, not content — is already visible to
 * anyone who can see the Foundry object; see plan's privacy rule), so
 * showing it doesn't leak anything the check wouldn't already gate.
 */
function registerSheetHeaderButtons(): void {
  Hooks.on('getHeaderControlsApplicationV2', (app: DocumentSheetApp, controls: ApplicationV2HeaderControl[]) => {
    const doc = app.document;
    if (!doc || typeof doc.getFlag !== 'function') return;

    if (game.user.isGM) {
      controls.push({
        icon: 'fa-solid fa-link',
        label: 'ATLASFOUNDRY.Links.HeaderButton',
        action: 'atlasLinks',
        onClick: () => openLinkManager({ doc, name: doc.name ?? '' }),
      });
      return;
    }

    const links = getLinks(doc);
    if (links.length === 0) return;
    controls.push({
      icon: 'fa-solid fa-link',
      label: 'ATLASFOUNDRY.Links.HeaderButton',
      action: 'atlasLinks',
      onClick: (event: Event) => {
        const anchor = (event.currentTarget ?? event.target) as HTMLElement;
        void openLinksPopover(links, anchor);
      },
    });
  });
}

/** GM-only "Atlas links…" entry in the scene navigation bar's right-click context menu. */
function registerSceneNavigationContextMenu(): void {
  Hooks.on('getSceneNavigationContext', (_html: HTMLElement, entries: ContextMenuEntry[]) => {
    if (!game.user.isGM) return;
    entries.push({
      name: 'ATLASFOUNDRY.Links.ManagerTitle',
      icon: '<i class="fa-solid fa-link"></i>',
      callback: (target: HTMLElement) => {
        const sceneId = target.dataset.sceneId;
        const scene = sceneId ? game.scenes.get(sceneId) : undefined;
        if (!scene) return;
        openLinkManager({ doc: scene, name: scene.name ?? '' });
      },
    });
  });
}

/** GM-only scene-controls tool (next to Atlas Search, see controls.ts) for the currently viewed scene's links. */
function registerActiveSceneControlTool(): void {
  Hooks.on('getSceneControlButtons', (controls: Record<string, any>) => {
    if (!game.user.isGM) return;
    const tokens = controls.tokens;
    if (!tokens?.tools) return;

    tokens.tools.atlasSceneLinks = {
      name: 'atlasSceneLinks',
      title: 'ATLASFOUNDRY.Links.SceneControlTool',
      icon: 'fa-solid fa-link',
      button: true,
      order: 101,
      onChange: () => {
        const scene = canvas?.scene;
        if (!scene) return;
        openLinkManager({ doc: scene, name: scene.name ?? '' });
      },
    };
  });
}

export function registerLinkEntryPoints(): void {
  registerSheetHeaderButtons();
  registerSceneNavigationContextMenu();
  registerActiveSceneControlTool();
}
