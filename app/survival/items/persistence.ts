import { EquipmentState } from "./equipmentSystem";
import { InventoryEntry } from "./types";
import { normalizeEquipment, normalizeInventory } from "./itemManager";
import { loadPlayerSave, savePlayerSave, resetPlayerSave } from "@/app/actions/saveGame";

const STORAGE_KEY = "dungeon-legends-save";
export const SAVE_VERSION = 2;

type SavedStats = {
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

type SaveData = {
  version: number;
  inventory: InventoryEntry[];
  equipment: EquipmentState;
  gold: number;
  stats: SavedStats | null;
};

type SaveFallback = {
  inventory: InventoryEntry[];
  equipment: EquipmentState;
  gold: number;
};

// ── Load ──────────────────────────────────────────────────────────────────────

export async function loadCloudPlayerSave(userId?: string | null): Promise<SaveData | null> {
  try {
    const serverSave = await loadPlayerSave();
    if (!serverSave) return null;
    const full: SaveData = {
      version: SAVE_VERSION,
      inventory: normalizeInventory(serverSave.inventory ?? []),
      equipment: normalizeEquipment(serverSave.equipment ?? {}) as EquipmentState,
      gold: typeof serverSave.gold === "number" ? serverSave.gold : 100,
      stats: (serverSave.stats as SavedStats | null) ?? null,
    };
    if (typeof window !== "undefined" && userId) {
      window.localStorage.setItem(`${STORAGE_KEY}-${userId}`, JSON.stringify(full));
    }
    return full;
  } catch (err) {
    console.warn("Failed to load cloud save:", err);
    return null;
  }
}

export function loadItemSave(fallback: SaveFallback, userId?: string | null): SaveFallback & { stats?: SavedStats | null } {
  if (typeof window === "undefined") return fallback;
  try {
    const key = userId ? `${STORAGE_KEY}-${userId}` : STORAGE_KEY;
    const raw = window.localStorage.getItem(key) || window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    if (parsed?.version !== SAVE_VERSION) return fallback;
    return {
      inventory: normalizeInventory(parsed.inventory ?? fallback.inventory),
      equipment: normalizeEquipment(parsed.equipment ?? fallback.equipment) as EquipmentState,
      gold: typeof parsed.gold === "number" ? parsed.gold : fallback.gold,
      stats: parsed.stats ?? null,
    };
  } catch {
    return fallback;
  }
}

// ── Save (debounced to server + immediate to localStorage) ──────────────────

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function saveItemData(data: SaveFallback & { stats?: unknown }, userId?: string | null) {
  if (typeof window === "undefined") return;

  const key = userId ? `${STORAGE_KEY}-${userId}` : STORAGE_KEY;
  const payload: SaveData = {
    version: SAVE_VERSION,
    inventory: data.inventory,
    equipment: data.equipment,
    gold: data.gold,
    stats: (data.stats as SavedStats | undefined) ?? null,
  };
  window.localStorage.setItem(key, JSON.stringify(payload));

  // Debounce server save: wait 1.8s after last change, then push to Supabase
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    savePlayerSave({
      inventory: data.inventory,
      equipment: data.equipment,
      gold: data.gold,
      stats: (data.stats as SavedStats | undefined) ?? null,
    }).catch((err) => {
      console.warn("Cloud save sync failed:", err);
    });
  }, 1800);
}

// ── Reset ─────────────────────────────────────────────────────────────────────

export function clearSaveData(userId?: string | null) {
  if (typeof window === "undefined") return;

  const key = userId ? `${STORAGE_KEY}-${userId}` : STORAGE_KEY;
  window.localStorage.removeItem(key);
  window.localStorage.removeItem(STORAGE_KEY);

  resetPlayerSave().catch(() => {
    // ignore
  });
}

