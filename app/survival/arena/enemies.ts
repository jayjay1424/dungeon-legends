// arena/enemies.ts
import {
  Enemy,
  Clone,
  Warrior,
  BmAnim,
  VampireAnim,
  SkeletonAnim,
  WarriorDir,
  BmCorpse,
  SkCorpse,
  NecroAnim,
  NecroCorpse,
  SkeletonKingAnim,
  SkKingCorpse,
} from "./types";
import {
  renderHpLabel,
  Z_BASE,
  VILLAGE_BASE_CENTER,
  VILLAGE_TREE_WALL_INNER_RADIUS,
  resolveTreeCollisions,
  resolveCloneCollisions,
  resolveKnightCollisions,
} from "./world";
import { playEnemyAttackSound } from "../audio";
import { damageClone } from "./clones";
import { damageWarrior } from "./warriors";
import styles from "../survival.module.css";

// --- Slimes ---------------------------------------------------------------
export const SLIME_FRAME_SIZE = 32;
export const SLIME_SHEET_SIZE = 192;
export const SLIME_SCALE = 2;
export const SLIME_DISPLAY = SLIME_FRAME_SIZE * SLIME_SCALE;
export const SLIME_SHEET_PX = SLIME_SHEET_SIZE * SLIME_SCALE;
export const SLIME_COLS = 6;
export const SLIME_COLOR_ROWS = 3;
export const SLIME_ANIM_MS = 140;
export const SLIME_ROW_SCALE = [1, 1, 1] as const;

export function slimeScaleForRow(colorRow: number): number {
  return SLIME_ROW_SCALE[Math.max(0, Math.min(SLIME_COLOR_ROWS - 1, colorRow))];
}

export function slimeDisplayForRow(colorRow: number): number {
  return SLIME_DISPLAY * slimeScaleForRow(colorRow);
}

export const MONSTER_STAGE_BASE_SPAWN_DISTANCE = 422;
export const MONSTER_STAGE_DISTANCE_MULTIPLIER = 3;

export const MONSTER_STAGE_ORDER = [
  { stage: 1, levelRange: "1-5", kind: "slime" as const, minDistance: MONSTER_STAGE_BASE_SPAWN_DISTANCE },
  { stage: 2, levelRange: "5-10", kind: "bloodMonster" as const, minDistance: MONSTER_STAGE_BASE_SPAWN_DISTANCE * MONSTER_STAGE_DISTANCE_MULTIPLIER },
  { stage: 3, levelRange: "10-15", kind: "goblinBeast" as const, minDistance: MONSTER_STAGE_BASE_SPAWN_DISTANCE * MONSTER_STAGE_DISTANCE_MULTIPLIER ** 2 },
  { stage: 4, levelRange: "15-20", kind: "goblinRider" as const, minDistance: MONSTER_STAGE_BASE_SPAWN_DISTANCE * MONSTER_STAGE_DISTANCE_MULTIPLIER ** 3 },
  { stage: 5, levelRange: "20-30", kind: "skeleton" as const, minDistance: MONSTER_STAGE_BASE_SPAWN_DISTANCE * MONSTER_STAGE_DISTANCE_MULTIPLIER ** 4 },
  { stage: 6, levelRange: "20-30", kind: "skeletonBow" as const, minDistance: MONSTER_STAGE_BASE_SPAWN_DISTANCE * MONSTER_STAGE_DISTANCE_MULTIPLIER ** 4 },
  { stage: 7, levelRange: "30-40", kind: "vampire" as const, minDistance: MONSTER_STAGE_BASE_SPAWN_DISTANCE * MONSTER_STAGE_DISTANCE_MULTIPLIER ** 5 },
  { stage: 8, levelRange: "40-50", kind: "demon" as const, minDistance: MONSTER_STAGE_BASE_SPAWN_DISTANCE * MONSTER_STAGE_DISTANCE_MULTIPLIER ** 6 },
  { stage: 9, levelRange: "50-60", kind: "necromancer" as const, minDistance: MONSTER_STAGE_BASE_SPAWN_DISTANCE * MONSTER_STAGE_DISTANCE_MULTIPLIER ** 7 },
  { stage: 10, levelRange: "60+", kind: "skeletonKing" as const, minDistance: MONSTER_STAGE_BASE_SPAWN_DISTANCE * MONSTER_STAGE_DISTANCE_MULTIPLIER ** 8 },
] as const;

export function monsterStageSpawnMinDistance(kind: Enemy["kind"]) {
  const stageEntry = MONSTER_STAGE_ORDER.find((entry) => entry.kind === kind);
  return stageEntry?.minDistance ?? MONSTER_STAGE_BASE_SPAWN_DISTANCE;
}

export const SLIME_SPAWN_MIN_DIST = monsterStageSpawnMinDistance("slime");
export const SLIME_SPAWN_DIST_RANGE = 260;
// Slimes hop after whoever is targeted (knights, you, clones, or the base).
export const SLIME_CHASE_SPEED = 0.12;
export const BLOOD_MONSTER_TERRITORY_MIN_DIST = monsterStageSpawnMinDistance("bloodMonster");
export const DEMON_TERRITORY_MIN_DIST = monsterStageSpawnMinDistance("demon");
export const GOBLIN_BEAST_TERRITORY_MIN_DIST = monsterStageSpawnMinDistance("goblinBeast");
export const GOBLIN_RIDER_TERRITORY_MIN_DIST = monsterStageSpawnMinDistance("goblinRider");
export const VAMPIRE_TERRITORY_MIN_DIST = monsterStageSpawnMinDistance("vampire");
export const SKELETON_TERRITORY_MIN_DIST = monsterStageSpawnMinDistance("skeleton");
export const NECRO_TERRITORY_MIN_DIST = monsterStageSpawnMinDistance("necromancer");
export const SK_KING_TERRITORY_MIN_DIST = monsterStageSpawnMinDistance("skeletonKing");

export type MonsterCamp = {
  id: string;
  kind: Enemy["kind"];
  name: string;
  zone: string;
  centerX: number;
  centerY: number;
  radius: number;
  maxPopulation: number;
  respawnMs: number;
};

export const MONSTER_CAMPS: MonsterCamp[] = [
  {
    id: "slime-camp",
    kind: "slime",
    name: "Slime Camp",
    zone: "Beginner Zone",
    centerX: 0,
    centerY: 4250,
    radius: 200,
    maxPopulation: 45,
    respawnMs: 20000,
  },
  {
    id: "blood-monster-camp",
    kind: "bloodMonster",
    name: "Blood Monster Camp",
    zone: "Forest Zone",
    centerX: 3110,
    centerY: 8400,
    radius: 220,
    maxPopulation: 36,
    respawnMs: 22000,
  },
  {
    id: "goblin-camp",
    kind: "goblinBeast",
    name: "Goblin Camp",
    zone: "Goblin Zone",
    centerX: 8870,
    centerY: 10420,
    radius: 260,
    maxPopulation: 24,
    respawnMs: 25000,
  },
  {
    id: "goblin-rider-camp",
    kind: "goblinRider",
    name: "Goblin Rider Camp",
    zone: "Goblin Zone",
    centerX: -4720,
    centerY: 12820,
    radius: 240,
    maxPopulation: 18,
    respawnMs: 25000,
  },
  {
    id: "graveyard-camp",
    kind: "skeleton",
    name: "Graveyard Camp",
    zone: "Graveyard",
    centerX: 6330,
    centerY: 17230,
    radius: 280,
    maxPopulation: 24,
    respawnMs: 28000,
  },
  {
    id: "skeleton-bow-camp",
    kind: "skeletonBow",
    name: "Skeleton Archer Camp",
    zone: "Graveyard",
    centerX: -9250,
    centerY: 15870,
    radius: 240,
    maxPopulation: 18,
    respawnMs: 28000,
  },
  {
    id: "vampire-camp",
    kind: "vampire",
    name: "Vampire Camp",
    zone: "Night Zone",
    centerX: 0,
    centerY: 23050,
    radius: 260,
    maxPopulation: 30,
    respawnMs: 30000,
  },
  {
    id: "demon-camp",
    kind: "demon",
    name: "Demon Camp",
    zone: "Demon Area",
    centerX: 7220,
    centerY: 26800,
    radius: 240,
    maxPopulation: 28,
    respawnMs: 32000,
  },
  {
    id: "final-camp",
    kind: "necromancer",
    name: "Necromancer Fortress",
    zone: "Final Area",
    centerX: 16300,
    centerY: 28080,
    radius: 320,
    maxPopulation: 26,
    respawnMs: 35000,
  },
  {
    id: "skeleton-king-camp",
    kind: "skeletonKing",
    name: "Skeleton King Throne",
    zone: "Final Boss Area",
    centerX: -16300,
    centerY: 28080,
    radius: 200,
    maxPopulation: 3,
    respawnMs: 45000,
  },
] as const;

export function getMonsterCamp(kind: Enemy["kind"]) {
  return MONSTER_CAMPS.find((camp) => camp.kind === kind) ?? MONSTER_CAMPS[0];
}

export function enemyDetectionRange(kind?: Enemy["kind"]) {
  switch (kind) {
    case "slime":
      return 240;
    case "bloodMonster":
      return 260;
    case "demon":
      return 300;
    case "goblinBeast":
      return 320;
    case "goblinRider":
      return 340;
    case "skeleton":
      return 280;
    case "skeletonBow":
      return 360;
    case "vampire":
      return 340;
    case "necromancer":
      return 320;
    case "skeletonKing":
      return 420;
    default:
      return 240;
  }
}

export function enemySpawnPosition(
  px: number,
  py: number,
  minDistance: number,
  distanceRange: number
) {
  const camp = MONSTER_CAMPS.find(
    (entry) => entry.centerX === px && entry.centerY === py
  );
  const effectiveMinDistance = camp
    ? Math.max(24, camp.radius * 0.25)
    : minDistance;
  const effectiveDistanceRange = camp
    ? Math.max(24, camp.radius * 0.75)
    : distanceRange;
  for (let attempt = 0; attempt < 24; attempt++) {
    const angle = Math.random() * Math.PI * 2;
    const distance =
      effectiveMinDistance + Math.random() * effectiveDistanceRange;
    const x = px + Math.cos(angle) * distance;
    const y = py + Math.sin(angle) * distance;
    const fromVillage = Math.hypot(
      x - VILLAGE_BASE_CENTER.x,
      y - VILLAGE_BASE_CENTER.y
    );
    if (fromVillage >= VILLAGE_TREE_WALL_INNER_RADIUS + 40) return { x, y };
  }
  const angle = Math.random() * Math.PI * 2;
  const distance = camp
    ? effectiveMinDistance
    : Math.max(minDistance, VILLAGE_TREE_WALL_INNER_RADIUS + 40);
  return {
    x: px + Math.cos(angle) * distance,
    y: py + Math.sin(angle) * distance,
  };
}

// --- Blood Monster --------------------------------------------------------
export const BM_FRAME_SIZE = 100;
export const BM_SCALE = 3.3;
export const BM_DISPLAY = BM_FRAME_SIZE * BM_SCALE;

