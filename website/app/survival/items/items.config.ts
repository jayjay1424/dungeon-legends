import { EquipmentSlot, ItemDefinition, ItemRarity, Rarity } from "./types";

export const RARITY_ORDER: Rarity[] = ["common", "rare", "legendary", "mythic"];
export const RARITY_MULTIPLIER: Record<Rarity, number> = { common: 1, rare: 1.6, legendary: 2.4, mythic: 3.2 };
export const VERSION_MULTIPLIER: Record<number, number> = { 1: 1, 2: 1.2, 3: 1.45, 4: 1.6 };

type EquipmentAsset = {
  file: string;
  category: "Armor" | "Helmet" | "Rings" | "Sword" | "Shop Items";
  kind: "armor" | "helmet" | "ring" | "sword";
  rarity: ItemRarity;
  version?: number;
};

// Browser code cannot enumerate public files, so this is the verified manifest of every equipment PNG.
const EQUIPMENT_ASSETS: EquipmentAsset[] = [
  { file: "common_armor.png", category: "Armor", kind: "armor", rarity: "Common" },
  { file: "epic_armor.png", category: "Armor", kind: "armor", rarity: "Epic" },
  { file: "legendary_armor.png", category: "Armor", kind: "armor", rarity: "Legendary" },
  { file: "rare_armor.png", category: "Armor", kind: "armor", rarity: "Rare" },
  { file: "mythic_armor.png", category: "Armor", kind: "armor", rarity: "Mythic" },
  { file: "common_helmet_v1.png", category: "Helmet", kind: "helmet", rarity: "Common", version: 1 },
  { file: "common_helmet_v2.png", category: "Helmet", kind: "helmet", rarity: "Common", version: 2 },
  { file: "legendary_helmet_v1.png", category: "Helmet", kind: "helmet", rarity: "Legendary", version: 1 },
  { file: "legeendary_helmet_v1.png", category: "Helmet", kind: "helmet", rarity: "Legendary", version: 1 },
  { file: "rare_helmet_v1.png", category: "Helmet", kind: "helmet", rarity: "Rare", version: 1 },
  { file: "rare_helmet_v2.png", category: "Helmet", kind: "helmet", rarity: "Rare", version: 2 },
  { file: "mythic_helmet_v1.png", category: "Helmet", kind: "helmet", rarity: "Mythic", version: 1 },
  { file: "mythic_helmet_v2.png", category: "Helmet", kind: "helmet", rarity: "Mythic", version: 2 },
  { file: "common_ring_v1.png", category: "Rings", kind: "ring", rarity: "Common", version: 1 },
  { file: "common_ring_v2.png", category: "Rings", kind: "ring", rarity: "Common", version: 2 },
  { file: "common_ring_v3.png", category: "Rings", kind: "ring", rarity: "Common", version: 3 },
  { file: "legendary_ring_v1.png", category: "Rings", kind: "ring", rarity: "Legendary", version: 1 },
  { file: "legendary_ring_v2.png", category: "Rings", kind: "ring", rarity: "Legendary", version: 2 },
  { file: "legendary_ring_v3.png", category: "Rings", kind: "ring", rarity: "Legendary", version: 3 },
  { file: "rare_ring_v1.png", category: "Rings", kind: "ring", rarity: "Rare", version: 1 },
  { file: "rare_ring_v2.png", category: "Rings", kind: "ring", rarity: "Rare", version: 2 },
  { file: "rare_ring_v3.png", category: "Rings", kind: "ring", rarity: "Rare", version: 3 },
  { file: "mythic_ring_v.png", category: "Rings", kind: "ring", rarity: "Mythic" },
  { file: "mythic_ring_v1.png", category: "Rings", kind: "ring", rarity: "Mythic", version: 1 },
  { file: "mythic_ring_v2.png", category: "Rings", kind: "ring", rarity: "Mythic", version: 2 },
  { file: "mythic_ring_v3.png", category: "Rings", kind: "ring", rarity: "Mythic", version: 3 },
  { file: "common_sword_v1.png", category: "Sword", kind: "sword", rarity: "Common", version: 1 },
  { file: "common_sword_v2.png", category: "Sword", kind: "sword", rarity: "Common", version: 2 },
  { file: "common_sword_v3.png", category: "Sword", kind: "sword", rarity: "Common", version: 3 },
  { file: "rare_sword_v1.png", category: "Sword", kind: "sword", rarity: "Rare", version: 1 },
  { file: "rare_sword_v2.png", category: "Sword", kind: "sword", rarity: "Rare", version: 2 },
  { file: "rare_sword_v4.png", category: "Sword", kind: "sword", rarity: "Rare", version: 4 },
  { file: "legendary_sword_v1.png", category: "Sword", kind: "sword", rarity: "Legendary", version: 1 },
  { file: "legendary_sword_v2.png", category: "Sword", kind: "sword", rarity: "Legendary", version: 2 },
  { file: "mythic_sword_v1.png", category: "Sword", kind: "sword", rarity: "Mythic", version: 1 },
  { file: "mythic_sword_v2.png", category: "Sword", kind: "sword", rarity: "Mythic", version: 2 },
  { file: "shop_ring_v1.png", category: "Shop Items", kind: "ring", rarity: "Common", version: 1 },
  { file: "shop_sword_v1.png", category: "Shop Items", kind: "sword", rarity: "Common", version: 1 },
  { file: "shop_sword_v2.png", category: "Shop Items", kind: "sword", rarity: "Common", version: 2 },
  { file: "shop_sword_v3.png", category: "Shop Items", kind: "sword", rarity: "Common", version: 3 },
  { file: "secret_ring.png", category: "Shop Items", kind: "ring", rarity: "Mythic" },
  { file: "secret_sword.png", category: "Shop Items", kind: "sword", rarity: "Mythic" },
  { file: "ultra_sword_v1.png", category: "Shop Items", kind: "sword", rarity: "Mythic", version: 1 },
];

