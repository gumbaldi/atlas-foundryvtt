import { t } from '../i18n';
import { openLinkManager } from './link-manager-app';
import { openLinksPopover } from './link-popover';
import { openLink } from './link-actions';
import { getLinks, type AtlasLink } from './link-store';
import { linkVisibility, toRefs } from './link-visibility';

interface TokenHudApp {
  object?: TokenPlaceable;
}

/**
 * Union of token-level and actor-level links (plan: "HUD shows the
 * union of token.flags + actor.flags") — a token inherits its
 * actor's links in addition to any scene-specific ones set directly on the
 * TokenDocument. IDs are independently `randomID()`'d per document, so a
 * plain concat is already the union, no de-dupe needed.
 */
function collectLinks(placeable: TokenPlaceable): AtlasLink[] {
  const tokenLinks = getLinks(placeable.document);
  const actorLinks = placeable.actor ? getLinks(placeable.actor) : [];
  return [...tokenLinks, ...actorLinks];
}

function buildHudButton(icon: string, title: string, onClick: (event: MouseEvent) => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'control-icon atlas-foundry-token-hud-button';
  button.title = title;
  button.innerHTML = `<i class="${icon}"></i>`;
  button.addEventListener('click', onClick);
  return button;
}

export function registerTokenHud(): void {
  Hooks.on('renderTokenHUD', (app: TokenHudApp, html: HTMLElement | { 0?: HTMLElement }) => {
    const placeable = app.object;
    if (!placeable) return;
    // v13 passed jQuery, v14 passes a plain HTMLElement (same accommodation as main.ts's renderSettings handler).
    const root = html instanceof HTMLElement ? html : html?.[0];
    if (!root) return;

    const links = collectLinks(placeable);
    const isGm = game.user.isGM;
    if (links.length === 0 && !isGm) return;

    const column = root.querySelector<HTMLElement>('.col.right') ?? root;

    if (links.length > 0) {
      column.appendChild(
        buildHudButton('fa-solid fa-map', t('ATLASFOUNDRY.Links.ViewButton'), (event) => {
          void (async () => {
            const result = await linkVisibility.check(toRefs(links));
            const visible = links.filter((link) => result.isVisible(link));
            if (visible.length === 0) return;
            if (visible.length === 1) {
              const only = visible[0]!;
              openLink(only, { external: event.shiftKey || event.ctrlKey || event.metaKey, currentName: result.nameFor(only) });
              return;
            }
            void openLinksPopover(visible, event.currentTarget as HTMLElement);
          })();
        }),
      );
    }

    if (isGm) {
      column.appendChild(
        buildHudButton('fa-solid fa-link', t('ATLASFOUNDRY.Links.EditButton'), () => {
          openLinkManager({ doc: placeable.document, name: placeable.document.name ?? '' });
        }),
      );
    }
  });
}
