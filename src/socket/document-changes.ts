import { DocumentChangeSchema, type DocumentChange } from '../atlas-types';

/** Socket event name the Atlas backend emits for every document change it may show to this user (see docs/SOCKET-EVENTS.md). */
export const DOCUMENT_CHANGED_EVENT = 'document:changed';

/** Pure, no Foundry globals: returns the typed change, or null for anything malformed (never trusted blindly). */
export function parseDocumentChange(payload: unknown): DocumentChange | null {
  const parsed = DocumentChangeSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}
