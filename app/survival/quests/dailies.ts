import { QuestDef } from "./definitions";
import {
  QuestSave,
  blankQuestSave,
  addQuestProgress,
  claimQuest,
} from "./tracker";

const STORAGE_KEY = "dungeon-legends-dailies";
const SAVE_VERSION = 1;

// Repeatable pool — 3 are picked per calendar day (local time).
export const DAILY_POOL: QuestDef[] = [
  {
    id: "daily-slayer",
    title: "Daily Slayer",
    hint: "Defeat 15 enemies of any kind.",
    target: 15,
    rewardGold: 150,
    rewardXp: 60,
  },
  {
    id: "daily-looter",
    title: "Daily Looter",
    hint: "Pick up 8 loot drops.",
    target: 8,
    rewardGold: 120,
    rewardXp: 50,
  },
  {
    id: "daily-caster",
    title: "Daily Caster",
    hint: "Cast 12 skills (dodge, clones, spin, flash).",
    target: 12,
    rewardGold: 150,
    rewardXp: 60,
  },
  {
    id: "daily-walker",
    title: "Daily Patrol",
    hint: "Travel 2000 units through the dungeon.",
    target: 2000,
    rewardGold: 100,
    rewardXp: 40,
  },
  {
    id: "daily-slimes",
    title: "Slime Season",
    hint: "Defeat 10 slimes.",
    target: 10,
    rewardGold: 120,
    rewardXp: 50,
  },
];

export type DailySave = {
  version: number;
  /** Local calendar day, e.g. "2026-9-20". */
  dateKey: string;
  save: QuestSave;
};

export function todayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic pick of 3 distinct daily ids for a date key. */
export function pickDailyIds(dateKey: string, count = 3): string[] {
  let seed = hashStr(`dungeon-legends-dailies:${dateKey}`);
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
  const pool = DAILY_POOL.map((q) => q.id);
  const picked: string[] = [];
  while (picked.length < Math.min(count, pool.length)) {
    const id = pool[Math.floor(rand() * pool.length)];
    if (!picked.includes(id)) picked.push(id);
  }
  return picked;
}

export function blankDailySave(dateKey: string = todayKey()): DailySave {
  return { version: SAVE_VERSION, dateKey, save: blankQuestSave() };
}

export function loadDailySave(): DailySave {
  const today = todayKey();
  if (typeof window === "undefined") return blankDailySave(today);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return blankDailySave(today);
    const parsed = JSON.parse(raw) as Partial<DailySave>;
    if (parsed?.version !== SAVE_VERSION || typeof parsed?.dateKey !== "string") {
      return blankDailySave(today);
    }
    if (parsed.dateKey !== today) return blankDailySave(today);
    const save = parsed.save;
    return {
      version: SAVE_VERSION,
      dateKey: today,
      save: {
        version: SAVE_VERSION,
        completedIds: Array.isArray(save?.completedIds) ? save.completedIds.filter((id): id is string => typeof id === "string") : [],
        claimedIds: Array.isArray(save?.claimedIds) ? save.claimedIds.filter((id): id is string => typeof id === "string") : [],
        counts: typeof save?.counts === "object" && save?.counts !== null ? (save.counts as Record<string, number>) : {},
      },
    };
  } catch {
    return blankDailySave(today);
  }
}

export function saveDailySave(daily: DailySave) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...daily, version: SAVE_VERSION }));
  } catch {
    // ignore (private mode / no storage)
  }
}

/** Rollover guard for long sessions crossing midnight. */
export function ensureToday(prev: DailySave): DailySave {
  return prev.dateKey === todayKey() ? prev : blankDailySave(todayKey());
}

export function addDailyProgress(
  daily: DailySave,
  id: string,
  amount: number
): { next: DailySave; completedNow: string[] } {
  const current = ensureToday(daily);
  const { next, completedNow } = addQuestProgress(current.save, id, amount, DAILY_POOL);
  return { next: { ...current, save: next }, completedNow };
}

export function claimDaily(daily: DailySave, id: string): DailySave {
  return { ...ensureToday(daily), save: claimQuest(ensureToday(daily).save, id) };
}

export function dailyById(id: string): QuestDef | undefined {
  return DAILY_POOL.find((q) => q.id === id);
}
