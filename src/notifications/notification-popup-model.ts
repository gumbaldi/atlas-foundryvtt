import { formatDocumentTitle } from '../render/document-title';
import type { AtlasMessage } from '../atlas-types';

export type PopupLayout = 'text' | 'image';

/** Font Awesome icon per notification kind; unknown kinds fall back to a bell at the call site. */
export const KIND_ICONS: Record<string, string> = {
  'gm-announcement': 'fa-solid fa-bullhorn',
  'document-new': 'fa-solid fa-file-circle-plus',
  'document-updated': 'fa-solid fa-file-pen',
  'document-media': 'fa-solid fa-photo-film',
  'support-ticket': 'fa-solid fa-life-ring',
  'diary-invite': 'fa-solid fa-book-bookmark',
  'diary-entry': 'fa-solid fa-book',
  'agent-content': 'fa-solid fa-robot',
};

export const POPUP_MAX_OPEN = 3;
const CASCADE_STEP_PX = 30;

/** `imageSrc` is the already sanitized picture URL (empty when absent or unsafe). */
export function popupLayout(message: Pick<AtlasMessage, 'kind'>, imageSrc: string): PopupLayout {
  return message.kind === 'document-media' && imageSrc ? 'image' : 'text';
}

export function popupTitle(message: Pick<AtlasMessage, 'subject' | 'documentName' | 'documentModuleType'>, fallback: string): string {
  if (message.subject) return message.subject;
  if (message.documentName) return formatDocumentTitle(message.documentModuleType ?? '', message.documentName);
  return fallback;
}

/** Plain text only; the HTML `body` is never shown here. */
export function popupBody(message: Pick<AtlasMessage, 'bodyPlainText'>): string {
  return message.bodyPlainText ?? '';
}

export function canOpenAnother(openCount: number, max: number = POPUP_MAX_OPEN): boolean {
  return openCount < max;
}

export function cascadeOffset(index: number): number {
  return index * CASCADE_STEP_PX;
}
