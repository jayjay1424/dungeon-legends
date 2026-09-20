export type ItemRarity = "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary" | "Mythic";
export type Rarity = "common" | "rare" | "legendary" | "mythic";
export type ItemType =
  | "weapon"
  | "armor"
  | "accessory"
  | "consumable"
  | "material"
  | "monster-drop"
  | "quest"
  | "currency";
export type EquipSlot = "armor" | "helmet" | "rings" | "sword";
export type EquipmentSlot = "weapon" | "helmet" | "chest" | "gloves" | "boots" | "offhand" | "ring" | "necklace" | "amulet" | "companion";

export type SpritePosition = {
  x: number;
  y: number;
  width: 48;
  height: 48;
};

export type ItemStats = Record<string, number>;

export type ItemDefinition = {
  id: string;
  name: string;
  category: string;
  version?: number;
  type: ItemType;
  rarity: ItemRarity;
  icon: string;
  iconPath?: string;
  description: string;
  stats: ItemStats;
  levelRequirement: number;
  stackLimit: number;
  craftingUsage: string[];
  sellPrice: number;
  dropChance: number;
  durationSeconds?: number;
  equipmentSlot?: EquipmentSlot;
};

export type InventoryEntry = ItemDefinition & {
  amount: number;
};

export type GroundDrop = {
  id: string;
  item: ItemDefinition;
  amount: number;
  x: number;
  y: number;
  el: HTMLDivElement | null;
};

export const RARITY_COLORS: Record<ItemRarity, string> = {
  Common: "#cbd5e1",
  Uncommon: "#4ade80",
  Rare: "#60a5fa",
  Epic: "#c084fc",
  Legendary: "#fbbf24",
  Mythic: "#f43f5e",
};

export type { EquipmentState } from "./equipmentSystem";
