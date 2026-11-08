import { MODULE_ID } from '../constants';

/**
 * A link from a Foundry object to an Atlas document, stored as a Foundry
 * flag (see plan: flags are world-persisted, embedded in scene/actor data,
 * and synced to every client that can see the Foundry object).
 *
 * Privacy rule (plan step "data model: flags"): `nameSnapshot`/`label` are
 * visible to anyone who can see the Foundry object, regardless of Atlas
 * permissions — only `documentId`/`entry` content stays server-gated. Never
 * put real Atlas content here, only id/name/label.
 */
export interface AtlasLink {
  id: string;
  documentId: string;
  moduleType: string;
  label?: string;
  /** Atlas name at link-creation time — display fallback only, never re-derived from Atlas content. */
  nameSnapshot: string;
  createdAt: number;
}

export interface NewAtlasLink {
  documentId: string;
  moduleType: string;
  nameSnapshot: string;
  label?: string;
}

interface LinkFlagData {
  version: 1;
  items: AtlasLink[];
}

const FLAG_KEY = 'links';
const FLAG_VERSION = 1;

/** The common surface of every linkable Foundry document type (Scene, Actor, JournalEntry, Item, TokenDocument, Tile). */
export interface FlagCapableDocument {
  getFlag(scope: string, key: string): unknown;
  setFlag(scope: string, key: string, value: unknown): Promise<unknown>;
}

function isAtlasLink(value: unknown): value is AtlasLink {
  if (!value || typeof value !== 'object') return false;
  const link = value as Record<string, unknown>;
  return (
    typeof link.id === 'string' &&
    typeof link.documentId === 'string' &&
    typeof link.moduleType === 'string' &&
    typeof link.nameSnapshot === 'string' &&
    typeof link.createdAt === 'number' &&
    (link.label === undefined || typeof link.label === 'string')
  );
}

/**
 * Tolerates missing, foreign, or malformed flag data (unset flag, a future
 * incompatible version, hand-edited JSON) by treating it as "no links yet"
 * rather than throwing — this is read on every render of the scene bar/HUD.
 */
export function getLinks(doc: FlagCapableDocument): AtlasLink[] {
  const raw = doc.getFlag(MODULE_ID, FLAG_KEY) as Partial<LinkFlagData> | undefined;
  if (!raw || raw.version !== FLAG_VERSION || !Array.isArray(raw.items)) return [];
  return raw.items.filter(isAtlasLink);
}

async function writeLinks(doc: FlagCapableDocument, items: AtlasLink[]): Promise<void> {
  const data: LinkFlagData = { version: FLAG_VERSION, items };
  await doc.setFlag(MODULE_ID, FLAG_KEY, data);
}

export async function addLink(doc: FlagCapableDocument, link: NewAtlasLink): Promise<AtlasLink> {
  const label = link.label?.trim();
  const created: AtlasLink = {
    id: foundry.utils.randomID(),
    documentId: link.documentId,
    moduleType: link.moduleType,
    nameSnapshot: link.nameSnapshot,
    createdAt: Date.now(),
    ...(label ? { label } : {}),
  };
  await writeLinks(doc, [...getLinks(doc), created]);
  return created;
}

export async function updateLinkLabel(doc: FlagCapableDocument, linkId: string, label: string): Promise<void> {
  const trimmed = label.trim();
  const items = getLinks(doc).map((existing) => {
    if (existing.id !== linkId) return existing;
    const updated = { ...existing };
    if (trimmed) updated.label = trimmed;
    else delete updated.label;
    return updated;
  });
  await writeLinks(doc, items);
}

export async function removeLink(doc: FlagCapableDocument, linkId: string): Promise<void> {
  await writeLinks(doc, getLinks(doc).filter((existing) => existing.id !== linkId));
}
