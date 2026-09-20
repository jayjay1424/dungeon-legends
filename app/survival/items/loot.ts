import { ItemDefinition, InventoryEntry } from "./types";
import { itemById } from "./database";
import { addItem } from "./inventorySystem";

// Ids must exist in ITEM_DATABASE or rollLoot skips them.
export const LOOT_TABLES: Record<string, { id: string; chance: number }[]> = {
  slime: [{ id: "slime_material", chance: 0.85 }, { id: "common_gem", chance: 0.15 }],
  bloodMonster: [{ id: "common_ingot", chance: 0.55 }, { id: "rare_gem", chance: 0.1 }],
  goblinBeast: [{ id: "common_ingot", chance: 0.5 }, { id: "common_gem", chance: 0.25 }],
  goblinRider: [{ id: "common_ingot", chance: 0.55 }, { id: "rare_gem", chance: 0.08 }],
  skeleton: [{ id: "common_ingot", chance: 0.45 }, { id: "common_sword_common_sword_v1", chance: 0.025 }],
  skeletonBow: [{ id: "common_ingot", chance: 0.45 }, { id: "rare_gem", chance: 0.05 }],
  vampire: [{ id: "rare_ingot", chance: 0.5 }, { id: "rare_gem", chance: 0.2 }],
  demon: [{ id: "rare_ingot", chance: 0.55 }, { id: "legendary_gem", chance: 0.12 }],
  necromancer: [{ id: "legendary_ingot", chance: 0.45 }, { id: "legendary_gem", chance: 0.15 }],
  skeletonKing: [{ id: "legendary_ingot", chance: 0.6 }, { id: "mythic_gem", chance: 0.25 }, { id: "legendary_sword_legendary_sword_v1", chance: 0.14 }, { id: "egg_4", chance: 0.3 }, { id: "egg_8", chance: 0.25 }, { id: "egg_12", chance: 0.2 }, { id: "egg_16", chance: 0.15 }, { id: "egg_20", chance: 0.1 }],
};

export function rollLoot(kind = "slime"): InventoryEntry[] {
  const drops: InventoryEntry[] = [];
  for (const entry of LOOT_TABLES[kind] ?? LOOT_TABLES.slime) {
    if (Math.random() > entry.chance) continue;
    const item = itemById(entry.id);
    if (item) drops.push({ ...item, amount: 1 });
  }
  return drops;
}

export function addInventoryItem(inventory: InventoryEntry[], item: ItemDefinition, amount = 1) {
  return addItem(inventory, item, amount);
}