export const BM_FRAMES: Record<BmAnim, number> = {
  idle: 6,
  walk: 8,
  attack1: 8,
  attack2: 8,
  attack3: 8,
  hurt: 4,
  death: 4,
};
export const BM_FRAME_MS: Record<BmAnim, number> = {
  idle: 170,
  walk: 110,
  attack1: 80,
  attack2: 80,
  attack3: 80,
  hurt: 90,
  death: 140,
};
export const BM_SHEET_SRC: Record<BmAnim, string> = {
  idle: "/blood-monster-idle.png",
  walk: "/blood-monster-walk.png",
  attack1: "/blood-monster-attack1.png",
  attack2: "/blood-monster-attack2.png",
  attack3: "/blood-monster-attack2.png",
  hurt: "/blood-monster-hurt.png",
  death: "/blood-monster-death.png",
};

// Brutal tuning (2x): enemies are faster, hit harder, and reach further.
// The Skeleton King is built to be the hardest kill in the dungeon.
export const BM_ATTACK_RANGE = 92;
export const BM_ATTACK_INTERVAL = 900;
export const BM_SPEED = 0.1;
export const BM_CONTACT_DAMAGE = 24;
export const BM_SPAWN_MIN_DIST = monsterStageSpawnMinDistance("bloodMonster");
export const BM_SPAWN_DIST_RANGE = 280;

// --- Demon ----------------------------------------------------------------
export const DEMON_FRAMES: Record<BmAnim, number> = {
  idle: 6,
  walk: 8,
  attack1: 7,
  attack2: 7,
  attack3: 7,
  hurt: 4,
  death: 4,
};
export const DEMON_FRAME_MS: Record<BmAnim, number> = {
  idle: 170,
  walk: 110,
  attack1: 80,
  attack2: 80,
  attack3: 80,
  hurt: 90,
  death: 140,
};
export const DEMON_SHEET_SRC: Record<BmAnim, string> = {
  idle: "/Demon_A_Idle.png",
  walk: "/Demon_A_Walk.png",
  attack1: "/Demon_A_Attack01.png",
  attack2: "/Demon_A_Attack02.png",
  attack3: "/Demon_A_Attack02.png",
  hurt: "/Demon_A_Hurt.png",
  death: "/Demon_A_Death.png",
};
export const DEMON_SPAWN_MIN_DIST = monsterStageSpawnMinDistance("demon");
export const DEMON_SPAWN_DIST_RANGE = 300;

// --- Goblin Beast ---------------------------------------------------------
export const GOBLIN_BEAST_FRAME_COUNTS: Record<BmAnim, number> = {
  idle: 6,
  walk: 6,
  attack1: 8,
  attack2: 9,
  attack3: 14,
  hurt: 4,
  death: 10,
};
export const GOBLIN_BEAST_FRAME_MS: Record<BmAnim, number> = {
  idle: 160,
  walk: 105,
  attack1: 80,
  attack2: 80,
  attack3: 75,
  hurt: 90,
  death: 130,
};
export const GOBLIN_BEAST_DISPLAY = 48 * 3.5;
export const GOBLIN_BEAST_SHEET_SCALE = GOBLIN_BEAST_DISPLAY;
export const GOBLIN_BEAST_ATTACK_RANGE = 100;
export const GOBLIN_BEAST_ATTACK_INTERVAL = 850;
export const GOBLIN_BEAST_SPEED = 0.34;
export const GOBLIN_BEAST_CONTACT_DAMAGE = 32;
export const GOBLIN_BEAST_MAX_HP = 120;
export const GOBLIN_BEAST_SPAWN_MIN_DIST = monsterStageSpawnMinDistance("goblinBeast");
export const GOBLIN_BEAST_SPAWN_DIST_RANGE = 320;

export function goblinBeastSpriteSrc(dir: WarriorDir, anim: BmAnim): string {
  const animName =
    anim === "walk"
      ? "Walk"
      : anim === "attack1"
      ? "Attack01"
      : anim === "attack2"
      ? "Attack02"
      : anim === "attack3"
      ? "Attack03"
      : anim[0].toUpperCase() + anim.slice(1);
  return `/GoblinBeast${dir}${animName}.png`;
}

export const GOBLIN_RIDER_FRAME_COUNTS: Record<BmAnim, number> = {
  idle: 5,
  walk: 4,
  attack1: 6,
  attack2: 5,
  attack3: 5,
  hurt: 4,
  death: 10,
};
export const GOBLIN_RIDER_FRAME_MS = GOBLIN_BEAST_FRAME_MS;
export const GOBLIN_RIDER_DISPLAY = GOBLIN_BEAST_DISPLAY;
export const GOBLIN_RIDER_ATTACK_RANGE = 108;
export const GOBLIN_RIDER_ATTACK_INTERVAL = 780;
export const GOBLIN_RIDER_SPEED = 0.4;
export const GOBLIN_RIDER_CONTACT_DAMAGE = 36;
export const GOBLIN_RIDER_MAX_HP = 140;
export const GOBLIN_RIDER_SPAWN_MIN_DIST = monsterStageSpawnMinDistance("goblinRider");
export const GOBLIN_RIDER_SPAWN_DIST_RANGE = 330;

export function goblinRiderSpriteSrc(dir: WarriorDir, anim: BmAnim): string {
  const animName =
    anim === "walk"
      ? "Move"
      : anim === "attack1"
      ? "Attack01"
      : anim === "attack2"
      ? "Attack02"
      : anim === "attack3"
      ? "Attack03"
      : anim[0].toUpperCase() + anim.slice(1);
  const directionPrefix = dir === "Down" ? "" : dir;
  return `/GoblinRider${directionPrefix}${animName}.png`;
}

// --- Vampire --------------------------------------------------------------
export const VAMPIRE_FRAME_COUNTS: Record<VampireAnim, number> = {
  idle: 4,
  walk: 6,
  run: 8,
  attack: 12,
  hurt: 4,
  death: 11,
};
export const VAMPIRE_FRAME_MS: Record<VampireAnim, number> = {
  idle: 170,
  walk: 120,
  run: 95,
  attack: 65,
  hurt: 100,
  death: 130,
};
export const VAMPIRE_FRAME_SIZE = 64;
export const VAMPIRE_DISPLAY = VAMPIRE_FRAME_SIZE * 2;
export const VAMPIRE_SHEET_ROWS = 4;
export const VAMPIRE_ATTACK_RANGE = 104;
export const VAMPIRE_ATTACK_INTERVAL = 850;
export const VAMPIRE_SPEED = 0.32;
export const VAMPIRE_CONTACT_DAMAGE = 34;
export const VAMPIRE_MAX_HP = 150;
export const VAMPIRE_SPAWN_MIN_DIST = monsterStageSpawnMinDistance("vampire");
export const VAMPIRE_SPAWN_DIST_RANGE = 280;

export function vampireRow(dir: WarriorDir): number {
  return dir === "Down" ? 0 : dir === "Up" ? 1 : dir === "Left" ? 2 : 3;
}

export function vampireSpriteSrc(anim: VampireAnim): string {
  return `/Vampires1_${anim === "run" ? "Run" : anim[0].toUpperCase() + anim.slice(1)}_full.png`;
}

// --- Necromancer ----------------------------------------------------------
export const NECRO_FRAME_SIZE = 48;
export const NECRO_SCALE = 2.5; // 120px display, matching Warrior/Skeleton pixel scale
export const NECRO_DISPLAY = NECRO_FRAME_SIZE * NECRO_SCALE;

export const NECRO_FRAMES: Record<NecroAnim, number> = {
  idle: 6,
  walk: 6,
  attack1: 7,
  attack2: 7,
  attack3: 12,
  hurt: 4,
  death: 11,
};

export const NECRO_FRAME_MS: Record<NecroAnim, number> = {
  idle: 160,
  walk: 110,
  attack1: 80,
  attack2: 80,
  attack3: 75,
  hurt: 90,
  death: 130,
};

export const NECRO_SHEET_SRC: Record<NecroAnim, string> = {
  idle: "/NecromancerRightIdle.png",
  walk: "/NecromancerRightWalk.png",
  attack1: "/NecromancerRightAttack01.png",
  attack2: "/NecromancerRightAttack02.png",
  attack3: "/NecromancerRightAttack03.png",
  hurt: "/NecromancerRightHurt.png",
  death: "/NecromancerRightDeath.png",
};

export const NECRO_ATTACK_RANGE = 104;
export const NECRO_ATTACK_INTERVAL = 1100;
export const NECRO_SPEED = 0.09;
export const NECRO_CONTACT_DAMAGE = 28;
export const NECRO_MAX_HP = 90;
export const NECRO_SPAWN_MIN_DIST = monsterStageSpawnMinDistance("necromancer");
export const NECRO_SPAWN_DIST_RANGE = 260;


// --- Skeleton With Sword --------------------------------------------------
export const SKELETON_FRAME_COUNTS: Record<SkeletonAnim, number> = {
  Idle: 6,
  Move: 6,
  Attack01: 8,
  Hurt: 4,
  Death: 8,
};
export const SKELETON_FRAME_MS: Record<SkeletonAnim, number> = {
  Idle: 160,
  Move: 110,
  Attack01: 80,
  Hurt: 120,
  Death: 150,
};

export function skeletonSpriteSrc(dir: WarriorDir, anim: SkeletonAnim): string {
  const moveWord = dir === "Left" || dir === "Right" ? "Run" : "Walk";
  const animWord = anim === "Move" ? moveWord : anim;
  const dirWord = dir === "Left" && anim !== "Attack01" ? "Leftt" : dir;
  return `/SkeletonWithSword${dirWord}${animWord}.png`;
}

export const SKELETON_DISPLAY = 48 * 2.5; // 120px
export const SKELETON_MAX_HP = 90;
export const SKELETON_DAMAGE = 24;
export const SKELETON_SPEED = 0.44;
export const SKELETON_ATTACK_RANGE = 80;
export const SKELETON_ATTACK_INTERVAL = 650;
export const SKELETON_SPAWN_MIN_DIST = monsterStageSpawnMinDistance("skeleton");
export const SKELETON_SPAWN_DIST_RANGE = BM_SPAWN_DIST_RANGE;

// --- Skeleton With Bow ----------------------------------------------------
export const SKELETON_BOW_FRAME_COUNTS: Record<SkeletonAnim, number> = {
  Idle: 6,
  Move: 6,
  Attack01: 12,
  Hurt: 4,
  Death: 8,
};
export const SKELETON_BOW_FRAME_MS: Record<SkeletonAnim, number> = {
  Idle: 160,
  Move: 110,
  Attack01: 75,
  Hurt: 110,
  Death: 150,
};

export function skeletonBowSpriteSrc(dir: WarriorDir, anim: SkeletonAnim): string {
  const moveWord = dir === "Left" || dir === "Right" ? "Run" : "Walk";
  const animWord = anim === "Move" ? moveWord : anim;
  const dirWord = dir === "Left" && anim !== "Attack01" ? "Leftt" : dir;
  return `/SkeletonWithBow${dirWord}${animWord}.png`;
}

export const SKELETON_BOW_DISPLAY = SKELETON_DISPLAY;
export const SKELETON_BOW_MAX_HP = 80;
export const SKELETON_BOW_DAMAGE = 20;
export const SKELETON_BOW_SPEED = 0.36;
export const SKELETON_BOW_ATTACK_RANGE = 84;
export const SKELETON_BOW_ATTACK_INTERVAL = 900;
export const SKELETON_BOW_SPAWN_MIN_DIST = monsterStageSpawnMinDistance("skeletonBow");
export const SKELETON_BOW_SPAWN_DIST_RANGE = 260;

