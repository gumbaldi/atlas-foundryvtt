import { t } from '../i18n';
import { notifyError, log } from '../log';
import { getCampaignId, setCampaignId } from '../settings';
import { authManager, revokeUnlinkedToken } from './auth-manager';
import { startDeviceFlow, pollDeviceFlow, type DeviceFlowStart } from './device-flow';

function renderContent(start: DeviceFlowStart, tabOpened: boolean): string {
  const escape = foundry.utils.escapeHTML;
  return `
    <div class="atlas-foundry-login">
      <h3>${escape(t('ATLASFOUNDRY.Login.ConfirmInAtlas'))}</h3>
      <p>${escape(t(tabOpened ? 'ATLASFOUNDRY.Login.TabOpened' : 'ATLASFOUNDRY.Login.PopupBlocked'))}</p>
      <p class="atlas-foundry-login-code-hint">${escape(t('ATLASFOUNDRY.Login.CodeHint', { code: start.userCode }))}</p>
      <button type="button" data-action="open-atlas">${escape(t('ATLASFOUNDRY.Login.OpenAtlasAgain'))}</button>
      <p class="atlas-foundry-status" data-login-status>${escape(t('ATLASFOUNDRY.Login.Waiting'))}</p>
    </div>
  `;
}

export interface LoginOptions {
  /** Runs after the Atlas tab was opened and before the login starts (e.g. to store the typed base URL). A rejection aborts the login. */
  prepare?: () => Promise<void>;
}

/**
 * Entry point for "Mit Atlas verbinden". Callers (controls/settings-app)
 * are expected to have already disabled this for players on an unlinked
 * world (see the plan's player special-case) — this guard is a defensive
 * backstop, not the primary UX.
 *
 * A browser only allows a new tab during the user's click, but the Atlas URL
 * is known only after the device flow started — so a blank tab is opened
 * synchronously (before the first `await`) and pointed at Atlas afterwards.
 */
export async function openLoginDialog(options: LoginOptions = {}): Promise<void> {
  if (!game.user.isGM && !getCampaignId()) {
    ui.notifications.warn(t('ATLASFOUNDRY.Login.PlayerWaitingForGm'));
    return;
  }

  const tab = window.open('', '_blank');
  if (tab) tab.opener = null;

  let start: DeviceFlowStart;
  try {
    await options.prepare?.();
  } catch {
    tab?.close();
    return;
  }
  try {
    start = await startDeviceFlow({
      worldId: game.world.id,
      worldName: game.world.title,
      campaignId: getCampaignId() || undefined,
      foundryUserName: game.user.name,
    });
  } catch (err) {
    tab?.close();
    notifyError(err, 'ATLASFOUNDRY.Login.StartFailed');
    return;
  }

  if (tab) tab.location.href = start.verificationUriComplete;

  authManager.setLinking(true);
  const controller = new AbortController();

  try {
    await foundry.applications.api.DialogV2.prompt({
      window: { title: 'ATLASFOUNDRY.Login.Title' },
      content: renderContent(start, !!tab),
      buttons: [{ label: 'ATLASFOUNDRY.Login.Cancel', action: 'cancel' }],
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
    // Cancel button, X and Escape all end up here — closing the dialog must really stop the flow.
    controller.abort();
    authManager.setLinking(false);
  }
}

async function runFlow(
  start: DeviceFlowStart,
  signal: AbortSignal,
  dialog: foundry.applications.api.DialogV2RenderContext,
): Promise<void> {
  const result = await pollDeviceFlow(start, signal);
  if (signal.aborted) return;
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

  try {
    await authManager.login(result.token, result.tokenId);
  } catch (err) {
    notifyError(err, 'ATLASFOUNDRY.Login.ExchangeFailed');
    return;
  }

  // Pin the world to the campaign only once the token really works.
  if (!worldCampaignId && game.user.isGM) {
    await setCampaignId(result.campaignId);
  }

  const me = authManager.getMe();
  ui.notifications.info(
    t('ATLASFOUNDRY.Login.Success', {
      displayName: me?.displayName ?? '',
      campaignName: me?.campaignName ?? '',
    }),
  );
}
