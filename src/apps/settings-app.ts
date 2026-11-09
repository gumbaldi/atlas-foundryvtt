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

function buildContent(): string {
  return `
    <div class="atlas-foundry-settings">
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
    </div>
    <footer class="form-footer">
      <button type="submit"><i class="fa-solid fa-floppy-disk"></i> ${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Settings.Save'))}</button>
    </footer>
  `;
}

/**
 * The GM's Atlas settings, opened from Foundry's own "Configure Settings"
 * module menu (`game.settings.registerMenu`, see main.ts). The app element
 * itself is the `<form>` (`tag: 'form'`), so the content below must not nest
 * another one.
 */
export class AtlasSettingsApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS: foundry.applications.api.ApplicationV2Options = {
    id: 'atlas-foundry-settings',
    tag: 'form',
    classes: ['atlas-foundry'],
    window: { title: 'ATLASFOUNDRY.Settings.Title', icon: 'fa-solid fa-book-open' },
    position: { width: 480 },
    form: { handler: AtlasSettingsApp.onSubmit, closeOnSubmit: true },
  };

  private onAuthChanged: (() => void) | undefined;
  private onSocketStatusChanged: (() => void) | undefined;

  static async onSubmit(_event: Event, _form: HTMLFormElement, formData: { object: Record<string, unknown> }): Promise<void> {
    const { normalized, warningKey } = validateBaseUrl(String(formData.object.baseUrl ?? ''));
    await setBaseUrl(normalized);
    await setCampaignId(String(formData.object.campaignId ?? '').trim());

    if (warningKey) ui.notifications.warn(t(warningKey));
  }

  protected async _renderHTML(): Promise<HTMLElement> {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = buildContent();
    return wrapper;
  }

  protected async _replaceHTML(result: HTMLElement, content: HTMLElement): Promise<void> {
    content.replaceChildren(...Array.from(result.childNodes));
    this.wire(content);
  }

  private wire(root: HTMLElement): void {
    renderStatus(root);

    this.removeHookListeners();
    this.onAuthChanged = () => renderStatus(root);
    this.onSocketStatusChanged = () => renderStatus(root);
    Hooks.on('atlas-foundry.authChanged', this.onAuthChanged);
    Hooks.on('atlas-foundry.socketStatusChanged', this.onSocketStatusChanged);

    root.querySelector('[data-action="auth-toggle"]')?.addEventListener('click', async () => {
      if (authManager.isLinked()) {
        await authManager.logout();
      } else {
        await openLoginDialog();
      }
      renderStatus(root);
    });

    const testButton = root.querySelector<HTMLButtonElement>('[data-action="test-connection"]');
    const statusEl = root.querySelector<HTMLElement>('[data-test-status]');
    const baseUrlInput = root.querySelector<HTMLInputElement>('input[name="baseUrl"]');

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
  }

  private removeHookListeners(): void {
    if (this.onAuthChanged) Hooks.off('atlas-foundry.authChanged', this.onAuthChanged);
    if (this.onSocketStatusChanged) Hooks.off('atlas-foundry.socketStatusChanged', this.onSocketStatusChanged);
    this.onAuthChanged = undefined;
    this.onSocketStatusChanged = undefined;
  }

  protected _onClose(options?: Record<string, unknown>): void {
    this.removeHookListeners();
    super._onClose(options);
  }
}

export async function openSettingsDialog(): Promise<void> {
  if (!game.user.isGM) {
    ui.notifications.warn(t('ATLASFOUNDRY.Settings.GmOnly'));
    return;
  }
  await new AtlasSettingsApp().render(true);
}