const MATERIAL_ASSETS = [
  ["from_slime.png", "Slime Material", "Common"], ["common_gem.png", "Common Gem", "Common"],
  ["comon_ingot.png", "Common Ingot", "Common"], ["rare_gem.png", "Rare Gem", "Rare"],
  ["rare_ingot.png", "Rare Ingot", "Rare"], ["legendary_gem.png", "Legendary Gem", "Legendary"],
  ["legendary_ingot.png", "Legendary Ingot", "Legendary"], ["mythic_gem.png", "Mythic Gem", "Mythic"],
  ["mythic_ingot.png", "Mythic Ingot", "Mythic"],
] as const;

const rarityKey = (rarity: ItemRarity): Rarity => rarity.toLowerCase() as Rarity;
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const pathFor = (folder: string, file: string) => `/items/${encodeURIComponent(folder)}/${encodeURIComponent(file)}`;

function equipmentStats(kind: EquipmentAsset["kind"], rarity: ItemRarity, version = 1) {
  const multiplier = (RARITY_MULTIPLIER[rarityKey(rarity)] ?? 1) * (VERSION_MULTIPLIER[version] ?? 1);
  const base = kind === "sword" ? { attack: 10, critChance: 2, attackSpeed: 0.04 } : kind === "armor" ? { defense: 18, hp: 80, damageReduction: 2 } : kind === "helmet" ? { defense: 10, hp: 35, resistance: 3 } : { critChance: 4, luck: 2, skillPower: 4 };
  return Object.fromEntries(Object.entries(base).map(([key, value]) => [key, key === "attackSpeed" ? Number((value * multiplier).toFixed(2)) : Math.round(value * multiplier)]));
}

function makeEquipment(asset: EquipmentAsset): ItemDefinition {
  const name = `${asset.rarity} ${asset.kind[0].toUpperCase()}${asset.kind.slice(1)}${asset.version ? ` v${asset.version}` : ""}`;
  const id = slug(`${asset.rarity}_${asset.kind}_${asset.file.replace(".png", "")}`);
  const equipmentSlot: EquipmentSlot = asset.kind === "sword" ? "weapon" : asset.kind === "armor" ? "chest" : asset.kind === "helmet" ? "helmet" : "ring";
  const rarityMultiplier = RARITY_MULTIPLIER[rarityKey(asset.rarity)] ?? 1;
  return { id, name, category: asset.category, version: asset.version, type: asset.kind === "ring" ? "accessory" : asset.kind === "sword" ? "weapon" : "armor", rarity: asset.rarity, icon: pathFor("equip", asset.file), iconPath: pathFor("equip", asset.file), description: `${name} from the existing ${asset.category.toLowerCase()} collection.`, stats: equipmentStats(asset.kind, asset.rarity, asset.version), levelRequirement: Math.max(1, Math.ceil(rarityMultiplier * (asset.version ?? 1))), stackLimit: 1, craftingUsage: [asset.kind === "ring" ? "ring enhancement" : `${asset.kind} crafting`], sellPrice: Math.round(25 * rarityMultiplier * (asset.version ?? 1)), dropChance: asset.rarity === "Common" ? 60 : asset.rarity === "Rare" ? 25 : asset.rarity === "Legendary" ? 10 : 5, equipmentSlot };
}

export function buildGeneratedEquipmentCatalog(): Record<string, ItemDefinition> {
  return Object.fromEntries(EQUIPMENT_ASSETS.map((asset) => { const item = makeEquipment(asset); return [item.id, item]; }));
}

export function generateMaterialCatalog(): Record<string, ItemDefinition> {
  return Object.fromEntries(MATERIAL_ASSETS.map(([file, name, rarity]) => {
    const item: ItemDefinition = { id: slug(name), name, category: "Materials", type: "material", rarity: rarity as ItemRarity, icon: pathFor("materials for craft", file), iconPath: pathFor("materials for craft", file), description: `${name} used by recipes for equipment and upgrades.`, stats: {}, levelRequirement: 1, stackLimit: 999, craftingUsage: [name.includes("Gem") ? "rings and enhancements" : name.includes("Ingot") ? "weapons and armor" : "health potions"], sellPrice: rarity === "Common" ? 4 : rarity === "Rare" ? 12 : rarity === "Legendary" ? 30 : 60, dropChance: rarity === "Common" ? 60 : rarity === "Rare" ? 25 : rarity === "Legendary" ? 10 : 5 };
    return [item.id, item];
  }));
}

export const allGeneratedItems: Record<string, ItemDefinition> = {
  ...buildGeneratedEquipmentCatalog(),
  ...generateMaterialCatalog(),
  heal_potion_from_shop: { id: "heal_potion_from_shop", name: "Health Potion", category: "Shop Items", type: "consumable", rarity: "Common", icon: pathFor("use", "heal_potion_from_shop.png"), iconPath: pathFor("use", "heal_potion_from_shop.png"), description: "A shop potion that restores health.", stats: { hp: 100 }, levelRequirement: 1, stackLimit: 99, craftingUsage: ["health recovery"], sellPrice: 10, dropChance: 0 },
};

export const knownGeneratedItemIds = Object.keys(allGeneratedItems);
