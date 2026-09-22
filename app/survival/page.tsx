"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import styles from "./survival.module.css";
import InfiniteArena, { ArenaHandle, SKILL_MANA_COSTS } from "./InfiniteArena";
import { startVillageMusic, stopVillageMusic } from "./audio";
import { ITEM_DATABASE, itemById } from "./items/database";
import { ItemIcon } from "./items/ItemIcon";
import { EquipmentSlot, InventoryEntry, ItemRarity, RARITY_COLORS } from "./items/types";
import type { SkillCooldowns } from "./arena/types";
import { addItem, removeItem, sortInventory } from "./items/inventorySystem";
import { equipItem, EquipmentState, unequipItem } from "./items/equipmentSystem";
import { applyConsumableStats, applyEquipmentStats } from "./items/statSystem";
import { clearSaveData, loadCloudPlayerSave, loadItemSave, saveItemData } from "./items/persistence";
import { loadDiscoveredIds, saveDiscoveredIds } from "./items/codex";
import ItemCodex from "./components/ItemCodex";
import HowToPlay from "./components/HowToPlay";
import InGameChat from "./components/InGameChat";
import MobileControls from "./components/MobileControls";
import FriendsModal from "../components/FriendsModal";
import type { ChatMessage } from "./arena/multiplayer";
import { BEGINNER_QUESTS, questById } from "./quests/definitions";
import { addQuestProgress, claimQuest, loadQuestSave, saveQuestSave } from "./quests/tracker";
import {
  addDailyProgress,
  claimDaily,
  dailyById,
  ensureToday,
  loadDailySave,
  pickDailyIds,
  saveDailySave,
} from "./quests/dailies";
import { CRAFTING_RECIPES, craftItem } from "./items/craftingSystem";
import { HATCH_COST_GOLD, rollDragonTier, DRAGON_TIERS } from "./items/eggs";
import RedDragonSprite, { redDragonScaleFor } from "./components/RedDragonSprite";
import EntityPortrait from "./components/EntityPortrait";
import {
  VENDOR_INFO,
  enemyPortraitSpec,
  npcPortraitSpec,
  warriorPortraitSpec,
  type InspectedEnemy,
  type NpcInspect,
  type VendorId,
  type WarriorInspect,
} from "./arena/inspect";

const SHOP_STOCK: { id: string; price: number }[] = [
  { id: "heal_potion_from_shop", price: 60 },
  { id: "common_sword_common_sword_v1", price: 600 },
  { id: "common_armor_common_armor", price: 700 },
  { id: "common_helmet_common_helmet_v1", price: 350 },
  { id: "common_ring_common_ring_v1", price: 400 },
];

type InventoryItem = InventoryEntry;

type Pet = {
  id: string;
  name: string;
  rarity: ItemRarity;
  level: number;
  hp: number;
  damage: number;
  skill: string;
  exp: number;
  expToNext: number;
};

const xpForLevel = (level: number) => Math.round(60 + (level - 1) * 40 + (level - 1) * (level - 1) * 20);

// Starter gear — must reference real ITEM_DATABASE ids (spreading a missing
// id yields a junk { amount: 1 } entry with no name/icon/stats).
// Fresh start: bare fists, nothing equipped.
const STARTER_GEAR_IDS: string[] = [];

const INVENTORY_TABS = [
  { id: "all", label: "All" },
  { id: "gear", label: "Gear" },
  { id: "dragons", label: "Dragons" },
  { id: "eggs", label: "Eggs" },
  { id: "usable", label: "Usable" },
  { id: "materials", label: "Mats" },
] as const;

type InventoryFilter = (typeof INVENTORY_TABS)[number]["id"];

/** Inventory rows per page — sized so list + page buttons + footer fit without scrolling. */
const INVENTORY_PAGE_SIZE = 4;
/** Materials rows per page — same no-scroll rule. */
const MATS_PAGE_SIZE = 8;
/** Incubator egg rows per page — same no-scroll rule. */
const HATCH_PAGE_SIZE = 5;

/** Camera zoom bounds. Lower = farther (more world visible). */
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 1;
const ZOOM_STEP = 0.05;
const ZOOM_DEFAULT = 0.75;

const SELL_RARITIES: ItemRarity[] = ["Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythic"];

type SellTarget = {
  id: string;
  name: string;
  rarity: ItemRarity;
  icon: string;
  owned: number;
  qty: number;
  worth: number;
};

const SLOT_ICONS: Record<string, string> = {
  weapon: "🗡",
  helmet: "🪖",
  chest: "🦺",
  gloves: "🧤",
  boots: "🥾",
  offhand: "🛡",
  ring: "💍",
  necklace: "📿",
  amulet: "🔮",
  companion: "🐉",
};

function filterMatches(item: InventoryItem, filter: InventoryFilter): boolean {
  switch (filter) {
    case "gear":
      return !!item.equipmentSlot;
    case "dragons":
      return item.category === "Dragons";
    case "eggs":
      return item.category === "Eggs";
    case "usable":
      return item.type === "consumable";
    case "materials":
      return item.type === "material" || item.type === "monster-drop";
    default:
      return true;
  }
}

/** Row action hint: EQUIP / USE / HATCH (eggs hatch at the incubator vendor). */
function inventoryRowAction(item: InventoryItem): string | null {
  if (item.equipmentSlot) return "EQUIP";
  if (item.type === "consumable") return "USE";
  if (item.category === "Eggs") return "HATCH";
  return null;
}

const petCatalog: Pet[] = [
  { id: "slime-pet", name: "Slime Pet", rarity: "Common", level: 1, hp: 20, damage: 8, skill: "Small healing", exp: 0, expToNext: 60 },
  { id: "wolf-pet", name: "Wolf Pet", rarity: "Rare", level: 2, hp: 40, damage: 16, skill: "Movement speed boost", exp: 0, expToNext: 80 },
  { id: "dragon-pet", name: "Dragon Pet", rarity: "Epic", level: 4, hp: 90, damage: 35, skill: "Fire attack", exp: 0, expToNext: 120 },
];

const STARTER_PACK: [string, number][] = [];

const initialInventory: InventoryItem[] = STARTER_PACK.flatMap(([id, amount]) => {
  const def = ITEM_DATABASE[id];
  return def ? [{ ...def, amount }] : [];
});

const initialEquipment: EquipmentState = {
  weapon: null,
  helmet: null,
  chest: null,
  gloves: null,
  boots: null,
  offhand: null,
  ring: null,
  necklace: null,
  amulet: null,
  companion: null,
};

