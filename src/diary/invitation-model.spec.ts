import { describe, expect, it } from 'vitest';
import type { AtlasMessage } from '../atlas-types';
import {
  addDismissed,
  dismissKey,
  formatInWorldDate,
  formatRealDate,
  isSessionLogArrival,
  MAX_DISMISSED,
  shouldInvite,
  unreadSessionLogMessageIds,
} from './invitation-model';

const LOG = { id: 'log-1', name: 'Into the Fog', sessionNumber: 12 };

describe('dismissKey', () => {
  it('joins the Foundry user id and the log id', () => {
    expect(dismissKey('u1', 'log-1')).toBe('u1:log-1');
  });
});

describe('shouldInvite', () => {
  it('is true for a log without a diary entry that was not dismissed', () => {
    expect(shouldInvite({ sessionLog: LOG, hasDiaryEntry: false }, [], 'u1')).toBe(true);
  });

  it('is false without a session log', () => {
    expect(shouldInvite({ sessionLog: null, hasDiaryEntry: false }, [], 'u1')).toBe(false);
    expect(shouldInvite(null, [], 'u1')).toBe(false);
  });

  it('is false when a diary entry exists', () => {
    expect(shouldInvite({ sessionLog: LOG, hasDiaryEntry: true }, [], 'u1')).toBe(false);
  });

  it('is false for a dismissed log of this user only', () => {
    const invitation = { sessionLog: LOG, hasDiaryEntry: false };
    expect(shouldInvite(invitation, ['u1:log-1'], 'u1')).toBe(false);
    expect(shouldInvite(invitation, ['u2:log-1'], 'u1')).toBe(true);
    expect(shouldInvite(invitation, ['u1:log-0'], 'u1')).toBe(true);
  });
});

describe('addDismissed', () => {
  it('appends a key', () => {
    expect(addDismissed(['a'], 'b')).toEqual(['a', 'b']);
  });

  it('ignores duplicates', () => {
    expect(addDismissed(['a', 'b'], 'a')).toEqual(['a', 'b']);
  });

  it('drops the oldest entries past the limit', () => {
    const full = Array.from({ length: MAX_DISMISSED }, (_, i) => `k${i}`);
    const next = addDismissed(full, 'new');
    expect(next).toHaveLength(MAX_DISMISSED);
    expect(next[0]).toBe('k1');
    expect(next.at(-1)).toBe('new');
  });

  it('does not mutate its input', () => {
    const list = ['a'];
    addDismissed(list, 'b');
    expect(list).toEqual(['a']);
  });
});

describe('formatInWorldDate', () => {
  it('writes day.month.year with the calendar in brackets', () => {
    expect(formatInWorldDate({ year: 1492, month: 3, day: 7 }, 'Calendar')).toBe('7.3.1492 (Calendar)');
  });

  it('has no suffix without a calendar', () => {
    expect(formatInWorldDate({ year: 1492, month: 3, day: 7 })).toBe('7.3.1492');
  });

  it('is empty without a day', () => {
    expect(formatInWorldDate(undefined, 'Calendar')).toBe('');
  });
});

describe('formatRealDate', () => {
  it('formats a valid ISO date', () => {
    const text = formatRealDate('2026-11-14', 'en');
    expect(text).toContain('2026');
    expect(text).toContain('14');
  });

  it('returns an empty string for garbage or nothing', () => {
    expect(formatRealDate('garbage', 'en')).toBe('');
    expect(formatRealDate('', 'en')).toBe('');
    expect(formatRealDate(undefined, 'en')).toBe('');
  });
});

describe('isSessionLogArrival', () => {
  it('matches only a new session-log document notification', () => {
    expect(isSessionLogArrival({ kind: 'document-new', documentModuleType: 'session-logs' })).toBe(true);
    expect(isSessionLogArrival({ kind: 'document-updated', documentModuleType: 'session-logs' })).toBe(false);
    expect(isSessionLogArrival({ kind: 'document-new', documentModuleType: 'locations' })).toBe(false);
  });
});

describe('unreadSessionLogMessageIds', () => {
  it('lists the unread document-new messages of that log', () => {
    const items: Pick<AtlasMessage, 'id' | 'kind' | 'documentId' | 'isRead'>[] = [
      { id: 'm1', kind: 'document-new', documentId: 'log-1', isRead: false },
      { id: 'm2', kind: 'document-new', documentId: 'log-1', isRead: true },
      { id: 'm3', kind: 'document-new', documentId: 'log-2', isRead: false },
      { id: 'm4', kind: 'document-updated', documentId: 'log-1', isRead: false },
    ];
    expect(unreadSessionLogMessageIds(items, 'log-1')).toEqual(['m1']);
  });
});
