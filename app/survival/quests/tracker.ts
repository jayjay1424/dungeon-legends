import { BEGINNER_QUESTS, QuestDef } from "./definitions";

const STORAGE_KEY = "dungeon-legends-quests";
const SAVE_VERSION = 1;

export type QuestSave = {
  version: number;
  /** Quest ids that hit their target (reward not necessarily claimed). */
  completedIds: string[];
  /** Quest ids whose reward was claimed. */
  claimedIds: string[];
  /** Raw progress counters per quest id. */
  counts: Record<string, number>;
};

const EMPTY: QuestSave = { version: SAVE_VERSION, completedIds: [], claimedIds: [], counts: {} };

export function blankQuestSave(): QuestSave {
  return { version: SAVE_VERSION, completedIds: [], claimedIds: [], counts: {} };
}

export function loadQuestSave(storageKey: string = STORAGE_KEY): QuestSave {
  if (typeof window === "undefined") return blankQuestSave();
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return blankQuestSave();
    const parsed = JSON.parse(raw) as Partial<QuestSave>;
    if (parsed?.version !== SAVE_VERSION) return blankQuestSave();
    return {
      version: SAVE_VERSION,
      completedIds: Array.isArray(parsed.completedIds) ? parsed.completedIds.filter((id): id is string => typeof id === "string") : [],
      claimedIds: Array.isArray(parsed.claimedIds) ? parsed.claimedIds.filter((id): id is string => typeof id === "string") : [],
      counts: typeof parsed.counts === "object" && parsed.counts !== null ? parsed.counts as Record<string, number> : {},
    };
  } catch {
    return blankQuestSave();
  }
}

export function saveQuestSave(save: QuestSave, storageKey: string = STORAGE_KEY) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify({ ...save, version: SAVE_VERSION }));
  } catch {
    // ignore (private mode / no storage)
  }
}

/** Add progress; returns the updated save plus ids that just completed. */
export function addQuestProgress(
  save: QuestSave,
  id: string,
  amount: number,
  defs: QuestDef[] = BEGINNER_QUESTS
): { next: QuestSave; completedNow: string[] } {
  const def = defs.find((q) => q.id === id);
  if (!def || amount <= 0) return { next: save, completedNow: [] };
  if (save.completedIds.includes(id)) return { next: save, completedNow: [] };
  const counts = { ...save.counts, [id]: Math.min(def.target, (save.counts[id] ?? 0) + amount) };
  if (counts[id] < def.target) return { next: { ...save, counts }, completedNow: [] };
  return {
    next: { ...save, counts, completedIds: [...save.completedIds, id] },
    completedNow: [id],
  };
}

export function claimQuest(save: QuestSave, id: string): QuestSave {
  if (!save.completedIds.includes(id) || save.claimedIds.includes(id)) return save;
  return { ...save, claimedIds: [...save.claimedIds, id] };
}