export function warriorDirFromVector(dx: number, dy: number): WarriorDir {
  return Math.abs(dx) > Math.abs(dy)
    ? dx > 0
      ? "Right"
      : "Left"
    : dy > 0
    ? "Down"
    : "Up";
}

// --- Skeleton King (Boss) -------------------------------------------------
export const SK_KING_SCALE = 10.8;

export const SK_KING_FRAME_COUNTS: Record<SkeletonKingAnim, number> = {
  Idle: 6,
  Walk: 10,
  Attack01: 10,
  Attack02: 4,
  Attack03: 12,
  Hurt: 4,
  Death: 13,
};

export const SK_KING_FRAME_SIZES: Record<SkeletonKingAnim, number> = {
  Idle: 48,
  Walk: 48,
  Attack01: 64,
  Attack02: 128,
  Attack03: 64,
  Hurt: 48,
  Death: 48,
};

export const SK_KING_FRAME_MS: Record<SkeletonKingAnim, number> = {
  Idle: 160,
  Walk: 100,
  Attack01: 75,
  Attack02: 90,
  Attack03: 75,
  Hurt: 110,
  Death: 140,
};

export function skeletonKingSpriteSrc(
  dir: WarriorDir,
  anim: SkeletonKingAnim
): string {
  return `/SkeletonKing${dir}${anim}.png`;
}

export const SK_KING_ATTACK_RANGE = 116;
export const SK_KING_ATTACK_INTERVAL = 1100;
export const SK_KING_SPEED = 0.28;
export const SK_KING_CONTACT_DAMAGE = 36;
export const SK_KING_MAX_HP = 400;
// Below this HP fraction the King enrages: faster swings, faster stride.
export const SK_KING_ENRAGE_FRACTION = 0.3;
export const SK_KING_ENRAGE_INTERVAL_MULT = 0.55;
export const SK_KING_ENRAGE_SPEED_MULT = 1.5;
// Defence mode: enemies march on the village base and chew through it.
export const BASE_DEFENSE_RADIUS = 80;
export const BASE_SPAWN_RING_RADIUS = 700;
export const SK_KING_SPAWN_MIN_DIST = monsterStageSpawnMinDistance("skeletonKing");
export const SK_KING_SPAWN_DIST_RANGE = 360;

// --- Spawning Functions ---------------------------------------------------
export const MAX_ACTIVE_ENEMIES = 260;

export function spawnWave(
  container: HTMLDivElement,
  enemiesRef: { current: Enemy[] },
  nextEnemyId: { current: number },
  px: number,
  py: number,
  wave: number,
  count: number,
  spawnCenterX: number = px,
  spawnCenterY: number = py
) {
  for (let i = 0; i < Math.min(count, MAX_ACTIVE_ENEMIES - enemiesRef.current.length); i++) {
    const { x, y } = enemySpawnPosition(
      spawnCenterX,
      spawnCenterY,
      SLIME_SPAWN_MIN_DIST,
      SLIME_SPAWN_DIST_RANGE
    );

    const el = document.createElement("div");
    el.className = styles.slime;
    const colorRow = Math.floor(Math.random() * SLIME_COLOR_ROWS);
    const displaySize = slimeDisplayForRow(colorRow);
    el.style.width = `${displaySize}px`;
    el.style.height = `${displaySize}px`;
    el.style.backgroundImage = "url(/slime-sheet.png)";
    el.style.backgroundSize = `${SLIME_COLS * displaySize}px ${SLIME_COLS * displaySize}px`;
    container.appendChild(el);

    const hpEl = document.createElement("div");
    hpEl.className = styles.hpLabel;
    container.appendChild(hpEl);

    const maxHp = 40 + wave * 22;
    enemiesRef.current.push({
      id: nextEnemyId.current++,
      x,
      y,
      hp: maxHp,
      maxHp,
      colorRow,
      spawnedAt: performance.now(),
      kind: "slime",
      el,
      hpEl,
    });
  }
}

export function spawnBloodMonsters(
  container: HTMLDivElement,
  enemiesRef: { current: Enemy[] },
  nextEnemyId: { current: number },
  px: number,
  py: number,
  wave: number,
  count: number,
  spawnCenterX: number = px,
  spawnCenterY: number = py
) {
  for (let i = 0; i < Math.min(count, MAX_ACTIVE_ENEMIES - enemiesRef.current.length); i++) {
    const { x, y } = enemySpawnPosition(
      spawnCenterX,
      spawnCenterY,
      BM_SPAWN_MIN_DIST,
      BM_SPAWN_DIST_RANGE
    );

    const el = document.createElement("div");
    el.className = styles.bloodMonster;
    el.style.width = `${BM_DISPLAY}px`;
    el.style.height = `${BM_DISPLAY}px`;
    el.style.backgroundImage = `url(${BM_SHEET_SRC.idle})`;
    el.style.backgroundSize = `${BM_DISPLAY * BM_FRAMES.idle}px ${BM_DISPLAY}px`;
    el.dataset.bmAnim = "idle";
    container.appendChild(el);

    const hpEl = document.createElement("div");
    hpEl.className = styles.hpLabel;
    container.appendChild(hpEl);

    const maxHp = 70 + wave * 30;
    enemiesRef.current.push({
      id: nextEnemyId.current++,
      x,
      y,
      hp: maxHp,
      maxHp,
      colorRow: 0,
      spawnedAt: performance.now(),
      kind: "bloodMonster",
      bmBehavior: "idle",
      bmBehaviorStartedAt: 0,
      bmFacingLeft: false,
      bmLastAttackAt: 0,
      el,
      hpEl,
    });
  }
}

export function spawnDemons(
  container: HTMLDivElement,
  enemiesRef: { current: Enemy[] },
  nextEnemyId: { current: number },
  px: number,
  py: number,
  wave: number,
  count: number,
  spawnCenterX: number = px,
  spawnCenterY: number = py
) {
  for (let i = 0; i < Math.min(count, MAX_ACTIVE_ENEMIES - enemiesRef.current.length); i++) {
    const { x, y } = enemySpawnPosition(
      spawnCenterX,
      spawnCenterY,
      DEMON_SPAWN_MIN_DIST,
      DEMON_SPAWN_DIST_RANGE
    );

    const el = document.createElement("div");
    el.className = styles.bloodMonster;
    el.style.width = `${BM_DISPLAY}px`;
    el.style.height = `${BM_DISPLAY}px`;
    el.style.backgroundImage = `url(${DEMON_SHEET_SRC.idle})`;
    el.style.backgroundSize = `${BM_DISPLAY * DEMON_FRAMES.idle}px ${BM_DISPLAY}px`;
    el.dataset.bmAnim = "idle";
    container.appendChild(el);

    const hpEl = document.createElement("div");
    hpEl.className = styles.hpLabel;
    container.appendChild(hpEl);

    const maxHp = 70 + wave * 30;
    enemiesRef.current.push({
      id: nextEnemyId.current++,
      x,
      y,
      hp: maxHp,
      maxHp,
      colorRow: 0,
      spawnedAt: performance.now(),
      kind: "demon",
      bmBehavior: "idle",
      bmBehaviorStartedAt: 0,
      bmFacingLeft: false,
      bmLastAttackAt: 0,
      el,
      hpEl,
    });
  }
}

export function spawnGoblinBeasts(
  container: HTMLDivElement,
  enemiesRef: { current: Enemy[] },
  nextEnemyId: { current: number },
  px: number,
  py: number,
  wave: number,
  count: number,
  spawnCenterX: number = px,
  spawnCenterY: number = py
) {
  for (let i = 0; i < Math.min(count, MAX_ACTIVE_ENEMIES - enemiesRef.current.length); i++) {
    const { x, y } = enemySpawnPosition(
      spawnCenterX,
      spawnCenterY,
      GOBLIN_BEAST_SPAWN_MIN_DIST,
      GOBLIN_BEAST_SPAWN_DIST_RANGE
    );
    const dir = warriorDirFromVector(px - x, py - y);
    const el = document.createElement("div");
    el.className = styles.bloodMonster;
    el.style.width = `${GOBLIN_BEAST_DISPLAY}px`;
    el.style.height = `${GOBLIN_BEAST_DISPLAY}px`;
    el.style.backgroundImage = `url(${goblinBeastSpriteSrc(dir, "idle")})`;
    el.style.backgroundSize = `${GOBLIN_BEAST_DISPLAY * GOBLIN_BEAST_FRAME_COUNTS.idle}px ${GOBLIN_BEAST_DISPLAY}px`;
    el.dataset.goblinAnim = "idle";
    el.dataset.goblinDir = dir;
    container.appendChild(el);

    const hpEl = document.createElement("div");
    hpEl.className = styles.hpLabel;
    container.appendChild(hpEl);

    const maxHp = GOBLIN_BEAST_MAX_HP + wave * 40;
    enemiesRef.current.push({
      id: nextEnemyId.current++,
      x,
      y,
      hp: maxHp,
      maxHp,
      colorRow: 0,
      spawnedAt: performance.now(),
      kind: "goblinBeast",
      bmBehavior: "idle",
      bmBehaviorStartedAt: 0,
      bmFacingLeft: false,
      bmLastAttackAt: 0,
      el,
      hpEl,
    });
  }
}

export function spawnGoblinRiders(
  container: HTMLDivElement,
  enemiesRef: { current: Enemy[] },
  nextEnemyId: { current: number },
  px: number,
  py: number,
  wave: number,
  count: number,
  spawnCenterX: number = px,
  spawnCenterY: number = py
) {
  for (let i = 0; i < Math.min(count, MAX_ACTIVE_ENEMIES - enemiesRef.current.length); i++) {
    const { x, y } = enemySpawnPosition(
      spawnCenterX,
      spawnCenterY,
      GOBLIN_RIDER_SPAWN_MIN_DIST,
      GOBLIN_RIDER_SPAWN_DIST_RANGE
    );
    const dir = warriorDirFromVector(px - x, py - y);
    const el = document.createElement("div");
    el.className = styles.bloodMonster;
    el.style.width = `${GOBLIN_RIDER_DISPLAY}px`;
    el.style.height = `${GOBLIN_RIDER_DISPLAY}px`;
    el.style.backgroundImage = `url(${goblinRiderSpriteSrc(dir, "idle")})`;
    el.style.backgroundSize = `${GOBLIN_RIDER_DISPLAY * GOBLIN_RIDER_FRAME_COUNTS.idle}px ${GOBLIN_RIDER_DISPLAY}px`;
    el.dataset.goblinRiderAnim = "idle";
    container.appendChild(el);

    const hpEl = document.createElement("div");
    hpEl.className = styles.hpLabel;
    container.appendChild(hpEl);

    const maxHp = GOBLIN_RIDER_MAX_HP + wave * 45;
    enemiesRef.current.push({
      id: nextEnemyId.current++,
      x,
      y,
      hp: maxHp,
      maxHp,
      colorRow: 0,
      spawnedAt: performance.now(),
      kind: "goblinRider",
      bmBehavior: "idle",
      bmBehaviorStartedAt: 0,
      bmFacingLeft: false,
      bmLastAttackAt: 0,
      skDir: dir,
      el,
      hpEl,
    });
  }
}

