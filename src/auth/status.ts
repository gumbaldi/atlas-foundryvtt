import { authManager } from './auth-manager';
import { atlasSocket } from '../socket/atlas-socket';

export type StatusColor = 'green' | 'yellow' | 'grey' | 'red';

export interface StatusInfo {
  color: StatusColor;
  messageKey: string;
  messageData?: Record<string, unknown>;
}

/** Shared by settings-app.ts and browser-app.ts so both status displays agree. */
export function getConnectionStatus(): StatusInfo {
  const state = authManager.getState();

  if (state === 'revoked') {
    const messageKey =
      authManager.getRevokedReason() === 'world-mismatch' ? 'ATLASFOUNDRY.Status.WorldMismatch' : 'ATLASFOUNDRY.Status.Revoked';
    return { color: 'red', messageKey };
  }
  if (state === 'loggedOut') return { color: 'grey', messageKey: 'ATLASFOUNDRY.Status.LoggedOut' };
  if (state === 'linking') return { color: 'grey', messageKey: 'ATLASFOUNDRY.Status.Linking' };

  const socketStatus = atlasSocket.getStatus();
  if (socketStatus === 'connected') {
    const me = authManager.getMe();
    return {
      color: 'green',
      messageKey: 'ATLASFOUNDRY.Status.Connected',
      messageData: { displayName: me?.displayName ?? '', campaignName: me?.campaignName ?? '' },
    };
  }
  return { color: 'yellow', messageKey: 'ATLASFOUNDRY.Status.Reconnecting' };
}
