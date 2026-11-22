/**
 * Display title of an Atlas document. Session logs always start with their number
 * ("#12 - Title"), everything else keeps its name. The number comes from the
 * backend's `sessionNumber`; Kanka imports often lack it and carry it in the name
 * instead ("Session 19 - Title"), so a leading "#19" / "Session 19" is read from
 * the name and rewritten. Idempotent: an already formatted title stays as it is.
 * Pure, no Foundry globals.
 */

const SESSION_LOGS = 'session-logs';
const NUMBERED_NAME = /^\s*(?:#|session\s+)(\d+)\s*(?:[-–—:.]\s*(.*))?$/i;

export function formatDocumentTitle(moduleType: string, name: string, sessionNumber?: number | null): string {
  if (moduleType !== SESSION_LOGS) return name;

  const match = NUMBERED_NAME.exec(name);
  const number = typeof sessionNumber === 'number' ? sessionNumber : match ? Number(match[1]) : null;
  if (number === null) return name;

  const title = (match ? (match[2] ?? '') : name).trim();
  return title ? `#${number} - ${title}` : `#${number}`;
}
