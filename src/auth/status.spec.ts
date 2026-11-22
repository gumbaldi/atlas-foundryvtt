import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.hoisted(() => ({
  getState: vi.fn(),
  getRevokedReason: vi.fn(),
  getMe: vi.fn(),
}));
const socketMock = vi.hoisted(() => ({ getStatus: vi.fn() }));

vi.mock('./auth-manager', () => ({ authManager: authMock }));
vi.mock('../socket/atlas-socket', () => ({ atlasSocket: socketMock }));

import { getConnectionStatus } from './status';

describe('getConnectionStatus', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    authMock.getState.mockReturnValue('active');
    authMock.getMe.mockReturnValue({ displayName: 'Ada', campaignName: 'Camp' });
  });

  it.each([
    ['world-mismatch', 'ATLASFOUNDRY.Status.WorldMismatch'],
    ['campaign-mismatch', 'ATLASFOUNDRY.Status.CampaignMismatch'],
    ['other', 'ATLASFOUNDRY.Status.Revoked'],
  ])('revoked (%s) is red', (reason, key) => {
    authMock.getState.mockReturnValue('revoked');
    authMock.getRevokedReason.mockReturnValue(reason);
    expect(getConnectionStatus()).toEqual({ color: 'red', messageKey: key });
  });

  it('loggedOut is grey', () => {
    authMock.getState.mockReturnValue('loggedOut');
    expect(getConnectionStatus()).toEqual({ color: 'grey', messageKey: 'ATLASFOUNDRY.Status.LoggedOut' });
  });

  it('linking is grey', () => {
    authMock.getState.mockReturnValue('linking');
    expect(getConnectionStatus()).toEqual({ color: 'grey', messageKey: 'ATLASFOUNDRY.Status.Linking' });
  });

  it('active + connected is green with message data', () => {
    socketMock.getStatus.mockReturnValue('connected');
    expect(getConnectionStatus()).toEqual({
      color: 'green',
      messageKey: 'ATLASFOUNDRY.Status.Connected',
      messageData: { displayName: 'Ada', campaignName: 'Camp' },
    });
  });

  it.each(['connecting', 'disconnected'])('active + %s is yellow Connecting', (status) => {
    socketMock.getStatus.mockReturnValue(status);
    expect(getConnectionStatus()).toEqual({ color: 'yellow', messageKey: 'ATLASFOUNDRY.Status.Connecting' });
  });

  it('active + degraded is yellow ConnectedNoLive', () => {
    socketMock.getStatus.mockReturnValue('degraded');
    expect(getConnectionStatus()).toEqual({ color: 'yellow', messageKey: 'ATLASFOUNDRY.Status.ConnectedNoLive' });
  });
});
