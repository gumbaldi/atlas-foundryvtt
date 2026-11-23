import { authManager } from '../auth/auth-manager';
import { getDismissedDiaryInvitations, getQuietMode, setDismissedDiaryInvitations } from '../settings';
import { log } from '../log';
import { openInvitationPopup } from '../notifications/notification-popups';
import { fetchDiaryInvitation, refreshDiaryInvitation } from './diary-api';
import { addDismissed, dismissKey, isSessionLogArrival, shouldInvite } from './invitation-model';
import type { AtlasDiaryInvitation, AtlasMessage } from '../atlas-types';

type SessionLog = NonNullable<AtlasDiaryInvitation['sessionLog']>;

export type ArrivalLayout = { layout: 'default' } | { layout: 'invitation'; sessionLog: SessionLog };

const DEFAULT_LAYOUT: ArrivalLayout = { layout: 'default' };

/** Log ids the invitation was already offered for during this page load. */
const offered = new Set<string>();

function currentUserId(): string {
  return game.user?.id ?? '';
}

/** Who is signed in where; a fetch that finishes under another identity is dropped. */
function identity(): string {
  return `${currentUserId()}|${authManager.getLinkedCampaignId() ?? ''}`;
}

async function inviteAtLogin(): Promise<void> {
  if (getQuietMode() || !authManager.isLinked()) return;

  const started = identity();
  let invitation: AtlasDiaryInvitation | null;
  try {
    invitation = await fetchDiaryInvitation();
  } catch (error) {
    log.warn('Could not load the diary invitation', error);
    return;
  }
  if (started !== identity()) return;

  const sessionLog = invitation?.sessionLog;
  const userId = currentUserId();
  if (!sessionLog || offered.has(sessionLog.id) || !shouldInvite(invitation, getDismissedDiaryInvitations(), userId)) return;

  offered.add(sessionLog.id);
  openInvitationPopup({
    sessionLog,
    onDismiss: () => {
      void setDismissedDiaryInvitations(addDismissed(getDismissedDiaryInvitations(), dismissKey(userId, sessionLog.id)));
    },
  });
}

/**
 * Asked by the notification popups before a window opens for an arriving notification. A new
 * session log turns into the invitation layout when a fresh fetch confirms the same log without a
 * diary entry; in every other case (other kind, fetch failed, route missing, other log, entry
 * exists) the normal layout opens, so there is never a second window.
 */
export async function resolveArrivalLayout(message: AtlasMessage): Promise<ArrivalLayout> {
  if (!isSessionLogArrival(message) || !message.documentId) return DEFAULT_LAYOUT;

  const started = identity();
  try {
    const invitation = await refreshDiaryInvitation();
    if (started !== identity()) return DEFAULT_LAYOUT;
    if (invitation?.sessionLog && invitation.sessionLog.id === message.documentId && !invitation.hasDiaryEntry) {
      offered.add(invitation.sessionLog.id);
      return { layout: 'invitation', sessionLog: invitation.sessionLog };
    }
  } catch (error) {
    log.warn('Could not check the diary invitation for a new session log', error);
  }
  return DEFAULT_LAYOUT;
}

/** Session reset: a new identity gets its own invitation again. */
export function clearDiaryInvitation(): void {
  offered.clear();
}

/** Only calls `Hooks.on`, so it belongs in `init`. */
export function registerDiaryInvitation(): void {
  Hooks.on('atlas-foundry.authChanged', (payload: { state: string }) => {
    if (payload.state === 'active') void inviteAtLogin();
  });
}
