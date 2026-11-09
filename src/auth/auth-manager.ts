import { getBaseUrl, getCampaignId, getUserToken, getUserTokenId, setUserToken, clearUserToken } from '../settings';
import { t } from '../i18n';
import { log } from '../log';
import type { TokenExchangeResponse } from '../atlas-types';

export type AuthState = 'loggedOut' | 'linking' | 'active' | 'revoked';
export type RevokedReason = 'revoked' | 'world-mismatch' | 'campaign-mismatch';

export interface FoundryMe {
  userId: string;
  displayName: string;
  campaignId: string;
  campaignName: string;
  role: string;
}

interface CachedJwt {
  token: string;
  expiresAt: number;
}

/** Renew this long before real expiry so in-flight requests never race the JWT's actual cutoff. */
const SKEW_MS = 60_000;

/**
 * Zentrale Auth-Zustandsmaschine (P3-Plan): cached JWT, lazy renewal on every
 * `ensureAccessToken()` call (no background timer), and the one durable
 * secret — the per-user Foundry token — lives only in the client-scoped
 * setting (see settings.ts). Emits `atlas-foundry.authChanged` so UI (P3
 * status line, later P4-P8) can react without importing this module.
 */
export class AuthManager {
  private state: AuthState = 'loggedOut';
  private cachedJwt: CachedJwt | null = null;
  private me: FoundryMe | null = null;
  private sessionCampaignId: string | null = null;
  private exchangePromise: Promise<string> | null = null;
  private revokedReason: RevokedReason = 'revoked';

  getState(): AuthState {
    return this.state;
  }

  getRevokedReason(): RevokedReason {
    return this.revokedReason;
  }

  getMe(): FoundryMe | null {
    return this.me;
  }

  /**
   * The campaign this session's token is bound to — read straight from the
   * token-exchange response, so (unlike `getMe()`) it's guaranteed populated
   * as soon as `ensureAccessToken()` resolves, even if the best-effort
   * `/foundry/me` refresh that follows it failed.
   */
  getLinkedCampaignId(): string | null {
    return this.sessionCampaignId;
  }

  isLinked(): boolean {
    return !!getUserToken();
  }

  setLinking(linking: boolean): void {
    if (linking) {
      this.setState('linking');
    } else if (this.state === 'linking') {
      // login() already moved state to 'active'/'revoked' on any completed
      // attempt — still being 'linking' here means the dialog was cancelled
      // or the code expired/was denied before login() ever ran.
      this.setState('loggedOut');
    }
  }

  /** Called once from the `ready` hook to silently resume a persisted session. */
  async restore(): Promise<void> {
    if (!getUserToken()) {
      this.setState('loggedOut');
      return;
    }
    try {
      await this.ensureAccessToken();
    } catch (err) {
      log.warn('Atlas Foundry: failed to restore session', err);
    }
  }

  /** Stores the newly linked device token and validates it immediately. */
  async login(rawToken: string, tokenId: string): Promise<void> {
    await setUserToken(rawToken, tokenId);
    this.cachedJwt = null;
    await this.ensureAccessToken();
  }

  async logout(): Promise<void> {
    const tokenId = getUserTokenId();
    const accessToken = await this.ensureAccessToken().catch(() => null);

    await clearUserToken();
    this.cachedJwt = null;
    this.me = null;
    this.sessionCampaignId = null;
    this.setState('loggedOut');

    if (!tokenId) return;
    if (!accessToken) {
      ui.notifications.warn(t('ATLASFOUNDRY.Auth.LogoutOfflineHint'));
      return;
    }
    try {
      await this.revokeOnServer(tokenId, accessToken);
    } catch (err) {
      log.warn('Atlas Foundry: server-side token revoke failed', err);
      ui.notifications.warn(t('ATLASFOUNDRY.Auth.LogoutOfflineHint'));
    }
  }

  /** Drops the cached JWT (e.g. after a baseUrl change) without touching login state. */
  invalidateCache(): void {
    this.cachedJwt = null;
  }

  async ensureAccessToken(): Promise<string> {
    const userToken = getUserToken();
    if (!userToken) {
      // Don't downgrade a visible 'revoked' state back to plain 'loggedOut' —
      // the red status dot must survive until the user acts on it (login()/logout()).
      if (this.state !== 'revoked') this.setState('loggedOut');
      throw new Error('Atlas Foundry: not logged in');
    }

    if (this.cachedJwt && this.cachedJwt.expiresAt - Date.now() > SKEW_MS) {
      return this.cachedJwt.token;
    }

    if (!this.exchangePromise) {
      this.exchangePromise = this.exchange(userToken).finally(() => {
        this.exchangePromise = null;
      });
    }
    return this.exchangePromise;
  }

