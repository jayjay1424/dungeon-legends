import { ITEM_DATABASE } from "./database";
import { InventoryEntry, ItemDefinition } from "./types";

export type LootRarity = "common" | "rare" | "legendary" | "mythic";

export const ZONE_LOOT_TABLES: Record<string, Record<LootRarity, number>> = {
  slime: { common: 60, rare: 28, legendary: 9, mythic: 3 },
  forest: { common: 62, rare: 26, legendary: 10, mythic: 2 },
  dungeon: { common: 50, rare: 30, legendary: 15, mythic: 5 },
  demon: { common: 30, rare: 35, legendary: 25, mythic: 10 },
};

const VERSION_WEIGHTS: Record<1 | 2 | 3, number> = { 1: 70, 2: 25, 3: 5 };

function weightedPick<T extends string>(weights: Record<T, number>): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = Math.random() * total;

  for (const [key, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return key;
  }

  return entries[entries.length - 1][0];
}

function pickVersion(): 1 | 2 | 3 {
  const roll = Math.random() * 100;
  if (roll <= VERSION_WEIGHTS[1]) return 1;
  if (roll <= VERSION_WEIGHTS[1] + VERSION_WEIGHTS[2]) return 2;
  return 3;
}

function buildGeneratedItemForLoot(kind: "equipment" | "material", rarity: LootRarity): ItemDefinition | null {
  const rarityLabel = rarity[0].toUpperCase() + rarity.slice(1);
  const candidates = Object.values(ITEM_DATABASE).filter((item) => {
    if (item.rarity !== rarityLabel) return false;
    if (kind === "material") return item.category === "Materials";
    return item.equipmentSlot !== undefined && item.category !== "Shop Items";
  });
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
}

export function rollLoot(zoneOrEnemyId = "slime"): InventoryEntry[] {
  const table = ZONE_LOOT_TABLES[zoneOrEnemyId] ?? ZONE_LOOT_TABLES.slime;
  const rarity = weightedPick(table);
  const isEquipment = Math.random() <= 0.72;
  const item = buildGeneratedItemForLoot(isEquipment ? "equipment" : "material", rarity);

  if (!item) return [];
  return [{ ...item, amount: 1 }];
}

export function rollLootTable(zoneOrEnemyId = "slime") {
  return ZONE_LOOT_TABLES[zoneOrEnemyId] ?? ZONE_LOOT_TABLES.slime;
}

export function generateLootDrop(zoneOrEnemyId = "slime") {
  const loot = rollLoot(zoneOrEnemyId);
  return loot[0] ?? null;
}

export const lootSeedExamples = Object.keys(ZONE_LOOT_TABLES);
