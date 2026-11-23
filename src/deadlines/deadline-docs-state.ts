import { MAX_DEADLINE_REFS, type DeadlineRef } from './deadline-refs';

export interface AddRefResult {
  list: DeadlineRef[];
  status: 'added' | 'duplicate' | 'limit';
}

const same = (a: DeadlineRef, b: DeadlineRef): boolean => a.documentId === b.documentId && a.moduleType === b.moduleType;

/** Pure: appends `ref` unless it is already there or the list is full. */
export function addRef(list: DeadlineRef[], ref: DeadlineRef): AddRefResult {
  if (list.some((entry) => same(entry, ref))) return { list: [...list], status: 'duplicate' };
  if (list.length >= MAX_DEADLINE_REFS) return { list: [...list], status: 'limit' };
  return { list: [...list, { documentId: ref.documentId, moduleType: ref.moduleType }], status: 'added' };
}

/** Pure: drops exactly that entry; a missing one leaves the list unchanged. */
export function removeRef(list: DeadlineRef[], ref: DeadlineRef): DeadlineRef[] {
  return list.filter((entry) => !same(entry, ref));
}
