import { t } from '../i18n';
import { notifyError, log } from '../log';
import { getCampaignId, setCampaignId } from '../settings';
import { authManager, revokeUnlinkedToken } from './auth-manager';
import { startDeviceFlow, pollDeviceFlow, type DeviceFlowStart } from './device-flow';

function renderContent(start: DeviceFlowStart): string {
  return `
    <div class="atlas-foundry-login">
      <p>${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Login.Instructions'))}</p>
      <p class="atlas-foundry-login-code">${foundry.utils.escapeHTML(start.userCode)}</p>
      <button type="button" data-action="open-atlas">${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Login.OpenAtlas'))}</button>
      <p class="hint">${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Login.FallbackLinkHint'))}</p>
      <input type="text" readonly value="${foundry.utils.escapeHTML(start.verificationUriComplete)}" data-fallback-link>
      <p class="atlas-foundry-status" data-login-status>${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Login.Waiting'))}</p>
    </div>
  `;
}

/**
 * Entry point for "Mit Atlas verbinden". Callers (controls/settings-app)
 * are expected to have already disabled this for players on an unlinked
 * world (see the plan's player special-case) — this guard is a defensive
 * backstop, not the primary UX.
 */
export async function openLoginDialog(): Promise<void> {
  if (!game.user.isGM && !getCampaignId()) {
    ui.notifications.warn(t('ATLASFOUNDRY.Login.PlayerWaitingForGm'));
    return;
  }

  let start: DeviceFlowStart;
  try {
    start = await startDeviceFlow({
      worldId: game.world.id,
      worldName: game.world.title,
      campaignId: getCampaignId() || undefined,
      foundryUserName: game.user.name,
    });
  } catch (err) {
    notifyError(err, 'ATLASFOUNDRY.Login.StartFailed');
    return;
  }

  authManager.setLinking(true);
  const controller = new AbortController();

  try {
    await foundry.applications.api.DialogV2.prompt({
      window: { title: 'ATLASFOUNDRY.Login.Title' },
      content: renderContent(start),
      buttons: [
        {
          label: 'ATLASFOUNDRY.Login.Cancel',
          action: 'cancel',
          callback: () => controller.abort(),
        },
      ],
      render: (_event, dialog) => {
        dialog.element.querySelector('[data-action="open-atlas"]')?.addEventListener('click', () => {
          const popup = window.open(start.verificationUriComplete, '_blank');
          if (!popup) ui.notifications.warn(t('ATLASFOUNDRY.Login.PopupBlocked'));
        });

        runFlow(start, controller.signal, dialog).catch((err) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          log.error('Atlas Foundry: login poll loop failed', err);
        });
      },
    });
  } finally {
    authManager.setLinking(false);
  }
}

async function runFlow(
  start: DeviceFlowStart,
  signal: AbortSignal,
  dialog: foundry.applications.api.DialogV2RenderContext,
): Promise<void> {
  const result = await pollDeviceFlow(start, signal);
  await dialog.close();

  if (result.status === 'denied') {
    ui.notifications.warn(t('ATLASFOUNDRY.Login.Denied'));
    return;
  }
  if (result.status === 'expired') {
    ui.notifications.warn(t('ATLASFOUNDRY.Login.Expired'));
    return;
  }

  const worldCampaignId = getCampaignId();
  if (worldCampaignId && worldCampaignId !== result.campaignId) {
    void revokeUnlinkedToken(result.token, result.tokenId);
    ui.notifications.error(t('ATLASFOUNDRY.Login.CampaignMismatch'));
    return;
  }
  if (!worldCampaignId && game.user.isGM) {
    await setCampaignId(result.campaignId);
  }

  try {
    await authManager.login(result.token, result.tokenId);
  } catch (err) {
    notifyError(err, 'ATLASFOUNDRY.Login.ExchangeFailed');
    return;
  }

  const me = authManager.getMe();
  ui.notifications.info(
    t('ATLASFOUNDRY.Login.Success', {
      displayName: me?.displayName ?? '',
      campaignName: me?.campaignName ?? '',
    }),
  );
}
