// arena/inspect.ts — data for the click-to-inspect portrait + details card.
// Covers enemies, ambient NPC villagers and the three vendor stalls.
// Portraits reuse the exact in-world sprite assets (no new art needed).

import type { Enemy, Npc, Warrior } from "./types";
import {
  BM_CONTACT_DAMAGE,
  BM_ATTACK_RANGE,
  GOBLIN_BEAST_CONTACT_DAMAGE,
  GOBLIN_BEAST_ATTACK_RANGE,
  GOBLIN_RIDER_CONTACT_DAMAGE,
  GOBLIN_RIDER_ATTACK_RANGE,
  VAMPIRE_CONTACT_DAMAGE,
  VAMPIRE_ATTACK_RANGE,
  NECRO_CONTACT_DAMAGE,
  NECRO_ATTACK_RANGE,
  SKELETON_DAMAGE,
  SKELETON_ATTACK_RANGE,
  SKELETON_BOW_DAMAGE,
  SKELETON_BOW_ATTACK_RANGE,
  SK_KING_CONTACT_DAMAGE,
  SK_KING_ATTACK_RANGE,
  enemyDetectionRange,
  getMonsterCamp,
} from "./enemies";
import { LOOT_TABLES } from "../items/loot";
import { itemById } from "../items/database";
import { NPC_CHAR_COUNT } from "./npcs";
import {
  WARRIOR_DAMAGE,
  WARRIOR_RANGE,
  WARRIOR_DETECT_RADIUS,
  WARRIOR_GUARD_RADIUS,
  WARRIOR_SPEED,
} from "./warriors";

export type EnemyKind = NonNullable<Enemy["kind"]>;

export interface EnemyDrop {
  name: string;
  chance: number;
}

export interface InspectedEnemy {
  id: number;
  kind: EnemyKind;
  name: string;
  hp: number;
  maxHp: number;
  damage: number;
  range: number;
  detect: number;
  camp: string;
  zone: string;
  drops: EnemyDrop[];
  colorRow: number;
  isBoss: boolean;
}

export interface NpcInspect {
  id: number;
  charIndex: number;
  name: string;
  state: string;
  hp: number;
  maxHp: number;
}

export type VendorId = "store" | "craft" | "incubator";

export interface VendorInfo {
  id: VendorId;
  name: string;
  src: string;
  description: string;
  keyHint: string;
  openLabel: string;
}

export const VENDOR_INFO: Record<VendorId, VendorInfo> = {
  store: {
    id: "store",
    name: "General Store",
    src: "/store.png",
    description:
      "The village merchant's stall. Stocks potions and basic gear for gold. Walk up close and press F to browse.",
    keyHint: "F",
    openLabel: "OPEN STORE",
  },
  craft: {
    id: "craft",
    name: "Crafting Forge",
    src: "/craft.png",
    description:
      "The blacksmith's forge. Turn monster materials into weapons and armor. Walk up close and press C to craft.",
    keyHint: "C",
    openLabel: "OPEN CRAFTING",
  },
  incubator: {
    id: "incubator",
    name: "Dragon Incubator",
    src: "/incubator.png",
    description:
      "A warm enchanted nest. Hatches boss-dropped dragon eggs into companions. Walk up close and press V to hatch.",
    keyHint: "V",
    openLabel: "OPEN INCUBATOR",
  },
};

/** Mirrors the in-world HP label mapping in enemies.ts (monsterName). */
export function enemyDisplayName(kind?: Enemy["kind"]): string {
  if (!kind) return "MONSTER";
  if (kind === "bloodMonster") return "BLOOD MONSTER";
  if (kind === "goblinBeast") return "GOBLIN BEAST";
  if (kind === "goblinRider") return "GOBLIN RIDER";
  if (kind === "skeletonBow") return "SKELETON BOW";
  return kind.replace(/([A-Z])/g, " $1").toUpperCase();
}

const ENEMY_COMBAT: Record<EnemyKind, { damage: number; range: number }> = {
  slime: { damage: 8, range: 40 },
  bloodMonster: { damage: BM_CONTACT_DAMAGE, range: BM_ATTACK_RANGE },
  demon: { damage: BM_CONTACT_DAMAGE, range: BM_ATTACK_RANGE },
  goblinBeast: { damage: GOBLIN_BEAST_CONTACT_DAMAGE, range: GOBLIN_BEAST_ATTACK_RANGE },
  goblinRider: { damage: GOBLIN_RIDER_CONTACT_DAMAGE, range: GOBLIN_RIDER_ATTACK_RANGE },
  skeleton: { damage: SKELETON_DAMAGE, range: SKELETON_ATTACK_RANGE },
  skeletonBow: { damage: SKELETON_BOW_DAMAGE, range: SKELETON_BOW_ATTACK_RANGE },
  vampire: { damage: VAMPIRE_CONTACT_DAMAGE, range: VAMPIRE_ATTACK_RANGE },
  necromancer: { damage: NECRO_CONTACT_DAMAGE, range: NECRO_ATTACK_RANGE },
  skeletonKing: { damage: SK_KING_CONTACT_DAMAGE, range: SK_KING_ATTACK_RANGE },
};

export function lootDropsFor(kind?: Enemy["kind"]): EnemyDrop[] {
  const table = LOOT_TABLES[kind ?? "slime"] ?? LOOT_TABLES.slime;
  return table.map((entry) => ({
    name: itemById(entry.id)?.name ?? entry.id,
    chance: entry.chance,
  }));
}

