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

export function loadItemSave(fallback: SaveFallback): SaveFallback {
  // 1. Try server first (online mode) — non-blocking prefetch
  if (typeof window !== "undefined") {
    const promise = loadPlayerSave();
    promise
      .then((serverSave) => {
        if (!serverSave) return;
        applySave(serverSave);
      })
      .catch(() => {
        // Server failed — fall through to localStorage
      });
  }

  // 2. Fallback: localStorage (offline / first visit)
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    if (parsed?.version !== SAVE_VERSION) return fallback;
    return {
      inventory: normalizeInventory(parsed.inventory ?? fallback.inventory),
      equipment: normalizeEquipment(parsed.equipment ?? fallback.equipment) as EquipmentState,
      gold: typeof parsed.gold === "number" ? parsed.gold : fallback.gold,
    };
  } catch {
    return fallback;
  }
}

// Called when server save loads — caches in localStorage for offline use
function applySave(serverSave: {
  inventory: InventoryEntry[];
  equipment: EquipmentState;
  gold: number;
  stats: SavedStats | null;
}) {
  if (typeof window === "undefined") return;
  const full: SaveData = {
    version: SAVE_VERSION,
    inventory: serverSave.inventory,
    equipment: serverSave.equipment,
    gold: serverSave.gold,
    stats: serverSave.stats,
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(full));
}

// ── Save (debounced to server + immediate to localStorage) ──────────────────

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function saveItemData(data: SaveFallback & { stats?: unknown }) {
  if (typeof window === "undefined") return;

  // Always cache in localStorage immediately
  const payload: SaveData = {
    version: SAVE_VERSION,
    inventory: data.inventory,
    equipment: data.equipment,
    gold: data.gold,
    stats: (data.stats as SavedStats | undefined) ?? null,
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

  // Debounce server save: wait 2s after last change, then push to server
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    savePlayerSave({
      inventory: data.inventory,
      equipment: data.equipment,
      gold: data.gold,
      stats: (data.stats as SavedStats | undefined) ?? null,
    }).catch(() => {
      // Server save failed — localStorage cache is still valid
    });
  }, 2000);
}

// ── Reset ─────────────────────────────────────────────────────────────────────

export function clearSaveData() {
  if (typeof window === "undefined") return;

  // Clear localStorage
  window.localStorage.removeItem(STORAGE_KEY);

  // Also wipe server side if logged in
  resetPlayerSave().catch(() => {
    // ignore
  });
}
