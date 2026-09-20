export type QuestDef = {
  id: string;
  title: string;
  hint: string;
  /** Progress units needed to complete. */
  target: number;
  rewardGold: number;
  rewardXp: number;
};

// One-time beginner chain, ordered for a bare-fists fresh start.
export const BEGINNER_QUESTS: QuestDef[] = [
  {
    id: "first-steps",
    title: "First Steps",
    hint: "Move around the dungeon (WASD / arrows).",
    target: 300,
    rewardGold: 20,
    rewardXp: 10,
  },
  {
    id: "first-blood",
    title: "First Blood",
    hint: "Defeat 3 slimes with clicks / spin.",
    target: 3,
    rewardGold: 40,
    rewardXp: 20,
  },
  {
    id: "scavenger",
    title: "Scavenger",
    hint: "Pick up 3 loot drops (E).",
    target: 3,
    rewardGold: 40,
    rewardXp: 20,
  },
  {
    id: "armed",
    title: "Armed",
    hint: "Equip any gear from the bag.",
    target: 1,
    rewardGold: 60,
    rewardXp: 25,
  },
  {
    id: "stronger",
    title: "Stronger",
    hint: "Spend 1 skill point (bag STATUS tab).",
    target: 1,
    rewardGold: 60,
    rewardXp: 25,
  },
  {
    id: "dragonkeeper",
    title: "Dragonkeeper",
    hint: "Hatch 1 dragon egg at the incubator (V).",
    target: 1,
    rewardGold: 80,
    rewardXp: 40,
  },
];

export const questById = (id: string) => BEGINNER_QUESTS.find((q) => q.id === id);
