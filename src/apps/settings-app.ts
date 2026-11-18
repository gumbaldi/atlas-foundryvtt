import { t } from '../i18n';
import { applyAtlasUrl, getBaseUrl, getCampaignId, getCampaignSlug, parseAtlasUrl, validateBaseUrl } from '../settings';
import { atlasCampaignDashboardUrl } from '../deep-links';
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

/** The single URL field shows the stored alias URL, else the campaign-id URL, else just the base URL. */
function currentAtlasUrl(): string {
  const campaignSlug = getCampaignSlug();
  if (campaignSlug) return atlasCampaignDashboardUrl(campaignSlug);
  const campaignId = getCampaignId();
  return campaignId ? atlasCampaignDashboardUrl(campaignId) : getBaseUrl();
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
        <label>${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Settings.AtlasUrl.Name'))}</label>
        <input name="atlasUrl" type="url" value="${foundry.utils.escapeHTML(currentAtlasUrl())}" placeholder="https://atlas.example.com/de/campaigns/...">
        <p class="hint">${foundry.utils.escapeHTML(t('ATLASFOUNDRY.Settings.AtlasUrl.Hint'))}</p>
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
    const parsed = parseAtlasUrl(String(formData.object.atlasUrl ?? ''));
    const { warningKey } = validateBaseUrl(parsed.baseUrl);
    await applyAtlasUrl(parsed);

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
        await openLoginDialog({ prepare: () => this.storeCurrentInputs(root) });
      }
      renderStatus(root);
    });

    const testButton = root.querySelector<HTMLButtonElement>('[data-action="test-connection"]');
    const statusEl = root.querySelector<HTMLElement>('[data-test-status]');
    const atlasUrlInput = root.querySelector<HTMLInputElement>('input[name="atlasUrl"]');

    testButton?.addEventListener('click', async () => {
      if (!statusEl) return;
      statusEl.classList.remove('atlas-foundry-status-ok', 'atlas-foundry-status-error');
      statusEl.textContent = t('ATLASFOUNDRY.Settings.TestingConnection');
      try {
        const result = await testConnection(parseAtlasUrl(atlasUrlInput?.value ?? '').baseUrl);
        statusEl.textContent = formatConnectionTestResult(result);
        statusEl.classList.add(result.ok ? 'atlas-foundry-status-ok' : 'atlas-foundry-status-error');
      } catch (err) {
        notifyError(err, 'ATLASFOUNDRY.ConnectionTest.UnexpectedError');
        statusEl.textContent = t('ATLASFOUNDRY.ConnectionTest.UnexpectedError');
        statusEl.classList.add('atlas-foundry-status-error');
      }
    });
  }

  /** The Connect button must use what is typed in the form, not the last saved values. */
  private async storeCurrentInputs(root: HTMLElement): Promise<void> {
    const atlasUrlInput = root.querySelector<HTMLInputElement>('input[name="atlasUrl"]');

    const parsed = parseAtlasUrl(atlasUrlInput?.value ?? '');
    const { normalized, warningKey } = validateBaseUrl(parsed.baseUrl);
    if (!normalized) {
      ui.notifications.warn(t('ATLASFOUNDRY.ConnectionTest.MissingBaseUrl'));
      throw new Error('Atlas Foundry: base URL missing');
    }
    await applyAtlasUrl(parsed);
    if (warningKey) ui.notifications.warn(t(warningKey));
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
