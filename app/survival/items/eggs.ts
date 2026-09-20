import { ItemDefinition, ItemRarity } from "./types";

// Dragon eggs: boss-only drops, hatched at the incubator vendor.
function eggRarity(n: number): ItemRarity {
  if (n <= 5) return "Common";
  if (n <= 10) return "Rare";
  if (n <= 15) return "Epic";
  return "Legendary";
}

function makeEgg(n: number): ItemDefinition {
  return {
    id: `egg_${n}`,
    name: `Dragon Egg ${n}`,
    category: "Eggs",
    type: "monster-drop",
    rarity: eggRarity(n),
    icon: `/egg/egg_${n}.png`,
    iconPath: `/egg/egg_${n}.png`,
    description: "A dragon egg dropped by the boss. Hatch it at the incubator.",
    stats: {},
    levelRequirement: 1,
    stackLimit: 99,
    craftingUsage: ["dragon hatching"],
    sellPrice: n <= 5 ? 50 : n <= 10 ? 120 : n <= 15 ? 300 : 700,
    dropChance: 0,
  };
}

export const EGG_ITEMS: Record<string, ItemDefinition> = Object.fromEntries(
  Array.from({ length: 20 }, (_, i) => {
    const item = makeEgg(i + 1);
    return [item.id, item];
  })
);

// Hatch results: random tier, goes to inventory, equippable in the
// companion slot. Equipped dragon stats apply to the player.
// Each tier renders with its own color fly sheets at the player's side:
// red uses /public/red_dragon, others use /public/dragons/<color>.
export type DragonColor =
  | "red"
  | "black"
  | "blue"
  | "green"
  | "purple"
  | "rainbow"
  | "white"
  | "yellow";

export const DRAGON_COLORS: DragonColor[] = [
  "red",
  "black",
  "blue",
  "green",
  "purple",
  "rainbow",
  "white",
  "yellow",
];

export type DragonTier = {
  id: string;
  name: string;
  rarity: ItemRarity;
  icon: string;
  stats: Record<string, number>;
  levelRequirement: number;
  weight: number;
  /** Display scale of the dragon follower in the arena. */
  spriteScale: number;
  /** Sprite color folder. "red" -> /red_dragon, others -> /dragons/<color>. */
  color: DragonColor;
  /** Lore shown in bag / incubator. Used as the item description. */
  description: string;
};

export const DRAGON_TIERS: DragonTier[] = [
  {
    id: "dragon_whelp",
    name: "Ember Whelp",
    rarity: "Common",
    icon: "/egg/dragon_red.png",
    stats: { attack: 8, hp: 30 },
    levelRequirement: 1,
    weight: 26,
    spriteScale: 0.45,
    color: "red",
    description: "A hot-headed red hatchling that hatched crackling with embers. Loyal and hardy — a perfect first companion. Equip as companion to fly at your side.",
  },
  {
    id: "dragon_yellow",
    name: "Sunscale Whelp",
    rarity: "Uncommon",
    icon: "/egg/dragon_yellow.png",
    stats: { attack: 11, hp: 45 },
    levelRequirement: 5,
    weight: 20,
    spriteScale: 0.5,
    color: "yellow",
    description: "A sun-yellow wyrmling that basks in battle-light. Quick and cheerful, it sharpens its adventurer's strikes. Equip as companion to fly at your side.",
  },
  {
    id: "dragon_drake",
    name: "Thorn Drake",
    rarity: "Rare",
    icon: "/egg/dragon_green.png",
    stats: { attack: 15, hp: 60, critChance: 3 },
    levelRequirement: 10,
    weight: 18,
    spriteScale: 0.55,
    color: "green",
    description: "A forest-green drake with vine-tough scales. It stalks beside you like a jungle guard, landing keen critical bites. Equip as companion.",
  },
  {
    id: "dragon_blue",
    name: "Tide Drake",
    rarity: "Rare",
    icon: "/egg/dragon_blue.png",
    stats: { attack: 19, hp: 80, critChance: 3 },
    levelRequirement: 14,
    weight: 12,
    spriteScale: 0.6,
    color: "blue",
    description: "A deep-blue drake born of storm seas. Calm and resilient, it shields you with ocean-born vitality. Equip as companion.",
  },
  {
    id: "dragon_wyvern",
    name: "Dusk Wyvern",
    rarity: "Epic",
    icon: "/egg/dragon_purple.png",
    stats: { attack: 25, hp: 100, skillPower: 10 },
    levelRequirement: 20,
    weight: 10,
    spriteScale: 0.65,
    color: "purple",
    description: "A violet wyvern that hunts at twilight. It channels dusk magic into your skills, striking from the shadows. Equip as companion.",
  },
  {
    id: "dragon_white",
    name: "Frost Wyvern",
    rarity: "Epic",
    icon: "/egg/dragon_white.png",
    stats: { attack: 32, hp: 130, skillPower: 12 },
    levelRequirement: 25,
    weight: 7,
    spriteScale: 0.72,
    color: "white",
    description: "A pale-white wyvern from the high peaks. Its icy breath steadies your aim and hardens your resolve. Equip as companion.",
  },
  {
    id: "dragon_elder",
    name: "Night Elder",
    rarity: "Legendary",
    icon: "/egg/dragon_black.png",
    stats: { attack: 40, hp: 160, critChance: 5, skillPower: 15 },
    levelRequirement: 30,
    weight: 5,
    spriteScale: 0.8,
    color: "black",
    description: "An ancient black elder wreathed in shadow. Feared by bosses, it lends crushing strength to proven adventurers. Equip as companion.",
  },
  {
    id: "dragon_rainbow",
    name: "Prism Sovereign",
    rarity: "Mythic",
    icon: "/egg/dragon_rainbow.png",
    stats: { attack: 55, hp: 220, critChance: 8, skillPower: 20 },
    levelRequirement: 35,
    weight: 2,
    spriteScale: 0.9,
    color: "rainbow",
    description: "A mythic rainbow sovereign — one in a hundred hatchlings. Reality shimmers where it flies. The ultimate companion. Equip as companion.",
  },
];

export const DRAGON_IDS = DRAGON_TIERS.map((t) => t.id);

export function isDragonId(id?: string | null): boolean {
  return !!id && DRAGON_IDS.includes(id);
}

export function dragonTierById(id?: string | null): DragonTier | null {
  if (!id) return null;
  return DRAGON_TIERS.find((t) => t.id === id) ?? null;
}

export function dragonColorFor(id?: string | null): DragonColor {
  return dragonTierById(id)?.color ?? "red";
}

export const DRAGON_ITEMS: Record<string, ItemDefinition> = Object.fromEntries(
  DRAGON_TIERS.map((tier) => [
    tier.id,
    {
      id: tier.id,
      name: tier.name,
      category: "Dragons",
      type: "accessory",
      rarity: tier.rarity,
      icon: tier.icon,
      iconPath: tier.icon,
      description: tier.description,
      stats: tier.stats,
      levelRequirement: tier.levelRequirement,
      stackLimit: 1,
      craftingUsage: ["companion bonus"],
      sellPrice: 200,
      dropChance: 0,
      equipmentSlot: "companion" as const,
    },
  ])
);

export function rollDragonTier(): DragonTier {
  const total = DRAGON_TIERS.reduce((sum, tier) => sum + tier.weight, 0);
  let roll = Math.random() * total;
  for (const tier of DRAGON_TIERS) {
    roll -= tier.weight;
    if (roll <= 0) return tier;
  }
  return DRAGON_TIERS[0];
}

export const HATCH_COST_GOLD = 300;
