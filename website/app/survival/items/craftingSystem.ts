import { addItem, removeItem } from "./inventorySystem";
import { itemById } from "./database";
import { InventoryEntry, ItemDefinition } from "./types";

export type CraftRecipe = {
  id: string;
  name: string;
  resultId: string;
  requiredMaterials: Array<{ id: string; amount: number }>;
};

export const CRAFTING_RECIPES: Record<string, CraftRecipe> = {
  health_potion: {
    id: "health_potion",
    name: "Health Potion",
    resultId: "heal_potion_from_shop",
    requiredMaterials: [{ id: "slime_material", amount: 3 }],
  },
  armor_common: {
    id: "armor_common",
    name: "Common Armor",
    resultId: "common_armor_common_armor",
    requiredMaterials: [{ id: "common_ingot", amount: 5 }],
  },
  helmet_common: {
    id: "helmet_common",
    name: "Common Helmet",
    resultId: "common_helmet_common_helmet_v1",
    requiredMaterials: [{ id: "common_ingot", amount: 4 }],
  },
  ring_common: {
    id: "ring_common",
    name: "Common Ring",
    resultId: "common_ring_common_ring_v1",
    requiredMaterials: [{ id: "common_gem", amount: 4 }],
  },
  sword_common: {
    id: "sword_common",
    name: "Common Sword",
    resultId: "common_sword_common_sword_v1",
    requiredMaterials: [{ id: "common_ingot", amount: 3 }, { id: "common_gem", amount: 2 }],
  },
};

export function craftItem(recipeId: string, inventory: InventoryEntry[]) {
  const recipe = CRAFTING_RECIPES[recipeId];
  if (!recipe) {
    return { success: false, reason: "invalid_recipe", inventory: inventory.map((entry) => ({ ...entry })) };
  }

  const result = itemById(recipe.resultId);
  if (!result) {
    return { success: false, reason: "unknown_result_item", inventory: inventory.map((entry) => ({ ...entry })) };
  }

  const nextInventory = inventory.map((entry) => ({ ...entry }));
  const missing: Array<{ id: string; amount: number; available: number }> = [];

  for (const requirement of recipe.requiredMaterials) {
    const available = nextInventory.filter((entry) => entry.id === requirement.id).reduce((sum, entry) => sum + entry.amount, 0);
    if (available < requirement.amount) {
      missing.push({ id: requirement.id, amount: requirement.amount, available });
    }
  }

  if (missing.length > 0) {
    return { success: false, reason: "not_enough_materials", missing, inventory: nextInventory };
  }

  for (const requirement of recipe.requiredMaterials) {
    let remaining = requirement.amount;
    for (const entry of nextInventory) {
      if (entry.id !== requirement.id || remaining <= 0) continue;
      const used = Math.min(entry.amount, remaining);
      entry.amount -= used;
      remaining -= used;
      if (entry.amount <= 0) {
        entry.amount = 0;
      }
    }
  }

  const filteredInventory = nextInventory.filter((entry) => entry.amount > 0);
  const craftedInventory = addItem(filteredInventory, result, 1);

  return {
    success: true,
    resultItem: result,
    consumedMaterials: recipe.requiredMaterials,
    inventory: craftedInventory,
  };
}

export function getCraftingRecipe(recipeId: string) {
  return CRAFTING_RECIPES[recipeId] ?? null;
}
