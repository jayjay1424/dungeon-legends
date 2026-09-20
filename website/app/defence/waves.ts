import { DefenceWaveKind } from "../survival/arena/types";

export type DefenceWave = {
  no: number;
  groups: { kind: DefenceWaveKind; count: number }[];
  rewardGold: number;
};

export const INTERMISSION_MS = 15_000;
export const BASE_MAX_HP = 800;
export const VICTORY_BONUS_GOLD = 1000;
export const MILESTONE_BONUS_GOLD = 500;

const ENDLESS_KINDS: DefenceWaveKind[] = [
  "slime",
  "bloodMonster",
  "goblinBeast",
  "goblinRider",
  "skeleton",
  "skeletonBow",
  "vampire",
  "demon",
  "necromancer",
  "skeletonKing",
];

/** Waves past 10: generated, ever harder — counts grow, kings every 5th. */
export function endlessWave(no: number): DefenceWave {
  const groups = [0, 1, 2].map((slot) => ({
    kind: ENDLESS_KINDS[(no + slot * 3) % ENDLESS_KINDS.length],
    count: 6 + Math.floor(no * 1.5) + slot * 2,
  }));
  if (no % 5 === 0) {
    groups.push({ kind: "skeletonKing", count: Math.floor(no / 10) });
  }
  return { no, groups, rewardGold: 80 * no };
}

export function waveFor(no: number): DefenceWave {
  return no <= DEFENCE_WAVES.length ? DEFENCE_WAVES[no - 1] : endlessWave(no);
}

const wave = (
  no: number,
  groups: { kind: DefenceWaveKind; count: number }[]
): DefenceWave => ({
  no,
  groups,
  rewardGold: 80 * no,
});

export const DEFENCE_WAVES: DefenceWave[] = [
  wave(1, [{ kind: "slime", count: 6 }]),
  wave(2, [
    { kind: "slime", count: 8 },
    { kind: "bloodMonster", count: 4 },
  ]),
  wave(3, [
    { kind: "bloodMonster", count: 8 },
    { kind: "goblinBeast", count: 4 },
  ]),
  wave(4, [
    { kind: "goblinBeast", count: 8 },
    { kind: "goblinRider", count: 4 },
    { kind: "skeleton", count: 6 },
  ]),
  wave(5, [
    { kind: "skeleton", count: 10 },
    { kind: "skeletonBow", count: 6 },
    { kind: "vampire", count: 4 },
  ]),
  wave(6, [
    { kind: "vampire", count: 8 },
    { kind: "demon", count: 6 },
  ]),
  wave(7, [
    { kind: "demon", count: 10 },
    { kind: "necromancer", count: 3 },
  ]),
  wave(8, [
    { kind: "goblinRider", count: 8 },
    { kind: "necromancer", count: 5 },
    { kind: "vampire", count: 6 },
  ]),
  wave(9, [
    { kind: "demon", count: 10 },
    { kind: "skeletonKing", count: 1 },
  ]),
  wave(10, [
    { kind: "skeletonKing", count: 2 },
    { kind: "necromancer", count: 6 },
    { kind: "vampire", count: 8 },
  ]),
];
