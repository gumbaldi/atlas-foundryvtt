import type { AtlasDeadlineEntry, AtlasDeadlineGroup, AtlasDeadlineOverview } from '../atlas-types';
import { describeDeadline } from '../render/deadline-line';
import { formatDocumentTitle } from '../render/document-title';

export interface DeadlineRow {
  id: string;
  name: string;
  imageUrl?: string;
  remainingKey: string | null;
  remainingCount: number | null;
  overdue: boolean;
}

export interface DeadlineGroup {
  source: AtlasDeadlineGroup['source'];
  document: { id: string; moduleType: string; title: string; imageUrl?: string; customModuleId?: string };
  rows: DeadlineRow[];
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

function isRunning(entry: AtlasDeadlineEntry): boolean {
  return entry.deadlineState === 'upcoming' || entry.deadlineState === 'due';
}

function compareEntries(a: AtlasDeadlineEntry, b: AtlasDeadlineEntry): number {
  const da = typeof a.daysRemaining === 'number' ? a.daysRemaining : null;
  const db = typeof b.daysRemaining === 'number' ? b.daysRemaining : null;
  if (da !== db) {
    if (da === null) return 1;
    if (db === null) return -1;
    return da - db;
  }
  return collator.compare(a.name, b.name);
}

function toRow(entry: AtlasDeadlineEntry): DeadlineRow {
  const line = describeDeadline(entry);
  const row: DeadlineRow = {
    id: entry.id,
    name: entry.name,
    remainingKey: line?.remainingKey ?? null,
    remainingCount: line?.remainingCount ?? null,
    overdue: typeof entry.daysRemaining === 'number' && entry.daysRemaining < 0,
  };
  if (entry.imageUrl) row.imageUrl = entry.imageUrl;
  return row;
}

/**
 * Pure view model of the deadlines overview: running deadlines only, one group per document
 * (own characters first, then the GM's picks), deadlines by due date with overdue first.
 */
export function buildDeadlineGroups(overview: AtlasDeadlineOverview | null): DeadlineGroup[] {
  if (!overview) return [];

  const groups: DeadlineGroup[] = [];
  for (const source of ['account-character', 'selected'] as const) {
    for (const group of overview.groups) {
      if (group.source !== source) continue;
      const running = group.deadlines.filter(isRunning);
      if (running.length === 0) continue;
      groups.push({
        source,
        document: {
          id: group.document.id,
          moduleType: group.document.moduleType,
          title: formatDocumentTitle(group.document.moduleType, group.document.name, group.document.sessionNumber),
          ...(group.document.imageUrl ? { imageUrl: group.document.imageUrl } : {}),
          ...(group.document.customModuleId ? { customModuleId: group.document.customModuleId } : {}),
        },
        rows: [...running].sort(compareEntries).map(toRow),
      });
    }
  }

  // A document that is both an own character and a GM pick shows once, as the own character.
  const seen = new Set<string>();
  const unique = groups.filter((g) => {
    const key = `${g.document.moduleType}:${g.document.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const rank = (g: DeadlineGroup) => (g.source === 'account-character' ? 0 : 1);
  return unique.sort((a, b) => rank(a) - rank(b) || collator.compare(a.document.title, b.document.title));
}

export function countDeadlines(groups: DeadlineGroup[]): number {
  return groups.reduce((sum, g) => sum + g.rows.length, 0);
}
