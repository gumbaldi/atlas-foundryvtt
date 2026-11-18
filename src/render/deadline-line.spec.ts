import { describe, expect, it } from 'vitest';
import { describeDeadline } from './deadline-line';

const P = 'ATLASFOUNDRY.Viewer.Deadline';

describe('describeDeadline', () => {
  it('describes an upcoming deadline with days left', () => {
    expect(
      describeDeadline({
        deadlineState: 'upcoming',
        daysRemaining: 3,
        dueDate: { year: 1492, month: 3, day: 7 },
      }),
    ).toEqual({
      stateKey: `${P}.State.upcoming`,
      dueText: '7.3.1492',
      remainingKey: `${P}.Remaining.InDays`,
      remainingCount: 3,
    });
  });

  it('uses the singular phrases for one day', () => {
    const base = { deadlineState: 'due', dueDate: { year: 1, month: 1, day: 1 } } as const;
    expect(describeDeadline({ ...base, daysRemaining: 1 })?.remainingKey).toBe(`${P}.Remaining.InDay`);
    expect(describeDeadline({ ...base, daysRemaining: -1 })?.remainingKey).toBe(`${P}.Remaining.DayOverdue`);
  });

  it('says "today" for zero days and counts overdue days positively', () => {
    const base = { deadlineState: 'due', dueDate: { year: 1492, month: 3, day: 7 } } as const;
    expect(describeDeadline({ ...base, daysRemaining: 0 })).toMatchObject({
      remainingKey: `${P}.Remaining.Today`,
      remainingCount: 0,
    });
    expect(describeDeadline({ ...base, daysRemaining: -2 })).toMatchObject({
      remainingKey: `${P}.Remaining.DaysOverdue`,
      remainingCount: 2,
    });
  });

  it('shows kept and archived deadlines without a remaining phrase', () => {
    for (const deadlineState of ['kept', 'archived'] as const) {
      expect(
        describeDeadline({ deadlineState, daysRemaining: 5, dueDate: { year: 1492, month: 3, day: 7 } }),
      ).toEqual({
        stateKey: `${P}.State.${deadlineState}`,
        dueText: '7.3.1492',
        remainingKey: null,
        remainingCount: null,
      });
    }
  });

  it('returns null for a document without any deadline field (old backend)', () => {
    expect(describeDeadline({})).toBeNull();
  });

  it('shows no remaining phrase when daysRemaining is null', () => {
    expect(
      describeDeadline({ deadlineState: 'upcoming', daysRemaining: null, dueDate: { year: 1492, month: 3, day: 7 } }),
    ).toMatchObject({ remainingKey: null, remainingCount: null });
  });

  it('appends the calendar name only when present', () => {
    const base = { deadlineState: 'upcoming', dueDate: { year: 1492, month: 3, day: 7 } } as const;
    expect(describeDeadline({ ...base, calendarName: 'Harptos' })?.dueText).toBe('7.3.1492 (Harptos)');
    expect(describeDeadline(base)?.dueText).toBe('7.3.1492');
  });
});
