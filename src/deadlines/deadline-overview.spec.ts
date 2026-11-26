import { describe, expect, it } from 'vitest';
import type { AtlasDeadlineEntry, AtlasDeadlineGroup, AtlasDeadlineOverview } from '../atlas-types';
import { buildDeadlineGroups, countDeadlines } from './deadline-overview';

function entry(over: Partial<AtlasDeadlineEntry> & { id: string }): AtlasDeadlineEntry {
  return { name: over.id, deadlineState: 'upcoming', ...over };
}

function group(over: Partial<AtlasDeadlineGroup> & { id: string; deadlines: AtlasDeadlineEntry[] }): AtlasDeadlineGroup {
  const { id, ...rest } = over;
  return {
    source: 'account-character',
    document: { id, moduleType: 'characters', name: id },
    ...rest,
  };
}

const overview = (groups: AtlasDeadlineGroup[]): AtlasDeadlineOverview => ({ groups });

describe('buildDeadlineGroups', () => {
  it('returns [] for null', () => {
    expect(buildDeadlineGroups(null)).toEqual([]);
  });

  it('drops deadlines whose state is not upcoming or due', () => {
    const result = buildDeadlineGroups(
      overview([
        group({
          id: 'g',
          deadlines: [
            entry({ id: 'a', deadlineState: 'upcoming' }),
            entry({ id: 'b', deadlineState: 'due' }),
            entry({ id: 'c', deadlineState: 'kept' }),
            entry({ id: 'd', deadlineState: 'archived' }),
          ],
        }),
      ]),
    );
    expect(result[0]?.rows.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('drops a group left with no deadline', () => {
    const result = buildDeadlineGroups(
      overview([
        group({ id: 'empty', deadlines: [entry({ id: 'x', deadlineState: 'kept' })] }),
        group({ id: 'none', deadlines: [] }),
        group({ id: 'ok', deadlines: [entry({ id: 'y' })] }),
      ]),
    );
    expect(result.map((g) => g.document.id)).toEqual(['ok']);
  });

  it('lists a document that is both account-character and selected once, as account-character', () => {
    const result = buildDeadlineGroups(
      overview([
        group({ id: 'same', source: 'selected', deadlines: [entry({ id: 'sel' })] }),
        group({ id: 'same', source: 'account-character', deadlines: [entry({ id: 'acc' })] }),
      ]),
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.source).toBe('account-character');
    expect(result[0]?.rows.map((r) => r.id)).toEqual(['acc']);
  });

  it('sorts account-character first, then selected, each alphabetical (case-insensitive, numeric-aware)', () => {
    const result = buildDeadlineGroups(
      overview([
        group({ id: 's1', source: 'selected', document: { id: 's1', moduleType: 'locations', name: 'zeta' }, deadlines: [entry({ id: 'a' })] }),
        group({ id: 'a1', document: { id: 'a1', moduleType: 'characters', name: 'beta' }, deadlines: [entry({ id: 'b' })] }),
        group({ id: 's2', source: 'selected', document: { id: 's2', moduleType: 'locations', name: 'Alpha' }, deadlines: [entry({ id: 'c' })] }),
        group({ id: 'a2', document: { id: 'a2', moduleType: 'characters', name: 'Alpha 10' }, deadlines: [entry({ id: 'd' })] }),
        group({ id: 'a3', document: { id: 'a3', moduleType: 'characters', name: 'alpha 9' }, deadlines: [entry({ id: 'e' })] }),
      ]),
    );
    expect(result.map((g) => g.document.id)).toEqual(['a3', 'a2', 'a1', 's2', 's1']);
  });

  it('formats session log titles', () => {
    const result = buildDeadlineGroups(
      overview([
        group({
          id: 'log',
          document: { id: 'log', moduleType: 'session-logs', name: 'The Crossing', sessionNumber: 12 },
          deadlines: [entry({ id: 'a' })],
        }),
      ]),
    );
    expect(result[0]?.document.title).toBe('#12 - The Crossing');
  });

  it('carries imageUrl and customModuleId of the document', () => {
    const result = buildDeadlineGroups(
      overview([
        group({
          id: 'c',
          document: { id: 'c', moduleType: 'custom', name: 'C', imageUrl: '/i.png', customModuleId: 'cm1' },
          deadlines: [entry({ id: 'a' })],
        }),
      ]),
    );
    expect(result[0]?.document).toEqual({ id: 'c', moduleType: 'custom', title: 'C', imageUrl: '/i.png', customModuleId: 'cm1' });
  });

  it('sorts deadlines by daysRemaining ascending, null/missing last, ties alphabetical', () => {
    const result = buildDeadlineGroups(
      overview([
        group({
          id: 'g',
          deadlines: [
            entry({ id: 'none', name: 'A none' }),
            entry({ id: 'nul', name: 'B null', daysRemaining: null }),
            entry({ id: 'later', name: 'Later', daysRemaining: 10 }),
            entry({ id: 'tieB', name: 'Bravo', daysRemaining: 3 }),
            entry({ id: 'tieA', name: 'alpha', daysRemaining: 3 }),
            entry({ id: 'over', name: 'Over', daysRemaining: -5, deadlineState: 'due' }),
          ],
        }),
      ]),
    );
    expect(result[0]?.rows.map((r) => r.id)).toEqual(['over', 'tieA', 'tieB', 'later', 'none', 'nul']);
  });

  it('carries remaining text keys and the overdue flag', () => {
    const result = buildDeadlineGroups(
      overview([
        group({
          id: 'g',
          deadlines: [
            entry({ id: 'over', daysRemaining: -2, deadlineState: 'due', imageUrl: '/d.png', name: 'Over' }),
            entry({ id: 'soon', daysRemaining: 1 }),
            entry({ id: 'unknown', daysRemaining: null }),
          ],
        }),
      ]),
    );
    const [over, soon, unknown] = result[0]?.rows ?? [];
    expect(over).toEqual({
      id: 'over',
      name: 'Over',
      imageUrl: '/d.png',
      remainingKey: 'ATLASFOUNDRY.Viewer.Deadline.Remaining.DaysOverdue',
      remainingCount: 2,
      overdue: true,
    });
    expect(soon?.remainingKey).toBe('ATLASFOUNDRY.Viewer.Deadline.Remaining.InDay');
    expect(soon?.remainingCount).toBe(1);
    expect(soon?.overdue).toBe(false);
    expect(unknown?.remainingKey).toBeNull();
    expect(unknown?.remainingCount).toBeNull();
    expect(unknown?.overdue).toBe(false);
  });
});

describe('countDeadlines', () => {
  it('sums the rows of all groups', () => {
    const groups = buildDeadlineGroups(
      overview([
        group({ id: 'a', deadlines: [entry({ id: '1' }), entry({ id: '2' })] }),
        group({ id: 'b', source: 'selected', deadlines: [entry({ id: '3' })] }),
      ]),
    );
    expect(countDeadlines(groups)).toBe(3);
    expect(countDeadlines([])).toBe(0);
  });
});
