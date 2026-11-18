import type { AtlasQuest } from '../atlas-types';

/** How many quest cards the tracker shows at once. */
export const MAX_TRACKED_QUESTS = 3;

function time(quest: AtlasQuest): number {
  return Date.parse(quest.updatedAt) || 0;
}

/**
 * Every quest the tracker is responsible for, newest first where pins decide.
 * Once any open quest carries `isPinned` (true or false) the backend knows
 * pins, so only pinned open quests count — none pinned means none shown. A
 * backend that does not send the field at all falls back to the open
 * top-level quests in list order. Pure, no Foundry globals.
 */
function trackedCandidates(quests: AtlasQuest[]): AtlasQuest[] {
  const open = quests.filter((q) => q.status === 'open');
  if (open.some((q) => q.isPinned !== undefined)) {
    return open.filter((q) => q.isPinned === true).sort((a, b) => time(b) - time(a));
  }
  return open.filter((q) => !q.parentId);
}

export function selectTrackedQuests(quests: AtlasQuest[], max = MAX_TRACKED_QUESTS): AtlasQuest[] {
  return trackedCandidates(quests).slice(0, max);
}

/** All quests the selection rule covers, uncapped: drives the collapsed pill and the "+N more" line. */
export function countTrackedQuests(quests: AtlasQuest[]): number {
  return trackedCandidates(quests).length;
}