export function spawnVampires(
  container: HTMLDivElement,
  enemiesRef: { current: Enemy[] },
  nextEnemyId: { current: number },
  px: number,
  py: number,
  wave: number,
  count: number,
  spawnCenterX: number = px,
  spawnCenterY: number = py
) {
  for (let i = 0; i < Math.min(count, MAX_ACTIVE_ENEMIES - enemiesRef.current.length); i++) {
    const { x, y } = enemySpawnPosition(
      spawnCenterX,
      spawnCenterY,
      VAMPIRE_SPAWN_MIN_DIST,
      VAMPIRE_SPAWN_DIST_RANGE
    );
    const el = document.createElement("div");
    el.className = styles.bloodMonster;
    el.style.width = `${VAMPIRE_DISPLAY}px`;
    el.style.height = `${VAMPIRE_DISPLAY}px`;
    el.style.backgroundImage = `url(${vampireSpriteSrc("idle")})`;
    el.style.backgroundSize = `${VAMPIRE_DISPLAY * VAMPIRE_FRAME_COUNTS.idle}px ${VAMPIRE_DISPLAY * VAMPIRE_SHEET_ROWS}px`;
    el.style.backgroundPosition = "0 0";
    el.dataset.vampireAnim = "idle";
    container.appendChild(el);

    const hpEl = document.createElement("div");
    hpEl.className = styles.hpLabel;
    container.appendChild(hpEl);

    const maxHp = VAMPIRE_MAX_HP + wave * 50;
    enemiesRef.current.push({
      id: nextEnemyId.current++,
      x,
      y,
      hp: maxHp,
      maxHp,
      colorRow: 0,
      spawnedAt: performance.now(),
      kind: "vampire",
      bmBehavior: "idle",
      bmBehaviorStartedAt: 0,
      bmFacingLeft: false,
      bmLastAttackAt: 0,
      skDir: warriorDirFromVector(px - x, py - y),
      el,
      hpEl,
    });
  }
}

export function spawnSkeletons(
  container: HTMLDivElement,
  enemiesRef: { current: Enemy[] },
  nextEnemyId: { current: number },
  px: number,
  py: number,
  wave: number,
  count: number,
  spawnCenterX: number = px,
  spawnCenterY: number = py
) {
  for (let i = 0; i < Math.min(count, MAX_ACTIVE_ENEMIES - enemiesRef.current.length); i++) {
    const { x, y } = enemySpawnPosition(
      spawnCenterX,
      spawnCenterY,
      SKELETON_SPAWN_MIN_DIST,
      SKELETON_SPAWN_DIST_RANGE
    );

    const el = document.createElement("div");
    el.className = styles.bloodMonster;
    el.style.width = `${SKELETON_DISPLAY}px`;
    el.style.height = `${SKELETON_DISPLAY}px`;
    el.style.backgroundImage = `url(${skeletonSpriteSrc("Down", "Idle")})`;
    el.style.backgroundSize = `${SKELETON_DISPLAY * SKELETON_FRAME_COUNTS.Idle}px ${SKELETON_DISPLAY}px`;
    el.dataset.skKey = "Down_Idle";
    container.appendChild(el);

    const hpEl = document.createElement("div");
    hpEl.className = styles.hpLabel;
    container.appendChild(hpEl);

    enemiesRef.current.push({
      id: nextEnemyId.current++,
      x,
      y,
      hp: SKELETON_MAX_HP + wave * 18,
      maxHp: SKELETON_MAX_HP + wave * 18,
      colorRow: 0,
      spawnedAt: performance.now(),
      kind: "skeleton",
      skDir: "Down",
      skBehavior: "idle",
      skBehaviorStartedAt: 0,
      skLastAttackAt: 0,
      el,
      hpEl,
    });
  }
}

export function spawnSkeletonBows(
  container: HTMLDivElement,
  enemiesRef: { current: Enemy[] },
  nextEnemyId: { current: number },
  px: number,
  py: number,
  wave: number,
  count: number,
  spawnCenterX: number = px,
  spawnCenterY: number = py
) {
  for (let i = 0; i < Math.min(count, MAX_ACTIVE_ENEMIES - enemiesRef.current.length); i++) {
    const { x, y } = enemySpawnPosition(
      spawnCenterX,
      spawnCenterY,
      SKELETON_BOW_SPAWN_MIN_DIST,
      SKELETON_BOW_SPAWN_DIST_RANGE
    );
    const el = document.createElement("div");
    el.className = styles.bloodMonster;
    el.style.width = `${SKELETON_BOW_DISPLAY}px`;
    el.style.height = `${SKELETON_BOW_DISPLAY}px`;
    el.style.backgroundImage = `url(${skeletonBowSpriteSrc("Down", "Idle")})`;
    el.style.backgroundSize = `${SKELETON_BOW_DISPLAY * SKELETON_BOW_FRAME_COUNTS.Idle}px ${SKELETON_BOW_DISPLAY}px`;
    el.dataset.skKey = "Bow_Down_Idle";
    container.appendChild(el);

    const hpEl = document.createElement("div");
    hpEl.className = styles.hpLabel;
    container.appendChild(hpEl);

    enemiesRef.current.push({
      id: nextEnemyId.current++,
      x,
      y,
      hp: SKELETON_BOW_MAX_HP + wave * 16,
      maxHp: SKELETON_BOW_MAX_HP + wave * 16,
      colorRow: 0,
      spawnedAt: performance.now(),
      kind: "skeletonBow",
      skDir: "Down",
      skBehavior: "idle",
      skBehaviorStartedAt: 0,
      skLastAttackAt: 0,
      el,
      hpEl,
    });
  }
}

export function spawnNecromancers(
  container: HTMLDivElement,
  enemiesRef: { current: Enemy[] },
  nextEnemyId: { current: number },
  px: number,
  py: number,
  wave: number,
  count: number,
  spawnCenterX: number = px,
  spawnCenterY: number = py
) {
  for (let i = 0; i < Math.min(count, MAX_ACTIVE_ENEMIES - enemiesRef.current.length); i++) {
    const { x, y } = enemySpawnPosition(
      spawnCenterX,
      spawnCenterY,
      NECRO_SPAWN_MIN_DIST,
      NECRO_SPAWN_DIST_RANGE
    );

    const el = document.createElement("div");
    el.className = styles.bloodMonster;
    el.style.width = `${NECRO_DISPLAY}px`;
    el.style.height = `${NECRO_DISPLAY}px`;
    el.style.backgroundImage = `url(${NECRO_SHEET_SRC.idle})`;
    el.style.backgroundSize = `${NECRO_DISPLAY * NECRO_FRAMES.idle}px ${NECRO_DISPLAY}px`;
    el.dataset.necroAnim = "idle";
    container.appendChild(el);

    const hpEl = document.createElement("div");
    hpEl.className = styles.hpLabel;
    container.appendChild(hpEl);

    const maxHp = NECRO_MAX_HP + wave * 32;
    enemiesRef.current.push({
      id: nextEnemyId.current++,
      x,
      y,
      hp: maxHp,
      maxHp,
      colorRow: 0,
      spawnedAt: performance.now(),
      kind: "necromancer",
      bmBehavior: "idle",
      bmBehaviorStartedAt: 0,
      bmFacingLeft: false,
      bmLastAttackAt: 0,
      el,
      hpEl,
    });
  }
}

export function spawnSkeletonKing(
  container: HTMLDivElement,
  enemiesRef: { current: Enemy[] },
  nextEnemyId: { current: number },
  px: number,
  py: number,
  wave: number,
  count: number,
  spawnCenterX: number = px,
  spawnCenterY: number = py
) {
  for (let i = 0; i < Math.min(count, MAX_ACTIVE_ENEMIES - enemiesRef.current.length); i++) {
    const { x, y } = enemySpawnPosition(
      spawnCenterX,
      spawnCenterY,
      SK_KING_SPAWN_MIN_DIST,
      SK_KING_SPAWN_DIST_RANGE
    );

    const baseSize = SK_KING_FRAME_SIZES.Idle * SK_KING_SCALE;
    const el = document.createElement("div");
    el.className = styles.bloodMonster;
    el.style.width = `${baseSize}px`;
    el.style.height = `${baseSize}px`;
    el.style.backgroundImage = `url(${skeletonKingSpriteSrc("Down", "Idle")})`;
    el.style.backgroundSize = `${baseSize * SK_KING_FRAME_COUNTS.Idle}px ${baseSize}px`;
    el.dataset.skKingKey = "Down_Idle";
    container.appendChild(el);

    const hpEl = document.createElement("div");
    hpEl.className = styles.hpLabel;
    container.appendChild(hpEl);

    const maxHp = SK_KING_MAX_HP + wave * 80;
    enemiesRef.current.push({
      id: nextEnemyId.current++,
      x,
      y,
      hp: maxHp,
      maxHp,
      colorRow: 0,
      spawnedAt: performance.now(),
      kind: "skeletonKing",
      skDir: "Down",
      skBehavior: "idle",
      skBehaviorStartedAt: 0,
      skLastAttackAt: 0,
      el,
      hpEl,
    });
  }
}

