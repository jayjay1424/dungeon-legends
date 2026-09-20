import { itemById } from "./database";
import { InventoryEntry, ItemDefinition } from "./types";

export function createItem(id: string, amount = 1): InventoryEntry | null {
  const item = itemById(id);
  if (!item || amount <= 0) return null;
  return { ...item, amount: Math.min(amount, item.stackLimit) };
}

export function canonicalItem(item: Partial<ItemDefinition> & { id: string }) {
  return itemById(item.id) ?? null;
}

export function normalizeInventory(entries: unknown): InventoryEntry[] {
  if (!Array.isArray(entries)) return [];
  return entries.reduce<InventoryEntry[]>((inventory, entry) => {
    if (!entry || typeof entry !== "object" || !("id" in entry) || typeof entry.id !== "string") return inventory;
    const item = createItem(entry.id, typeof entry.amount === "number" ? entry.amount : 1);
    if (!item) return inventory;
    const existing = inventory.find((candidate) => candidate.id === item.id && item.stackLimit > 1 && candidate.amount < item.stackLimit);
    if (existing) existing.amount = Math.min(item.stackLimit, existing.amount + item.amount);
    else inventory.push(item);
    return inventory;
  }, []);
}

export function normalizeEquipment(equipment: unknown) {
  if (!equipment || typeof equipment !== "object") return {};
  return Object.entries(equipment).reduce<Record<string, InventoryEntry | null>>((normalized, [slot, value]) => {
    if (!value || typeof value !== "object" || !("id" in value) || typeof value.id !== "string") return normalized;
    const item = createItem(value.id);
    if (item?.equipmentSlot === slot) normalized[slot] = item;
    return normalized;
  }, {});
}
