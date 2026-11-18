import type { AtlasDocumentDetail } from '../atlas-types';

const KEY = 'ATLASFOUNDRY.Viewer.Deadline';

export interface DeadlineLine {
  /** i18n key of the state label; `null` when the backend sent no state. */
  stateKey: string | null;
  /** `<day>.<month>.<year>` plus ` (<calendar>)` when known; `null` without a due day. */
  dueText: string | null;
  /** i18n key of the days-left phrase, with `remainingCount` as `{count}`; `null` for none. */
  remainingKey: string | null;
  remainingCount: number | null;
}

type DeadlineFields = Pick<AtlasDocumentDetail, 'deadlineState' | 'dueDate' | 'daysRemaining' | 'calendarName'>;

/**
 * Pure view model of the viewer's deadline line (no Foundry globals). Returns `null` for a
 * document with no deadline field at all, e.g. any document from a backend that predates them.
 */
export function describeDeadline(doc: DeadlineFields): DeadlineLine | null {
  const { deadlineState, dueDate, daysRemaining, calendarName } = doc;
  if (!deadlineState && !dueDate) return null;

  const dueText = dueDate
    ? `${dueDate.day}.${dueDate.month}.${dueDate.year}${calendarName ? ` (${calendarName})` : ''}`
    : null;

  // Kept and archived deadlines have nothing left to count down.
  let remainingKey: string | null = null;
  let remainingCount: number | null = null;
  if (typeof daysRemaining === 'number' && deadlineState !== 'kept' && deadlineState !== 'archived') {
    remainingCount = Math.abs(daysRemaining);
    if (daysRemaining === 0) remainingKey = `${KEY}.Remaining.Today`;
    else if (daysRemaining > 0) remainingKey = `${KEY}.Remaining.${daysRemaining === 1 ? 'InDay' : 'InDays'}`;
    else remainingKey = `${KEY}.Remaining.${daysRemaining === -1 ? 'DayOverdue' : 'DaysOverdue'}`;
  }

  return {
    stateKey: deadlineState ? `${KEY}.State.${deadlineState}` : null,
    dueText,
    remainingKey,
    remainingCount,
  };
}