  private async exchange(userToken: string): Promise<string> {
    const baseUrl = getBaseUrl();
    if (!baseUrl) throw new Error('Atlas Foundry: base URL not configured');

    // Network failures are left for the caller (atlas-socket's auth callback,
    // typically) to interpret as "degraded" — they must not touch auth state,
    // since the stored token itself may still be perfectly valid.
    const response = await fetch(`${baseUrl}/api/v1/foundry/token-exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: userToken, worldId: game.world.id }),
    });

    // The stored token may have changed (logout, new login) while this request
    // was in flight — its result must not touch the newer session.
    if (getUserToken() !== userToken) throw new Error('Atlas Foundry: token changed during exchange');

    if (response.status === 401) {
      const detail = (await response.json().catch(() => null)) as { message?: string } | null;
      this.revokedReason = detail?.message?.toLowerCase().includes('world mismatch') ? 'world-mismatch' : 'revoked';
      await clearUserToken();
      this.cachedJwt = null;
      this.me = null;
      this.sessionCampaignId = null;
      this.setState('revoked');
      throw new Error('Atlas Foundry: token revoked, expired, or world mismatch');
    }
    if (!response.ok) {
      throw new Error(`Atlas Foundry: token exchange failed (HTTP ${response.status})`);
    }

    const body = (await response.json()) as TokenExchangeResponse;

    // Fail closed: a sign-in for another campaign than the world's is revoked, not just warned about.
    const worldCampaignId = getCampaignId();
    if (worldCampaignId && body.campaignId !== worldCampaignId) {
      const tokenId = getUserTokenId();
      await this.revokeOnServer(tokenId, body.accessToken).catch((err) =>
        log.warn('Atlas Foundry: failed to revoke a wrong-campaign token', err),
      );
      this.revokedReason = 'campaign-mismatch';
      await clearUserToken();
      this.cachedJwt = null;
      this.me = null;
      this.sessionCampaignId = null;
      this.setState('revoked');
      throw new Error('Atlas Foundry: token belongs to a different campaign than this world');
    }

    // Uhr-Drift: expiresIn is relative to the server's clock at response time,
    // so we anchor it to Date.now() on receipt rather than trusting any absolute value.
    this.cachedJwt = { token: body.accessToken, expiresAt: Date.now() + body.expiresIn * 1000 };
    this.sessionCampaignId = body.campaignId;
    this.setState('active');

    await this.refreshMe(body.accessToken).catch((err) => log.warn('Atlas Foundry: failed to refresh /foundry/me', err));

    return body.accessToken;
  }

  private async refreshMe(accessToken: string): Promise<void> {
    const baseUrl = getBaseUrl();
    const response = await fetch(`${baseUrl}/api/v1/foundry/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return;

    const me = (await response.json()) as FoundryMe;
    this.me = me;
    this.notifyChange();
  }

  private async revokeOnServer(tokenId: string, accessToken: string): Promise<void> {
    const baseUrl = getBaseUrl();
    const response = await fetch(`${baseUrl}/api/v1/users/me/foundry-tokens/${encodeURIComponent(tokenId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) throw new Error(`Atlas Foundry: server-side revoke failed (HTTP ${response.status})`);
  }

  private setState(state: AuthState): void {
    if (this.state === state) return;
    this.state = state;
    this.notifyChange();
  }

  private notifyChange(): void {
    Hooks.callAll('atlas-foundry.authChanged', { state: this.state, me: this.me });
  }
}

export const authManager = new AuthManager();

/**
 * Best-effort revoke for a device token the user never actually linked to
 * (wrong-campaign confirmation, see login-app.ts) — exchanges once just to
 * get a bearer JWT, then deletes. Failures are logged only; the caller
 * already shows its own error dialog and doesn't need a second one.
 */
export async function revokeUnlinkedToken(rawToken: string, tokenId: string): Promise<void> {
  const baseUrl = getBaseUrl();
  if (!baseUrl) return;
  try {
    const exchangeResponse = await fetch(`${baseUrl}/api/v1/foundry/token-exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: rawToken, worldId: game.world.id }),
    });
    if (!exchangeResponse.ok) return;
    const { accessToken } = (await exchangeResponse.json()) as TokenExchangeResponse;
    await fetch(`${baseUrl}/api/v1/users/me/foundry-tokens/${encodeURIComponent(tokenId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (err) {
    log.warn('Atlas Foundry: failed to revoke a rejected device token', err);
  }
}
