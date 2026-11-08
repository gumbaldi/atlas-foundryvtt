import { t } from '../i18n';
import { getBaseUrl, getCampaignId, setBaseUrl, setCampaignId, validateBaseUrl } from '../settings';
import { testConnection, formatConnectionTestResult } from '../connection-test';
import { notifyError } from '../log';
import { authManager } from '../auth/auth-manager';
import { openLoginDialog } from '../auth/login-app';
import { getConnectionStatus } from '../auth/status';

function renderStatus(dialogElement: HTMLElement): void {
  const status = getConnectionStatus();
  const dot = dialogElement.querySelector<HTMLElement>('[data-status-dot]');
  const text = dialogElement.querySelector<HTMLElement>('[data-status-text]');
  const toggleButton = dialogElement.querySelector<HTMLButtonElement>('[data-action="auth-toggle"]');

  if (dot) dot.className = `atlas-foundry-dot atlas-foundry-dot-${status.color}`;
  if (text) text.textContent = t(status.messageKey, status.messageData);
  if (toggleButton) {
    toggleButton.textContent = t(authManager.isLinked() ? 'ATLASFOUNDRY.Settings.Logout' : 'ATLASFOUNDRY.Settings.Login');
  }
}

export async function openSettingsDialog(): Promise<void> {
  if (!game.user.isGM) {
    ui.notifications.warn(t('ATLASFOUNDRY.Settings.GmOnly'));
    return;
  }

  const content = `
    <form class="atlas-foundry-settings">
      <div class="form-group atlas-foundry-status-row">
        <span class="atlas-foundry-dot" data-status-dot></span>
        <span data-status-text></span>
        <button type="button" data-action="auth-toggle"></button>
      </div>
      <div class="form-group">
        <label>${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Settings.BaseUrl.Name'))}</label>
        <input name="baseUrl" type="url" value="${foundry.utils.escapeHTML(getBaseUrl())}" placeholder="https://atlas.example.com">
        <p class="hint">${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Settings.BaseUrl.Hint'))}</p>
      </div>
      <div class="form-group">
        <label>${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Settings.CampaignId.Name'))}</label>
        <input name="campaignId" type="text" value="${foundry.utils.escapeHTML(getCampaignId())}">
        <p class="hint">${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Settings.CampaignId.Hint'))}</p>
      </div>
      <div class="form-group">
        <button type="button" data-action="test-connection">${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Settings.TestConnection'))}</button>
        <p class="atlas-foundry-status" data-test-status></p>
      </div>
    </form>
  `;

  let onAuthChanged: (() => void) | undefined;
  let onSocketStatusChanged: (() => void) | undefined;

  try {
    await foundry.applications.api.DialogV2.prompt({
      window: { title: 'ATLASFOUNDRY.Settings.Title' },
      content,
      render: (_event, dialog) => {
        renderStatus(dialog.element);
        onAuthChanged = () => renderStatus(dialog.element);
        onSocketStatusChanged = () => renderStatus(dialog.element);
        Hooks.on('atlas-foundry.authChanged', onAuthChanged);
        Hooks.on('atlas-foundry.socketStatusChanged', onSocketStatusChanged);

        dialog.element.querySelector('[data-action="auth-toggle"]')?.addEventListener('click', async () => {
          if (authManager.isLinked()) {
            await authManager.logout();
          } else {
            await openLoginDialog();
          }
          renderStatus(dialog.element);
        });

        const testButton = dialog.element.querySelector<HTMLButtonElement>('[data-action="test-connection"]');
        const statusEl = dialog.element.querySelector<HTMLElement>('[data-test-status]');
        const baseUrlInput = dialog.element.querySelector<HTMLInputElement>('input[name="baseUrl"]');

        testButton?.addEventListener('click', async () => {
          if (!statusEl) return;
          statusEl.classList.remove('atlas-foundry-status-ok', 'atlas-foundry-status-error');
          statusEl.textContent = t('ATLASFOUNDRY.Settings.TestingConnection');
          try {
            const result = await testConnection(baseUrlInput?.value ?? '');
            statusEl.textContent = formatConnectionTestResult(result);
            statusEl.classList.add(result.ok ? 'atlas-foundry-status-ok' : 'atlas-foundry-status-error');
          } catch (err) {
            notifyError(err, 'ATLASFOUNDRY.ConnectionTest.UnexpectedError');
            statusEl.textContent = t('ATLASFOUNDRY.ConnectionTest.UnexpectedError');
            statusEl.classList.add('atlas-foundry-status-error');
          }
        });
      },
      ok: {
        label: 'ATLASFOUNDRY.Settings.Save',
        callback: async (_event, button) => {
          const baseUrlInput = button.form.elements.namedItem('baseUrl') as HTMLInputElement | null;
          const campaignIdInput = button.form.elements.namedItem('campaignId') as HTMLInputElement | null;

          const { normalized, warningKey } = validateBaseUrl(baseUrlInput?.value ?? '');
          await setBaseUrl(normalized);
          await setCampaignId(campaignIdInput?.value.trim() ?? '');

          if (warningKey) ui.notifications.warn(t(warningKey));
        },
      },
    });
  } finally {
    if (onAuthChanged) Hooks.off('atlas-foundry.authChanged', onAuthChanged);
    if (onSocketStatusChanged) Hooks.off('atlas-foundry.socketStatusChanged', onSocketStatusChanged);
  }
}
