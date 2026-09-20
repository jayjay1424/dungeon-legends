import { itemById } from "./database";
import { InventoryEntry, ItemDefinition } from "./types";

export function addItem(inventory: InventoryEntry[], item: ItemDefinition, amount = 1) {
  const canonical = itemById(item.id);
  if (!canonical || amount <= 0) return inventory.map((entry) => ({ ...entry }));
  const next = inventory.map((entry) => ({ ...entry }));
  let remaining = amount;
  if (canonical.stackLimit > 1) {
    for (const entry of next.filter((entry) => entry.id === canonical.id && entry.amount < canonical.stackLimit)) {
      const added = Math.min(remaining, canonical.stackLimit - entry.amount);
      entry.amount += added;
      remaining -= added;
      if (remaining === 0) return next;
    }
  }
  while (remaining > 0) {
    const added = Math.min(remaining, canonical.stackLimit);
    next.push({ ...canonical, amount: added });
    remaining -= added;
  }
  return next;
}

export function removeItem(inventory: InventoryEntry[], id: string, amount = 1) {
  if (amount <= 0) return inventory.map((entry) => ({ ...entry }));
  let remaining = amount;
  const next: InventoryEntry[] = [];
  for (const entry of inventory) {
    if (entry.id !== id || remaining === 0) {
      next.push({ ...entry });
      continue;
    }
    const removed = Math.min(entry.amount, remaining);
    remaining -= removed;
    if (entry.amount > removed) next.push({ ...entry, amount: entry.amount - removed });
  }
  return next;
}

export function sortInventory(inventory: InventoryEntry[], sortBy: "type" | "rarity" | "level" | "quantity") {
  const rarityOrder: Record<string, number> = { Common: 0, Uncommon: 1, Rare: 2, Epic: 3, Legendary: 4, Mythic: 5 };
  return [...(inventory ?? [])].filter(Boolean).sort((left, right) => {
    const leftType = left?.type ?? "";
    const rightType = right?.type ?? "";
    const leftName = left?.name ?? "";
    const rightName = right?.name ?? "";
    const leftRarity = rarityOrder[left?.rarity ?? "Common"] ?? 0;
    const rightRarity = rarityOrder[right?.rarity ?? "Common"] ?? 0;
    const leftLevel = left?.levelRequirement ?? 0;
    const rightLevel = right?.levelRequirement ?? 0;
    const leftAmount = left?.amount ?? 0;
    const rightAmount = right?.amount ?? 0;

    if (sortBy === "rarity") return rightRarity - leftRarity;
    if (sortBy === "level") return rightLevel - leftLevel;
    if (sortBy === "quantity") return rightAmount - leftAmount;
    return leftType.localeCompare(rightType) || leftName.localeCompare(rightName);
  });
}
