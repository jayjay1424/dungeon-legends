import { allGeneratedItems } from "./items.config";
import { DRAGON_ITEMS, EGG_ITEMS } from "./eggs";
import { ItemDefinition } from "./types";

export const ITEM_DATABASE: Record<string, ItemDefinition> = {
  ...allGeneratedItems,
  ...EGG_ITEMS,
  ...DRAGON_ITEMS,
} as Record<string, ItemDefinition>;

export const itemById = (id: string) => ITEM_DATABASE[id];
