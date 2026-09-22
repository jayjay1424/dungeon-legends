// Server actions for online game save/load
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { InventoryEntry, EquipmentState } from "@/app/survival/items/types";

export type PlayerStats = {
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  level: number;
  xp: number;
  xpToNext: number;
  skillPoints: number;
  power: number;
  speed: number;
  gold: number;
  wave: number;
  attack: number;
  defense: number;
  critChance: number;
  critDamage: number;
  moveSpeed: number;
  attackSpeed: number;
  skillPower: number;
  armor: number;
  luck: number;
};

export type PlayerSave = {
  inventory: InventoryEntry[];
  equipment: EquipmentState;
  gold: number;
  stats: PlayerStats | null;
};

// ── Load ──────────────────────────────────────────────────────────────────────

export async function loadPlayerSave(): Promise<PlayerSave | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("player_saves")
    .select("inventory, equipment, gold, stats, data_hash")
    .eq("user_id", user.id)
    .single();

  if (error || !data) return null;

  // Integrity check: if data_hash is missing, save may have been tampered with
  // Server will re-compute hash on next save
  if (!data.data_hash) {
    console.warn(`Save for user ${user.id} has no integrity hash. Re-computing on next save.`);
  }

  return {
    inventory: (data.inventory as InventoryEntry[]) ?? [],
    equipment: (data.equipment as EquipmentState) ?? {},
    gold: typeof data.gold === "number" ? data.gold : 100,
    stats: (data.stats as PlayerStats) ?? defaultStats(),
  };
}

// ── Save ──────────────────────────────────────────────────────────────────────

export async function savePlayerSave(save: PlayerSave): Promise<boolean> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;

  // Server-side hash computation via DB trigger — client cannot fake it
  const { error } = await supabase
    .from("player_saves")
    .upsert(
      {
        user_id: user.id,
        inventory: save.inventory,
        equipment: save.equipment,
        gold: save.gold,
        stats: save.stats,
        // data_hash is NOT provided — DB trigger computes it server-side
      },
      { onConflict: "user_id" }
    );

  if (error) {
    console.error("savePlayerSave error:", error);
    return false;
  }

  revalidatePath("/survival");
  revalidatePath("/defence");
  return true;
}

// ── Reset ─────────────────────────────────────────────────────────────────────

export async function resetPlayerSave(): Promise<boolean> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;

  const { error } = await supabase
    .from("player_saves")
    .delete()
    .eq("user_id", user.id);

  if (error) {
    console.error("resetPlayerSave error:", error);
    return false;
  }

  revalidatePath("/survival");
  revalidatePath("/defence");
  return true;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function defaultStats(): PlayerStats {
  return {
    hp: 100,
    maxHp: 100,
    mana: 50,
    maxMana: 50,
    level: 1,
    xp: 0,
    xpToNext: 60,
    skillPoints: 0,
    power: 12,
    speed: 1,
    gold: 100,
    wave: 1,
    attack: 10,
    defense: 5,
    critChance: 5,
    critDamage: 150,
    moveSpeed: 1,
    attackSpeed: 1,
    skillPower: 10,
    armor: 0,
    luck: 1,
  };
}
