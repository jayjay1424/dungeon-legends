import { itemById } from "./database";
import { EquipmentSlot, InventoryEntry } from "./types";
import { removeItem } from "./inventorySystem";

export type EquipmentState = Partial<Record<EquipmentSlot, InventoryEntry | null>>;

export function equipmentBonuses(equipment: EquipmentState) {
  return Object.values(equipment).reduce<Record<string, number>>((bonuses, item) => {
    if (!item) return bonuses;
    for (const [key, value] of Object.entries(item.stats)) {
      bonuses[key] = (bonuses[key] ?? 0) + value;
    }
    return bonuses;
  }, {});
}

export function equipItem(
  inventory: InventoryEntry[],
  equipment: EquipmentState,
  item: InventoryEntry,
  playerLevel = Number.MAX_SAFE_INTEGER
) {
  const canonical = itemById(item.id);
  if (!canonical?.equipmentSlot || item.amount < 1 || canonical.levelRequirement > playerLevel) return { inventory, equipment };
  const slot = canonical.equipmentSlot;
  const previous = equipment[slot] ?? null;
  const nextInventory = removeItem(inventory, item.id, 1);
  if (previous) nextInventory.push({ ...previous, amount: 1 });
  return {
    inventory: nextInventory,
    equipment: { ...equipment, [slot]: { ...canonical, amount: 1 } },
  };
}

export function unequipItem(inventory: InventoryEntry[], equipment: EquipmentState, slot: EquipmentSlot) {
  const item = equipment[slot] ?? null;
  if (!item) return { inventory: inventory.map((entry) => ({ ...entry })), equipment };
  return {
    inventory: [...inventory.map((entry) => ({ ...entry })), { ...item, amount: 1 }],
    equipment: { ...equipment, [slot]: null },
  };
}
