import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchDiaryInvitation = vi.fn();
const refreshDiaryInvitation = vi.fn();
const openInvitationPopup = vi.fn();
const getQuietMode = vi.fn(() => false);
const getDismissed = vi.fn((): string[] => []);
const setDismissed = vi.fn(async () => undefined);
const isLinked = vi.fn(() => true);

vi.mock('../auth/auth-manager', () => ({
  authManager: { isLinked, getLinkedCampaignId: () => 'camp-1' },
}));
vi.mock('../settings', () => ({
  getQuietMode,
  getDismissedDiaryInvitations: getDismissed,
  setDismissedDiaryInvitations: setDismissed,
}));
vi.mock('../log', () => ({ log: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));
vi.mock('../notifications/notification-popups', () => ({ openInvitationPopup }));
vi.mock('./diary-api', () => ({ fetchDiaryInvitation, refreshDiaryInvitation }));

const { clearDiaryInvitation, registerDiaryInvitation, resolveArrivalLayout } = await import('./diary-invitation');

const LOG = { id: 'log-1', name: 'Into the Fog' };
const ARRIVAL = { id: 'm1', kind: 'document-new', documentModuleType: 'session-logs', documentId: 'log-1' } as never;

let authChanged: (payload: { state: string }) => void;

async function login(): Promise<void> {
  authChanged({ state: 'active' });
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  vi.clearAllMocks();
  clearDiaryInvitation();
  getQuietMode.mockReturnValue(false);
  getDismissed.mockReturnValue([]);
  isLinked.mockReturnValue(true);
  globalThis.game = { user: { id: 'u1' } } as unknown as Game;
  globalThis.Hooks = {
    on: vi.fn((_name: string, cb: typeof authChanged) => {
      authChanged = cb;
    }),
  } as unknown as HooksStatic;
  registerDiaryInvitation();
});

describe('login trigger', () => {
  it('opens the invitation for a log without a diary entry', async () => {
    fetchDiaryInvitation.mockResolvedValue({ sessionLog: LOG, hasDiaryEntry: false });
    await login();
    expect(openInvitationPopup).toHaveBeenCalledOnce();
    expect(openInvitationPopup.mock.calls[0]?.[0]).toMatchObject({ sessionLog: LOG });
  });

  it('offers a log only once per page load', async () => {
    fetchDiaryInvitation.mockResolvedValue({ sessionLog: LOG, hasDiaryEntry: false });
    await login();
    await login();
    expect(openInvitationPopup).toHaveBeenCalledOnce();
  });

  it.each([
    ['a diary entry exists', { sessionLog: LOG, hasDiaryEntry: true }],
    ['there is no session log', { sessionLog: null, hasDiaryEntry: false }],
    ['the route is missing', null],
  ])('stays quiet when %s', async (_name, invitation) => {
    fetchDiaryInvitation.mockResolvedValue(invitation);
    await login();
    expect(openInvitationPopup).not.toHaveBeenCalled();
  });

  it('stays quiet for a dismissed log, in quiet mode and when the fetch fails', async () => {
    fetchDiaryInvitation.mockResolvedValue({ sessionLog: LOG, hasDiaryEntry: false });
    getDismissed.mockReturnValue(['u1:log-1']);
    await login();
    getDismissed.mockReturnValue([]);
    getQuietMode.mockReturnValue(true);
    await login();
    getQuietMode.mockReturnValue(false);
    fetchDiaryInvitation.mockRejectedValue(new Error('boom'));
    await login();
    expect(openInvitationPopup).not.toHaveBeenCalled();
  });

  it('the opt-out stores the user:log key', async () => {
    fetchDiaryInvitation.mockResolvedValue({ sessionLog: LOG, hasDiaryEntry: false });
    await login();
    openInvitationPopup.mock.calls[0]?.[0].onDismiss();
    expect(setDismissed).toHaveBeenCalledWith(['u1:log-1']);
  });
});

describe('resolveArrivalLayout', () => {
  it('answers invitation when a fresh fetch confirms the same log without an entry', async () => {
    refreshDiaryInvitation.mockResolvedValue({ sessionLog: LOG, hasDiaryEntry: false });
    await expect(resolveArrivalLayout(ARRIVAL)).resolves.toEqual({ layout: 'invitation', sessionLog: LOG });
  });

  it.each([
    ['a diary entry exists', { sessionLog: LOG, hasDiaryEntry: true }],
    ['it is another log', { sessionLog: { id: 'log-2', name: 'x' }, hasDiaryEntry: false }],
    ['the route is missing', null],
  ])('answers default when %s', async (_name, invitation) => {
    refreshDiaryInvitation.mockResolvedValue(invitation);
    await expect(resolveArrivalLayout(ARRIVAL)).resolves.toEqual({ layout: 'default' });
  });

  it('answers default when the fetch fails', async () => {
    refreshDiaryInvitation.mockRejectedValue(new Error('boom'));
    await expect(resolveArrivalLayout(ARRIVAL)).resolves.toEqual({ layout: 'default' });
  });

  it('answers default without a fetch for other notifications', async () => {
    const other = { id: 'm2', kind: 'document-updated', documentModuleType: 'session-logs', documentId: 'log-1' } as never;
    await expect(resolveArrivalLayout(other)).resolves.toEqual({ layout: 'default' });
    expect(refreshDiaryInvitation).not.toHaveBeenCalled();
  });
});