// --- Enemy Updates and Contact Damage -------------------------------------
export function updateEnemies(
  enemies: Enemy[],
  now: number,
  dt: number,
  px: number,
  py: number,
  cx: number,
  cy: number,
  w: number,
  h: number,
  ctx: CanvasRenderingContext2D,
  trees: Map<string, import("./types").Tree>,
  lastHitRef: { current: number },
  dodgeInvulnUntil: number,
  hpRef: { current: number },
  onPlayerHit: (dmg: number, enemyScreenX: number, enemyScreenY: number, enemyX: number, enemyY: number) => void,
  onCombatEvent?: () => void,
  clones: Clone[] = [],
  mitigation: { defense: number; armor: number } = { defense: 0, armor: 0 },
  onBaseHit?: (dmg: number, enemyX: number, enemyY: number) => void,
  warriors: Warrior[] = []
) {
  for (const enemy of enemies) {
    const isStunned = (enemy.stunnedUntil ?? 0) > now;
    const isMelee = enemy.kind === "bloodMonster" || enemy.kind === "demon";
    const isSlime = enemy.kind === "slime";
    const isGoblin = enemy.kind === "goblinBeast";
    const isRider = enemy.kind === "goblinRider";
    const isVampire = enemy.kind === "vampire";
    const isSkeleton = enemy.kind === "skeleton" || enemy.kind === "skeletonBow";
    const isSkeletonBow = enemy.kind === "skeletonBow";
    const isNecro = enemy.kind === "necromancer";
    const isKing = enemy.kind === "skeletonKing";
    // Defence mode: march on the village base no matter where the player is.
    const huntingBase = enemy.targetBase === true;
    const spawnGraceMs = 220;
    const spawnProgress = Math.min(1, (now - (enemy.spawnedAt ?? now)) / spawnGraceMs);
    const distToPlayer = Math.hypot(enemy.x - px, enemy.y - py);
    const detectionRange = enemyDetectionRange(enemy.kind);
    const homeX = enemy.homeX ?? enemy.x;
    const homeY = enemy.homeY ?? enemy.y;
    const homeDistance = Math.hypot(enemy.x - homeX, enemy.y - homeY);
    const territoryRadius = enemy.territoryRadius ?? Infinity;
    const groupDetectsTarget = enemy.groupId
      ? enemies.some(
          (member) =>
            member.groupId === enemy.groupId &&
            Math.hypot(member.x - px, member.y - py) <= enemyDetectionRange(member.kind)
        )
      : false;
    const canDetectTarget =
      huntingBase ||
      (homeDistance <= territoryRadius * 2 &&
        (distToPlayer <= detectionRange || groupDetectsTarget));
    // NOTE: mere detection never starts combat — only player hits do.
    enemy.combatTargetingPlayer = canDetectTarget;
    const isSpawning = (enemy.spawnedAt ?? now) > now - spawnGraceMs;
    const meleeFrames = enemy.kind === "demon" ? DEMON_FRAMES : BM_FRAMES;
    const meleeFrameMs = enemy.kind === "demon" ? DEMON_FRAME_MS : BM_FRAME_MS;
    const meleeSheetSrc = enemy.kind === "demon" ? DEMON_SHEET_SRC : BM_SHEET_SRC;
    const dispSize = isRider
      ? GOBLIN_RIDER_DISPLAY
      : isGoblin
      ? GOBLIN_BEAST_DISPLAY
      : isMelee
      ? BM_DISPLAY
      : isSkeleton
      ? SKELETON_DISPLAY
      : isNecro
      ? NECRO_DISPLAY
      : isKing
      ? 48 * SK_KING_SCALE
      : slimeDisplayForRow(enemy.colorRow);
    const moveEnemy = (nextX: number, nextY: number) => {
      const resolved = resolveTreeCollisions(nextX, nextY, trees);
      // Clones are solid to enemies (but not to the player).
      const unblocked = resolveCloneCollisions(resolved.x, resolved.y, clones);
      // Knight shield wall: enemies pile up instead of passing through.
      const pastLine = resolveKnightCollisions(unblocked.x, unblocked.y, warriors);
      enemy.x = pastLine.x;
      enemy.y = pastLine.y;
    };
    // Retarget: nearest of player vs living clones inside detection range.
    // Enemies never ignore a clone standing closer than you.
    let tx = px;
    let ty = py;
    let targetClone: Clone | null = null;
    let targetWarrior: Warrior | null = null;
    let targetKind: "warrior" | "player" | "clone" | "base" = "player";
    for (const clone of clones) {
      if (clone.hp <= 0) continue;
      const d = Math.hypot(clone.x - enemy.x, clone.y - enemy.y);
      if (d <= detectionRange) {
        const playerDist = Math.hypot(px - enemy.x, py - enemy.y);
        if (d < playerDist && (!targetClone || d < Math.hypot(targetClone.x - enemy.x, targetClone.y - enemy.y))) {
          targetClone = clone;
        }
      }
    }
    if (huntingBase) {
      // Kill priority: knights, you, and your clones first — the campfire
      // only when nothing living is detected nearby. Nothing gets ignored.
      let bestKind: "warrior" | "player" | "clone" | "base" = "base";
      let bestDist = Infinity;
      for (const w of warriors) {
        if (w.hp <= 0 || w.state === "dead") continue;
        const d = Math.hypot(w.x - enemy.x, w.y - enemy.y);
        if (d <= detectionRange && d < bestDist) {
          bestDist = d;
          bestKind = "warrior";
          targetWarrior = w;
        }
      }
      {
        const d = Math.hypot(px - enemy.x, py - enemy.y);
        if (d <= detectionRange && d < bestDist) {
          bestDist = d;
          bestKind = "player";
        }
      }
      if (targetClone) {
        const d = Math.hypot(targetClone.x - enemy.x, targetClone.y - enemy.y);
        if (d < bestDist) {
          bestDist = d;
          bestKind = "clone";
        }
      }
      targetKind = bestKind;
      if (bestKind === "warrior" && targetWarrior) {
        tx = targetWarrior.x;
        ty = targetWarrior.y;
      } else if (bestKind === "player") {
        tx = px;
        ty = py;
      } else if (bestKind === "clone" && targetClone) {
        tx = targetClone.x;
        ty = targetClone.y;
      } else {
        tx = VILLAGE_BASE_CENTER.x;
        ty = VILLAGE_BASE_CENTER.y;
      }
    } else {
      if (targetClone) {
        tx = targetClone.x;
        ty = targetClone.y;
        targetKind = "clone";
      }
    }

    // Defence march: base-hunters charge at 2.5x until something living is
    // targeted, then fight at normal speed.
    const marchMult = huntingBase && targetKind === "base" ? 2.5 : 1;

    if (isSpawning) {
      if (!isStunned) {
        enemy.bmBehavior = "idle";
        enemy.skBehavior = "idle";
      }
    } else if (
      !isStunned &&
      canDetectTarget &&
      (isMelee || isGoblin || isRider || isVampire)
    ) {
      const ddx = tx - enemy.x;
      const ddy = ty - enemy.y;
      const dist = Math.hypot(ddx, ddy) || 1;
      const attackRange = isVampire
        ? VAMPIRE_ATTACK_RANGE
        : isRider
        ? GOBLIN_RIDER_ATTACK_RANGE
        : isGoblin
        ? GOBLIN_BEAST_ATTACK_RANGE
        : BM_ATTACK_RANGE;
      const speed = isVampire
        ? VAMPIRE_SPEED
        : isRider
        ? GOBLIN_RIDER_SPEED
        : isGoblin
        ? GOBLIN_BEAST_SPEED
        : BM_SPEED;
      const attackInterval = isVampire
        ? VAMPIRE_ATTACK_INTERVAL
        : isRider
        ? GOBLIN_RIDER_ATTACK_INTERVAL
        : isGoblin
        ? GOBLIN_BEAST_ATTACK_INTERVAL
        : BM_ATTACK_INTERVAL;
      if (dist > attackRange) {
        moveEnemy(
          enemy.x + (ddx / dist) * speed * marchMult * dt,
          enemy.y + (ddy / dist) * speed * marchMult * dt
        );
        enemy.bmBehavior = "walk";
        enemy.bmFacingLeft = ddx < 0;
      } else {
        enemy.bmFacingLeft = ddx < 0;
        if (now - (enemy.bmLastAttackAt ?? 0) > attackInterval) {
          enemy.bmLastAttackAt = now;
          enemy.attackAudioStop?.();
          enemy.bmBehavior = isGoblin || isRider
            ? Math.random() < 0.34
              ? "attack1"
              : Math.random() < 0.5
              ? "attack2"
              : "attack3"
            : isVampire
            ? "attack1"
            : Math.random() < 0.5
            ? "attack1"
            : "attack2";
          enemy.bmBehaviorStartedAt = now;
          enemy.attackAudioStop = playEnemyAttackSound(
            enemy.kind === "vampire"
              ? "vampire"
              : enemy.kind === "goblinRider"
              ? "goblinRider"
              : enemy.kind === "goblinBeast"
              ? "goblinBeast"
              : enemy.kind === "demon"
              ? "demon"
              : "bloodMonster",
            dist,
            Math.max(-1, Math.min(1, ddx / 500))
          ) ?? undefined;
        }
      }
    } else if (!isStunned && canDetectTarget && isSkeleton) {
      const ddx = tx - enemy.x;
      const ddy = ty - enemy.y;
      const dist = Math.hypot(ddx, ddy) || 1;
      enemy.skDir = warriorDirFromVector(ddx, ddy);
      const attackRange = isSkeletonBow ? SKELETON_BOW_ATTACK_RANGE : SKELETON_ATTACK_RANGE;
      const speed = isSkeletonBow ? SKELETON_BOW_SPEED : SKELETON_SPEED;
      const attackInterval = isSkeletonBow
        ? SKELETON_BOW_ATTACK_INTERVAL
        : SKELETON_ATTACK_INTERVAL;
      if (dist > attackRange) {
        moveEnemy(
          enemy.x + (ddx / dist) * speed * marchMult * dt,
          enemy.y + (ddy / dist) * speed * marchMult * dt
        );
        enemy.skBehavior = "walk";
      } else if (now - (enemy.skLastAttackAt ?? 0) > attackInterval) {
        enemy.skLastAttackAt = now;
        enemy.attackAudioStop?.();
        enemy.skBehavior = "attack1";
        enemy.skBehaviorStartedAt = now;
        enemy.attackAudioStop = playEnemyAttackSound(
          isSkeletonBow ? "skeletonBow" : "skeleton",
          dist,
          Math.max(-1, Math.min(1, ddx / 500))
        ) ?? undefined;
      }
    } else if (!isStunned && canDetectTarget && isNecro) {
      const ddx = tx - enemy.x;
      const ddy = ty - enemy.y;
      const dist = Math.hypot(ddx, ddy) || 1;
      enemy.bmFacingLeft = ddx < 0;
      if (dist > NECRO_ATTACK_RANGE) {
        moveEnemy(
          enemy.x + (ddx / dist) * NECRO_SPEED * marchMult * dt,
          enemy.y + (ddy / dist) * NECRO_SPEED * marchMult * dt
        );
        enemy.bmBehavior = "walk";
      } else {
        if (now - (enemy.bmLastAttackAt ?? 0) > NECRO_ATTACK_INTERVAL) {
          enemy.bmLastAttackAt = now;
          enemy.attackAudioStop?.();
          const r = Math.random();
          enemy.bmBehavior = r < 0.35 ? "attack1" : r < 0.7 ? "attack2" : "attack3";
          enemy.bmBehaviorStartedAt = now;
          enemy.attackAudioStop = playEnemyAttackSound(
            "necromancer",
            dist,
            Math.max(-1, Math.min(1, ddx / 500))
          ) ?? undefined;
        }
      }
    } else if (!isStunned && canDetectTarget && isKing) {
      const ddx = tx - enemy.x;
      const ddy = ty - enemy.y;
      const dist = Math.hypot(ddx, ddy) || 1;
      enemy.skDir = warriorDirFromVector(ddx, ddy);
      // Enrage below threshold: faster stride, much faster swings.
      const enraged = enemy.hp < enemy.maxHp * SK_KING_ENRAGE_FRACTION;
      const kingSpeed = SK_KING_SPEED * (enraged ? SK_KING_ENRAGE_SPEED_MULT : 1);
      const kingInterval = SK_KING_ATTACK_INTERVAL * (enraged ? SK_KING_ENRAGE_INTERVAL_MULT : 1);
      if (dist > SK_KING_ATTACK_RANGE) {
        moveEnemy(
          enemy.x + (ddx / dist) * kingSpeed * marchMult * dt,
          enemy.y + (ddy / dist) * kingSpeed * marchMult * dt
        );
        enemy.skBehavior = "walk";
      } else {
        if (now - (enemy.skLastAttackAt ?? 0) > kingInterval) {
          enemy.skLastAttackAt = now;
          enemy.attackAudioStop?.();
          const r = Math.random();
          enemy.skBehavior = r < 0.4 ? "attack1" : r < 0.75 ? "attack2" : "attack3";
          enemy.skBehaviorStartedAt = now;
          enemy.attackAudioStop = playEnemyAttackSound(
            "skeletonKing",
            dist,
            Math.max(-1, Math.min(1, ddx / 500))
          ) ?? undefined;
        }
      }
    } else if (!isStunned && canDetectTarget && isSlime) {
      // Slimes hop toward the current target (knight, you, clone, or base).
      // Contact damage is handled by the shared block below.
      const ddx = tx - enemy.x;
      const ddy = ty - enemy.y;
      const dist = Math.hypot(ddx, ddy) || 1;
      if (dist > 32) {
        moveEnemy(
          enemy.x + (ddx / dist) * SLIME_CHASE_SPEED * marchMult * dt,
          enemy.y + (ddy / dist) * SLIME_CHASE_SPEED * marchMult * dt
        );
      }
    } else if (
      !isStunned &&
      enemy.homeX !== undefined &&
      enemy.homeY !== undefined &&
      homeDistance > territoryRadius
    ) {
      const ddx = homeX - enemy.x;
      const ddy = homeY - enemy.y;
      const dist = Math.hypot(ddx, ddy) || 1;
      const returnSpeed = isKing
        ? SK_KING_SPEED
        : isNecro
        ? NECRO_SPEED
        : isSkeleton
        ? isSkeletonBow
          ? SKELETON_BOW_SPEED
          : SKELETON_SPEED
        : isVampire
        ? VAMPIRE_SPEED
        : isRider
        ? GOBLIN_RIDER_SPEED
        : isGoblin
        ? GOBLIN_BEAST_SPEED
        : isMelee
        ? BM_SPEED
        : 0.16;
      moveEnemy(
        enemy.x + (ddx / dist) * returnSpeed * dt,
        enemy.y + (ddy / dist) * returnSpeed * dt
      );
      enemy.bmBehavior = "walk";
      enemy.skBehavior = "walk";
      enemy.bmFacingLeft = ddx < 0;
      enemy.skDir = warriorDirFromVector(ddx, ddy);
    } else if (!isStunned) {
      const wanderSpeed = isKing
        ? SK_KING_SPEED * 0.45
        : isNecro
        ? NECRO_SPEED * 0.45
        : isSkeleton
        ? (isSkeletonBow ? SKELETON_BOW_SPEED : SKELETON_SPEED) * 0.45
        : isVampire
        ? VAMPIRE_SPEED * 0.45
        : isRider
        ? GOBLIN_RIDER_SPEED * 0.45
        : isGoblin
        ? GOBLIN_BEAST_SPEED * 0.45
        : isMelee
        ? BM_SPEED * 0.45
        : 0.08;

      if (now >= (enemy.nextWanderAt ?? 0)) {
        const distFromHome = Math.hypot(enemy.x - homeX, enemy.y - homeY);
        let angle = Math.random() * Math.PI * 2;
        if (distFromHome > territoryRadius * 0.75) {
          angle = Math.atan2(homeY - enemy.y, homeX - enemy.x);
          angle += (Math.random() - 0.5) * 0.8;
        }
        enemy.wanderAngle = angle;
        enemy.nextWanderAt = now + 1400 + Math.random() * 2400;
      }

      const wanderAngle = enemy.wanderAngle ?? 0;
      const shouldMove = (enemy.nextWanderAt ?? 0) - now > 500;
      enemy.bmBehavior = shouldMove ? "walk" : "idle";
      enemy.skBehavior = shouldMove ? "walk" : "idle";
      if (shouldMove) {
        const nextX = enemy.x + Math.cos(wanderAngle) * wanderSpeed * dt;
        const nextY = enemy.y + Math.sin(wanderAngle) * wanderSpeed * dt;
        const nextDistance = Math.hypot(nextX - homeX, nextY - homeY);
        if (nextDistance <= territoryRadius) {
          moveEnemy(nextX, nextY);
        } else {
          enemy.nextWanderAt = now;
        }
        enemy.bmFacingLeft = Math.cos(wanderAngle) < 0;
        enemy.skDir = warriorDirFromVector(
          Math.cos(wanderAngle),
          Math.sin(wanderAngle)
        );
      }
    }

    const screenX = enemy.x - cx + w / 2;
    const screenY = enemy.y - cy + h / 2;
    const offscreen =
      screenX < -80 || screenX > w + 80 || screenY < -80 || screenY > h + 80;
    const spawnAlpha = Math.min(1, Math.max(0.2, (now - (enemy.spawnedAt ?? now)) / 220));

    if (enemy.el) {
      if (isVampire) {
        const dir = warriorDirFromVector(px - enemy.x, py - enemy.y);
        const hurtActive =
          enemy.bmHurtStartedAt !== undefined &&
          now - enemy.bmHurtStartedAt <
            VAMPIRE_FRAME_COUNTS.hurt * VAMPIRE_FRAME_MS.hurt;
        let anim: VampireAnim;
        let frame: number;
        if (hurtActive) {
          anim = "hurt";
          frame = Math.min(
            VAMPIRE_FRAME_COUNTS.hurt - 1,
            Math.floor((now - enemy.bmHurtStartedAt!) / VAMPIRE_FRAME_MS.hurt)
          );
        } else if (enemy.bmBehavior === "attack1") {
          const elapsed = now - (enemy.bmBehaviorStartedAt ?? now);
          const attackFrame = Math.floor(elapsed / VAMPIRE_FRAME_MS.attack);
          if (attackFrame >= VAMPIRE_FRAME_COUNTS.attack) {
            enemy.bmBehavior = "idle";
            anim = "idle";
            frame = Math.floor(now / VAMPIRE_FRAME_MS.idle) % VAMPIRE_FRAME_COUNTS.idle;
          } else {
            anim = "attack";
            frame = attackFrame;
          }
        } else if (enemy.bmBehavior === "walk") {
          anim = "run";
          frame = Math.floor(now / VAMPIRE_FRAME_MS.run) % VAMPIRE_FRAME_COUNTS.run;
        } else {
          anim = "idle";
          frame = Math.floor(now / VAMPIRE_FRAME_MS.idle) % VAMPIRE_FRAME_COUNTS.idle;
        }
        const spriteKey = `${dir}_${anim}`;
        if (enemy.el.dataset.vampireAnim !== spriteKey) {
          enemy.el.style.backgroundImage = `url(${vampireSpriteSrc(anim)})`;
          enemy.el.style.backgroundSize = `${VAMPIRE_DISPLAY * VAMPIRE_FRAME_COUNTS[anim]}px ${VAMPIRE_DISPLAY * VAMPIRE_SHEET_ROWS}px`;
          enemy.el.dataset.vampireAnim = spriteKey;
        }
        enemy.el.style.backgroundPosition = `-${frame * VAMPIRE_DISPLAY}px -${vampireRow(dir) * VAMPIRE_DISPLAY}px`;
        enemy.el.style.transform = `translate(${screenX - VAMPIRE_DISPLAY / 2}px, ${screenY - VAMPIRE_DISPLAY / 2}px)`;
        enemy.el.style.opacity = offscreen ? "0" : String(spawnAlpha);
        enemy.el.style.zIndex = String(Z_BASE + Math.round(enemy.y + VAMPIRE_DISPLAY));
      } else if (isMelee || isGoblin || isRider) {
        const frames = isRider
          ? GOBLIN_RIDER_FRAME_COUNTS
          : isGoblin
          ? GOBLIN_BEAST_FRAME_COUNTS
          : meleeFrames;
        const frameMs = isRider
          ? GOBLIN_RIDER_FRAME_MS
          : isGoblin
          ? GOBLIN_BEAST_FRAME_MS
          : meleeFrameMs;
        const displaySize = isRider
          ? GOBLIN_RIDER_DISPLAY
          : isGoblin
          ? GOBLIN_BEAST_DISPLAY
          : BM_DISPLAY;
        const hurtActive =
          enemy.bmHurtStartedAt !== undefined &&
          now - enemy.bmHurtStartedAt < frames.hurt * frameMs.hurt;

        let anim: BmAnim;
        let frame: number;

        if (hurtActive) {
          anim = "hurt";
          frame = Math.min(
            frames.hurt - 1,
            Math.floor((now - enemy.bmHurtStartedAt!) / frameMs.hurt)
          );
        } else if (
          enemy.bmBehavior === "attack1" ||
          enemy.bmBehavior === "attack2" ||
          ((isGoblin || isRider) && enemy.bmBehavior === "attack3")
        ) {
          const attackKind: BmAnim = enemy.bmBehavior;
          const elapsed = now - (enemy.bmBehaviorStartedAt ?? now);
          const idx = Math.floor(elapsed / frameMs[attackKind]);
          if (idx >= frames[attackKind]) {
            enemy.bmBehavior = "idle";
            anim = "idle";
            frame = Math.floor(now / frameMs.idle) % frames.idle;
          } else {
            anim = attackKind;
            frame = idx;
          }
        } else if (enemy.bmBehavior === "walk") {
          anim = "walk";
          frame = Math.floor(now / frameMs.walk) % frames.walk;
        } else {
          anim = "idle";
          frame = Math.floor(now / frameMs.idle) % frames.idle;
        }

        if (isGoblin || isRider) {
          const dir = warriorDirFromVector(px - enemy.x, py - enemy.y);
          const spriteKey = `${dir}_${anim}`;
          const datasetKey = isRider ? "goblinRiderAnim" : "goblinAnim";
          if (enemy.el.dataset[datasetKey] !== spriteKey) {
            enemy.el.style.width = `${displaySize}px`;
            enemy.el.style.height = `${displaySize}px`;
            enemy.el.style.backgroundImage = `url(${isRider ? goblinRiderSpriteSrc(dir, anim) : goblinBeastSpriteSrc(dir, anim)})`;
            enemy.el.style.backgroundSize = `${displaySize * frames[anim]}px ${displaySize}px`;
            enemy.el.dataset[datasetKey] = spriteKey;
          }
        } else if (enemy.el.dataset.bmAnim !== anim) {
          enemy.el.style.backgroundImage = `url(${meleeSheetSrc[anim]})`;
          enemy.el.style.backgroundSize = `${displaySize * frames[anim]}px ${displaySize}px`;
          enemy.el.dataset.bmAnim = anim;
        }
        enemy.el.style.backgroundPosition = `-${frame * displaySize}px 0px`;
        const facingTransform = isGoblin || isRider
          ? ""
          : ` scaleX(${enemy.bmFacingLeft ? -1 : 1})`;
        enemy.el.style.transform = `translate(${screenX - displaySize / 2}px, ${
          screenY - displaySize / 2
        }px)${facingTransform}`;
        enemy.el.style.opacity = offscreen ? "0" : String(spawnAlpha);
        enemy.el.style.zIndex = String(Z_BASE + Math.round(enemy.y + displaySize));
      } else if (isSkeleton) {
        const skeletonFrames = isSkeletonBow
          ? SKELETON_BOW_FRAME_COUNTS
          : SKELETON_FRAME_COUNTS;
        const skeletonFrameMs = isSkeletonBow
          ? SKELETON_BOW_FRAME_MS
          : SKELETON_FRAME_MS;
        const hurtActive =
          enemy.skHurtStartedAt !== undefined &&
          now - enemy.skHurtStartedAt <
            skeletonFrames.Hurt * skeletonFrameMs.Hurt;

        let anim: SkeletonAnim;
        let frame: number;

        if (hurtActive) {
          anim = "Hurt";
          frame = Math.min(
            skeletonFrames.Hurt - 1,
            Math.floor((now - enemy.skHurtStartedAt!) / skeletonFrameMs.Hurt)
          );
        } else if (enemy.skBehavior === "attack1") {
          const elapsed = now - (enemy.skBehaviorStartedAt ?? now);
          const idx = Math.floor(elapsed / skeletonFrameMs.Attack01);
          if (idx >= skeletonFrames.Attack01) {
            enemy.skBehavior = "idle";
            anim = "Idle";
            frame = Math.floor(now / skeletonFrameMs.Idle) % skeletonFrames.Idle;
          } else {
            anim = "Attack01";
            frame = idx;
          }
        } else if (enemy.skBehavior === "walk") {
          anim = "Move";
          frame = Math.floor(now / skeletonFrameMs.Move) % skeletonFrames.Move;
        } else {
          anim = "Idle";
          frame = Math.floor(now / skeletonFrameMs.Idle) % skeletonFrames.Idle;
        }

        const dir = enemy.skDir ?? "Down";
        const spriteKey = `${isSkeletonBow ? "Bow_" : ""}${dir}_${anim}`;
        if (enemy.el.dataset.skKey !== spriteKey) {
          enemy.el.style.backgroundImage = `url(${isSkeletonBow ? skeletonBowSpriteSrc(dir, anim) : skeletonSpriteSrc(dir, anim)})`;
          enemy.el.style.backgroundSize = `${
            (isSkeletonBow ? SKELETON_BOW_DISPLAY : SKELETON_DISPLAY) * skeletonFrames[anim]
          }px ${SKELETON_DISPLAY}px`;
          enemy.el.dataset.skKey = spriteKey;
        }
        enemy.el.style.backgroundPosition = `-${frame * (isSkeletonBow ? SKELETON_BOW_DISPLAY : SKELETON_DISPLAY)}px 0px`;
        enemy.el.style.transform = `translate(${screenX - (isSkeletonBow ? SKELETON_BOW_DISPLAY : SKELETON_DISPLAY) / 2}px, ${
          screenY - (isSkeletonBow ? SKELETON_BOW_DISPLAY : SKELETON_DISPLAY) / 2
        }px)`;
        enemy.el.style.opacity = offscreen ? "0" : String(spawnAlpha);
        enemy.el.style.zIndex = String(
          Z_BASE + Math.round(enemy.y + SKELETON_DISPLAY / 2 - 6)
        );
      } else if (isNecro) {
        const hurtActive =
          enemy.bmHurtStartedAt !== undefined &&
          now - enemy.bmHurtStartedAt < NECRO_FRAMES.hurt * NECRO_FRAME_MS.hurt;

        let anim: NecroAnim;
        let frame: number;

        if (hurtActive) {
          anim = "hurt";
          frame = Math.min(
            NECRO_FRAMES.hurt - 1,
            Math.floor((now - enemy.bmHurtStartedAt!) / NECRO_FRAME_MS.hurt)
          );
        } else if (
          enemy.bmBehavior === "attack1" ||
          enemy.bmBehavior === "attack2" ||
          enemy.bmBehavior === "attack3"
        ) {
          const attackKind: "attack1" | "attack2" | "attack3" = enemy.bmBehavior;
          const elapsed = now - (enemy.bmBehaviorStartedAt ?? now);
          const idx = Math.floor(elapsed / NECRO_FRAME_MS[attackKind]);
          if (idx >= NECRO_FRAMES[attackKind]) {
            enemy.bmBehavior = "idle";
            anim = "idle";
            frame = Math.floor(now / NECRO_FRAME_MS.idle) % NECRO_FRAMES.idle;
          } else {
            anim = attackKind;
            frame = idx;
          }
        } else if (enemy.bmBehavior === "walk") {
          anim = "walk";
          frame = Math.floor(now / NECRO_FRAME_MS.walk) % NECRO_FRAMES.walk;
        } else {
          anim = "idle";
          frame = Math.floor(now / NECRO_FRAME_MS.idle) % NECRO_FRAMES.idle;
        }

        if (enemy.el.dataset.necroAnim !== anim) {
          enemy.el.style.backgroundImage = `url(${NECRO_SHEET_SRC[anim]})`;
          enemy.el.style.backgroundSize = `${NECRO_DISPLAY * NECRO_FRAMES[anim]}px ${NECRO_DISPLAY}px`;
          enemy.el.dataset.necroAnim = anim;
        }
        enemy.el.style.backgroundPosition = `-${frame * NECRO_DISPLAY}px 0px`;
        enemy.el.style.transform = `translate(${screenX - NECRO_DISPLAY / 2}px, ${
          screenY - NECRO_DISPLAY / 2
        }px) scaleX(${enemy.bmFacingLeft ? -1 : 1})`;
        enemy.el.style.opacity = offscreen ? "0" : String(spawnAlpha);
        enemy.el.style.zIndex = String(Z_BASE + Math.round(enemy.y + NECRO_DISPLAY / 2));
      } else if (isKing) {
        const hurtActive =
          enemy.skHurtStartedAt !== undefined &&
          now - enemy.skHurtStartedAt <
            SK_KING_FRAME_COUNTS.Hurt * SK_KING_FRAME_MS.Hurt;

        let anim: SkeletonKingAnim;
        let frame: number;

        if (hurtActive) {
          anim = "Hurt";
          frame = Math.min(
            SK_KING_FRAME_COUNTS.Hurt - 1,
            Math.floor((now - enemy.skHurtStartedAt!) / SK_KING_FRAME_MS.Hurt)
          );
        } else if (
          enemy.skBehavior === "attack1" ||
          enemy.skBehavior === "attack2" ||
          (enemy.skBehavior as string) === "attack3"
        ) {
          const attackAnim: SkeletonKingAnim =
            enemy.skBehavior === "attack1"
              ? "Attack01"
              : enemy.skBehavior === "attack2"
              ? "Attack02"
              : "Attack03";
          const elapsed = now - (enemy.skBehaviorStartedAt ?? now);
          const idx = Math.floor(elapsed / SK_KING_FRAME_MS[attackAnim]);
          if (idx >= SK_KING_FRAME_COUNTS[attackAnim]) {
            enemy.skBehavior = "idle";
            anim = "Idle";
            frame =
              Math.floor(now / SK_KING_FRAME_MS.Idle) %
              SK_KING_FRAME_COUNTS.Idle;
          } else {
            anim = attackAnim;
            frame = idx;
          }
        } else if (enemy.skBehavior === "walk") {
          anim = "Walk";
          frame =
            Math.floor(now / SK_KING_FRAME_MS.Walk) %
            SK_KING_FRAME_COUNTS.Walk;
        } else {
          anim = "Idle";
          frame =
            Math.floor(now / SK_KING_FRAME_MS.Idle) %
            SK_KING_FRAME_COUNTS.Idle;
        }

        const dir = enemy.skDir ?? "Down";
        const spriteKey = `${dir}_${anim}`;
        const frameSize = SK_KING_FRAME_SIZES[anim];
        const kingDispSize = frameSize * SK_KING_SCALE;
        const totalW = kingDispSize * SK_KING_FRAME_COUNTS[anim];

        if (enemy.el.dataset.skKingKey !== spriteKey) {
          enemy.el.style.width = `${kingDispSize}px`;
          enemy.el.style.height = `${kingDispSize}px`;
          enemy.el.style.backgroundImage = `url(${skeletonKingSpriteSrc(dir, anim)})`;
          enemy.el.style.backgroundSize = `${totalW}px ${kingDispSize}px`;
          enemy.el.dataset.skKingKey = spriteKey;
        }
        enemy.el.style.backgroundPosition = `-${frame * kingDispSize}px 0px`;
        enemy.el.style.transform = `translate(${screenX - kingDispSize / 2}px, ${
          screenY - kingDispSize / 2
        }px)`;
        enemy.el.style.opacity = offscreen ? "0" : String(spawnAlpha);
        enemy.el.style.zIndex = String(
          Z_BASE + Math.round(enemy.y + (48 * SK_KING_SCALE) / 2)
        );
      } else {
        const frame = Math.floor(now / SLIME_ANIM_MS) % SLIME_COLS;
        enemy.el.style.backgroundSize = `${SLIME_COLS * dispSize}px ${SLIME_COLS * dispSize}px`;
        enemy.el.style.backgroundPosition = `-${frame * dispSize}px -${
          enemy.colorRow * dispSize
        }px`;
        enemy.el.style.width = `${dispSize}px`;
        enemy.el.style.height = `${dispSize}px`;
        enemy.el.style.transform = `translate(${screenX}px, ${screenY}px)`;
        enemy.el.style.opacity = offscreen ? "0" : String(spawnAlpha);
        enemy.el.style.zIndex = String(Z_BASE + Math.round(enemy.y + dispSize));
      }
    }

    const monsterName = enemy.kind
      ? enemy.kind === "bloodMonster"
        ? "BLOOD MONSTER"
        : enemy.kind === "goblinBeast"
        ? "GOBLIN BEAST"
        : enemy.kind === "goblinRider"
        ? "GOBLIN RIDER"
        : enemy.kind === "skeletonBow"
        ? "SKELETON BOW"
        : enemy.kind.replace(/([A-Z])/g, " $1").toUpperCase()
      : "MONSTER";
    if (enemy.hpEl && !isKing) {
      enemy.hpEl.style.width = `${Math.max(58, Math.min(140, dispSize * 0.7))}px`;
    }
    renderHpLabel(
      enemy.hpEl,
      enemy.hp,
      enemy.maxHp,
      isMelee || isGoblin || isRider || isVampire || isSkeleton || isNecro || isKing
        ? screenX - 14
        : screenX + dispSize / 2 - 14,
      isMelee || isGoblin || isRider || isVampire || isSkeleton || isNecro || isKing
        ? screenY - (isKing ? 48 * SK_KING_SCALE : dispSize) / 2 - 14
        : screenY - 14,
      offscreen,
      monsterName,
      distToPlayer <= detectionRange * 1.5,
      isKing
    );

    const contactRadius = isVampire
      ? VAMPIRE_ATTACK_RANGE
      : isSkeletonBow
      ? SKELETON_BOW_ATTACK_RANGE
      : isRider
      ? GOBLIN_RIDER_ATTACK_RANGE
      : isGoblin
      ? GOBLIN_BEAST_ATTACK_RANGE
      : isMelee
      ? 92
      : isSkeleton
      ? 80
      : isNecro
      ? 96
      : isKing
      ? 116
      : 80;
    const contactDamage = isVampire
      ? VAMPIRE_CONTACT_DAMAGE
      : isSkeletonBow
      ? SKELETON_BOW_DAMAGE
      : isRider
      ? GOBLIN_RIDER_CONTACT_DAMAGE
      : isGoblin
      ? GOBLIN_BEAST_CONTACT_DAMAGE
      : isMelee
      ? BM_CONTACT_DAMAGE
      : isSkeleton
      ? SKELETON_DAMAGE
      : isNecro
      ? NECRO_CONTACT_DAMAGE
      : isKing
      ? SK_KING_CONTACT_DAMAGE
      : 16;
    const contactCooldown = isVampire
      ? VAMPIRE_ATTACK_INTERVAL
      : isSkeletonBow
      ? SKELETON_BOW_ATTACK_INTERVAL
      : isRider
      ? GOBLIN_RIDER_ATTACK_INTERVAL
      : isGoblin
      ? GOBLIN_BEAST_ATTACK_INTERVAL
      : isMelee
      ? BM_ATTACK_INTERVAL
      : isSkeleton
      ? SKELETON_ATTACK_INTERVAL
      : isNecro
      ? NECRO_ATTACK_INTERVAL
      : isKing
      ? SK_KING_ATTACK_INTERVAL
      : 700;
    if (
      !isSpawning &&
      now - lastHitRef.current > contactCooldown &&
      canDetectTarget
    ) {
      const distToTarget =
        targetClone && targetClone.hp > 0
          ? Math.hypot(targetClone.x - enemy.x, targetClone.y - enemy.y)
          : distToPlayer;
      if (huntingBase) {
        const distToBase = Math.hypot(
          enemy.x - VILLAGE_BASE_CENTER.x,
          enemy.y - VILLAGE_BASE_CENTER.y
        );
        if (targetKind === "base" && distToBase < BASE_DEFENSE_RADIUS) {
          // Siege the base.
          lastHitRef.current = now;
          onBaseHit?.(contactDamage, enemy.x, enemy.y);
          onCombatEvent?.();
        } else if (
          targetKind === "warrior" &&
          targetWarrior &&
          targetWarrior.hp > 0 &&
          Math.hypot(targetWarrior.x - enemy.x, targetWarrior.y - enemy.y) < contactRadius
        ) {
          // Chew through the knight line first.
          lastHitRef.current = now;
          damageWarrior(targetWarrior, contactDamage, now);
          onCombatEvent?.();
        } else if (targetKind === "clone" && targetClone && targetClone.hp > 0 && distToTarget < contactRadius) {
          lastHitRef.current = now;
          damageClone(targetClone, contactDamage);
          onCombatEvent?.();
        } else if (
          targetKind === "player" &&
          distToPlayer < contactRadius &&
          now > dodgeInvulnUntil
        ) {
          lastHitRef.current = now;
          const mitigated = Math.max(
            1,
            Math.round(contactDamage - (mitigation.defense + mitigation.armor * 2) / 2)
          );
          onCombatEvent?.();
          onPlayerHit(mitigated, screenX, screenY, enemy.x, enemy.y);
        }
      } else if (targetClone && targetClone.hp > 0 && distToTarget < contactRadius) {
        // Chew through the clone instead of ignoring it.
        lastHitRef.current = now;
        damageClone(targetClone, contactDamage);
        onCombatEvent?.();
      } else if (
        !targetClone &&
        distToPlayer < contactRadius &&
        now > dodgeInvulnUntil
      ) {
        // Single HP pipeline: report damage only — the arena callback owns
        // hpRef, and page state is forced to the same value, so the HUD bar
        // and the character bar can never drift apart.
        // Defense + armor shave a visible chunk off every incoming hit.
        lastHitRef.current = now;
        const mitigated = Math.max(
          1,
          Math.round(contactDamage - (mitigation.defense + mitigation.armor * 2) / 2)
        );
        onCombatEvent?.();
        onPlayerHit(mitigated, screenX, screenY, enemy.x, enemy.y);
      }
    }
  }
}

