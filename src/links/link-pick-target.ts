import { t } from '../i18n';
import { addLink, type FlagCapableDocument } from './link-store';
import type { AtlasSearchResult } from '../atlas-types';

interface LinkTargetOption {
  label: string;
  doc: FlagCapableDocument;
}

function isFlagCapable(doc: unknown): doc is FlagCapableDocument {
  return !!doc && typeof (doc as FlagCapableDocument).getFlag === 'function' && typeof (doc as FlagCapableDocument).setFlag === 'function';
}

/** Active scene, every selected token (scene-specific link target), and any currently open document sheet — the three target kinds the plan calls for. */
function collectTargetOptions(): LinkTargetOption[] {
  const options: LinkTargetOption[] = [];
  const seen = new Set<unknown>();

  const addOption = (label: string, doc: unknown) => {
    if (!isFlagCapable(doc) || seen.has(doc)) return;
    seen.add(doc);
    options.push({ label, doc });
  };

  const scene = canvas?.scene;
  if (scene) addOption(t('ATLASFOUNDRY.Links.PickTargetScene', { name: scene.name ?? '' }), scene);

  for (const token of canvas?.tokens?.controlled ?? []) {
    addOption(t('ATLASFOUNDRY.Links.PickTargetToken', { name: token.document.name ?? '' }), token.document);
  }

  for (const win of Object.values(ui.windows ?? {})) {
    const doc = (win as { document?: unknown } | null)?.document;
    if (doc) addOption(t('ATLASFOUNDRY.Links.PickTargetSheet', { name: (doc as FoundryDocumentLike).name ?? '' }), doc);
  }

  return options;
}

/**
 * P5 plan step 9: "Verknüpfen…" in search results resolves a target (active
 * scene / selected token(s) / any open document sheet), an optional label,
 * and writes the link. GM-only (link management, see the plan's
 * Auth-/Berechtigungsanforderungen) — search-app.ts already hides the
 * button for non-GMs, this is the defensive backstop.
 */
export async function pickLinkTarget(result: AtlasSearchResult): Promise<void> {
  if (!game.user.isGM) return;

  const options = collectTargetOptions();
  if (options.length === 0) {
    ui.notifications.warn(t('ATLASFOUNDRY.Links.NoTargets'));
    return;
  }

  const content = `
    <div class="atlas-foundry atlas-foundry-link-target-picker">
      <div class="form-group">
        ${options
          .map(
            (option, index) => `
          <label class="atlas-foundry-row">
            <input type="radio" name="targetIndex" value="${index}" ${index === 0 ? 'checked' : ''}>
            ${foundry.utils.escapeHTML(option.label)}
          </label>`,
          )
          .join('')}
      </div>
      <div class="form-group">
        <label>${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Links.LabelPlaceholder'))}</label>
        <input type="text" name="label" placeholder="${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Links.LabelPlaceholder'))}">
      </div>
    </div>
  `;

  await foundry.applications.api.DialogV2.prompt({
    window: { title: 'ATLASFOUNDRY.Links.PickTitle' },
    content,
    ok: {
      label: 'ATLASFOUNDRY.Links.AddButton',
      callback: async (_event, _button, dialog) => {
        const targetIndexField = dialog.element.querySelector<HTMLInputElement>('input[name="targetIndex"]:checked');
        const target = options[Number(targetIndexField?.value ?? '-1')];
        if (!target) return;
        const label = dialog.element.querySelector<HTMLInputElement>('input[name="label"]')?.value ?? '';

        await addLink(target.doc, {
          documentId: result.id,
          moduleType: result.moduleType,
          nameSnapshot: result.name,
          label,
        });
        ui.notifications.info(t('ATLASFOUNDRY.Links.Added', { name: result.name }));
      },
    },
  }).catch(() => undefined);
}
