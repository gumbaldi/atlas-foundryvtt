import { io, type Socket } from 'socket.io-client';
import { getBaseUrl } from '../settings';
import { authManager } from '../auth/auth-manager';
import { log } from '../log';

export type SocketStatus = 'disconnected' | 'connecting' | 'connected' | 'degraded';

/**
 * Managed Socket.IO connection, one per client (GM and players alike — this
 * replaces V1's GM-only, statically-authed socket, see plan A1/F7). The auth
 * callback re-runs `ensureAccessToken()` on every (re)connect attempt, so a
 * long-lived session survives the 15-minute JWT expiry without any timer.
 * Uses the Socket.IO default transports (HTTP long-polling first, then an
 * upgrade to WebSocket), so a proxy that blocks the WebSocket upgrade still
 * yields a working live connection.
 */
class AtlasSocket {
  private socket: Socket | null = null;
  private status: SocketStatus = 'disconnected';

  getStatus(): SocketStatus {
    return this.status;
  }

  start(): void {
    if (this.socket) return;
    const baseUrl = getBaseUrl();
    if (!baseUrl) return;

    this.setStatus('connecting');
    this.socket = io(`${baseUrl}/ws`, {
      auth: (cb) => {
        authManager
          .ensureAccessToken()
          .then((token) => cb({ token }))
          .catch(() => cb({ token: '' }));
      },
    });

    this.socket.on('connect', () => this.setStatus('connected'));
    this.socket.on('disconnect', () => this.setStatus('degraded'));
    this.socket.on('connect_error', (err: unknown) => {
      // Log only when entering `degraded`, not on every reconnect attempt.
      if (this.status !== 'degraded') log.warn('Atlas Foundry: socket connect_error', err);
      this.setStatus('degraded');
    });
    // Generic bridge so other modules (P4 cache-invalidation, P8 notifications)
    // can subscribe via Hooks instead of importing this module directly.
    this.socket.onAny((event: string, payload: unknown) => {
      Hooks.callAll('atlas-foundry.socketEvent', event, payload);
    });
  }

  stop(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.setStatus('disconnected');
  }

  restart(): void {
    this.stop();
    this.start();
  }

  private setStatus(status: SocketStatus): void {
    if (this.status === status) return;
    this.status = status;
    Hooks.callAll('atlas-foundry.socketStatusChanged', status);
  }
}

export const atlasSocket = new AtlasSocket();
