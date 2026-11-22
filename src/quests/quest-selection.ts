import type { AtlasQuest } from '../atlas-types';

/** How many quest cards the tracker shows at once. */
export const MAX_TRACKED_QUESTS = 3;

function time(quest: AtlasQuest): number {
  return Date.parse(quest.updatedAt) || 0;
}

/**
 * Every quest the tracker is responsible for: only open quests the backend
 * marks as pinned, newest first. A quest without `isPinned: true` is never
 * shown, so a backend that sends no pins shows an empty tracker rather than
 * arbitrary quests. Pure, no Foundry globals.
 */
function trackedCandidates(quests: AtlasQuest[]): AtlasQuest[] {
  return quests.filter((q) => q.status === 'open' && q.isPinned === true).sort((a, b) => time(b) - time(a));
}

export function selectTrackedQuests(quests: AtlasQuest[], max = MAX_TRACKED_QUESTS): AtlasQuest[] {
  return trackedCandidates(quests).slice(0, max);
}

/** All quests the selection rule covers, uncapped: drives the collapsed pill and the "+N more" line. */
export function countTrackedQuests(quests: AtlasQuest[]): number {
  return trackedCandidates(quests).length;
}