export function buildEnemyInspect(enemy: Enemy): InspectedEnemy | null {
  if (!enemy.kind) return null;
  const kind = enemy.kind;
  const combat = ENEMY_COMBAT[kind];
  const camp = getMonsterCamp(kind);
  return {
    id: enemy.id,
    kind,
    name: enemyDisplayName(kind),
    hp: Math.max(0, Math.round(enemy.hp)),
    maxHp: Math.round(enemy.maxHp),
    damage: combat.damage,
    range: combat.range,
    detect: enemyDetectionRange(kind),
    camp: camp.name,
    zone: camp.zone,
    drops: lootDropsFor(kind),
    colorRow: enemy.colorRow,
    isBoss: kind === "skeletonKing",
  };
}

const NPC_NAMES = [
  "Ash",
  "Birch",
  "Clover",
  "Dain",
  "Elowen",
  "Fen",
  "Gale",
  "Hazel",
  "Ivo",
  "Juniper",
  "Kell",
  "Lark",
  "Moss",
  "Nia",
  "Otto",
];

export function npcName(charIndex: number): string {
  if (charIndex >= 0 && charIndex < NPC_NAMES.length) return NPC_NAMES[charIndex];
  return `Villager #${charIndex + 1}`;
}

export function buildNpcInspect(npc: Npc): NpcInspect {
  return {
    id: npc.id,
    charIndex: npc.charIndex,
    name: npcName(npc.charIndex),
    state: npc.state,
    hp: Math.max(0, Math.round(npc.hp)),
    maxHp: Math.round(npc.maxHp),
  };
}

export interface PortraitSpec {
  src: string;
  /** Native sheet size. */
  sheetW: number;
  sheetH: number;
  /** Top-left of the frame to show, native px. */
  fx: number;
  fy: number;
  /** Frame size, native px. */
  fw: number;
  fh: number;
}

/** First idle frame (facing down) for each enemy kind. Dimensions verified from /public PNGs. */
export function enemyPortraitSpec(kind: EnemyKind, colorRow = 0): PortraitSpec {
  switch (kind) {
    case "slime":
      return { src: "/slime-sheet.png", sheetW: 192, sheetH: 192, fx: 0, fy: colorRow * 32, fw: 32, fh: 32 };
    case "bloodMonster":
      return { src: "/blood-monster-idle.png", sheetW: 600, sheetH: 100, fx: 0, fy: 0, fw: 100, fh: 100 };
    case "demon":
      return { src: "/Demon_A_Idle.png", sheetW: 600, sheetH: 100, fx: 0, fy: 0, fw: 100, fh: 100 };
    case "goblinBeast":
      return { src: "/GoblinBeastDownIdle.png", sheetW: 288, sheetH: 48, fx: 0, fy: 0, fw: 48, fh: 48 };
    case "goblinRider":
      return { src: "/GoblinRiderIdle.png", sheetW: 400, sheetH: 80, fx: 0, fy: 0, fw: 80, fh: 80 };
    case "skeleton":
      return { src: "/SkeletonWithSwordDownIdle.png", sheetW: 288, sheetH: 48, fx: 0, fy: 0, fw: 48, fh: 48 };
    case "skeletonBow":
      return { src: "/SkeletonWithBowDownIdle.png", sheetW: 288, sheetH: 48, fx: 0, fy: 0, fw: 48, fh: 48 };
    case "vampire":
      return { src: "/Vampires1_Idle_full.png", sheetW: 256, sheetH: 256, fx: 0, fy: 0, fw: 64, fh: 64 };
    case "necromancer":
      return { src: "/NecromancerRightIdle.png", sheetW: 288, sheetH: 48, fx: 0, fy: 0, fw: 48, fh: 48 };
    case "skeletonKing":
      return { src: "/SkeletonKingDownIdle.png", sheetW: 288, sheetH: 48, fx: 0, fy: 0, fw: 48, fh: 48 };
  }
}

/** Villager portrait: first frame, facing down. npc-sheet is 64x1440 (4 cols x 60 rows of 16x24). */
export function npcPortraitSpec(charIndex: number): PortraitSpec {
  const safe = charIndex >= 0 && charIndex < NPC_CHAR_COUNT ? charIndex : 0;
  return { src: "/npc-sheet.png", sheetW: 64, sheetH: 1440, fx: 0, fy: safe * 4 * 24, fw: 16, fh: 24 };
}

export interface WarriorInspect {
  id: number;
  name: string;
  state: string;
  hp: number;
  maxHp: number;
  damage: number;
  range: number;
  detect: number;
  guardRadius: number;
  speed: number;
}

const WARRIOR_NAMES = ["Bram", "Cole", "Dirk", "Errol"];

export function warriorName(id: number): string {
  return WARRIOR_NAMES[((id % WARRIOR_NAMES.length) + WARRIOR_NAMES.length) % WARRIOR_NAMES.length];
}

export function buildWarriorInspect(warrior: Warrior): WarriorInspect {
  return {
    id: warrior.id,
    name: warriorName(warrior.id),
    state: warrior.state,
    hp: Math.max(0, Math.round(warrior.hp)),
    maxHp: Math.round(warrior.maxHp),
    damage: WARRIOR_DAMAGE,
    range: WARRIOR_RANGE,
    detect: WARRIOR_DETECT_RADIUS,
    guardRadius: WARRIOR_GUARD_RADIUS,
    speed: WARRIOR_SPEED,
  };
}

/** Guard portrait: first idle frame, facing down. WarriorDownIdle is 240x48 (5 frames of 48). */
export function warriorPortraitSpec(): PortraitSpec {
  return { src: "/WarriorDownIdle.png", sheetW: 240, sheetH: 48, fx: 0, fy: 0, fw: 48, fh: 48 };
}
