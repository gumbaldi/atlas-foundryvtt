import type { AtlasDiaryInvitation, AtlasMessage, DeadlineDay } from '../atlas-types';

/** Pure helpers of the diary invitation; no Foundry globals. */

export const MAX_DISMISSED = 50;

export function dismissKey(userId: string, logId: string): string {
  return `${userId}:${logId}`;
}

export function shouldInvite(invitation: AtlasDiaryInvitation | null, dismissed: string[], userId: string): boolean {
  if (!invitation?.sessionLog || invitation.hasDiaryEntry) return false;
  return !dismissed.includes(dismissKey(userId, invitation.sessionLog.id));
}

/** Appends `key` (a duplicate changes nothing) and drops the oldest entries past the limit. */
export function addDismissed(list: string[], key: string): string[] {
  if (list.includes(key)) return [...list];
  return [...list, key].slice(-MAX_DISMISSED);
}

/** `7.3.1492 (Calendar)`; the calendar suffix is left out when unknown, the whole text without a day. */
export function formatInWorldDate(day: DeadlineDay | undefined, calendarName?: string): string {
  if (!day) return '';
  const text = `${day.day}.${day.month}.${day.year}`;
  return calendarName ? `${text} (${calendarName})` : text;
}

/** A calendar day in the given locale; an unparsable or missing value gives an empty string. */
export function formatRealDate(iso: string | undefined, locale: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  try {
    // UTC so a plain ISO date does not slip to the previous day in a western time zone.
    return new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(date);
  } catch {
    return '';
  }
}

/** True for the notification Atlas sends when a session log is published. */
export function isSessionLogArrival(message: Pick<AtlasMessage, 'kind' | 'documentModuleType'>): boolean {
  return message.kind === 'document-new' && message.documentModuleType === 'session-logs';
}

/** The unread "new session log" notifications of one log, so opening the log can acknowledge them. */
export function unreadSessionLogMessageIds(
  items: Pick<AtlasMessage, 'id' | 'kind' | 'documentId' | 'isRead'>[],
  logId: string,
): string[] {
  return items.filter((m) => m.kind === 'document-new' && m.documentId === logId && !m.isRead).map((m) => m.id);
}
