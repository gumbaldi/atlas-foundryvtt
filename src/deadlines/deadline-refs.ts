/** The GM's picked documents: ids and module types only, never names (the setting is readable by every client). */
export interface DeadlineRef {
  documentId: string;
  moduleType: string;
}

export const MAX_DEADLINE_REFS = 50;

/** Pure, no Foundry globals: tolerant parse of the stored setting value. */
export function parseDeadlineRefs(raw: unknown): DeadlineRef[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const refs: DeadlineRef[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const { documentId, moduleType } = entry as Record<string, unknown>;
    if (typeof documentId !== 'string' || !documentId || typeof moduleType !== 'string' || !moduleType) continue;
    const key = `${moduleType}:${documentId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push({ documentId, moduleType });
    if (refs.length >= MAX_DEADLINE_REFS) break;
  }
  return refs;
}

/** `type:id,type:id` as the overview route expects it. */
export function refsToQuery(refs: DeadlineRef[]): string {
  return refs.map((ref) => `${ref.moduleType}:${ref.documentId}`).join(',');
}

/** Module types whose change can move a deadline: the account characters' own deadlines, and the deadline entries themselves. */
const DEADLINE_SOURCE_TYPES: ReadonlySet<string> = new Set(['characters', 'deadlines']);

/** Pure: does this document change possibly affect the Deadlines section? Any change to a GM-picked document counts. */
export function isDeadlineRelevantChange(change: { moduleType: string; documentId: string }, refs: DeadlineRef[]): boolean {
  if (DEADLINE_SOURCE_TYPES.has(change.moduleType)) return true;
  return refs.some((ref) => ref.moduleType === change.moduleType && ref.documentId === change.documentId);
}