const baseStats = {
  hp: 100,
  maxHp: 100,
  mana: 50,
  maxMana: 50,
  level: 1,
  xp: 0,
  xpToNext: xpForLevel(1),
  skillPoints: 0,
  power: 12,
  speed: 1,
  gold: 100, // fresh start: nothing but 100 gold
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

type Stats = typeof baseStats;

function applyLevelProgression(nextState: Stats): Stats {
  let { level, xp, xpToNext, skillPoints, maxHp, maxMana, power, speed, hp, mana, attack, defense, critChance, critDamage, moveSpeed, attackSpeed, skillPower, armor, luck } = nextState;

  // Level-ups grant skill points only — every stat grows by spending them.
  // (Full HP/mana refill stays as the level-up reward.)
  while (xp >= xpToNext) {
    xp -= xpToNext;
    level += 1;
    skillPoints += 1;
    xpToNext = xpForLevel(level);
    hp = maxHp;
    mana = maxMana;
  }

  return {
    ...nextState,
    level,
    xp,
    xpToNext,
    skillPoints,
    maxHp,
    maxMana,
    power,
    speed,
    attack,
    defense,
    critChance,
    critDamage,
    moveSpeed,
    attackSpeed,
    skillPower,
    armor,
    luck,
    hp: Math.min(nextState.hp, maxHp),
    mana: Math.min(nextState.mana, maxMana),
  };
}

// Fresh start: level 1, 100 gold, empty bags. Set START_LEVEL higher only
// for local testing of late-game gear.
const START_LEVEL = 1;

const initialStats: Stats = (() => {
  let xpNeeded = 0;
  for (let level = 1; level < START_LEVEL; level++) xpNeeded += xpForLevel(level);
  const leveled = applyLevelProgression({ ...baseStats, xp: xpNeeded });
  return { ...leveled, hp: leveled.maxHp, mana: leveled.maxMana };
})();

function getPetBonus(pets: Pet[]) {
  return pets.reduce<Record<string, number>>((acc, pet) => {
    acc.hp = (acc.hp ?? 0) + pet.hp;
    acc.attack = (acc.attack ?? 0) + pet.damage;
    acc.moveSpeed = (acc.moveSpeed ?? 0) + 0.04;
    acc.skillPower = (acc.skillPower ?? 0) + pet.level * 2;
    return acc;
  }, {});
}

function getCombinedStats(stats: typeof initialStats, equipment: EquipmentState, pets: Pet[]) {
  const equippedStats = applyEquipmentStats(stats, equipment);
  const petBonus = getPetBonus(pets);
  const merged = {
    ...equippedStats,
    maxHp: equippedStats.maxHp + (petBonus.hp ?? 0),
    attack: equippedStats.attack + (petBonus.attack ?? 0),
    moveSpeed: equippedStats.moveSpeed + (petBonus.moveSpeed ?? 0),
    skillPower: equippedStats.skillPower + (petBonus.skillPower ?? 0),
    hp: Math.min(equippedStats.hp + (petBonus.hp ?? 0), equippedStats.maxHp + (petBonus.hp ?? 0)),
  };

  return merged;
}

function QuestRow({
  quest,
  progress,
  done,
  claimed,
  onClaim,
}: {
  quest: { id: string; title: string; hint: string; target: number; rewardGold: number; rewardXp: number };
  progress: number;
  done: boolean;
  claimed: boolean;
  onClaim: (id: string) => void;
}) {
  const pct = quest.target > 0 ? Math.min(100, (progress / quest.target) * 100) : 0;
  return (
    <div style={{ padding: "8px 10px", borderRadius: 0, background: "rgba(24, 20, 37, 0.9)", border: done ? "1px solid #ffcd75" : "1px solid #3a3f58" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <strong style={{ fontSize: 12, color: done ? "#ffcd75" : "#fff" }}>{quest.title}</strong>
        <small style={{ fontSize: 11, opacity: 0.8 }}>{progress}/{quest.target}</small>
      </div>
      <div style={{ fontSize: 11, opacity: 0.75, marginTop: 4 }}>{quest.hint}</div>
      <div style={{ height: 8, background: "#0f0a1e", border: "1px solid #3a3f58", borderRadius: 0, overflow: "hidden", marginTop: 6 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: done ? "#ffcd75" : "#e86a17" }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 6 }}>
        <small style={{ fontSize: 11, color: "#ffcd75" }}>+{quest.rewardGold}G · +{quest.rewardXp}XP</small>
        {claimed ? (
          <small style={{ fontSize: 11, color: "#38b764" }}>CLAIMED</small>
        ) : done ? (
          <button type="button" onClick={() => onClaim(quest.id)} style={{ border: "1px solid #ffcd75", background: "#b13434", color: "#ffcd75", padding: "6px 12px", borderRadius: 0, cursor: "pointer", fontSize: 11, letterSpacing: "0.08em" }}>
            CLAIM
          </button>
        ) : (
          <small style={{ fontSize: 11, opacity: 0.6 }}>IN PROGRESS</small>
        )}
      </div>
    </div>
  );
}

export default function SurvivalPage() {
  const router = useRouter();
  const arenaRef = useRef<ArenaHandle>(null);

  useEffect(() => {
    const startAudio = () => startVillageMusic();
    startAudio();
    window.addEventListener("pointerdown", startAudio, { once: true });
    return () => {
      window.removeEventListener("pointerdown", startAudio);
      stopVillageMusic();
    };
  }, []);

  const [stats, setStats] = useState(initialStats);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomPlayerCount, setRoomPlayerCount] = useState(1);
  const [playerInfo, setPlayerInfo] = useState<{ id: string; name: string; level: number } | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [virtualDir, setVirtualDir] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const room = params.get("room");
      if (room) setRoomId(room);
    } catch {
      // ignore
    }
  }, []);

  const [inventory, setInventory] = useState<InventoryItem[]>(initialInventory);
  const [equipment, setEquipment] = useState<EquipmentState>(initialEquipment);
  // Fresh start: no companions yet — pets are earned later, so the
  // starting table shows true base stats (LIFE 100, ATK 10, ...).
  const [pets, setPets] = useState<Pet[]>([]);
  const [worldTime, setWorldTime] = useState({ label: "8:00 AM", isNight: false });
  const [zoneName, setZoneName] = useState("Base Camp");
  const [zoneBanner, setZoneBanner] = useState("");
  const [bagOpen, setBagOpen] = useState(false);
  const [codexOpen, setCodexOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [discoveredIds, setDiscoveredIds] = useState<string[]>([]);
  const [levelUpMessage, setLevelUpMessage] = useState("");
  const [expMessage, setExpMessage] = useState("");
  const [combatPhase, setCombatPhase] = useState<"combat" | "cooldown" | "safe">("safe");
  const [stunActive, setStunActive] = useState(false);
  const [lootMessage, setLootMessage] = useState("");
  const [lootNearby, setLootNearby] = useState(false);
  const [inventorySort, setInventorySort] = useState<"type" | "rarity" | "level" | "quantity">("type");
  const [inventoryFilter, setInventoryFilter] = useState<InventoryFilter>("all");
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryPage, setInventoryPage] = useState(1);
  const [matsPage, setMatsPage] = useState(1);
  const [hatchPage, setHatchPage] = useState(1);
  const [bagTab, setBagTab] = useState<"status" | "items" | "gear" | "mats" | "quests">("items");
  // Default must match the server render — the saved value loads after
  // mount (reading localStorage during render causes hydration mismatch).
  const [zoom, setZoom] = useState(ZOOM_DEFAULT);
  const [zoomLoaded, setZoomLoaded] = useState(false);
  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem("dungeon-legends-zoom"));
      if (Number.isFinite(saved) && saved >= ZOOM_MIN && saved <= ZOOM_MAX) setZoom(saved);
    } catch {
      // ignore (private mode / no storage)
    }
    setZoomLoaded(true);
  }, []);
  useEffect(() => {
    if (!zoomLoaded) return;
    try {
      window.localStorage.setItem("dungeon-legends-zoom", String(zoom));
    } catch {
      // ignore
    }
  }, [zoom, zoomLoaded]);
  const stepZoom = (dir: 1 | -1) =>
    setZoom((current) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((current + dir * ZOOM_STEP) * 100) / 100)));
  const [vendorNearby, setVendorNearby] = useState<"store" | "craft" | "incubator" | null>(null);
  const [shopOpen, setShopOpen] = useState(false);
  const [shopTab, setShopTab] = useState<"buy" | "sell">("buy");
  // Bulk-sell controls: WHICH rarities + WHICH category, HOW MANY (keep-one
  // safety + max-per-item cap). Defaults only touch Common/Uncommon.
  const [sellRarities, setSellRarities] = useState<ItemRarity[]>(["Common", "Uncommon"]);
  const [sellCategory, setSellCategory] = useState<InventoryFilter>("all");
  const [sellKeepOne, setSellKeepOne] = useState(true);
  const [sellMaxEach, setSellMaxEach] = useState("");
  const [craftOpen, setCraftOpen] = useState(false);
  const [hatchOpen, setHatchOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [lastHatchedId, setLastHatchedId] = useState<string | null>(null);
  const [inspectedEnemy, setInspectedEnemy] = useState<InspectedEnemy | null>(null);
  const [inspectedNpc, setInspectedNpc] = useState<NpcInspect | null>(null);
  const [inspectedVendor, setInspectedVendor] = useState<VendorId | null>(null);
  const [inspectedWarrior, setInspectedWarrior] = useState<WarriorInspect | null>(null);
  const clearInspection = () => {
    setInspectedEnemy(null);
    setInspectedNpc(null);
    setInspectedVendor(null);
    setInspectedWarrior(null);
  };
  const saveLoadedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function initUserAndSave() {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) {
        router.push("/login?redirect=/survival");
        return;
      }
      const user = authData.user;
      setUserId(user.id);

      let username = (user.user_metadata?.username as string) || (user.user_metadata?.full_name as string);
      if (!username) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", user.id)
          .maybeSingle();
        username = prof?.username;
      }
      const finalName = username || user.email?.split("@")[0] || "Adventurer";

      // 1. Try loading from Supabase Cloud Player Save
      const cloudSave = await loadCloudPlayerSave(user.id);
      if (cancelled) return;

      if (cloudSave) {
        setInventory(cloudSave.inventory);
        if (cloudSave.equipment && Object.values(cloudSave.equipment).some(Boolean)) {
          setEquipment(cloudSave.equipment);
        }
        if (typeof cloudSave.gold === "number") {
          setStats((current) => ({ ...current, gold: cloudSave.gold }));
        }
        if (cloudSave.stats) {
          setStats((current) => ({
            ...current,
            level: cloudSave.stats!.level ?? current.level,
            xp: cloudSave.stats!.xp ?? current.xp,
            xpToNext: cloudSave.stats!.xpToNext ?? current.xpToNext,
            skillPoints: cloudSave.stats!.skillPoints ?? current.skillPoints,
            gold: cloudSave.gold,
            power: cloudSave.stats!.power ?? current.power,
            speed: cloudSave.stats!.speed ?? current.speed,
            attack: cloudSave.stats!.attack ?? current.attack,
            defense: cloudSave.stats!.defense ?? current.defense,
            critChance: cloudSave.stats!.critChance ?? current.critChance,
            critDamage: cloudSave.stats!.critDamage ?? current.critDamage,
            moveSpeed: cloudSave.stats!.moveSpeed ?? current.moveSpeed,
            attackSpeed: cloudSave.stats!.attackSpeed ?? current.attackSpeed,
            skillPower: cloudSave.stats!.skillPower ?? current.skillPower,
            armor: cloudSave.stats!.armor ?? current.armor,
            luck: cloudSave.stats!.luck ?? current.luck,
          }));
          setPlayerInfo({
            id: user.id,
            name: finalName,
            level: cloudSave.stats.level ?? stats.level,
          });
        } else {
          setPlayerInfo({
            id: user.id,
            name: finalName,
            level: stats.level,
          });
        }
      } else {
        // Fallback to local storage
        const saved = loadItemSave({ inventory: initialInventory, equipment: initialEquipment, gold: initialStats.gold }, user.id);
        setInventory(saved.inventory);
        if (saved.equipment && Object.values(saved.equipment).some(Boolean)) {
          setEquipment(saved.equipment as EquipmentState);
        }
        if (saved.gold !== stats.gold) {
          setStats((current) => ({ ...current, gold: saved.gold }));
        }
        setPlayerInfo({
          id: user.id,
          name: finalName,
          level: stats.level,
        });
      }

      saveLoadedRef.current = true;
    }

    initUserAndSave();

    return () => {
      cancelled = true;
    };
  }, []);

  // Synchronize playerInfo level whenever stats.level changes
  useEffect(() => {
    if (playerInfo && stats.level !== playerInfo.level) {
      setPlayerInfo((prev) => (prev ? { ...prev, level: stats.level } : null));
    }
  }, [stats.level]);

  useEffect(() => {
    if (!saveLoadedRef.current) return;
    saveItemData({ inventory, equipment, gold: stats.gold, stats }, userId);
  }, [inventory, equipment, stats.gold, stats, userId]);

  // Item book: ever-owned discovery. Loads once, persists on change.
  useEffect(() => {
    setDiscoveredIds(loadDiscoveredIds());
  }, []);

  // Beginner quests: progress persists; completion toasts fire once.
  const [quests, setQuests] = useState(loadQuestSave);
  const toastedQuestsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    saveQuestSave(quests);
  }, [quests]);
  useEffect(() => {
    const fresh = quests.completedIds.filter((id) => !toastedQuestsRef.current.has(id));
    if (fresh.length === 0) return;
    toastedQuestsRef.current = new Set([...toastedQuestsRef.current, ...fresh]);
    const def = questById(fresh[0]);
    if (def) setLootMessage(`QUEST COMPLETE: ${def.title} — CLAIM IN BAG`);
  }, [quests.completedIds]);

  const bumpQuest = (id: string, n: number) => {
    if (n <= 0) return;
    setQuests((prev) => addQuestProgress(prev, id, n).next);
  };

  const claimQuestReward = (id: string) => {
    const def = questById(id);
    if (!def) return;
    if (quests.claimedIds.includes(id) || !quests.completedIds.includes(id)) return;
    setQuests((prev) => claimQuest(prev, id));
    handleStatsChange((current) => ({
      ...current,
      gold: current.gold + def.rewardGold,
      xp: current.xp + def.rewardXp,
    }));
    setLootMessage(`CLAIMED ${def.title}: +${def.rewardGold}G +${def.rewardXp}XP`);
  };

  const questClaimableCount = quests.completedIds.filter((id) => !quests.claimedIds.includes(id)).length;

  // Daily quests: 3 picked per real calendar day, auto-reset at midnight.
  const [dailies, setDailies] = useState(loadDailySave);
  const toastedDailiesRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    saveDailySave(dailies);
  }, [dailies]);
  useEffect(() => {
    const fresh = dailies.save.completedIds.filter((id) => !toastedDailiesRef.current.has(id));
    if (fresh.length === 0) return;
    toastedDailiesRef.current = new Set([...toastedDailiesRef.current, ...fresh]);
    const def = dailyById(fresh[0]);
    if (def) setLootMessage(`DAILY COMPLETE: ${def.title} — CLAIM IN BAG`);
  }, [dailies.save.completedIds]);

  const bumpDaily = (id: string, n: number) => {
    if (n <= 0) return;
    setDailies((prev) => addDailyProgress(prev, id, n).next);
  };

  const claimDailyReward = (id: string) => {
    const def = dailyById(id);
    if (!def) return;
    const current = ensureToday(dailies);
    if (current.save.claimedIds.includes(id) || !current.save.completedIds.includes(id)) return;
    setDailies((prev) => claimDaily(prev, id));
    handleStatsChange((currentStats) => ({
      ...currentStats,
      gold: currentStats.gold + def.rewardGold,
      xp: currentStats.xp + def.rewardXp,
    }));
    setLootMessage(`CLAIMED ${def.title}: +${def.rewardGold}G +${def.rewardXp}XP`);
  };

  const dailyIds = pickDailyIds(dailies.dateKey);
  const dailyClaimableCount = dailies.save.completedIds.filter((id) => !dailies.save.claimedIds.includes(id)).length;

  useEffect(() => {
    saveDiscoveredIds(discoveredIds);
  }, [discoveredIds]);

  // Record anything currently held or equipped as discovered.
  useEffect(() => {
    const owned = new Set<string>();
    for (const entry of inventory) {
      if (entry?.id) owned.add(entry.id);
    }
    for (const slot of Object.values(equipment)) {
      if (slot?.id) owned.add(slot.id);
    }
    if (owned.size === 0) return;
    setDiscoveredIds((current) => {
      const known = new Set(current);
      let changed = false;
      for (const id of owned) {
        if (!known.has(id)) {
          known.add(id);
          changed = true;
        }
      }
      return changed ? [...known] : current;
    });
  }, [inventory, equipment]);

  useEffect(() => {
    if (!levelUpMessage) return;
    const timer = window.setTimeout(() => setLevelUpMessage(""), 1400);
    return () => window.clearTimeout(timer);
  }, [levelUpMessage]);

  useEffect(() => {
    if (!expMessage) return;
    const timer = window.setTimeout(() => setExpMessage(""), 1400);
    return () => window.clearTimeout(timer);
  }, [expMessage]);

  useEffect(() => {
    if (!lootMessage) return;
    const timer = window.setTimeout(() => setLootMessage(""), 1600);
    return () => window.clearTimeout(timer);
  }, [lootMessage]);

  useEffect(() => {
    if (!zoneBanner) return;
    const timer = window.setTimeout(() => setZoneBanner(""), 2200);
    return () => window.clearTimeout(timer);
  }, [zoneBanner]);

  // Skill cooldown countdowns ( polled from the arena so button + keyboard
  // casts stay in sync ). Attack has no cooldown and never shows one.
  // Locked skills show their required level instead of a countdown.
  const [cooldowns, setCooldowns] = useState<SkillCooldowns>({
    spin: { remainingMs: 0, totalMs: 1, locked: true, unlockLevel: 20 },
    dodge: { remainingMs: 0, totalMs: 1, locked: true, unlockLevel: 5 },
    clones: { remainingMs: 0, totalMs: 1, locked: true, unlockLevel: 10 },
    flash: { remainingMs: 0, totalMs: 1, locked: true, unlockLevel: 25 },
  });
  const cooldownsRef = useRef(cooldowns);
  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = arenaRef.current?.getCooldowns();
      if (!next) return;
      const prev = cooldownsRef.current;
      if (
        prev.spin.remainingMs !== next.spin.remainingMs ||
        prev.dodge.remainingMs !== next.dodge.remainingMs ||
        prev.clones.remainingMs !== next.clones.remainingMs ||
        prev.flash.remainingMs !== next.flash.remainingMs ||
        prev.spin.locked !== next.spin.locked ||
        prev.dodge.locked !== next.dodge.locked ||
        prev.clones.locked !== next.clones.locked ||
        prev.flash.locked !== next.flash.locked
      ) {
        cooldownsRef.current = next;
        setCooldowns(next);
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      // Don't hijack typing in inputs/selects.
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) return;
      const k = event.key.toLowerCase();
      if (k === "escape") {
        setCodexOpen(false);
        setHelpOpen(false);
        setShopOpen(false);
        setCraftOpen(false);
        setHatchOpen(false);
        clearInspection();
        return;
      }
      if (k === "b") setCodexOpen((open) => !open);
      if (k === "f" && vendorNearby === "store") setShopOpen((open) => !open);
      if (k === "c" && vendorNearby === "craft") setCraftOpen((open) => !open);
      if (k === "v" && vendorNearby === "incubator") setHatchOpen((open) => !open);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [vendorNearby]);

  // Equip slots that can actually hold something: any slot with at least
  // one matching item in the database (or currently equipped). Slots like
  // amulet/gloves/boots have no items, so they stay hidden.
  const usableEquipSlots = useMemo(() => {
    const usable = new Set<EquipmentSlot>();
    for (const item of Object.values(ITEM_DATABASE)) {
      if (item.equipmentSlot) usable.add(item.equipmentSlot);
    }
    for (const [slot, entry] of Object.entries(equipment)) {
      if (entry) usable.add(slot as EquipmentSlot);
    }
    return (Object.keys(SLOT_ICONS) as EquipmentSlot[]).filter((slot) => usable.has(slot));
  }, [equipment]);

  const codexOwnedCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const entry of inventory) {
      if (!entry?.id) continue;
      counts[entry.id] = (counts[entry.id] ?? 0) + (entry.amount || 0);
    }
    for (const slot of Object.values(equipment)) {
      if (!slot?.id) continue;
      counts[slot.id] = (counts[slot.id] ?? 0) + 1;
    }
    return counts;
  }, [inventory, equipment]);

  const countOf = (itemId: string) =>
    inventory
      .filter((entry) => entry && entry.id === itemId)
      .reduce((sum, entry) => sum + (entry.amount || 0), 0);

  const buyItem = (itemId: string, price: number) => {
    const def = itemById(itemId);
    if (!def) return;
    if (stats.gold < price) {
      setLootMessage("NOT ENOUGH GOLD");
      return;
    }
    handleStatsChange((current) => ({ ...current, gold: current.gold - price }));
    setInventory((current) => addItem(current, def, 1));
    setLootMessage(`BOUGHT ${def.name}`);
  };

  const sellItem = (itemId: string, sellAll: boolean) => {
    // Only bag contents can be sold — equipped gear lives in `equipment`,
    // so it can never be sold by accident.
    const entry = inventory.find((candidate) => candidate && candidate.id === itemId);
    const owned = entry?.amount || 0;
    if (!entry || owned < 1) {
      setLootMessage("NOTHING TO SELL");
      return;
    }
    const def = itemById(itemId);
    if (!def) return;
    // Clamp to what is actually owned — never oversell, never go negative.
    const qty = Math.max(1, Math.min(owned, sellAll ? owned : 1));
    const gain = (def.sellPrice ?? 0) * qty;
    setInventory((current) => removeItem(current, itemId, qty));
    handleStatsChange((current) => ({ ...current, gold: current.gold + gain }));
    if (selectedItem?.id === itemId && owned - qty <= 0) setSelectedItem(null);
    setLootMessage(`SOLD ${qty}x ${def.name} +${gain}G`);
  };

  const toggleSellRarity = (rarity: ItemRarity) => {
    setSellRarities((current) =>
      current.includes(rarity) ? current.filter((entry) => entry !== rarity) : [...current, rarity]
    );
  };

  const bulkSell = () => {
    if (sellMatching.length === 0 || bulkQty <= 0) {
      setLootMessage("NOTHING MATCHES THE SELL FILTERS");
      return;
    }
    const preview = sellMatching
      .slice(0, 6)
      .map((target) => `${target.qty}x ${target.name}`)
      .join("\n");
    const more = sellMatching.length > 6 ? `\n…and ${sellMatching.length - 6} more` : "";
    if (!window.confirm(`Sell ${bulkQty}x items for ${bulkGold.toLocaleString()}G?\n\n${preview}${more}`)) return;
    setInventory((current) => {
      let next = current;
      for (const target of sellMatching) next = removeItem(next, target.id, target.qty);
      return next;
    });
    handleStatsChange((current) => ({ ...current, gold: current.gold + bulkGold }));
    setSelectedItem(null);
    setLootMessage(`SOLD ${bulkQty}x ITEMS +${bulkGold.toLocaleString()}G`);
  };

  const craftRecipe = (recipeId: string) => {
    const result = craftItem(recipeId, inventory);
    if (!result.success) {
      const missing = "missing" in result && Array.isArray(result.missing) ? result.missing : [];
      if (missing.length > 0) {
        setLootMessage(`MISSING: ${missing.map((m) => `${m.id} ${m.available}/${m.amount}`).join(", ")}`);
      } else {
        setLootMessage("CANNOT CRAFT");
      }
      return;
    }
    setInventory(result.inventory);
    setLootMessage(`CRAFTED ${result.resultItem?.name ?? "ITEM"}`);
  };

  const hatchEgg = (eggId: string) => {
    if (stats.gold < HATCH_COST_GOLD) {
      setLootMessage(`NEED ${HATCH_COST_GOLD} GOLD TO HATCH`);
      return;
    }
    if (countOf(eggId) < 1) {
      setLootMessage("NO EGG");
      return;
    }
    const tier = rollDragonTier();
    const dragon = itemById(tier.id);
    if (!dragon) return;
    handleStatsChange((current) => ({ ...current, gold: current.gold - HATCH_COST_GOLD }));
    setInventory((current) => addItem(removeItem(current, eggId, 1), dragon, 1));
    setLastHatchedId(tier.id);
    bumpQuest("dragonkeeper", 1);
    setLootMessage(`HATCHED ${dragon.name}! EQUIP IT AS COMPANION`);
  };

  const combinedStats = useMemo(() => getCombinedStats(stats, equipment, pets), [stats, equipment, pets]);
  const displayedInventory = useMemo(() => {
    const query = inventorySearch.trim().toLowerCase();
    const filtered = inventory.filter(
      (item) =>
        filterMatches(item, inventoryFilter) &&
        (!query || `${item.name} ${item.description} ${item.rarity} ${item.category}`.toLowerCase().includes(query))
    );
    return sortInventory(filtered, inventorySort);
  }, [inventory, inventorySort, inventoryFilter, inventorySearch]);
  const pageCount = Math.max(1, Math.ceil(displayedInventory.length / INVENTORY_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, inventoryPage), pageCount);
  const pagedInventory = displayedInventory.slice((safePage - 1) * INVENTORY_PAGE_SIZE, safePage * INVENTORY_PAGE_SIZE);
  const matsEntries = inventory.filter((item) => item.type === "material" || item.type === "monster-drop");
  const matsPageCount = Math.max(1, Math.ceil(matsEntries.length / MATS_PAGE_SIZE));
  const matsSafePage = Math.min(Math.max(1, matsPage), matsPageCount);
  const pagedMats = matsEntries.slice((matsSafePage - 1) * MATS_PAGE_SIZE, matsSafePage * MATS_PAGE_SIZE);
  // Bulk-sell matching: aggregate owned amounts per item id, then apply the
  // keep-one safety and the max-per-item cap. Worthless items never match.
  const sellMatching: SellTarget[] = useMemo(() => {
    const cap = Math.floor(Number(sellMaxEach));
    const maxEach = Number.isFinite(cap) && cap > 0 ? cap : Infinity;
    const byId = new Map<string, SellTarget>();
    for (const entry of inventory) {
      if (!entry || (entry.amount || 0) < 1) continue;
      if (!sellRarities.includes(entry.rarity)) continue;
      if (!filterMatches(entry, sellCategory)) continue;
      const worth = itemById(entry.id)?.sellPrice ?? 0;
      if (worth <= 0) continue;
      const current = byId.get(entry.id);
      if (current) {
        current.owned += entry.amount;
      } else {
        byId.set(entry.id, { id: entry.id, name: entry.name, rarity: entry.rarity, icon: entry.icon, owned: entry.amount, qty: 0, worth });
      }
    }
    const targets: SellTarget[] = [];
    for (const target of byId.values()) {
      let qty = target.owned - (sellKeepOne ? 1 : 0);
      qty = Math.max(0, Math.min(qty, maxEach));
      if (qty > 0) targets.push({ ...target, qty });
    }
    return targets;
  }, [inventory, sellRarities, sellCategory, sellKeepOne, sellMaxEach]);
  const bulkQty = sellMatching.reduce((sum, target) => sum + target.qty, 0);
  const bulkGold = sellMatching.reduce((sum, target) => sum + target.qty * target.worth, 0);
  const hatchEggs = inventory.filter((entry) => entry && typeof entry.id === "string" && entry.id.startsWith("egg_"));
  const hatchPageCount = Math.max(1, Math.ceil(hatchEggs.length / HATCH_PAGE_SIZE));
  const hatchSafePage = Math.min(Math.max(1, hatchPage), hatchPageCount);
  const pagedHatchEggs = hatchEggs.slice((hatchSafePage - 1) * HATCH_PAGE_SIZE, hatchSafePage * HATCH_PAGE_SIZE);

  const handleStatsChange = (updater: (prev: typeof initialStats) => typeof initialStats) => {
    setStats((prev) => {
      const next = applyLevelProgression(updater(prev));
      if (next.level > prev.level) {
        setLevelUpMessage("LEVEL UP!");
      }
      return next;
    });
  };

  const handleUpgrade = (stat: "life" | "health" | "mana" | "power" | "defense" | "crit" | "skill" | "speed") => {
    if (stats.skillPoints <= 0) {
      setLootMessage("NO SKILL POINTS — LEVEL UP FIRST");
      return;
    }
    bumpQuest("stronger", 1);
    setStats((prev) => {
      if (prev.skillPoints <= 0) return prev;
      const next = { ...prev, skillPoints: prev.skillPoints - 1 };

      switch (stat) {
        case "life":
          next.maxHp += 18;
          next.hp = next.maxHp;
          break;
        case "health":
          next.maxHp += 12;
          next.hp = Math.min(next.hp + 12, next.maxHp);
          break;
        case "mana":
          next.maxMana += 10;
          next.mana = next.maxMana;
          break;
        case "power":
          next.power += 2;
          next.attack += 4;
          break;
        case "defense":
          next.defense += 4;
          next.armor += 2;
          break;
        case "crit":
          next.critChance += 2;
          next.critDamage += 10;
          break;
        case "skill":
          next.skillPower += 6;
          break;
        case "speed":
          next.speed += 0.12;
          next.moveSpeed += 0.08;
          break;
      }

      return applyLevelProgression(next);
    });
  };

  const equipItemToSlot = (item: InventoryItem) => {
    if (!item.equipmentSlot) return;
    if (item.levelRequirement > stats.level) {
      setLootMessage(`REQUIRES LEVEL ${item.levelRequirement} TO EQUIP ${item.name.toUpperCase()}`);
      return;
    }
    const result = equipItem(inventory, equipment, item, stats.level);
    if (result.equipment !== equipment) bumpQuest("armed", 1);
    setInventory(result.inventory);
    setEquipment(result.equipment);
    setSelectedItem(null);
  };

  const unequipFromSlot = (slot: EquipmentSlot) => {
    const result = unequipItem(inventory, equipment, slot);
    setInventory(result.inventory);
    setEquipment(result.equipment);
  };

  const consumeItem = (item: InventoryItem) => {
    if (item.type !== "consumable") return;
    if (stats.level < item.levelRequirement) {
      setLootMessage(`REQUIRES LEVEL ${item.levelRequirement} TO USE ${item.name.toUpperCase()}`);
      return;
    }
    setStats((current) => applyConsumableStats(current, item.stats));
    setInventory((current) => removeItem(current, item.id, 1));
    setSelectedItem(null);
    if (item.durationSeconds && item.stats.moveSpeed) {
      window.setTimeout(() => setStats((current) => ({ ...current, moveSpeed: current.moveSpeed - item.stats.moveSpeed })), item.durationSeconds * 1000);
    }
  };

  const materialCount = inventory
    .filter((item) => item.type === "material" || item.type === "monster-drop")
    .reduce((sum, item) => sum + item.amount, 0);

  const lifePercent = Math.max(0, Math.min(100, (combinedStats.hp / combinedStats.maxHp) * 100));
  const manaPercent = Math.max(0, Math.min(100, (combinedStats.mana / combinedStats.maxMana) * 100));
  const xpPercent = Math.max(0, Math.min(100, (stats.xp / stats.xpToNext) * 100));

  const renderCooldownOverlay = (key: keyof SkillCooldowns) => {
    const cd = cooldowns[key];
    if (cd.locked) {
      return (
        <>
          <span className={styles.cooldownOverlay} style={{ height: "100%" }} aria-hidden="true" />
          <span className={styles.cooldownText} aria-label={`Unlocks at level ${cd.unlockLevel}`}>
            LV{cd.unlockLevel}
          </span>
        </>
      );
    }
    if (cd.remainingMs <= 0) return null;
    const pct = cd.totalMs > 0 ? Math.min(100, (cd.remainingMs / cd.totalMs) * 100) : 0;
    return (
      <>
        <span className={styles.cooldownOverlay} style={{ height: `${pct}%` }} aria-hidden="true" />
        <span className={styles.cooldownText} aria-label={`${Math.ceil(cd.remainingMs / 1000)} seconds remaining`}>
          {Math.ceil(cd.remainingMs / 1000)}
        </span>
      </>
    );
  };

  const skillLockedToast = (key: keyof SkillCooldowns, name: string) => {
    const cd = cooldowns[key];
    if (cd.locked) {
      setLootMessage(`${name} UNLOCKS AT LV ${cd.unlockLevel}`);
      return true;
    }
    return false;
  };

  const handleSendChat = (text: string) => {
    arenaRef.current?.sendChatMessage?.(text);
    if (playerInfo) {
      const myMsg: ChatMessage = {
        id: `${playerInfo.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        senderId: playerInfo.id,
        senderName: playerInfo.name,
        text,
        timestamp: Date.now(),
      };
      setChatMessages((prev) => [...prev.slice(-49), myMsg]);
    }
  };

  const handleMobileAttack = () => {
    arenaRef.current?.attack();
  };

  const handleMobileDodge = () => {
    arenaRef.current?.dodge?.();
  };

  const handleMobileSpin = () => {
    arenaRef.current?.spin?.();
  };

  const handleMobileClones = () => {
    arenaRef.current?.clones?.();
  };

  const handleMobileFlash = () => {
    arenaRef.current?.flashTriangle();
  };

  return (
    <main className={styles.page}>
      <header className={styles.hudCompact}>
        <div className={styles.hudCompactRow}>
          <span className={styles.statusDot} />
          <h1>{playerInfo?.name || "ADVENTURER"}</h1>
          <span className={styles.zoneBadge}>{zoneName}</span>
          <span className={styles.waveBadge}>LV {combinedStats.level}</span>
          {stats.skillPoints > 0 && (
            <span className={styles.spBadge}>+{stats.skillPoints} SP</span>
          )}
          <span className={styles.timeBadge}>{worldTime.isNight ? "☾" : "☀"} {worldTime.label}</span>
          <button
            type="button"
            onClick={() => setFriendsOpen(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: "rgba(168, 85, 247, 0.25)",
              border: "2px solid #c084fc",
              padding: "3px 8px",
              fontSize: "0.58rem",
              color: "#e9d5ff",
              cursor: "pointer",
              fontFamily: "inherit",
              boxShadow: "0 0 8px rgba(192, 132, 252, 0.3)",
            }}
            title="Open Friends List"
          >
            👥 FRIENDS
          </button>
          {/* Public Server button — only when not in a room */}
          {!roomId && (
            <button
              type="button"
              onClick={() => {
                const publicRoomId = "public-survival-1";
                setRoomId(publicRoomId);
                const url = new URL(window.location.href);
                url.searchParams.set("room", publicRoomId);
                window.history.replaceState({}, "", url.toString());
                setLootMessage("🌍 JOINED PUBLIC SERVER!");
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                background: "rgba(34, 197, 94, 0.2)",
                border: "2px solid #4ade80",
                padding: "3px 8px",
                fontSize: "0.58rem",
                color: "#86efac",
                cursor: "pointer",
                fontFamily: "inherit",
                boxShadow: "0 0 8px rgba(74, 222, 128, 0.2)",
              }}
              title="Join the shared public server visible to everyone"
            >
              🌍 PUBLIC
            </button>
          )}
          {roomId && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: roomId === "public-survival-1"
                  ? "rgba(34, 197, 94, 0.2)"
                  : "rgba(14, 116, 144, 0.25)",
                border: roomId === "public-survival-1"
                  ? "2px solid #4ade80"
                  : "2px solid #38bdf8",
                padding: "3px 8px",
                fontSize: "0.58rem",
                color: roomId === "public-survival-1" ? "#86efac" : "#38bdf8",
                boxShadow: "0 0 10px rgba(56, 189, 248, 0.3)",
              }}
            >
              <span>
                {roomId === "public-survival-1"
                  ? "🌍 PUBLIC SERVER"
                  : `⚔️ ROOM: ${roomId.length > 8 ? `${roomId.substring(0, 8)}...` : roomId}`}
              </span>
              <span style={{ color: "#a5f3fc" }}>👥 {roomPlayerCount} ONLINE</span>
              {roomId !== "public-survival-1" && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    setLootMessage("ROOM INVITE LINK COPIED!");
                  }}
                  style={{
                    background: "#0284c7",
                    border: "1px solid #38bdf8",
                    color: "#fff",
                    padding: "2px 6px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: "0.52rem",
                  }}
                  title="Copy Invite Link to share with friends"
                >
                  COPY LINK
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setRoomId(null);
                  const url = new URL(window.location.href);
                  url.searchParams.delete("room");
                  window.history.replaceState({}, "", url.toString());
                  router.push("/survival");
                }}
                style={{
                  background: "rgba(225, 29, 72, 0.3)",
                  border: "1px solid #f43f5e",
                  color: "#fda4af",
                  padding: "2px 6px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: "0.52rem",
                }}
                title="Leave multiplayer room"
              >
                LEAVE
              </button>
            </div>
          )}
          <span className={styles.hudCompactSpacer} />
          <span className={styles.hudRes}>GOLD<strong>{stats.gold.toLocaleString()}</strong></span>
          <span className={styles.hudRes}>MATS<strong>{materialCount}</strong></span>
        </div>

        <div className={styles.hudCompactBars}>
          <span className={styles.hudLvMini} title="Level">{combinedStats.level}</span>
          <div className={styles.hudBar} title={`HP ${Math.round(combinedStats.hp)} / ${combinedStats.maxHp}`}>
            <span className={styles.hudBarLabelHp}>HP</span>
            <div className={styles.hudBarTrack}>
              <div className={styles.hudHpFill} style={{ width: `${lifePercent}%` }} />
            </div>
            <strong>{Math.round(combinedStats.hp)}/{combinedStats.maxHp}</strong>
          </div>
          <div className={styles.hudBar} title={`MP ${Math.round(combinedStats.mana)} / ${combinedStats.maxMana}`}>
            <span className={styles.hudBarLabelMp}>MP</span>
            <div className={styles.hudBarTrack}>
              <div className={styles.hudMpFill} style={{ width: `${manaPercent}%` }} />
            </div>
            <strong>{Math.round(combinedStats.mana)}/{combinedStats.maxMana}</strong>
          </div>
          <div className={styles.hudBar} title={`XP ${stats.xp} / ${stats.xpToNext}`}>
            <span className={styles.hudBarLabelXp}>XP</span>
            <div className={styles.hudBarTrack}>
              <div className={styles.hudXpFill} style={{ width: `${xpPercent}%` }} />
            </div>
            <strong>{stats.xp}/{stats.xpToNext}</strong>
          </div>
        </div>
      </header>

      {levelUpMessage && (
        <div style={{ position: "absolute", top: 90, left: "50%", transform: "translateX(-50%)", padding: "10px 20px", borderRadius: 0, background: "#ffcd75", color: "#000", fontWeight: 800, letterSpacing: "0.12em", zIndex: 40 }}>
          {levelUpMessage}
        </div>
      )}

      {expMessage && (
        <div className={styles.expRewardMessage}>
          {expMessage}
        </div>
      )}

      <div className={styles.mainGameArea}>
        {lifePercent < 30 && <div className={styles.lowHpVignette} />}
          {combatPhase === "combat" && <div className={styles.combatIndicator}>COMBAT MODE ACTIVE</div>}
          {combatPhase === "cooldown" && <div className={styles.cooldownIndicator}>COOLING DOWN</div>}
          {stunActive && <div className={styles.stunIndicator}>STUNNED</div>}
        {zoneBanner && <div className={styles.zoneBanner}>{zoneBanner}</div>}
        {lootMessage && <div className={styles.lootMessage}>{lootMessage}</div>}
        {lootNearby && <div className={styles.pickupHint}>PRESS E TO COLLECT</div>}
        {vendorNearby === "store" && !shopOpen && <div className={styles.vendorHint}>PRESS F FOR STORE</div>}
        {vendorNearby === "craft" && !craftOpen && <div className={styles.vendorHint}>PRESS C TO CRAFT</div>}
        {vendorNearby === "incubator" && !hatchOpen && <div className={styles.vendorHint}>PRESS V TO HATCH</div>}

        <InfiniteArena
          ref={arenaRef}
          playerHp={combinedStats.hp}
          playerMaxHp={combinedStats.maxHp}
          playerAttack={combinedStats.attack}
          playerCritChance={combinedStats.critChance}
          playerCritDamage={combinedStats.critDamage}
          playerSkillPower={combinedStats.skillPower}
          playerMoveSpeed={combinedStats.moveSpeed}
          playerAttackSpeed={combinedStats.attackSpeed}
          playerLuck={combinedStats.luck}
          playerDefense={combinedStats.defense}
          playerArmor={combinedStats.armor}
          playerLevel={combinedStats.level}
          playerMana={combinedStats.mana}
          playerMaxMana={combinedStats.maxMana}
          onSkillDenied={() => setLootMessage("NOT ENOUGH MANA")}
          companionId={equipment.companion?.id ?? null}
          zoom={zoom}
          roomId={roomId}
          playerInfo={playerInfo ?? undefined}
          onPlayerCountChange={setRoomPlayerCount}
          onChatMessage={(msg) => setChatMessages((prev) => [...prev.slice(-49), msg])}
          virtualDirection={virtualDir}
          onStatsChange={handleStatsChange}
          onExpEarned={(amount, enemyName) => setExpMessage(`${enemyName} DEFEATED +${amount} EXP`)}
          onCombatChange={setCombatPhase}
          onStunChange={setStunActive}
          onLootCollected={(item, amount) => {
            bumpQuest("scavenger", 1);
            bumpDaily("daily-looter", 1);
            if (item.type === "currency") {
              const gold = (item.stats.gold ?? 5) * amount;
              handleStatsChange((current) => ({ ...current, gold: current.gold + gold }));
              setLootMessage(`+${gold} GOLD`);
            } else {
              setInventory((current) => addItem(current, item, amount));
              setLootMessage(`+${amount} ${item.name}`);
            }
          }}
          onKill={(kind) => {
            if (kind === "slime") bumpQuest("first-blood", 1);
            bumpDaily("daily-slayer", 1);
            if (kind === "slime") bumpDaily("daily-slimes", 1);
          }}
          onDistanceMoved={(units) => {
            bumpQuest("first-steps", units);
            bumpDaily("daily-walker", units);
          }}
          onSkillCast={() => bumpDaily("daily-caster", 1)}
          onLootNearby={setLootNearby}
          onTimeChange={setWorldTime}
          onZoneChange={(name) => {
            setZoneName(name);
            setZoneBanner(name);
          }}
          onVendorNearby={(vendor) => {
            setVendorNearby(vendor);
            if (vendor !== "store") setShopOpen(false);
            if (vendor !== "craft") setCraftOpen(false);
            if (vendor !== "incubator") setHatchOpen(false);
          }}
          onInspectEnemy={(info) => {
            setInspectedEnemy(info);
            if (info) {
              setInspectedNpc(null);
              setInspectedVendor(null);
              setInspectedWarrior(null);
            }
          }}
          onInspectNpc={(info) => {
            setInspectedNpc(info);
            if (info) {
              setInspectedEnemy(null);
              setInspectedVendor(null);
              setInspectedWarrior(null);
            }
          }}
          onInspectVendor={(vendor) => {
            setInspectedVendor(vendor);
            if (vendor) {
              setInspectedEnemy(null);
              setInspectedNpc(null);
              setInspectedWarrior(null);
            }
          }}
          onInspectWarrior={(info) => {
            setInspectedWarrior(info);
            if (info) {
              setInspectedEnemy(null);
              setInspectedNpc(null);
              setInspectedVendor(null);
            }
          }}
        />

        <button
          type="button"
          className={styles.bagToggle}
          onClick={() => setBagOpen((open) => !open)}
          aria-expanded={bagOpen}
          aria-label="Toggle bag"
        >
          BAG
        </button>

        <button
          type="button"
          className={styles.bagToggle}
          style={{ top: 232, borderColor: "#ffcd75", color: "#ffcd75" }}
          onClick={() => setCodexOpen((open) => !open)}
          aria-expanded={codexOpen}
          aria-label="Toggle item book"
          title="Item book (B)"
        >
          BOOK
        </button>

        <button
          type="button"
          className={styles.bagToggle}
          style={{ top: 272, borderColor: "#ffcd75", color: "#ffcd75" }}
          onClick={() => setHelpOpen((open) => !open)}
          aria-expanded={helpOpen}
          aria-label="Toggle how to play"
          title="How to play (?)"
        >
          ?
        </button>

        {helpOpen && <HowToPlay onClose={() => setHelpOpen(false)} />}

        {codexOpen && (
          <ItemCodex
            discoveredIds={discoveredIds}
            ownedCounts={codexOwnedCounts}
            onClose={() => setCodexOpen(false)}
          />
        )}

        <div
          style={{
            position: "absolute",
            right: 12,
            bottom: 12,
            zIndex: 60,
            display: "flex",
            gap: 6,
            alignItems: "center",
            background: "rgba(24, 20, 37, 0.95)",
            border: "1px solid #ffcd75",
            padding: "4px 6px",
            borderRadius: 0,
            fontFamily: 'var(--font-pixel), "Press Start 2P", monospace',
          }}
          title="Camera zoom"
        >
          <button
            type="button"
            onClick={() => stepZoom(-1)}
            disabled={zoom <= ZOOM_MIN}
            aria-label="Zoom out"
            title="Zoom out (see more)"
            style={{ border: "none", background: "transparent", color: zoom <= ZOOM_MIN ? "#5a5a78" : "#ffcd75", fontSize: 14, cursor: zoom <= ZOOM_MIN ? "not-allowed" : "pointer", padding: "0 6px" }}
          >
            −
          </button>
          <button
            type="button"
            onClick={() => setZoom(ZOOM_DEFAULT)}
            title="Reset zoom"
            style={{ border: "none", background: "transparent", color: "#ffcd75", fontSize: 11, cursor: "pointer", minWidth: 40 }}
            suppressHydrationWarning
          >
            {Math.round((zoomLoaded ? zoom : ZOOM_DEFAULT) * 100)}%
          </button>
          <button
            type="button"
            onClick={() => stepZoom(1)}
            disabled={zoom >= ZOOM_MAX}
            aria-label="Zoom in"
            title="Zoom in"
            style={{ border: "none", background: "transparent", color: zoom >= ZOOM_MAX ? "#5a5a78" : "#ffcd75", fontSize: 14, cursor: zoom >= ZOOM_MAX ? "not-allowed" : "pointer", padding: "0 6px" }}
          >
            +
          </button>
        </div>

        {bagOpen && (
          <aside className={styles.bagPanelFloating} style={{ maxWidth: 1020, width: "min(1020px, 90vw)" }}>
            <div className={styles.bagHeader}>
              <span>{playerInfo?.name || "ADVENTURER"}</span>
              <strong>LV {combinedStats.level}</strong>
              <button type="button" className={styles.bagClose} onClick={() => setBagOpen(false)} aria-label="Close bag">✕</button>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {([
                { id: "status", label: `STATUS · LV ${combinedStats.level}` },
                { id: "items", label: `ITEMS · ${inventory.length}` },
                { id: "gear", label: `GEAR · ${usableEquipSlots.filter((slot) => equipment[slot]).length}/${usableEquipSlots.length}` },
                { id: "mats", label: `MATS · ${inventory.filter((entry) => entry.type === "material" || entry.type === "monster-drop").length}` },
                { id: "quests", label: `QUESTS${questClaimableCount + dailyClaimableCount > 0 ? ` · ${questClaimableCount + dailyClaimableCount}!` : ""}` },
              ] as const).map((tab) => {
                const active = bagTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setBagTab(tab.id)}
                    style={{
                      border: active ? "1px solid #ffcd75" : "1px solid #3a3f58",
                      background: active ? "#b13434" : "rgba(24, 20, 37, 0.9)",
                      color: active ? "#ffcd75" : "#cbd5e1",
                      padding: "6px 14px",
                      borderRadius: 0,
                      fontSize: 11,
                      letterSpacing: "0.1em",
                      cursor: "pointer",
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {bagTab === "status" && (
            <>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, opacity: 0.8, marginBottom: 4, marginTop: 4 }}>
                <span>EXPERIENCE</span>
                <strong>{stats.xp}/{stats.xpToNext} XP</strong>
              </div>
              <div style={{ height: 10, background: "#0f0a1e", borderRadius: 0, overflow: "hidden", border: "1px solid #3a3f58" }}>
                <div style={{ width: `${stats.xpToNext > 0 ? Math.max(0, Math.min(100, (stats.xp / stats.xpToNext) * 100)) : 0}%`, height: "100%", background: "linear-gradient(90deg, #38bdf8, #818cf8)" }} />
              </div>
            </div>
            <div className={styles.bagTopStats}>
              {[
                { key: "life", label: "HP", value: `${Math.round(combinedStats.hp)}/${combinedStats.maxHp}` },
                { key: "mana", label: "MP", value: `${Math.round(combinedStats.mana)}/${combinedStats.maxMana}` },
                { key: "power", label: "ATK", value: `${combinedStats.attack}` },
                { key: "defense", label: "DEF", value: `${combinedStats.defense}` },
                { key: "crit", label: "CRIT", value: `${combinedStats.critChance}%` },
                { key: "skill", label: "SKL", value: `${combinedStats.skillPower}` },
                { key: "speed", label: "SPD", value: `${combinedStats.moveSpeed.toFixed(2)}x` },
              ].map((stat) => (
                <div key={stat.key} className={styles.statCard}>
                  <div className={styles.statHeader}>
                    <span>{stat.label}</span>
                    <button
                      type="button"
                      className={styles.upgradeButton}
                      onClick={() => handleUpgrade(stat.key as "life" | "mana" | "power" | "defense" | "crit" | "skill" | "speed")}
                      disabled={stats.skillPoints <= 0}
                      title="Upgrade stat"
                    >
                      +
                    </button>
                  </div>
                  <strong>{stat.value}</strong>
                </div>
              ))}
            </div>
            </>
            )}

            {bagTab === "items" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginTop: 18, alignItems: "start" }}>
              <div style={{ padding: 12, borderRadius: 0, background: "rgba(24, 20, 37, 0.9)", border: "1px solid #3a3f58" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ fontSize: 11, opacity: 0.8, textTransform: "uppercase" }}>
                    Inventory ({displayedInventory.length}{displayedInventory.length !== inventory.length ? `/${inventory.length}` : ""})
                  </div>
                  <select value={inventorySort} onChange={(event) => { setInventorySort(event.target.value as typeof inventorySort); setInventoryPage(1); }} aria-label="Sort inventory" style={{ background: "#0f0a1e", color: "#ffcd75", border: "1px solid #3a3f58", borderRadius: 0, padding: "4px 6px", fontSize: 11 }}>
                    <option value="type">Type</option>
                    <option value="rarity">Rarity</option>
                    <option value="level">Level</option>
                    <option value="quantity">Quantity</option>
                  </select>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  {INVENTORY_TABS.map((tab) => {
                    const active = inventoryFilter === tab.id;
                    const tabCount = tab.id === "all" ? inventory.length : inventory.filter((entry) => filterMatches(entry, tab.id)).length;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => { setInventoryFilter(tab.id); setInventoryPage(1); }}
                        style={{
                          border: active ? "1px solid #ffcd75" : "1px solid #3a3f58",
                          background: active ? "#b13434" : "rgba(24, 20, 37, 0.9)",
                          color: active ? "#ffcd75" : "#cbd5e1",
                          padding: "4px 10px",
                          borderRadius: 0,
                          fontSize: 11,
                          letterSpacing: "0.06em",
                          cursor: "pointer",
                        }}
                      >
                        {tab.label} · {tabCount}
                      </button>
                    );
                  })}
                </div>
                <input
                  value={inventorySearch}
                  onChange={(event) => { setInventorySearch(event.target.value); setInventoryPage(1); }}
                  placeholder="Search name, rarity, category…"
                  aria-label="Search inventory"
                  style={{ width: "100%", boxSizing: "border-box", background: "#0f0a1e", color: "#ffcd75", border: "1px solid #3a3f58", borderRadius: 0, padding: "6px 8px", fontSize: 12, marginBottom: 8 }}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {pagedInventory.map((item, index) => {
                    const locked = item.equipmentSlot ? item.levelRequirement > stats.level : false;
                    const action = inventoryRowAction(item);
                    const rarityColor = RARITY_COLORS[item.rarity] ?? "#cbd5e1";
                    const selected = selectedItem?.id === item.id;
                    return (
                      <button
                        key={`${item.id}-${index}`}
                        type="button"
                        onMouseEnter={() => setSelectedItem(item)}
                        onClick={() => {
                          setSelectedItem(item);
                          if (item.equipmentSlot) equipItemToSlot(item);
                          else consumeItem(item);
                        }}
                        title={item.equipmentSlot ? `Equip ${item.name}` : item.type === "consumable" ? `Use ${item.name}` : item.category === "Eggs" ? "Hatch at the incubator (press V nearby)" : item.description}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 8,
                          width: "100%",
                          padding: "6px 10px",
                          borderRadius: 0,
                          background: "rgba(24, 20, 37, 0.9)",
                          color: "#ffcd75",
                          border: "1px solid #3a3f58",
                          boxShadow: `inset 3px 0 0 ${rarityColor}${selected ? ", 0 0 0 1px #ffcd75" : ""}`,
                          opacity: locked ? 0.72 : 1,
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
                          <ItemIcon icon={item.icon} rarity={item.rarity} size={30} />
                          <span style={{ minWidth: 0 }}>
                            <strong style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</strong>
                            <small style={{ display: "block", opacity: 0.75, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.rarity} · {item.category}</small>
                          </span>
                        </span>
                        <span style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                          {locked && (
                            <small style={{ background: "#7f1d1d", color: "#fecaca", padding: "2px 6px", borderRadius: 0, fontSize: 10 }}>🔒 LV {item.levelRequirement}</small>
                          )}
                          {action && (
                            <small style={{ background: action === "HATCH" ? "#3b2f6b" : "#b13434", color: action === "HATCH" ? "#ddd6fe" : "#ffcd75", padding: "2px 6px", borderRadius: 0, fontSize: 10, letterSpacing: "0.08em" }}>{action}</small>
                          )}
                          <small style={{ color: rarityColor }}>x{item.amount}</small>
                        </span>
                      </button>
                    );
                  })}
                  {displayedInventory.length === 0 && (
                    <div style={{ padding: "14px 10px", textAlign: "center", fontSize: 12, opacity: 0.7 }}>
                      {inventory.length === 0
                        ? "Bag is empty — defeat enemies and press E to loot."
                        : "No items match — try another tab or clear the search."}
                    </div>
                  )}
                </div>
                {pageCount > 1 && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 8 }}>
                    <button
                      type="button"
                      onClick={() => setInventoryPage(Math.max(1, safePage - 1))}
                      disabled={safePage <= 1}
                      style={{
                        border: "1px solid #3a3f58",
                        background: safePage <= 1 ? "rgba(24, 20, 37, 0.5)" : "rgba(24, 20, 37, 0.9)",
                        color: safePage <= 1 ? "#5a5a78" : "#ffcd75",
                        padding: "4px 12px",
                        borderRadius: 0,
                        fontSize: 11,
                        letterSpacing: "0.08em",
                        cursor: safePage <= 1 ? "not-allowed" : "pointer",
                      }}
                    >
                      ‹ PREV
                    </button>
                    <small style={{ opacity: 0.8, fontSize: 11 }}>Page {safePage} of {pageCount}</small>
                    <button
                      type="button"
                      onClick={() => setInventoryPage(Math.min(pageCount, safePage + 1))}
                      disabled={safePage >= pageCount}
                      style={{
                        border: "1px solid #3a3f58",
                        background: safePage >= pageCount ? "rgba(24, 20, 37, 0.5)" : "rgba(24, 20, 37, 0.9)",
                        color: safePage >= pageCount ? "#5a5a78" : "#ffcd75",
                        padding: "4px 12px",
                        borderRadius: 0,
                        fontSize: 11,
                        letterSpacing: "0.08em",
                        cursor: safePage >= pageCount ? "not-allowed" : "pointer",
                      }}
                    >
                      NEXT ›
                    </button>
                  </div>
                )}
              </div>

              <div style={{ padding: 12, borderRadius: 0, background: "rgba(24, 20, 37, 0.9)", border: "1px solid #3a3f58" }}>
                <div style={{ fontSize: 11, opacity: 0.8, textTransform: "uppercase", marginBottom: 8 }}>Details</div>
                {selectedItem && (() => {
                  const detailLocked = selectedItem.levelRequirement > stats.level;
                  const detailRarity = RARITY_COLORS[selectedItem.rarity] ?? "#cbd5e1";
                  const detailStats = Object.entries(selectedItem.stats ?? {});
                  return (
                    <div style={{ padding: 12, background: "rgba(15, 10, 30, 0.7)", borderRadius: 0, boxShadow: `inset 3px 0 0 ${detailRarity}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <strong style={{ color: detailRarity }}>{selectedItem.name}</strong>
                        <small style={{ border: `1px solid ${detailRarity}`, color: detailRarity, padding: "2px 8px", borderRadius: 0, fontSize: 10, letterSpacing: "0.1em", flexShrink: 0 }}>{selectedItem.rarity.toUpperCase()}</small>
                      </div>
                      {selectedItem.equipmentSlot === "companion" ? (
                        <div style={{ marginTop: 8, display: "flex", justifyContent: "center" }}>
                          <RedDragonSprite dir="down" scale={redDragonScaleFor(selectedItem.id)} fps={10} playing companionId={selectedItem.id} />
                        </div>
                      ) : (
                        <div style={{ marginTop: 8, display: "flex", justifyContent: "center" }}>
                          <ItemIcon icon={selectedItem.icon} rarity={selectedItem.rarity} size={96} />
                        </div>
                      )}
                      <div style={{ fontSize: 12, opacity: 0.85, marginTop: 8 }}>{selectedItem.description}</div>
                      <div style={{ fontSize: 12, marginTop: 8, color: detailLocked ? "#ffb4a2" : "#cbd5e1" }}>
                        Required level: {selectedItem.levelRequirement}{detailLocked ? ` 🔒 (you are LV ${stats.level})` : ""}
                      </div>
                      {detailStats.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                          {detailStats.map(([key, value]) => (
                            <span key={key} style={{ fontSize: 11, background: "#0f0a1e", border: "1px solid #3a3f58", color: "#ffcd75", padding: "3px 8px", borderRadius: 0 }}>+{value} {key}</span>
                          ))}
                        </div>
                      )}
                      <div style={{ marginTop: 10 }}>
                        {selectedItem.equipmentSlot ? (
                          <button
                            type="button"
                            onClick={() => equipItemToSlot(selectedItem)}
                            disabled={detailLocked}
                            title={detailLocked ? `Requires level ${selectedItem.levelRequirement}` : `Equip ${selectedItem.name}`}
                            style={{ width: "100%", border: "1px solid #ffcd75", background: detailLocked ? "#0f0a1e" : "#b13434", color: detailLocked ? "#78716c" : "#ffcd75", padding: "8px 12px", borderRadius: 0, cursor: detailLocked ? "not-allowed" : "pointer", letterSpacing: "0.1em", fontSize: 12 }}
                          >
                            {detailLocked ? `🔒 REQUIRES LV ${selectedItem.levelRequirement}` : `EQUIP TO ${selectedItem.equipmentSlot.toUpperCase()}`}
                          </button>
                        ) : selectedItem.type === "consumable" ? (
                          <button
                            type="button"
                            onClick={() => consumeItem(selectedItem)}
                            title={`Use ${selectedItem.name}`}
                            style={{ width: "100%", border: "1px solid #ffcd75", background: "#b13434", color: "#ffcd75", padding: "8px 12px", borderRadius: 0, cursor: "pointer", letterSpacing: "0.1em", fontSize: 12 }}
                          >
                            USE
                          </button>
                        ) : selectedItem.category === "Eggs" ? (
                          <div style={{ fontSize: 11, opacity: 0.8, textAlign: "center" }}>🥚 Hatch at the incubator — find it in the world and press V nearby.</div>
                        ) : null}
                      </div>
                    </div>
                  );
                })()}
                {!selectedItem && (
                  <div style={{ padding: "26px 10px", textAlign: "center", fontSize: 12, opacity: 0.7, border: "1px dashed #3a3f58", borderRadius: 0 }}>
                    Hover or tap an item in the inventory to inspect it here.
                  </div>
                )}
              </div>
            </div>
            )}

            {bagTab === "gear" && (
            <div style={{ marginTop: 18 }}>
              <div style={{ padding: 12, borderRadius: 0, background: "rgba(24, 20, 37, 0.9)", border: "1px solid #3a3f58" }}>
                <div style={{ fontSize: 11, opacity: 0.8, textTransform: "uppercase", marginBottom: 8 }}>
                  Equipment ({usableEquipSlots.filter((slot) => equipment[slot]).length}/{usableEquipSlots.length})
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                  {usableEquipSlots.map((slot) => {
                    const item = equipment[slot];
                    const rarityColor = item ? RARITY_COLORS[item.rarity] ?? "#cbd5e1" : undefined;
                    return (
                      <div
                        key={slot}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                          padding: "8px 10px",
                          borderRadius: 0,
                          background: item ? "rgba(24, 20, 37, 0.9)" : "rgba(15, 10, 30, 0.6)",
                          border: item ? "1px solid #3a3f58" : "1px dashed #3a3f58",
                          boxShadow: item && rarityColor ? `inset 3px 0 0 ${rarityColor}` : "none",
                        }}
                      >
                        <span style={{ textTransform: "uppercase", fontSize: 11, opacity: item ? 1 : 0.55, flexShrink: 0 }}>{SLOT_ICONS[slot] ?? "▫"} {slot}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                          {slot === "companion" && item ? (
                            <RedDragonSprite dir="down" scale={0.32} fps={8} playing companionId={item.id} />
                          ) : (
                            item && <ItemIcon icon={item.icon} rarity={item.rarity} size={30} />
                          )}
                          <span style={{ color: rarityColor ?? "#5a5a78", fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item ? item.name : "Empty"}</span>
                          {item && <button type="button" onClick={() => unequipFromSlot(slot as EquipmentSlot)} title={`Unequip ${item.name}`} style={{ border: "none", background: "#5a1111", color: "#fff", padding: "4px 8px", borderRadius: 0, cursor: "pointer", fontSize: 11, flexShrink: 0 }}>Unequip</button>}
                        </div>
                      </div>
                    );
                  })}
                  {equipment.companion && (
                    <div style={{ fontSize: 11, opacity: 0.8, textAlign: "center", gridColumn: "1 / -1" }}>
                      Your {equipment.companion.name} is flying at your side in the arena.
                    </div>
                  )}
                </div>
              </div>
            </div>
            )}

            {bagTab === "mats" && (
            <div style={{ marginTop: 18 }}>
              <div style={{ padding: 12, borderRadius: 0, background: "rgba(24, 20, 37, 0.9)", border: "1px solid #3a3f58" }}>
                <div style={{ fontSize: 11, opacity: 0.8, textTransform: "uppercase", marginBottom: 8 }}>Materials ({matsEntries.length})</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {pagedMats.map((item, index) => (
                    <div key={`${item.id}-${index}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", borderRadius: 0, background: "rgba(24, 20, 37, 0.9)" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}><ItemIcon icon={item.icon} rarity={item.rarity} size={28} />{item.name}</span>
                      <strong>x{item.amount}</strong>
                    </div>
                  ))}
                  {matsEntries.length === 0 && (
                    <div style={{ padding: "14px 10px", textAlign: "center", fontSize: 12, opacity: 0.7 }}>
                      No materials — defeat enemies and press E to loot.
                    </div>
                  )}
                </div>
                {matsPageCount > 1 && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 8 }}>
                    <button
                      type="button"
                      onClick={() => setMatsPage(Math.max(1, matsSafePage - 1))}
                      disabled={matsSafePage <= 1}
                      style={{
                        border: "1px solid #3a3f58",
                        background: "rgba(24, 20, 37, 0.9)",
                        color: matsSafePage <= 1 ? "#5a5a78" : "#ffcd75",
                        padding: "4px 12px",
                        borderRadius: 0,
                        fontSize: 11,
                        letterSpacing: "0.08em",
                        cursor: matsSafePage <= 1 ? "not-allowed" : "pointer",
                      }}
                    >
                      ‹ PREV
                    </button>
                    <small style={{ opacity: 0.8, fontSize: 11 }}>Page {matsSafePage} of {matsPageCount}</small>
                    <button
                      type="button"
                      onClick={() => setMatsPage(Math.min(matsPageCount, matsSafePage + 1))}
                      disabled={matsSafePage >= matsPageCount}
                      style={{
                        border: "1px solid #3a3f58",
                        background: "rgba(24, 20, 37, 0.9)",
                        color: matsSafePage >= matsPageCount ? "#5a5a78" : "#ffcd75",
                        padding: "4px 12px",
                        borderRadius: 0,
                        fontSize: 11,
                        letterSpacing: "0.08em",
                        cursor: matsSafePage >= matsPageCount ? "not-allowed" : "pointer",
                      }}
                    >
                      NEXT ›
                    </button>
                  </div>
                )}
              </div>
            </div>
            )}

            {bagTab === "quests" && (
            <div style={{ marginTop: 18 }}>
              <div style={{ padding: 12, borderRadius: 0, background: "rgba(24, 20, 37, 0.9)", border: "1px solid #3a3f58" }}>
                <div style={{ fontSize: 11, opacity: 0.8, textTransform: "uppercase", marginBottom: 4 }}>Beginner Quests</div>
                <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 10 }}>Complete deeds, then claim gold + XP here.</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {BEGINNER_QUESTS.map((quest) => {
                    const progress = Math.min(quest.target, quests.counts[quest.id] ?? 0);
                    const done = quests.completedIds.includes(quest.id);
                    const claimed = quests.claimedIds.includes(quest.id);
                    return (
                      <QuestRow
                        key={quest.id}
                        quest={quest}
                        progress={progress}
                        done={done}
                        claimed={claimed}
                        onClaim={claimQuestReward}
                      />
                    );
                  })}
                </div>
                <div style={{ fontSize: 11, opacity: 0.8, textTransform: "uppercase", marginTop: 14, marginBottom: 4 }}>
                  Daily Quests — resets midnight{dailyClaimableCount > 0 ? ` · ${dailyClaimableCount} to claim!` : ""}
                </div>
                <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 10 }}>Today: {dailies.dateKey}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {dailyIds.map((id) => {
                    const quest = dailyById(id);
                    if (!quest) return null;
                    const progress = Math.min(quest.target, dailies.save.counts[quest.id] ?? 0);
                    const done = dailies.save.completedIds.includes(quest.id);
                    const claimed = dailies.save.claimedIds.includes(quest.id);
                    return (
                      <QuestRow
                        key={quest.id}
                        quest={quest}
                        progress={progress}
                        done={done}
                        claimed={claimed}
                        onClaim={claimDailyReward}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
            )}

            <div className={styles.bagFooter} style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div className={styles.skillPointRow} style={{ flex: 1 }}>
                <span>GOLD</span>
                <strong>{stats.gold.toLocaleString()}</strong>
              </div>
              <div className={styles.skillPointRow} style={{ flex: 1 }}>
                <span>UPGRADES</span>
                <strong>{stats.skillPoints}</strong>
              </div>
              <div className={styles.levelInfo} style={{ flex: 1 }}>
                <span>XP RATE</span>
                <strong>{combinedStats.level}x</strong>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Reset gold, items and equipment back to starting values?")) {
                    clearSaveData();
                    window.location.reload();
                  }
                }}
                title="Wipe gold, inventory and equipment"
                style={{ border: "1px solid #7f1d1d", background: "transparent", color: "#ffb4a2", padding: "6px 10px", borderRadius: 0, fontSize: 11, letterSpacing: "0.1em", cursor: "pointer", flexShrink: 0 }}
              >
                RESET
              </button>
            </div>
          </aside>
        )}

        {shopOpen && (
          <aside className={styles.bagPanelFloating} style={{ maxWidth: 520, width: "min(520px, 85vw)", overflowY: "auto" }}>
            <div className={styles.bagHeader}>
              <span>STORE</span>
              <strong>{stats.gold.toLocaleString()} GOLD</strong>
              <button type="button" className={styles.bagClose} onClick={() => setShopOpen(false)} aria-label="Close store">✕</button>
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              {(["buy", "sell"] as const).map((tab) => {
                const active = shopTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setShopTab(tab)}
                    style={{
                      flex: 1,
                      border: active ? "1px solid #ffcd75" : "1px solid #3a3f58",
                      background: active ? "#b13434" : "rgba(24, 20, 37, 0.9)",
                      color: active ? "#ffcd75" : "#cbd5e1",
                      padding: "6px 12px",
                      borderRadius: 0,
                      fontSize: 11,
                      letterSpacing: "0.1em",
                      cursor: "pointer",
                    }}
                  >
                    {tab === "buy" ? `BUY · ${SHOP_STOCK.length}` : `SELL · ${inventory.length}`}
                  </button>
                );
              })}
            </div>
            {shopTab === "buy" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {SHOP_STOCK.map((stock) => {
                const def = itemById(stock.id);
                if (!def) return null;
                const afford = stats.gold >= stock.price;
                return (
                  <div key={stock.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 10px", borderRadius: 0, background: "rgba(24, 20, 37, 0.9)", border: "1px solid #3a3f58" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <ItemIcon icon={def.icon} rarity={def.rarity} size={34} />
                      <span style={{ textAlign: "left" }}><strong>{def.name}</strong><small style={{ display: "block", opacity: 0.75 }}>{def.description}</small></span>
                    </span>
                    <button type="button" onClick={() => buyItem(stock.id, stock.price)} disabled={!afford} title={afford ? `Buy for ${stock.price} gold` : "Not enough gold"} style={{ flexShrink: 0, border: "1px solid #ffcd75", background: afford ? "#b13434" : "#0f0a1e", color: afford ? "#ffcd75" : "#78716c", padding: "6px 12px", borderRadius: 0, cursor: afford ? "pointer" : "not-allowed" }}>
                      {stock.price}G
                    </button>
                  </div>
                );
              })}
            </div>
            )}
            {shopTab === "sell" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ padding: 10, borderRadius: 0, background: "rgba(177, 52, 52, 0.25)", border: "1px solid #ffcd75" }}>
                <div style={{ fontSize: 11, letterSpacing: "0.1em", color: "#ffcd75", marginBottom: 6 }}>BULK SELL — WHAT TO SELL</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  {SELL_RARITIES.map((rarity) => {
                    const on = sellRarities.includes(rarity);
                    const dot = RARITY_COLORS[rarity] ?? "#cbd5e1";
                    return (
                      <button
                        key={rarity}
                        type="button"
                        onClick={() => toggleSellRarity(rarity)}
                        title={on ? `Stop selling ${rarity}` : `Sell ${rarity} too`}
                        style={{
                          border: on ? "1px solid #ffcd75" : "1px solid #3a3f58",
                          background: on ? "#b13434" : "rgba(24, 20, 37, 0.9)",
                          color: on ? "#ffcd75" : "#94a3b8",
                          padding: "4px 10px",
                          borderRadius: 0,
                          fontSize: 11,
                          cursor: "pointer",
                        }}
                      >
                        <span style={{ color: dot }}>●</span> {rarity}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 8 }}>
                  <select value={sellCategory} onChange={(event) => setSellCategory(event.target.value as InventoryFilter)} aria-label="Sell category" style={{ background: "#0f0a1e", color: "#ffcd75", border: "1px solid #3a3f58", borderRadius: 0, padding: "4px 6px", fontSize: 11 }}>
                    {INVENTORY_TABS.map((tab) => (
                      <option key={tab.id} value={tab.id}>{tab.label}</option>
                    ))}
                  </select>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, cursor: "pointer" }}>
                    <input type="checkbox" checked={sellKeepOne} onChange={(event) => setSellKeepOne(event.target.checked)} />
                    Keep 1 of each
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                    Max each
                    <input
                      value={sellMaxEach}
                      onChange={(event) => setSellMaxEach(event.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
                      placeholder="All"
                      inputMode="numeric"
                      aria-label="Max per item"
                      style={{ width: 56, background: "#0f0a1e", color: "#ffcd75", border: "1px solid #3a3f58", borderRadius: 0, padding: "4px 6px", fontSize: 11 }}
                    />
                  </label>
                </div>
                {sellMatching.length > 0 ? (
                  <div style={{ fontSize: 11, marginBottom: 6, opacity: 0.9 }}>
                    {sellMatching.slice(0, 4).map((target) => (
                      <div key={target.id} style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>{target.qty}x {target.name}</span>
                        <strong>+{(target.qty * target.worth).toLocaleString()}G</strong>
                      </div>
                    ))}
                    {sellMatching.length > 4 && <div style={{ opacity: 0.7 }}>…and {sellMatching.length - 4} more</div>}
                  </div>
                ) : (
                  <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 6 }}>Nothing matches — tick a rarity or change category.</div>
                )}
                <button
                  type="button"
                  onClick={bulkSell}
                  disabled={sellMatching.length === 0}
                  title={sellMatching.length === 0 ? "Nothing matches the filters" : `Sell ${bulkQty} items for ${bulkGold.toLocaleString()} gold`}
                  style={{ width: "100%", border: "1px solid #ffcd75", background: sellMatching.length === 0 ? "#0f0a1e" : "#b13434", color: sellMatching.length === 0 ? "#78716c" : "#ffcd75", padding: "8px 12px", borderRadius: 0, cursor: sellMatching.length === 0 ? "not-allowed" : "pointer", letterSpacing: "0.1em", fontSize: 12 }}
                >
                  {sellMatching.length === 0 ? "NOTHING TO SELL" : `SELL ${bulkQty}x FOR ${bulkGold.toLocaleString()}G`}
                </button>
              </div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>…or sell one by one. Equipped gear can't be sold — unequip it first.</div>
              {sortInventory(inventory, "type").map((entry, index) => {
                const def = itemById(entry.id);
                if (!def || (entry.amount || 0) < 1) return null;
                const worth = def.sellPrice ?? 0;
                return (
                  <div key={`${entry.id}-${index}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "6px 8px", borderRadius: 0, background: "rgba(24, 20, 37, 0.9)", border: "1px solid #3a3f58" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <ItemIcon icon={entry.icon} rarity={entry.rarity} size={30} />
                      <span style={{ textAlign: "left", fontSize: 12 }}>
                        <strong>{entry.name}</strong>
                        <small style={{ display: "block", opacity: 0.75 }}>x{entry.amount} · worth {worth}G each</small>
                      </span>
                    </span>
                    <span style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button type="button" onClick={() => sellItem(entry.id, false)} title={`Sell 1 for ${worth} gold`} style={{ border: "1px solid #ffcd75", background: "#b13434", color: "#ffcd75", padding: "6px 10px", borderRadius: 0, cursor: "pointer", fontSize: 11 }}>
                        +{worth}G
                      </button>
                      {entry.amount > 1 && (
                        <button type="button" onClick={() => sellItem(entry.id, true)} title={`Sell all ${entry.amount} for ${worth * entry.amount} gold`} style={{ border: "1px solid #ffcd75", background: "#5a1111", color: "#ffcd75", padding: "6px 10px", borderRadius: 0, cursor: "pointer", fontSize: 11 }}>
                          ALL +{worth * entry.amount}G
                        </button>
                      )}
                    </span>
                  </div>
                );
              })}
              {inventory.length === 0 && (
                <div style={{ padding: "14px 10px", textAlign: "center", fontSize: 12, opacity: 0.7 }}>
                  Bag is empty — nothing to sell.
                </div>
              )}
            </div>
            )}
          </aside>
        )}

        {craftOpen && (
          <aside className={styles.bagPanelFloating} style={{ maxWidth: 520, width: "min(520px, 85vw)", overflowY: "auto" }}>
            <div className={styles.bagHeader}>
              <span>CRAFT</span>
              <strong>RECIPES</strong>
              <button type="button" className={styles.bagClose} onClick={() => setCraftOpen(false)} aria-label="Close crafting">✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {Object.values(CRAFTING_RECIPES).map((recipe) => {
                const result = itemById(recipe.resultId);
                if (!result) return null;
                const canCraft = recipe.requiredMaterials.every((m) => countOf(m.id) >= m.amount);
                return (
                  <div key={recipe.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 10px", borderRadius: 0, background: "rgba(24, 20, 37, 0.9)", border: "1px solid #3a3f58" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <ItemIcon icon={result.icon} rarity={result.rarity} size={34} />
                      <span style={{ textAlign: "left" }}>
                        <strong>{result.name}</strong>
                        <small style={{ display: "block", opacity: 0.75 }}>
                          {recipe.requiredMaterials.map((m) => `${itemById(m.id)?.name ?? m.id} ${countOf(m.id)}/${m.amount}`).join(" · ")}
                        </small>
                      </span>
                    </span>
                    <button type="button" onClick={() => craftRecipe(recipe.id)} disabled={!canCraft} title={canCraft ? "Craft" : "Not enough materials"} style={{ flexShrink: 0, border: "1px solid #ffcd75", background: canCraft ? "#b13434" : "#0f0a1e", color: canCraft ? "#ffcd75" : "#78716c", padding: "6px 12px", borderRadius: 0, cursor: canCraft ? "pointer" : "not-allowed" }}>
                      CRAFT
                    </button>
                  </div>
                );
              })}
            </div>
          </aside>
        )}

        {hatchOpen && (
          <aside className={styles.bagPanelFloating} style={{ maxWidth: 520, width: "min(520px, 85vw)" }}>
            <div className={styles.bagHeader}>
              <span>INCUBATOR</span>
              <strong>{HATCH_COST_GOLD}G PER EGG</strong>
              <button type="button" className={styles.bagClose} onClick={() => { setHatchOpen(false); setLastHatchedId(null); }} aria-label="Close incubator">✕</button>
            </div>
            <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 6 }}>Boss-only eggs · {HATCH_COST_GOLD}G per hatch · odds under each dragon.</div>
            {lastHatchedId && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 0, background: "rgba(177, 52, 52, 0.25)", border: "1px solid #ffcd75", marginBottom: 6 }}>
                <RedDragonSprite dir="down" scale={redDragonScaleFor(lastHatchedId)} fps={10} playing companionId={lastHatchedId} />
                <div style={{ fontSize: 11, flex: 1 }}>
                  <strong style={{ display: "block", letterSpacing: "0.08em" }}>
                    HATCHED {itemById(lastHatchedId)?.name?.toUpperCase() ?? lastHatchedId.toUpperCase()}!
                  </strong>
                  <span style={{ opacity: 0.85 }}>Open the bag → equip as companion.</span>
                </div>
                <button type="button" onClick={() => setLastHatchedId(null)} aria-label="Dismiss hatch result" title="Dismiss" style={{ border: "1px solid #ffcd75", background: "transparent", color: "#ffcd75", width: 22, height: 22, borderRadius: 0, cursor: "pointer", fontSize: 11, flexShrink: 0 }}>✕</button>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 4, marginBottom: 6 }}>
              {DRAGON_TIERS.map((tier) => (
                <div key={tier.id} title={`${tier.name} — ${tier.weight}%`} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, padding: "3px 2px", borderRadius: 0, background: "rgba(24, 20, 37, 0.9)", border: "1px solid #3a3f58" }}>
                  <RedDragonSprite dir="right" scale={0.17} fps={8} playing companionId={tier.id} />
                  <small style={{ color: tier.rarity, fontSize: 9, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{tier.name}</small>
                  <small style={{ opacity: 0.7, fontSize: 9, lineHeight: 1.2 }}>{tier.weight}%</small>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {pagedHatchEggs.map((entry, index) => {
                const canHatch = stats.gold >= HATCH_COST_GOLD && (entry.amount || 0) > 0;
                return (
                  <div key={`${entry.id}-${index}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "4px 8px", borderRadius: 0, background: "rgba(24, 20, 37, 0.9)", border: "1px solid #3a3f58" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <ItemIcon icon={entry.icon} rarity={entry.rarity} size={24} />
                      <span style={{ fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}><strong>{entry.name}</strong> <small style={{ opacity: 0.75 }}>x{entry.amount}</small></span>
                    </span>
                    <button type="button" onClick={() => hatchEgg(entry.id)} disabled={!canHatch} title={canHatch ? `Hatch for ${HATCH_COST_GOLD} gold` : "Need egg + gold"} style={{ flexShrink: 0, border: "1px solid #ffcd75", background: canHatch ? "#b13434" : "#0f0a1e", color: canHatch ? "#ffcd75" : "#78716c", padding: "5px 12px", borderRadius: 0, cursor: canHatch ? "pointer" : "not-allowed", fontSize: 11 }}>
                      HATCH
                    </button>
                  </div>
                );
              })}
              {hatchEggs.length === 0 && (
                <div style={{ padding: "14px 10px", textAlign: "center", fontSize: 12, opacity: 0.7 }}>
                  No dragon eggs — defeat the Skeleton King.
                </div>
              )}
            </div>
            {hatchPageCount > 1 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setHatchPage(Math.max(1, hatchSafePage - 1))}
                  disabled={hatchSafePage <= 1}
                  style={{
                    border: "1px solid #3a3f58",
                    background: "rgba(24, 20, 37, 0.9)",
                    color: hatchSafePage <= 1 ? "#5a5a78" : "#ffcd75",
                    padding: "4px 12px",
                    borderRadius: 0,
                    fontSize: 11,
                    letterSpacing: "0.08em",
                    cursor: hatchSafePage <= 1 ? "not-allowed" : "pointer",
                  }}
                >
                  ‹ PREV
                </button>
                <small style={{ opacity: 0.8, fontSize: 11 }}>Page {hatchSafePage} of {hatchPageCount}</small>
                <button
                  type="button"
                  onClick={() => setHatchPage(Math.min(hatchPageCount, hatchSafePage + 1))}
                  disabled={hatchSafePage >= hatchPageCount}
                  style={{
                    border: "1px solid #3a3f58",
                    background: "rgba(24, 20, 37, 0.9)",
                    color: hatchSafePage >= hatchPageCount ? "#5a5a78" : "#ffcd75",
                    padding: "4px 12px",
                    borderRadius: 0,
                    fontSize: 11,
                    letterSpacing: "0.08em",
                    cursor: hatchSafePage >= hatchPageCount ? "not-allowed" : "pointer",
                  }}
                >
                  NEXT ›
                </button>
              </div>
            )}
          </aside>
        )}

        {(inspectedEnemy || inspectedNpc || inspectedVendor || inspectedWarrior) && (
          <aside className={styles.inspectCard} aria-label="Inspected details">
            <div className={styles.bagHeader}>
              <span>{inspectedEnemy ? (inspectedEnemy.isBoss ? "BOSS" : "ENEMY") : inspectedNpc ? "VILLAGER" : inspectedWarrior ? "BODYGUARD" : "VENDOR"}</span>
              <button type="button" className={styles.bagClose} onClick={clearInspection} aria-label="Close details">✕</button>
            </div>

            {inspectedEnemy && (() => {
              const enemy = inspectedEnemy;
              const hpPct = enemy.maxHp > 0 ? Math.max(0, Math.min(100, (enemy.hp / enemy.maxHp) * 100)) : 0;
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <strong style={{ color: enemy.isBoss ? "#f87171" : "#ffcd75" }}>{enemy.name}</strong>
                    {enemy.isBoss && <small style={{ border: "1px solid #f87171", color: "#f87171", padding: "2px 8px", borderRadius: 0, fontSize: 10, letterSpacing: "0.1em" }}>BOSS</small>}
                  </div>
                  <EntityPortrait spec={enemyPortraitSpec(enemy.kind, enemy.colorRow)} height={128} label={`${enemy.name} portrait`} />
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                      <span>HP</span>
                      <strong>{enemy.hp}/{enemy.maxHp}</strong>
                    </div>
                    <div style={{ height: 8, background: "#0f0a1e", borderRadius: 0, overflow: "hidden", border: "1px solid #3a3f58" }}>
                      <div style={{ width: `${hpPct}%`, height: "100%", background: hpPct > 50 ? "#4ade80" : hpPct > 25 ? "#fbbf24" : "#f87171" }} />
                    </div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {[`⚔ ${enemy.damage} atk`, `◎ ${enemy.range} range`, `👁 ${enemy.detect} detect`].map((chip) => (
                      <span key={chip} style={{ fontSize: 11, background: "#0f0a1e", border: "1px solid #3a3f58", color: "#ffcd75", padding: "3px 8px", borderRadius: 0 }}>{chip}</span>
                    ))}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.85 }}>📍 {enemy.camp} · {enemy.zone}</div>
                  {enemy.drops.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, opacity: 0.8, textTransform: "uppercase", marginBottom: 4 }}>May drop</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {enemy.drops.map((drop) => (
                          <div key={drop.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                            <span>{drop.name}</span>
                            <strong>{Math.round(drop.chance * 100)}%</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={{ fontSize: 11, opacity: 0.7, textAlign: "center" }}>Click another enemy to inspect it · Esc to close</div>
                </div>
              );
            })()}

            {inspectedNpc && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <strong style={{ color: "#ffcd75" }}>{inspectedNpc.name}</strong>
                <EntityPortrait spec={npcPortraitSpec(inspectedNpc.charIndex)} height={144} label={`${inspectedNpc.name} portrait`} />
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span>HP</span>
                    <strong>{inspectedNpc.hp}/{inspectedNpc.maxHp}</strong>
                  </div>
                  <div style={{ height: 8, background: "#0f0a1e", borderRadius: 0, overflow: "hidden", border: "1px solid #3a3f58" }}>
                    <div style={{ width: `${inspectedNpc.maxHp > 0 ? Math.max(0, Math.min(100, (inspectedNpc.hp / inspectedNpc.maxHp) * 100)) : 0}%`, height: "100%", background: "#4ade80" }} />
                  </div>
                </div>
                <div style={{ fontSize: 12, opacity: 0.85 }}>Currently: <strong>{inspectedNpc.state.toUpperCase()}</strong></div>
                <div style={{ fontSize: 11, opacity: 0.7, textAlign: "center" }}>Click villagers in the world to chat or recruit them to follow you.</div>
              </div>
            )}

            {inspectedWarrior && (() => {
              const guard = inspectedWarrior;
              const hpPct = guard.maxHp > 0 ? Math.max(0, Math.min(100, (guard.hp / guard.maxHp) * 100)) : 0;
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <strong style={{ color: "#6ee7b7" }}>{guard.name}</strong>
                    <small style={{ border: "1px solid #6ee7b7", color: "#6ee7b7", padding: "2px 8px", borderRadius: 0, fontSize: 10, letterSpacing: "0.1em" }}>BODYGUARD</small>
                  </div>
                  <EntityPortrait spec={warriorPortraitSpec()} height={120} label={`${guard.name} portrait`} />
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                      <span>HP</span>
                      <strong>{guard.hp}/{guard.maxHp}</strong>
                    </div>
                    <div style={{ height: 8, background: "#0f0a1e", borderRadius: 0, overflow: "hidden", border: "1px solid #3a3f58" }}>
                      <div style={{ width: `${hpPct}%`, height: "100%", background: hpPct > 50 ? "#4ade80" : hpPct > 25 ? "#fbbf24" : "#f87171" }} />
                    </div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {[`⚔ ${guard.damage} atk`, `◎ ${guard.range} range`, `👁 ${guard.detect} detect`, `🛡 ${guard.guardRadius} guard`].map((chip) => (
                      <span key={chip} style={{ fontSize: 11, background: "#0f0a1e", border: "1px solid #3a3f58", color: "#ffcd75", padding: "3px 8px", borderRadius: 0 }}>{chip}</span>
                    ))}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.85 }}>Status: <strong>{guard.state.toUpperCase()}</strong></div>
                  <div style={{ fontSize: 11, opacity: 0.7, textAlign: "center" }}>One of four base guards. They patrol home, chase nearby monsters, and get back up after being downed.</div>
                </div>
              );
            })()}

            {inspectedVendor && (() => {
              const vendor = VENDOR_INFO[inspectedVendor];
              const nearby = vendorNearby === vendor.id;
              const openPanel =
                vendor.id === "store" ? () => setShopOpen(true) :
                vendor.id === "craft" ? () => setCraftOpen(true) :
                () => setHatchOpen(true);
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <strong style={{ color: "#ffcd75" }}>{vendor.name}</strong>
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <img src={vendor.src} alt={`${vendor.name} portrait`} style={{ height: 140, width: "auto", imageRendering: "pixelated", background: "rgba(2, 6, 16, 0.6)", border: "2px solid #3a3f58", borderRadius: 0, padding: 6 }} />
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.85 }}>{vendor.description}</div>
                  <button
                    type="button"
                    onClick={openPanel}
                    disabled={!nearby}
                    title={nearby ? `Press ${vendor.keyHint} or click to open` : "Walk closer to the stall to use it"}
                    style={{ width: "100%", border: "1px solid #ffcd75", background: nearby ? "#b13434" : "#0f0a1e", color: nearby ? "#ffcd75" : "#78716c", padding: "8px 12px", borderRadius: 0, cursor: nearby ? "pointer" : "not-allowed", letterSpacing: "0.1em", fontSize: 12 }}
                  >
                    {nearby ? vendor.openLabel : `WALK CLOSER + ${vendor.keyHint}`}
                  </button>
                </div>
              );
            })()}
          </aside>
        )}
      </div>

      <div className={styles.actionDock}>
        <section className={styles.interfaceBox}>
          <div className={styles.boxHeading}>SKILLS</div>
          <div className={styles.skillSlots}>
            <button className={`${styles.slot} ${styles.attackSlot}`} onClick={() => arenaRef.current?.attack()} title="Attack (no cooldown, no mana cost)">
              <span className={styles.slotIcon}>⚔</span><small>ATTACK</small><kbd>◉</kbd>
            </button>
            <button className={`${styles.slot} ${styles.skillSlot}${cooldowns.spin.locked || cooldowns.spin.remainingMs > 0 ? ` ${styles.cooldownSlot}` : ""}`} onClick={() => { if (skillLockedToast("spin", "SPIN")) return; arenaRef.current?.skill(); }} title={cooldowns.spin.locked ? `Spin unlocks at LV ${cooldowns.spin.unlockLevel}` : `Spin skill (${SKILL_MANA_COSTS.spin} MP)`}>
              <span className={styles.slotIcon}>✦</span><small>SPIN</small><kbd>2</kbd>
              {renderCooldownOverlay("spin")}
            </button>
            <button className={`${styles.slot} ${styles.dodgeSlot}${cooldowns.dodge.locked || cooldowns.dodge.remainingMs > 0 ? ` ${styles.cooldownSlot}` : ""}`} onClick={() => { if (skillLockedToast("dodge", "DODGE")) return; window.dispatchEvent(new KeyboardEvent("keydown", { key: "q" })); }} title={cooldowns.dodge.locked ? `Dodge unlocks at LV ${cooldowns.dodge.unlockLevel}` : `Dodge (${SKILL_MANA_COSTS.dodge} MP)`}>
              <span className={styles.slotIcon}>➤</span><small>DODGE</small><kbd>Q</kbd>
              {renderCooldownOverlay("dodge")}
            </button>
            <button className={`${styles.slot}${cooldowns.clones.locked || cooldowns.clones.remainingMs > 0 ? ` ${styles.cooldownSlot}` : ""}`} onClick={() => { if (skillLockedToast("clones", "CLONES")) return; window.dispatchEvent(new KeyboardEvent("keydown", { key: "1" })); }} title={cooldowns.clones.locked ? `Clones unlock at LV ${cooldowns.clones.unlockLevel}` : `Clone skill (${SKILL_MANA_COSTS.clones} MP)`}>
              <span className={styles.slotIcon}>◆</span><small>CLONES</small><kbd>1</kbd>
              {renderCooldownOverlay("clones")}
            </button>
            <button className={`${styles.slot} ${styles.flashTriangleSlot}${cooldowns.flash.locked || cooldowns.flash.remainingMs > 0 ? ` ${styles.cooldownSlot}` : ""}`} onClick={() => { if (skillLockedToast("flash", "FLASH")) return; arenaRef.current?.flashTriangle(); }} title={cooldowns.flash.locked ? `Flash unlocks at LV ${cooldowns.flash.unlockLevel}` : `Flash triangle skill (${SKILL_MANA_COSTS.flash} MP)`}>
              <span className={styles.slotIcon}>✧</span><small>FLASH</small><kbd>3</kbd>
              {renderCooldownOverlay("flash")}
            </button>
          </div>
        </section>

        <section className={`${styles.interfaceBox} ${styles.equipmentBox}`}>
          <div className={styles.boxHeading}>EQUIPMENT</div>
          <div className={styles.equipmentSlots}>
            {(usableEquipSlots).map((slot) => {
              const equipped = equipment[slot];
              return (
                <div
                  key={slot}
                  className={`${styles.itemSlot} ${equipped ? styles.itemActive : ""}`}
                  title={equipped ? `${equipped.name} (${equipped.rarity}) — click to see bag` : `${slot.toUpperCase()} slot — empty, equip gear from the bag`}
                  onClick={() => {
                    setBagOpen(true);
                    setBagTab("gear");
                  }}
                  style={
                    equipped
                      ? { borderColor: RARITY_COLORS[equipped.rarity], cursor: "pointer" }
                      : { cursor: "pointer" }
                  }
                >
                  {equipped ? (
                    <ItemIcon icon={equipped.icon} rarity={equipped.rarity} size={28} />
                  ) : (
                    <span aria-hidden="true">{SLOT_ICONS[slot]}</span>
                  )}
                  <small
                    style={{
                      display: "block",
                      maxWidth: "100%",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {equipped ? equipped.name : "EMPTY"}
                  </small>
                </div>
              );
            })}
          </div>
        </section>

        <button className={styles.exitButton} onClick={() => router.push("/dashboard")} title="Exit survival mode">EXIT</button>
      </div>

      {/* Real-time In-Game Chat */}
      <InGameChat
        messages={chatMessages}
        onSendMessage={handleSendChat}
        localPlayerName={playerInfo?.name || "Hero"}
      />

      {/* Mobile Touch Controller (Auto-detected on mobile/touch screens) */}
      <MobileControls
        onDirectionChange={(dx, dy) => setVirtualDir({ x: dx, y: dy })}
        onAttack={handleMobileAttack}
        onDodge={handleMobileDodge}
        onSpin={handleMobileSpin}
        onClones={handleMobileClones}
        onFlash={handleMobileFlash}
        onOpenChat={() => {
          // Focus the chat input if InGameChat is rendered
          const chatInput = document.querySelector<HTMLInputElement>('[data-chat-input]');
          if (chatInput) chatInput.focus();
        }}
      />

      {/* Social Friends Modal */}
      {friendsOpen && (
        <FriendsModal
          onClose={() => setFriendsOpen(false)}
          currentRoomId={roomId}
        />
      )}
    </main>
  );
}