// --- Corpses -------------------------------------------------------------
export function updateCorpses(
  now: number,
  cx: number,
  cy: number,
  w: number,
  h: number,
  bmCorpsesRef: { current: BmCorpse[] },
  skCorpsesRef: { current: SkCorpse[] },
  necroCorpsesRef: { current: NecroCorpse[] },
  skKingCorpsesRef: { current: SkKingCorpse[] }
) {
  // Blood Monster corpses
  for (const corpse of bmCorpsesRef.current) {
    const age = now - corpse.startedAt;
    const screenX = corpse.x - cx + w / 2;
    const screenY = corpse.y - cy + h / 2;
    if (corpse.el.dataset.vampireAnim === "death") {
      const frame = Math.min(
        VAMPIRE_FRAME_COUNTS.death - 1,
        Math.floor(age / VAMPIRE_FRAME_MS.death)
      );
      corpse.el.style.backgroundPosition = `-${frame * VAMPIRE_DISPLAY}px -${vampireRow("Down") * VAMPIRE_DISPLAY}px`;
      corpse.el.style.transform = `translate(${screenX - VAMPIRE_DISPLAY / 2}px, ${
        screenY - VAMPIRE_DISPLAY / 2
      }px)`;
      const deathDuration = VAMPIRE_FRAME_COUNTS.death * VAMPIRE_FRAME_MS.death;
      corpse.el.style.opacity = age > deathDuration ? "0" : "1";
      corpse.el.style.zIndex = String(Z_BASE + Math.round(corpse.y));
      continue;
    }
    if (corpse.el.dataset.goblinAnim === "death" || corpse.el.dataset.goblinRiderAnim === "death") {
      const isRider = corpse.el.dataset.goblinRiderAnim === "death";
      const displaySize = isRider ? GOBLIN_RIDER_DISPLAY : GOBLIN_BEAST_DISPLAY;
      const frameCounts = isRider ? GOBLIN_RIDER_FRAME_COUNTS : GOBLIN_BEAST_FRAME_COUNTS;
      const frameMs = isRider ? GOBLIN_RIDER_FRAME_MS : GOBLIN_BEAST_FRAME_MS;
      const frame = Math.min(
        frameCounts.death - 1,
        Math.floor(age / frameMs.death)
      );
      corpse.el.style.backgroundPosition = `-${frame * displaySize}px 0px`;
      corpse.el.style.transform = `translate(${screenX - displaySize / 2}px, ${
        screenY - displaySize / 2
      }px)`;
      const deathDuration = frameCounts.death * frameMs.death;
      corpse.el.style.opacity = age > deathDuration ? "0" : "1";
      corpse.el.style.zIndex = String(Z_BASE + Math.round(corpse.y));
      continue;
    }
    const frame = Math.min(BM_FRAMES.death - 1, Math.floor(age / BM_FRAME_MS.death));
    corpse.el.style.backgroundPosition = `-${frame * BM_DISPLAY}px 0px`;
    corpse.el.style.transform = `translate(${screenX - BM_DISPLAY / 2}px, ${
      screenY - BM_DISPLAY / 2
    }px)`;
    const deathDuration = BM_FRAMES.death * BM_FRAME_MS.death;
    corpse.el.style.opacity = age > deathDuration ? "0" : "1";
    corpse.el.style.zIndex = String(Z_BASE + Math.round(corpse.y));
  }
  if (bmCorpsesRef.current.length) {
    const stillAnimating: BmCorpse[] = [];
    for (const corpse of bmCorpsesRef.current) {
      const deathDuration =
        corpse.el.dataset.vampireAnim === "death"
          ? VAMPIRE_FRAME_COUNTS.death * VAMPIRE_FRAME_MS.death
          : corpse.el.dataset.goblinAnim === "death"
          ? GOBLIN_BEAST_FRAME_COUNTS.death * GOBLIN_BEAST_FRAME_MS.death
          : corpse.el.dataset.goblinRiderAnim === "death"
          ? GOBLIN_RIDER_FRAME_COUNTS.death * GOBLIN_RIDER_FRAME_MS.death
          : BM_FRAMES.death * BM_FRAME_MS.death;
      if (now - corpse.startedAt > deathDuration + 300) {
        corpse.el.remove();
      } else {
        stillAnimating.push(corpse);
      }
    }
    bmCorpsesRef.current = stillAnimating;
  }

  // Skeleton corpses
  for (const corpse of skCorpsesRef.current) {
    const age = now - corpse.startedAt;
    const screenX = corpse.x - cx + w / 2;
    const screenY = corpse.y - cy + h / 2;
    const isBow = corpse.bow === true;
    const frameCounts = isBow ? SKELETON_BOW_FRAME_COUNTS : SKELETON_FRAME_COUNTS;
    const frameMs = isBow ? SKELETON_BOW_FRAME_MS : SKELETON_FRAME_MS;
    const displaySize = isBow ? SKELETON_BOW_DISPLAY : SKELETON_DISPLAY;
    const frame = Math.min(
      frameCounts.Death - 1,
      Math.floor(age / frameMs.Death)
    );
    corpse.el.style.backgroundPosition = `-${frame * displaySize}px 0px`;
    corpse.el.style.transform = `translate(${screenX - displaySize / 2}px, ${
      screenY - displaySize / 2
    }px)`;
    const deathDuration = frameCounts.Death * frameMs.Death;
    corpse.el.style.opacity = age > deathDuration ? "0" : "1";
    corpse.el.style.zIndex = String(Z_BASE + Math.round(corpse.y));
  }
  if (skCorpsesRef.current.length) {
    const deathDuration = SKELETON_FRAME_COUNTS.Death * SKELETON_FRAME_MS.Death;
    const stillAnimating: SkCorpse[] = [];
    for (const corpse of skCorpsesRef.current) {
      if (now - corpse.startedAt > deathDuration + 300) {
        corpse.el.remove();
      } else {
        stillAnimating.push(corpse);
      }
    }
    skCorpsesRef.current = stillAnimating;
  }

  // Necromancer corpses
  for (const corpse of necroCorpsesRef.current) {
    const age = now - corpse.startedAt;
    const screenX = corpse.x - cx + w / 2;
    const screenY = corpse.y - cy + h / 2;
    const frame = Math.min(
      NECRO_FRAMES.death - 1,
      Math.floor(age / NECRO_FRAME_MS.death)
    );
    corpse.el.style.backgroundPosition = `-${frame * NECRO_DISPLAY}px 0px`;
    corpse.el.style.transform = `translate(${screenX - NECRO_DISPLAY / 2}px, ${
      screenY - NECRO_DISPLAY / 2
    }px) scaleX(${corpse.facingLeft ? -1 : 1})`;
    const deathDuration = NECRO_FRAMES.death * NECRO_FRAME_MS.death;
    corpse.el.style.opacity = age > deathDuration ? "0" : "1";
    corpse.el.style.zIndex = String(Z_BASE + Math.round(corpse.y));
  }
  if (necroCorpsesRef.current.length) {
    const deathDuration = NECRO_FRAMES.death * NECRO_FRAME_MS.death;
    const stillAnimating: NecroCorpse[] = [];
    for (const corpse of necroCorpsesRef.current) {
      if (now - corpse.startedAt > deathDuration + 300) {
        corpse.el.remove();
      } else {
        stillAnimating.push(corpse);
      }
    }
    necroCorpsesRef.current = stillAnimating;
  }

  // Skeleton King corpses
  for (const corpse of skKingCorpsesRef.current) {
    const age = now - corpse.startedAt;
    const screenX = corpse.x - cx + w / 2;
    const screenY = corpse.y - cy + h / 2;
    const frame = Math.min(
      SK_KING_FRAME_COUNTS.Death - 1,
      Math.floor(age / SK_KING_FRAME_MS.Death)
    );
    const dispSize = 48 * SK_KING_SCALE;
    corpse.el.style.backgroundPosition = `-${frame * dispSize}px 0px`;
    corpse.el.style.transform = `translate(${screenX - dispSize / 2}px, ${
      screenY - dispSize / 2
    }px)`;
    const deathDuration = SK_KING_FRAME_COUNTS.Death * SK_KING_FRAME_MS.Death;
    corpse.el.style.opacity = age > deathDuration ? "0" : "1";
    corpse.el.style.zIndex = String(Z_BASE + Math.round(corpse.y));
  }
  if (skKingCorpsesRef.current.length) {
    const deathDuration = SK_KING_FRAME_COUNTS.Death * SK_KING_FRAME_MS.Death;
    const stillAnimating: SkKingCorpse[] = [];
    for (const corpse of skKingCorpsesRef.current) {
      if (now - corpse.startedAt > deathDuration + 300) {
        corpse.el.remove();
      } else {
        stillAnimating.push(corpse);
      }
    }
    skKingCorpsesRef.current = stillAnimating;
  }
}

export function cleanupEnemies(
  enemies: Enemy[],
  bmCorpses: BmCorpse[],
  skCorpses: SkCorpse[],
  necroCorpses: NecroCorpse[],
  skKingCorpses: SkKingCorpse[]
) {
  enemies.forEach((e) => {
    e.el?.remove();
    e.hpEl?.remove();
  });
  bmCorpses.forEach((c) => c.el.remove());
  skCorpses.forEach((c) => c.el.remove());
  necroCorpses.forEach((c) => c.el.remove());
  skKingCorpses.forEach((c) => c.el.remove());
}



