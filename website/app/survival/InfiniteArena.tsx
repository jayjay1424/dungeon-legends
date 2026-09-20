// InfiniteArena.tsx
"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import styles from "./survival.module.css";
import {
  ArenaHandle,
  ArenaProps,
  Enemy,
  BmCorpse,
  SkCorpse,
  NecroCorpse,
  SkKingCorpse,
  Npc,
  Clone,
  Warrior,
  PlayerDir,
  PlayerAction,
  SkillCooldowns,
  SkillKey,
  DefenceWaveKind,
  Tree,
} from "./arena/types";
import { GroundDrop } from "./items/types";
import { rollLoot } from "./items/loot";
import {
  buildEnemyInspect,
  buildNpcInspect,
  buildWarriorInspect,
  type VendorId,
} from "./arena/inspect";
import {
  FLOOR_TILE_SIZE,
  Z_BASE,
  HOUSES,
  HOUSE_DISPLAY_W,
  HOUSE_DISPLAY_H,
  CAMPFIRE_WORLD_Y,
  CAMPFIRE_DISPLAY,
  CAMPFIRE_FRAME_COUNT,
  GAME_DAY_LENGTH_MS,
  GAME_START_MINUTE,
  resolveAllPlayerCollisions,
  drawGroundShadow,
  renderFloor,
  worldZoneAt,
  updateEnvironmentDecor,
  updateDemonProps,
  cleanupDemonProps,
  updateBaseProps,
  cleanupBaseProps,
  BASE_PROPS,
  renderLightingOverlay,
  TERRITORY_ZONES,
  VILLAGE_BASE_CENTER,
  distFromBase,
} from "./arena/world";
import {
  spawnWave,
  spawnBloodMonsters,
  spawnDemons,
  spawnGoblinBeasts,
  spawnGoblinRiders,
  spawnSkeletons,
  spawnSkeletonBows,
  spawnVampires,
  spawnNecromancers,
  spawnSkeletonKing,
  BASE_SPAWN_RING_RADIUS,
  MONSTER_CAMPS,
  updateEnemies,
  updateCorpses,
  cleanupEnemies,
} from "./arena/enemies";
import { spawnNpcs, updateNpcs, cleanupNpcs } from "./arena/npcs";
import { spawnWarriors, updateWarriors, cleanupWarriors, spawnHeralds, spawnWarriorAt, HERALD_COUNT } from "./arena/warriors";
import {
  createIntroState,
  skipIntroSpeech,
  updateDefenceIntro,
  IntroState,
} from "./arena/defenceIntro";
import { assignFormationSlots } from "./arena/formation";
import { doCastClones, updateClones, cleanupClones, SKILL_COOLDOWN } from "./arena/clones";
import { activate as activateFlashTriangle, FLASH_TRIANGLE_COOLDOWN_MS } from "./arena/flashTriangle";
import {
  CombatContext,
  CombatStatSnapshot,
  applyDamageGlow,
  doAttack1,
  doAttack2,
  doDodge,
  DODGE_COOLDOWN,
} from "./arena/combat";
import { renderMinimap } from "./arena/minimap";
import {
  renderBiomeGround,
  renderBiomeLighting,
  renderBiomeWeather,
} from "./arena/biomes";
import { CombatStateManager, CombatPhase } from "./arena/combatState";
import {
  playDodgeSound,
  playJutsuSound,
  playWarriorSecondSkillSound,
  playWarriorThirdSkillSound,
  preloadDodgeSound,
  startCombatMusic,
  stopCombatMusic,
} from "./audio";

export type { ArenaHandle, ArenaProps };

const PLAYER_FRAME_W = 96;
const PLAYER_FRAME_H = 80;
const PLAYER_COLS = 8;
const PLAYER_SCALE = 3;
const PLAYER_DISPLAY_W = PLAYER_FRAME_W * PLAYER_SCALE;
const PLAYER_DISPLAY_H = PLAYER_FRAME_H * PLAYER_SCALE;
const PLAYER_IDLE_ANIM_MS = 160;
const PLAYER_RUN_ANIM_MS = 90;
const PLAYER_ATTACK_ANIM_MS = 55;
const PLAYER_DEATH_DURATION_MS = 650;
const SECOND_SKILL_FRAME_SIZE = 74;
const SECOND_SKILL_FRAME_COUNT = 11;
const SECOND_SKILL_ROW = 6;
const SECOND_SKILL_DURATION_MS = 300;
const SECOND_SKILL_ROTATION_DEGREES = 360;
// Spin is heavier than a basic swing: its own cooldown on top of the anim.
export const SPIN_COOLDOWN_MS = 1500;
// Skill unlock levels (attack is always available).
export const SKILL_UNLOCK_LEVELS = { dodge: 5, clones: 10, spin: 20, flash: 25 } as const;
// Enemy hits stun the player briefly (dodge still escapes).
export const PLAYER_STUN_MS = 600;

// Mana costs per skill (attack is free) + regen: flat base plus a fraction
// of max mana so regen stays meaningful from Lv 1 to Lv 35+.
export const SKILL_MANA_COSTS = { spin: 10, dodge: 6, clones: 20, flash: 12 } as const;
export const MANA_REGEN_BASE_PER_SEC = 2;
export const MANA_REGEN_MAX_FRACTION_PER_SEC = 0.02;
const DODGE_EFFECT_ROW = 0;
const DODGE_SMOKE_DURATION_MS = 500;
const DODGE_SMOKE_FRAME_COUNT = 16;
const DODGE_SMOKE_SHEET_ROWS = 20;
const CLONE_SMOKE_FRAME_SIZE = 64;
const CLONE_SMOKE_FRAME_COUNT = 11;
const CLONE_SMOKE_ROW = 10;
const CLONE_SMOKE_DURATION_MS = 600;

// Dragon companion (red: public/red_dragon, others: public/dragons/<color>).
// All sheets are 820x644, 4x4 grid.
const DRAGON_FRAME_W = 205;
const DRAGON_FRAME_H = 161;
const DRAGON_COLS = 4;
const DRAGON_ROWS = 4;
const DRAGON_FRAMES = DRAGON_COLS * DRAGON_ROWS;
const DRAGON_SCALE_BY_ID: Record<string, number> = {
  dragon_whelp: 0.45,
  dragon_yellow: 0.5,
  dragon_drake: 0.55,
  dragon_blue: 0.6,
  dragon_wyvern: 0.65,
  dragon_white: 0.72,
  dragon_elder: 0.8,
  dragon_rainbow: 0.9,
};
const DRAGON_COLOR_BY_ID: Record<string, string> = {
  dragon_whelp: 'red',
  dragon_yellow: 'yellow',
  dragon_drake: 'green',
  dragon_blue: 'blue',
  dragon_wyvern: 'purple',
  dragon_white: 'white',
  dragon_elder: 'black',
  dragon_rainbow: 'rainbow',
};

function dragonSrcFor(dir: string, companionId?: string | null): string {
  const color = (companionId && DRAGON_COLOR_BY_ID[companionId]) || 'red';
  if (color === 'red') {
    switch (dir) {
      case 'up':
        return '/red_dragon/reddragonfly_up.png';
      case 'down':
        return '/red_dragon/reddragonfly_down.png';
      case 'left':
        return '/red_dragon/reddragonfly_left.png';
      case 'right':
      default:
        return '/red_dragon/reddragonfly_right.png';
    }
  }
  const d = dir === 'up' || dir === 'down' || dir === 'left' ? dir : 'right';
  return `/dragons/${color}/${color}dragonfly_${d}.png`;
}

const InfiniteArena = forwardRef<ArenaHandle, ArenaProps>(function InfiniteArena(
    { onStatsChange, playerAttack = 10, playerCritChance = 5, playerCritDamage = 150, playerSkillPower = 10, playerMoveSpeed = 1, playerAttackSpeed = 1, playerLuck = 1, playerDefense = 5, playerArmor = 0, playerLevel = 1, playerHp, playerMaxHp, playerMana, playerMaxMana, onSkillDenied, onKill, onDistanceMoved, onSkillCast,   onStunChange, mode = "survival", onBaseHit, baseDestroyed = false, onHeraldArrived, onStoryBanner, onIntroDone, companionId = null, onExpEarned, onCombatChange, onLootCollected, onLootNearby, onTimeChange, onZoneChange, onVendorNearby, onInspectEnemy, onInspectNpc, onInspectVendor, onInspectWarrior, zoom = 1 },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const worldLayerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapCanvasRef = useRef<HTMLCanvasElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const playerHpRef = useRef<HTMLDivElement>(null);
  const bossHpRef = useRef<HTMLDivElement>(null);
  const secondSkillRef = useRef<HTMLDivElement>(null);
  const dragonRef = useRef<HTMLDivElement>(null);
  const dragonPosRef = useRef({ x: 0, y: 0 });
  const dragonInitRef = useRef(false);
  const companionIdRef = useRef<string | null>(companionId ?? null);
  useEffect(() => {
    companionIdRef.current = companionId ?? null;
    // Snap the follower next to the player when (un)equipping so it
    // doesn't glide across the whole map.
    if (companionIdRef.current) {
      dragonPosRef.current = {
        x: posRef.current.x - 70,
        y: posRef.current.y + 30,
      };
      dragonInitRef.current = true;
    } else if (dragonRef.current) {
      dragonRef.current.style.opacity = '0';
    }
  }, [companionId]);

  const [isExpanded, setIsExpanded] = useState(false);

  // Inspect callbacks change every render (inline arrows) but the arena
  // listeners are registered once — mirror them through refs.
  const inspectEnemyRef = useRef(onInspectEnemy);
  const inspectNpcRef = useRef(onInspectNpc);
  const inspectVendorRef = useRef(onInspectVendor);
  const inspectWarriorRef = useRef(onInspectWarrior);
  useEffect(() => {
    inspectEnemyRef.current = onInspectEnemy;
    inspectNpcRef.current = onInspectNpc;
    inspectVendorRef.current = onInspectVendor;
    inspectWarriorRef.current = onInspectWarrior;
  });

  // Camera zoom: render a larger world region into a bigger canvas, then
  // shrink the whole world layer to fit the arena. All world math stays
  // in loop pixels, so positions, ranges and hit-testing stay exact.
  const zoomRef = useRef(zoom);
  const applyZoomSize = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const layer = worldLayerRef.current;
    if (!canvas || !container || !layer) return;
    const z = zoomRef.current > 0 ? zoomRef.current : 1;
    canvas.width = Math.max(1, Math.round(container.clientWidth / z));
    canvas.height = Math.max(1, Math.round(container.clientHeight / z));
    layer.style.width = `${canvas.width}px`;
    layer.style.height = `${canvas.height}px`;
    layer.style.left = "50%";
    layer.style.top = "50%";
    layer.style.right = "auto";
    layer.style.bottom = "auto";
    layer.style.marginLeft = `${-canvas.width / 2}px`;
    layer.style.marginTop = `${-canvas.height / 2}px`;
    layer.style.transform = `scale(${z})`;
  };
  useEffect(() => {
    zoomRef.current = zoom > 0 ? zoom : 1;
    applyZoomSize();
  }, [zoom]);

  const posRef = useRef({ x: 0, y: 0 });
  const cameraFollowRef = useRef(true);
  const camPosRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const downPosRef = useRef<{ x: number; y: number } | null>(null);

  const playerDirRef = useRef<PlayerDir>("down");
  const playerActionRef = useRef<PlayerAction | null>(null);
  const clickComboRef = useRef(0);
  const keysRef = useRef<Record<string, boolean>>({});

  const enemiesRef = useRef<Enemy[]>([]);
  const nextEnemyId = useRef(0);
  const bmCorpsesRef = useRef<BmCorpse[]>([]);
  const skCorpsesRef = useRef<SkCorpse[]>([]);
  const necroCorpsesRef = useRef<NecroCorpse[]>([]);
  const skKingCorpsesRef = useRef<SkKingCorpse[]>([]);

  const npcsRef = useRef<Npc[]>([]);
  const clonesRef = useRef<Clone[]>([]);
  const nextCloneId = useRef(0);

  const warriorsRef = useRef<Warrior[]>([]);
  const nextWarriorId = useRef(0);

  const waveRef = useRef(1);
  const lastHitRef = useRef(0);
  const floorPatternRef = useRef<CanvasPattern | null>(null);
  const treesRef = useRef<Map<string, Tree>>(new Map());
  const houseElsRef = useRef<HTMLDivElement[]>([]);
  const campfireElRef = useRef<HTMLDivElement | null>(null);
  const demonFiresRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const demonPropsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const basePropsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const basePropLabelsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const vendorNearbyRef = useRef<"store" | "craft" | "incubator" | null>(null);

  const hpRef = useRef(100);
  const maxHpRef = useRef(100);
  // Live combat stats (ref so mount-closure handlers never go stale):
  // every upgrade, level, gear swap, or pet bonus flows into damage here.
  const combatStatsRef = useRef<CombatStatSnapshot>({
    attack: playerAttack,
    critChance: playerCritChance,
    critDamage: playerCritDamage,
    skillPower: playerSkillPower,
    moveSpeed: playerMoveSpeed,
    attackSpeed: playerAttackSpeed,
    luck: playerLuck,
    defense: playerDefense,
    armor: playerArmor,
  });
  useEffect(() => {
    combatStatsRef.current = {
      attack: playerAttack,
      critChance: playerCritChance,
      critDamage: playerCritDamage,
      skillPower: playerSkillPower,
      moveSpeed: playerMoveSpeed,
      attackSpeed: playerAttackSpeed,
      luck: playerLuck,
      defense: playerDefense,
      armor: playerArmor,
    };
  }, [playerAttack, playerCritChance, playerCritDamage, playerSkillPower, playerMoveSpeed, playerAttackSpeed, playerLuck, playerDefense, playerArmor]);
  const manaRef = useRef(50);
  const maxManaRef = useRef(50);
  const lastSyncedManaRef = useRef(50);
  const onSkillDeniedRef = useRef(onSkillDenied);
  onSkillDeniedRef.current = onSkillDenied;
  // Quest callbacks via refs so the mount-closure game loop never goes stale.
  const onKillRef = useRef(onKill);
  onKillRef.current = onKill;
  const onDistanceMovedRef = useRef(onDistanceMoved);
  onDistanceMovedRef.current = onDistanceMoved;
  const onSkillCastRef = useRef(onSkillCast);
  onSkillCastRef.current = onSkillCast;
  const onBaseHitRef = useRef(onBaseHit);
  onBaseHitRef.current = onBaseHit;
  const baseDestroyedRef = useRef(baseDestroyed);
  baseDestroyedRef.current = baseDestroyed;
  const onHeraldArrivedRef = useRef(onHeraldArrived);
  onHeraldArrivedRef.current = onHeraldArrived;
  const onStoryBannerRef = useRef(onStoryBanner);
  onStoryBannerRef.current = onStoryBanner;
  const onIntroDoneRef = useRef(onIntroDone);
  onIntroDoneRef.current = onIntroDone;
  const heraldsArrivedRef = useRef(0);
  const introStateRef = useRef<IntroState>(createIntroState());
  const distanceAccRef = useRef(0);

  // Page stats are the source of truth: mirror them so the bar above
  // the character always matches the HUD (levels, gear and heals included).
  useEffect(() => {
    if (typeof playerMaxHp === "number" && playerMaxHp > 0) {
      maxHpRef.current = playerMaxHp;
    }
    if (typeof playerHp === "number") {
      hpRef.current = Math.max(0, Math.min(playerHp, maxHpRef.current));
    }
  }, [playerHp, playerMaxHp]);

  // Mana mirror: only adopt page values going UP (heals, potions, level-ups)
  // so arena-side spending/regen fractions between syncs never get clobbered.
  useEffect(() => {
    if (typeof playerMaxMana === "number" && playerMaxMana > 0) {
      maxManaRef.current = playerMaxMana;
      manaRef.current = Math.min(manaRef.current, maxManaRef.current);
    }
    if (typeof playerMana === "number" && playerMana > manaRef.current) {
      manaRef.current = Math.min(playerMana, maxManaRef.current);
    }
  }, [playerMana, playerMaxMana]);

  // Spend mana for a skill. Returns false (and reports denial) when broke.
  const spendMana = (skill: SkillKey): boolean => {
    const cost = SKILL_MANA_COSTS[skill];
    if (manaRef.current < cost) {
      onSkillDeniedRef.current?.(skill);
      return false;
    }
    manaRef.current -= cost;
    lastSyncedManaRef.current = Math.floor(manaRef.current);
    onStatsChange((s) => ({ ...s, mana: manaRef.current }));
    return true;
  };
  const lastDodgeAtRef = useRef(-Infinity);
  const dodgeInvulnUntilRef = useRef(0);
  const lastSkillAtRef = useRef(-Infinity);
  const lastSpinAtRef = useRef(-Infinity);
  const secondSkillStartedAtRef = useRef<number | null>(null);
  const flashTriangleLastActivatedAtRef = useRef(-Infinity);
  const dodgeSmokeRef = useRef<
    { el: HTMLDivElement; x: number; y: number; startedAt: number }[]
  >([]);
  const cloneSmokeRef = useRef<
    { el: HTMLDivElement; x: number; y: number; startedAt: number }[]
  >([]);
  const hitEffectsRef = useRef<
    { numberEl: HTMLDivElement; flashEl: HTMLDivElement; x: number; y: number; startedAt: number }[]
  >([]);
  const playerDeathStartedAtRef = useRef<number | null>(null);
  const playerStunUntilRef = useRef(0);
  const lastStunFlagRef = useRef(false);
  const arenaShakeUntilRef = useRef(0);
  const arenaShakeStrengthRef = useRef(0);
  const gameClockStartedAtRef = useRef<number | null>(null);
  const lastTimeLabelRef = useRef("");
  const lastZoneNameRef = useRef<string | null>(null);
  const activatedZonesRef = useRef<Set<string>>(new Set());
  const activatedCampsRef = useRef<Set<string>>(new Set());
  const campRespawnAtRef = useRef<Map<string, number>>(new Map());
  const combatManagerRef = useRef<CombatStateManager | null>(null);
  const groundDropsRef = useRef<GroundDrop[]>([]);
  const lootNearbyRef = useRef(false);

  const signalCombat = () => combatManagerRef.current?.startCombat();

  // Same race per lane, but scattered across the whole ring instead of
  // clumped at the camp point. Each enemy keeps its spawn spot as home.
  const KIND_LANE: Record<string, string> = {
    slime: "beginner",
    bloodMonster: "forest",
    goblinBeast: "goblin",
    goblinRider: "goblin",
    skeleton: "graveyard",
    skeletonBow: "graveyard",
    vampire: "night",
    demon: "demon",
    necromancer: "final",
    skeletonKing: "final",
  };

  const scatterInLane = (kind: string): { x: number; y: number } | null => {
    const lane = TERRITORY_ZONES.find((z) => z.id === KIND_LANE[kind]);
    if (!lane) return null;
    const angle = Math.random() * Math.PI * 2;
    const band = Math.max(60, lane.outerR - lane.innerR - 300);
    const radius = lane.innerR + 150 + Math.random() * band;
    return {
      x: VILLAGE_BASE_CENTER.x + Math.cos(angle) * radius,
      y: VILLAGE_BASE_CENTER.y + Math.sin(angle) * radius,
    };
  };

  const spawnCampGroup = (camp: (typeof MONSTER_CAMPS)[number], count: number) => {
    if (!worldLayerRef.current || count <= 0) return;
    const spawner =
      camp.kind === "slime"
        ? spawnWave
        : camp.kind === "bloodMonster"
        ? spawnBloodMonsters
        : camp.kind === "demon"
        ? spawnDemons
        : camp.kind === "goblinBeast"
        ? spawnGoblinBeasts
        : camp.kind === "goblinRider"
        ? spawnGoblinRiders
        : camp.kind === "vampire"
        ? spawnVampires
        : camp.kind === "skeleton"
        ? spawnSkeletons
        : camp.kind === "skeletonBow"
        ? spawnSkeletonBows
        : camp.kind === "necromancer"
        ? spawnNecromancers
        : spawnSkeletonKing;
    const groupId = `${camp.id}-${Date.now()}-${Math.random()}`;
    const groupStart = enemiesRef.current.length;
    spawner(
      worldLayerRef.current,
      enemiesRef,
      nextEnemyId,
      posRef.current.x,
      posRef.current.y,
      waveRef.current,
      count,
      camp.centerX,
      camp.centerY
    );
    for (let index = groupStart; index < enemiesRef.current.length; index++) {
      const enemy = enemiesRef.current[index];
      enemy.campId = camp.id;
      enemy.groupId = groupId;
      enemy.territoryRadius = camp.radius;
      // Scatter across the lane; stay where spawned instead of walking home.
      const spot = scatterInLane(camp.kind ?? "");
      if (spot) {
        enemy.x = spot.x;
        enemy.y = spot.y;
        enemy.homeX = spot.x;
        enemy.homeY = spot.y;
      } else {
        enemy.homeX = camp.centerX;
        enemy.homeY = camp.centerY;
      }
    }
  };

  const spawnZoneArmy = (zoneId: string) => {
    const zone = worldZoneAt(posRef.current.x, posRef.current.y);
    if (!zone || zone.id !== zoneId) return;

    const zoneSpawnMap: Record<string, Array<{ kind: "slime" | "bloodMonster" | "goblinBeast" | "goblinRider" | "skeleton" | "skeletonBow" | "vampire" | "demon" | "necromancer" | "skeletonKing"; count: number; spawner: (...args: any[]) => void }>> = {
      beginner: [{ kind: "slime", count: 45, spawner: spawnWave }],
      forest: [{ kind: "bloodMonster", count: 36, spawner: spawnBloodMonsters }],
      goblin: [
        { kind: "goblinBeast", count: 24, spawner: spawnGoblinBeasts },
        { kind: "goblinRider", count: 18, spawner: spawnGoblinRiders },
      ],
      graveyard: [
        { kind: "skeleton", count: 24, spawner: spawnSkeletons },
        { kind: "skeletonBow", count: 18, spawner: spawnSkeletonBows },
      ],
      night: [{ kind: "vampire", count: 30, spawner: spawnVampires }],
      demon: [{ kind: "demon", count: 28, spawner: spawnDemons }],
      final: [
        { kind: "necromancer", count: 26, spawner: spawnNecromancers },
        { kind: "skeletonKing", count: 3, spawner: spawnSkeletonKing },
      ],
    };

    const config = zoneSpawnMap[zoneId];
    if (!config || !worldLayerRef.current) return;

    for (const entry of config) {
      const camp = MONSTER_CAMPS.find((c) => c.kind === entry.kind);
      if (!camp) continue;
      spawnCampGroup(camp, Math.min(entry.count, camp.maxPopulation));
      activatedCampsRef.current.add(camp.id);
    }

    activatedZonesRef.current.add(zoneId);
  };

  const getCombatContext = (): CombatContext => ({
    container: worldLayerRef.current!,
    containerWidth: canvasRef.current?.width ?? window.innerWidth,
    playerPos: posRef.current,
    camPos: camPosRef.current,
    enemiesRef,
    bmCorpsesRef,
    skCorpsesRef,
    necroCorpsesRef,
    skKingCorpsesRef,
    npcsRef,
    clonesRef,
    warriorsRef,
    nextEnemyId,
    waveRef,
    hpRef,
    maxHpRef,
    combatStatsRef,
    onStatsChange,
    onExpEarned,
    onCombatEvent: signalCombat,
        onEnemyDefeated: (x, y, kind, playerContributed) => {
          // Defence waves drop nothing at all (gold comes from wave-clear
          // payouts). Survival keeps player-only drops.
          if (mode === "defence" || !playerContributed || !worldLayerRef.current) return;
          onKillRef.current?.(kind);
          for (const item of rollLoot(kind)) {
            const el = document.createElement("div");
            el.className = styles.groundDrop;
            el.style.backgroundImage = `url(${item.icon})`;
            el.style.backgroundSize = "52px 52px";
            el.style.backgroundPosition = "center";
            el.style.backgroundRepeat = "no-repeat";
            el.style.imageRendering = "pixelated";
            el.title = item.name;
            worldLayerRef.current.appendChild(el);
            groundDropsRef.current.push({
              id: `${item.id}-${performance.now()}-${Math.random()}`,
              item,
              amount: item.type === "currency" ? 5 : 1,
              x,
              y,
              el,
            });
          }
        },
    onDamageEffect: (x, y, damage, source, crit = false) => {
      if (!worldLayerRef.current) return;
      const numberEl = document.createElement("div");
      numberEl.className = styles.damageNumber;
      numberEl.textContent = crit ? `-${Math.round(damage)}!` : `-${Math.round(damage)}`;
      numberEl.dataset.source = source;
      if (crit) numberEl.dataset.crit = "true";
      worldLayerRef.current.appendChild(numberEl);

      const flashEl = document.createElement("div");
      flashEl.className = styles.hitFlash;
      worldLayerRef.current.appendChild(flashEl);
      hitEffectsRef.current.push({
        numberEl,
        flashEl,
        x,
        y,
        startedAt: performance.now(),
      });
      arenaShakeUntilRef.current = Math.max(
        arenaShakeUntilRef.current,
        performance.now() + (source === "player" ? 90 : 55)
      );
      arenaShakeStrengthRef.current = Math.max(
        arenaShakeStrengthRef.current,
        source === "player" ? 14 : 8
      );
    },
  });


  const handleAttack1 = () => {
    if (!containerRef.current) return;
    if (playerDeathStartedAtRef.current !== null || isPlayerStunned()) return;
    doAttack1(getCombatContext(), playerActionRef);
  };

  const isPlayerStunned = () => performance.now() < playerStunUntilRef.current;

  // Level via ref so mount-closure keyboard handlers see level-ups.
  const playerLevelRef = useRef(playerLevel);
  playerLevelRef.current = playerLevel;
  const isSkillUnlocked = (skill: keyof typeof SKILL_UNLOCK_LEVELS) =>
    playerLevelRef.current >= SKILL_UNLOCK_LEVELS[skill];

  const handleAttack2 = () => {
    if (!containerRef.current) return;
    if (playerDeathStartedAtRef.current !== null || isPlayerStunned()) return;
    doAttack2(getCombatContext(), playerActionRef);
  };

  const handleDodge = () => {
    if (playerDeathStartedAtRef.current !== null) return;
    if (!isSkillUnlocked("dodge")) return;
    const now = performance.now();
    if (now - lastDodgeAtRef.current < DODGE_COOLDOWN) return;
    if (!spendMana("dodge")) return;
    onSkillCastRef.current?.("dodge");
    const smokeEl = document.createElement("div");
    smokeEl.className = styles.secondSkill;
    worldLayerRef.current?.appendChild(smokeEl);
    dodgeSmokeRef.current.push({
      el: smokeEl,
      x: posRef.current.x,
      y: posRef.current.y,
      startedAt: now,
    });
    doDodge(
      posRef,
      playerDirRef.current,
      lastDodgeAtRef,
      dodgeInvulnUntilRef,
      treesRef.current
    );
    playDodgeSound();
  };

  const handleCastClones = () => {
    if (playerDeathStartedAtRef.current !== null || isPlayerStunned()) return;
    if (!isSkillUnlocked("clones")) return;
    if (manaRef.current < SKILL_MANA_COSTS.clones) {
      onSkillDeniedRef.current?.("clones");
      return;
    }
    const castStarted = doCastClones(
      worldLayerRef.current!,
      clonesRef,
      nextCloneId,
      posRef.current.x,
      posRef.current.y,
      lastSkillAtRef,
      (x, y) => {
        const smokeEl = document.createElement("div");
        smokeEl.className = styles.secondSkill;
        worldLayerRef.current?.appendChild(smokeEl);
        cloneSmokeRef.current.push({
          el: smokeEl,
          x,
          y,
          startedAt: performance.now(),
        });
      }
    );
    if (castStarted) {
      manaRef.current -= SKILL_MANA_COSTS.clones;
      lastSyncedManaRef.current = Math.floor(manaRef.current);
      onStatsChange((s) => ({ ...s, mana: manaRef.current }));
      onSkillCastRef.current?.("clones");
      playJutsuSound();
    }
  };

  const collectNearestDrop = () => {
    let nearest: GroundDrop | null = null;
    let nearestDistance = 72;
    for (const drop of groundDropsRef.current) {
      const distance = Math.hypot(drop.x - posRef.current.x, drop.y - posRef.current.y);
      if (distance < nearestDistance) {
        nearest = drop;
        nearestDistance = distance;
      }
    }
    if (!nearest) return;
    nearest.el?.remove();
    groundDropsRef.current = groundDropsRef.current.filter((drop) => drop.id !== nearest!.id);
    onLootCollected?.(nearest.item, nearest.amount);
  };

  const handleSecondSkill = () => {
    if (!containerRef.current) return;
    if (playerDeathStartedAtRef.current !== null || isPlayerStunned()) return;
    if (!isSkillUnlocked("spin")) return;
    const now = performance.now();
    if (now - lastSpinAtRef.current < SPIN_COOLDOWN_MS) return;
    if (
      secondSkillStartedAtRef.current !== null &&
      now - secondSkillStartedAtRef.current < SECOND_SKILL_DURATION_MS
    ) {
      return;
    }
    const skillTargets = [...enemiesRef.current];
    const hitEnemy = skillTargets.some((enemy) =>
      Math.hypot(enemy.x - posRef.current.x, enemy.y - posRef.current.y) <= 180
    );
    if (!spendMana("spin")) return;
    lastSpinAtRef.current = performance.now();
    onSkillCastRef.current?.("spin");
    doAttack2(getCombatContext(), playerActionRef);
    for (const enemy of skillTargets) {
      const dx = enemy.x - posRef.current.x;
      const dy = enemy.y - posRef.current.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 220) continue;
      const directionX = distance > 0 ? dx / distance : 1;
      const directionY = distance > 0 ? dy / distance : 0;
      enemy.x += directionX * 70;
      enemy.y += directionY * 70;
      enemy.stunnedUntil = now + SECOND_SKILL_DURATION_MS;
      enemy.bmBehavior = "idle";
      enemy.skBehavior = "idle";
      enemy.attackAudioStop?.();
      enemy.attackAudioStop = undefined;
    }
    playWarriorSecondSkillSound();
    if (hitEnemy) arenaShakeUntilRef.current = now + 220;
    secondSkillStartedAtRef.current = now;
  };

  const handleFlashTriangle = () => {
    if (playerDeathStartedAtRef.current !== null || isPlayerStunned()) return;
    if (!isSkillUnlocked("flash")) return;
    if (manaRef.current < SKILL_MANA_COSTS.flash) {
      onSkillDeniedRef.current?.("flash");
      return;
    }
    const activated = activateFlashTriangle(
      getCombatContext(),
      worldLayerRef.current,
      posRef,
      playerActionRef,
      flashTriangleLastActivatedAtRef,
      playerAttack,
      cameraFollowRef
    );
    if (activated) {
      manaRef.current -= SKILL_MANA_COSTS.flash;
      lastSyncedManaRef.current = Math.floor(manaRef.current);
      onStatsChange((s) => ({ ...s, mana: manaRef.current }));
      onSkillCastRef.current?.("flash");
      arenaShakeUntilRef.current = performance.now() + 280;
      arenaShakeStrengthRef.current = 20;
      playWarriorThirdSkillSound();
    }
  };

  // Defence mode: spawn a wave of base-hunters on a ring around the base.
  const spawnDefenceWave = (groups: { kind: DefenceWaveKind; count: number }[], wave: number) => {
    if (!worldLayerRef.current) return;
    const spawnerFor = (kind: DefenceWaveKind) =>
      kind === "slime"
        ? spawnWave
        : kind === "bloodMonster"
        ? spawnBloodMonsters
        : kind === "demon"
        ? spawnDemons
        : kind === "goblinBeast"
        ? spawnGoblinBeasts
        : kind === "goblinRider"
        ? spawnGoblinRiders
        : kind === "vampire"
        ? spawnVampires
        : kind === "skeleton"
        ? spawnSkeletons
        : kind === "skeletonBow"
        ? spawnSkeletonBows
        : kind === "necromancer"
        ? spawnNecromancers
        : spawnSkeletonKing;
    groups.forEach((group, gi) => {
      const spawner = spawnerFor(group.kind);
      const before = enemiesRef.current.length;
      // All waves muster in the slime (beginner) zone, then march on the base.
      const lane = TERRITORY_ZONES.find((z) => z.id === "beginner");
      const band = lane
        ? Math.max(60, lane.outerR - lane.innerR - 300)
        : 2200;
      const radius = lane ? lane.innerR + 150 + Math.random() * band : 3600;
      const angle = (gi / Math.max(1, groups.length)) * Math.PI * 2 + Math.random() * 0.5;
      const cx = VILLAGE_BASE_CENTER.x + Math.cos(angle) * radius;
      const cy = VILLAGE_BASE_CENTER.y + Math.sin(angle) * radius;
      spawner(
        worldLayerRef.current!,
        enemiesRef,
        nextEnemyId,
        cx,
        cy,
        wave,
        group.count,
        cx,
        cy
      );
      for (let i = before; i < enemiesRef.current.length; i++) {
        const enemy = enemiesRef.current[i];
        enemy.targetBase = true;
        enemy.homeX = cx;
        enemy.homeY = cy;
      }
    });
  };

  // Defence intro: ride heralds out, then turn villagers into knights.
  const beginWarningRun = () => {
    if (!worldLayerRef.current) return;
    heraldsArrivedRef.current = 0;
    formRanks();
    spawnHeralds(
      worldLayerRef.current,
      warriorsRef,
      nextWarriorId,
      (warrior) => {
        const info = buildWarriorInspect(warrior);
        inspectWarriorRef.current?.(info);
      }
    );
  };

  const convertVillagersToKnights = (): number => {    if (!worldLayerRef.current) return 0;
    let converted = 0;
    for (const npc of npcsRef.current) {
      npc.el?.remove();
      npc.statusEl?.remove();
      npc.hpEl?.remove();
      npc.menuEl?.remove();
      spawnWarriorAt(
        worldLayerRef.current,
        warriorsRef,
        nextWarriorId,
        npc.x,
        npc.y,
        "guard",
        (warrior) => {
          const info = buildWarriorInspect(warrior);
          inspectWarriorRef.current?.(info);
        }
      );
      converted++;
    }
    npcsRef.current = [];
    return converted;
  };

  // Defence intro: start the warning script once all heralds are in.
  const playWarning = () => {
    introStateRef.current = {
      stage: "warning",
      stageAt: performance.now(),
      lineAt: 0,
      lineIndex: -1,
    };
  };

  // Defence intro SKIP: silence heralds, arm villagers now.
  const skipWarning = (): number => {
    skipIntroSpeech(warriorsRef.current);
    introStateRef.current = { stage: "done", stageAt: 0, lineAt: 0, lineIndex: -1 };
    return convertVillagersToKnights();
  };

  // Defence draft: raise living guards' max HP and heal them to full.
  const reinforceGuards = (bonus: number): number => {
    let count = 0;
    for (const warrior of warriorsRef.current) {
      if (warrior.state === "dead") continue;
      warrior.maxHp += bonus;
      warrior.hp = warrior.maxHp;
      count++;
    }
    return count;
  };

  // Defence: line every knight up on the formation ring.
  const formRanks = () => {
    assignFormationSlots(warriorsRef.current);
  };

  // Defence draft: raise one extra guard at the base (cap 30 allies).
  const addGuardAlly = (): boolean => {
    if (!worldLayerRef.current) return false;
    if (warriorsRef.current.length >= 30) return false;
    const angle = Math.random() * Math.PI * 2;
    spawnWarriorAt(
      worldLayerRef.current,
      warriorsRef,
      nextWarriorId,
      VILLAGE_BASE_CENTER.x + Math.cos(angle) * 220,
      VILLAGE_BASE_CENTER.y + Math.sin(angle) * 220,
      "guard",
      (warrior) => {
        const info = buildWarriorInspect(warrior);
        inspectWarriorRef.current?.(info);
      }
    );
    assignFormationSlots(warriorsRef.current);
    return true;
  };

  useImperativeHandle(ref, () => ({
    attack: handleAttack1,
    skill: handleSecondSkill,
    flashTriangle: handleFlashTriangle,
    spawnDefenceWave,
    getHostileCount: () => enemiesRef.current.filter((e) => e.hp > 0).length,
    beginWarningRun,
    convertVillagersToKnights,
    formRanks,
    playWarning,
    skipWarning,
    reinforceGuards,
    addGuardAlly,
    getCooldowns: (): SkillCooldowns => {
      const now = performance.now();
      const level = playerLevelRef.current;
      const remainingOf = (last: number | null, total: number) =>
        last === null ? 0 : Math.max(0, Math.ceil(total - (now - last)));
      const entry = (
        skill: keyof typeof SKILL_UNLOCK_LEVELS,
        last: number | null,
        total: number
      ) => ({
        remainingMs: remainingOf(last, total),
        totalMs: total,
        locked: level < SKILL_UNLOCK_LEVELS[skill],
        unlockLevel: SKILL_UNLOCK_LEVELS[skill],
      });
      return {
        spin: entry("spin", lastSpinAtRef.current, SPIN_COOLDOWN_MS),
        dodge: entry("dodge", lastDodgeAtRef.current, DODGE_COOLDOWN),
        clones: entry("clones", lastSkillAtRef.current, SKILL_COOLDOWN),
        flash: entry("flash", flashTriangleLastActivatedAtRef.current, FLASH_TRIANGLE_COOLDOWN_MS),
      };
    },
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const worldLayer = worldLayerRef.current;
    const mmCanvas = minimapCanvasRef.current;
    if (!canvas || !container || !worldLayer || !mmCanvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    preloadDodgeSound();
    const combatManager = new CombatStateManager((phase) => {
      onCombatChange?.(phase);
      // Defence runs its own music (whole run, stops only on base fall).
      if (mode === "defence") return;
      if (phase === "combat") startCombatMusic();
      else stopCombatMusic();
    });
    combatManagerRef.current = combatManager;
    combatManager.start();

    const resize = () => {
      applyZoomSize();
    };
    resize();
    window.addEventListener("resize", resize);

    const floorImg = new Image();
    floorImg.src = "/grass-floor.jpeg";
    floorImg.onload = () => {
      const pattern = ctx.createPattern(floorImg, "repeat");
      if (pattern && pattern.setTransform) {
        const scale = FLOOR_TILE_SIZE / floorImg.width;
        pattern.setTransform(new DOMMatrix().scale(scale));
      }
      floorPatternRef.current = pattern;
    };

    houseElsRef.current = HOUSES.map((house) => {
      const el = document.createElement("div");
      el.className = styles.house;
      el.style.width = `${HOUSE_DISPLAY_W}px`;
      el.style.height = `${HOUSE_DISPLAY_H}px`;
      el.style.backgroundImage = `url(${house.src})`;
      el.style.backgroundSize = `${HOUSE_DISPLAY_W}px ${HOUSE_DISPLAY_H}px`;
      el.style.zIndex = String(Z_BASE + Math.round(house.y));
      worldLayer.appendChild(el);
      return el;
    });

    {
      const el = document.createElement("div");
      el.className = styles.campfire;
      el.style.width = `${CAMPFIRE_DISPLAY}px`;
      el.style.height = `${CAMPFIRE_DISPLAY}px`;
      el.style.backgroundImage = "url(/campfire.png)";
      el.style.backgroundSize = `${
        CAMPFIRE_DISPLAY * CAMPFIRE_FRAME_COUNT
      }px ${CAMPFIRE_DISPLAY}px`;
      el.style.zIndex = String(Z_BASE + Math.round(CAMPFIRE_WORLD_Y));
      worldLayer.appendChild(el);
      campfireElRef.current = el;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const wasDown = keysRef.current[k];
      keysRef.current[k] = true;
      if (k === "o" && !wasDown)
        cameraFollowRef.current = !cameraFollowRef.current;
      if (wasDown) return;
      if (k === "q") handleDodge();
      if (k === "1") handleCastClones();
      if (k === "2") handleSecondSkill();
      if (k === "3") handleFlashTriangle();
      if (k === "e") collectNearestDrop();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false;
    };

    const onMouseDown = (e: MouseEvent) => {
      downPosRef.current = { x: e.clientX, y: e.clientY };
      if (e.button === 2) {
        isDraggingRef.current = true;
        return;
      }
      if (e.button !== 0) return;
      if (clickComboRef.current % 2 === 0) {
        handleAttack1();
      } else {
        handleAttack2();
      }
      clickComboRef.current++;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (isDraggingRef.current && !cameraFollowRef.current) {
        // Screen pixels cover 1/zoom world units when zoomed out.
        camPosRef.current.x -= e.movementX / zoomRef.current;
        camPosRef.current.y -= e.movementY / zoomRef.current;
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 2) isDraggingRef.current = false;
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    // Click-to-inspect: vendors and enemies use delegated hit-testing
    // (their divs historically ignore pointer events). NPCs report
    // themselves via spawnNpcs. Drags and attack-clicks on empty
    // ground intentionally select nothing.
    const onInspectClick = (e: MouseEvent) => {
      const down = downPosRef.current;
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) return;
      if (e.button !== 0) return;
      const contains = (el: HTMLDivElement | null) => {
        if (!el || !el.isConnected) return false;
        if (el.style.opacity === "0" || el.style.display === "none") return false;
        const r = el.getBoundingClientRect();
        return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      };
      // Vendors first — their stalls sit behind wandering monsters.
      // Name labels float just above the stall, so test those too.
      for (const [id, el] of basePropsRef.current) {
        if (id !== "store" && id !== "craft" && id !== "incubator") continue;
        const label = basePropLabelsRef.current.get(id) ?? null;
        if (contains(el) || contains(label)) {
          inspectVendorRef.current?.(id as VendorId);
          return;
        }
      }
      // Enemies: nearest rect center wins when several overlap.
      let best: Enemy | null = null;
      let bestDist = Infinity;
      for (const enemy of enemiesRef.current) {
        if (!enemy.el || enemy.hp <= 0) continue;
        if (!contains(enemy.el)) continue;
        const r = enemy.el.getBoundingClientRect();
        const d = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
        if (d < bestDist) {
          bestDist = d;
          best = enemy;
        }
      }
      if (best) {
        const info = buildEnemyInspect(best);
        if (info) inspectEnemyRef.current?.(info);
      }
    };

    const onMinimapClick = (e: MouseEvent) => {
      e.stopPropagation();
      setIsExpanded((prev) => !prev);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    container.addEventListener("mousedown", onMouseDown);
    container.addEventListener("mousemove", onMouseMove);
    container.addEventListener("click", onInspectClick);
    window.addEventListener("mouseup", onMouseUp);
    container.addEventListener("contextmenu", onContextMenu);
    mmCanvas.addEventListener("click", onMinimapClick);

    // NOTE: world-space divs must parent to worldLayer (not the arena
    // container) so camera zoom scales them together with the canvas.
    spawnNpcs(worldLayer, npcsRef, posRef.current.x, posRef.current.y, (npc) => {
      const info = buildNpcInspect(npc);
      inspectNpcRef.current?.(info);
    });
    spawnWarriors(
      worldLayer,
      warriorsRef,
      nextWarriorId,
      posRef.current.x,
      posRef.current.y,
      (warrior) => {
        const info = buildWarriorInspect(warrior);
        inspectWarriorRef.current?.(info);
      }
    );

    let raf = 0;
    let last = performance.now();

    const loop = (now: number) => {
      if (gameClockStartedAtRef.current === null) {
        gameClockStartedAtRef.current = now;
      }
      const elapsed = now - gameClockStartedAtRef.current;
      const gameMinute =
        (GAME_START_MINUTE + (elapsed / GAME_DAY_LENGTH_MS) * 1440) % 1440;
      const hour = Math.floor(gameMinute / 60);
      const minute = Math.floor(gameMinute % 60);
      const hour12 = hour % 12 || 12;
      const timeLabel = `${hour12}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
      const isNight = gameMinute < 6 * 60 || gameMinute >= 18 * 60;
      if (timeLabel !== lastTimeLabelRef.current) {
        lastTimeLabelRef.current = timeLabel;
        onTimeChange?.({ label: timeLabel, isNight });
      }
      const zoneHere = worldZoneAt(posRef.current.x, posRef.current.y);
      const zoneName = zoneHere
        ? zoneHere.name
        : distFromBase(posRef.current.x, posRef.current.y) < 900
        ? "Base Camp"
        : "Wilderness";
      if (zoneName !== lastZoneNameRef.current) {
        lastZoneNameRef.current = zoneName;
        onZoneChange?.(zoneName);
      }
      const dt = Math.min(32, now - last);
      last = now;
      const keys = keysRef.current;
      const speed = 0.22 * combatStatsRef.current.moveSpeed * dt * (keys.shift ? 2 : 1);

      let dx = 0;
      let dy = 0;
      if (keys["w"] || keys["arrowup"]) dy -= 1;
      if (keys["s"] || keys["arrowdown"]) dy += 1;
      if (keys["a"] || keys["arrowleft"]) dx -= 1;
      if (keys["d"] || keys["arrowright"]) dx += 1;
      if (dx !== 0 && dy !== 0) {
        dx *= Math.SQRT1_2;
        dy *= Math.SQRT1_2;
      }

      const playerIsDead = playerDeathStartedAtRef.current !== null;
      const playerStunned = performance.now() < playerStunUntilRef.current;
      if (lastStunFlagRef.current !== playerStunned) {
        lastStunFlagRef.current = playerStunned;
        onStunChange?.(playerStunned);
      }
      if (!playerIsDead && !playerStunned) {
        posRef.current.x += dx * speed;
        posRef.current.y += dy * speed;
        // Quest odometer: report roughly every 50 world units walked.
        distanceAccRef.current += Math.hypot(dx * speed, dy * speed);
        while (distanceAccRef.current >= 50) {
          distanceAccRef.current -= 50;
          onDistanceMovedRef.current?.(50);
        }
      }
      const resolved = resolveAllPlayerCollisions(
        posRef.current.x,
        posRef.current.y,
        treesRef.current
      );
      posRef.current.x = resolved.x;
      posRef.current.y = resolved.y;

      const currentZone = worldZoneAt(posRef.current.x, posRef.current.y);
      const canActivateZone = currentZone?.id !== "night" || isNight;
      // Defence mode: no zone armies or camp respawns — waves come only
      // from the wave director (spawnDefenceWave).
      if (
        mode !== "defence" &&
        currentZone &&
        canActivateZone &&
        !activatedZonesRef.current.has(currentZone.id)
      ) {
        spawnZoneArmy(currentZone.id);
      }

      if (!isNight && activatedZonesRef.current.has("night")) {
        for (const enemy of enemiesRef.current) {
          if (enemy.kind === "vampire") {
            enemy.el?.remove();
            enemy.hpEl?.remove();
          }
        }
        enemiesRef.current = enemiesRef.current.filter(
          (enemy) => enemy.kind !== "vampire"
        );
        activatedZonesRef.current.delete("night");
      }

      if (mode !== "defence") {
        for (const camp of MONSTER_CAMPS) {
          if (!activatedCampsRef.current.has(camp.id)) continue;
          if (camp.kind === "vampire" && !isNight) continue;
          const activeCount = enemiesRef.current.filter(
            (enemy) => enemy.campId === camp.id
          ).length;
          if (activeCount >= camp.maxPopulation) {
            campRespawnAtRef.current.delete(camp.id);
            continue;
          }
          const scheduledAt = campRespawnAtRef.current.get(camp.id);
          if (scheduledAt === undefined) {
            campRespawnAtRef.current.set(camp.id, now + camp.respawnMs);
          } else if (now >= scheduledAt) {
            spawnCampGroup(camp, camp.maxPopulation - activeCount);
            campRespawnAtRef.current.delete(camp.id);
          }
        }
      }

      const moving = !playerIsDead && (dx !== 0 || dy !== 0);
      if (moving) {
        playerDirRef.current =
          Math.abs(dx) > Math.abs(dy)
            ? dx > 0
              ? "right"
              : "left"
            : dy > 0
            ? "down"
            : "up";
      }

      const { x: px, y: py } = posRef.current;

      if (cameraFollowRef.current) {
        camPosRef.current.x = px;
        camPosRef.current.y = py;
      }

      const cx = camPosRef.current.x;
      const cy = camPosRef.current.y;
      const w = canvas.width;
      const h = canvas.height;

      if (now < arenaShakeUntilRef.current) {
        const shakeProgress =
          (arenaShakeUntilRef.current - now) / 220;
        const shake = arenaShakeStrengthRef.current * shakeProgress;
        container.style.transform = `translate(${(Math.random() * 2 - 1) * shake}px, ${(Math.random() * 2 - 1) * shake}px)`;
      } else {
        arenaShakeStrengthRef.current = 0;
        container.style.transform = "none";
      }

      // 1. Floor
      renderFloor(ctx, w, h, cx, cy, floorPatternRef.current);

      // 1b. Lane biomes (tints + pixel ground details)
      renderBiomeGround(ctx, w, h, cx, cy, now);

      // 2. Trees, Houses, Campfire
      updateEnvironmentDecor(
        worldLayer,
        ctx,
        cx,
        cy,
        w,
        h,
        now,
        treesRef.current,
        houseElsRef.current,
        campfireElRef.current,
        demonFiresRef.current,
        !baseDestroyedRef.current
      );

      // 2b. Demon fortress props (portal, throne, forge, walls, lava...)
      updateDemonProps(
        worldLayer,
        ctx,
        cx,
        cy,
        w,
        h,
        demonPropsRef.current
      );

      // 2c. Base vendors (store + craft beside the respawn point)
      updateBaseProps(
        worldLayer,
        ctx,
        cx,
        cy,
        w,
        h,
        basePropsRef.current,
        basePropLabelsRef.current
      );

      // 2d. Vendor proximity for F/C/V interaction.
      {
        let nearest: "store" | "craft" | "incubator" | null = null;
        let nearestDist = 130;
        for (const prop of BASE_PROPS) {
          if (prop.id !== "store" && prop.id !== "craft" && prop.id !== "incubator") continue;
          const d = Math.hypot(prop.x - px, prop.y - py);
          if (d < nearestDist) {
            nearest = prop.id as "store" | "craft" | "incubator";
            nearestDist = d;
          }
        }
        if (nearest !== vendorNearbyRef.current) {
          vendorNearbyRef.current = nearest;
          onVendorNearby?.(nearest);
        }
      }

      // 3. Player Shadow & Sprite
      const pScreenX = px - cx + w / 2;
      const pScreenY = py - cy + h / 2;
      drawGroundShadow(ctx, pScreenX, pScreenY + 38, 22, 9);

      {
        const deathStartedAt = playerDeathStartedAtRef.current;
        const isDying = deathStartedAt !== null;
        let state: "idle" | "run" | "attack1" | "attack2" = moving
          ? "run"
          : "idle";
        let frame: number;
        const action = playerActionRef.current;
        if (isDying) {
          state = "attack2";
          frame = Math.min(
            PLAYER_COLS - 1,
            Math.floor((now - deathStartedAt) / (PLAYER_DEATH_DURATION_MS / PLAYER_COLS))
          );
        } else if (action) {
          const frameIdx = Math.floor(
            (now - action.startedAt) / PLAYER_ATTACK_ANIM_MS
          );
          if (frameIdx >= PLAYER_COLS) {
            playerActionRef.current = null;
            frame =
              state === "run"
                ? Math.floor(now / PLAYER_RUN_ANIM_MS) % PLAYER_COLS
                : Math.floor(now / PLAYER_IDLE_ANIM_MS) % PLAYER_COLS;
          } else {
            state = action.kind === "flashTriangle" ? "attack2" : action.kind;
            frame = frameIdx;
          }
        } else {
          frame =
            state === "run"
              ? Math.floor(now / PLAYER_RUN_ANIM_MS) % PLAYER_COLS
              : Math.floor(now / PLAYER_IDLE_ANIM_MS) % PLAYER_COLS;
        }

        const sprite = playerRef.current;
        if (sprite) {
          const skillAge =
            secondSkillStartedAtRef.current === null
              ? SECOND_SKILL_DURATION_MS
              : Math.min(
                  SECOND_SKILL_DURATION_MS,
                  now - secondSkillStartedAtRef.current
                );
          const skillRotation =
            secondSkillStartedAtRef.current === null
              ? 0
              : (skillAge / SECOND_SKILL_DURATION_MS) *
                SECOND_SKILL_ROTATION_DEGREES;
          sprite.style.width = `${PLAYER_DISPLAY_W}px`;
          sprite.style.height = `${PLAYER_DISPLAY_H}px`;
          sprite.style.backgroundImage = `url(/player/${state}_${playerDirRef.current}.png)`;
          sprite.style.backgroundSize = `${
            PLAYER_DISPLAY_W * PLAYER_COLS
          }px ${PLAYER_DISPLAY_H}px`;
          sprite.style.backgroundPosition = `-${frame * PLAYER_DISPLAY_W}px 0px`;
          sprite.style.backgroundRepeat = "no-repeat";
          sprite.style.imageRendering = "pixelated";
          sprite.style.opacity = isDying
            ? String(Math.max(0, 1 - (now - deathStartedAt!) / PLAYER_DEATH_DURATION_MS))
            : now < dodgeInvulnUntilRef.current
            ? "0.55"
            : "1";
          sprite.style.zIndex = String(Z_BASE + Math.round(py + 38));
          sprite.style.left = "0px";
          sprite.style.top = "0px";
          sprite.style.transform = `translate(${
            pScreenX - PLAYER_DISPLAY_W / 2
          }px, ${pScreenY - PLAYER_DISPLAY_H / 2}px) rotate(${skillRotation}deg)`;
        }

        // 3b. Equipped dragon companion — hovers at the player's side.
        {
          const dragonEl = dragonRef.current;
          const activeCompanion = companionIdRef.current;
          if (dragonEl) {
            if (!activeCompanion) {
              dragonEl.style.opacity = '0';
            } else {
              const scale = DRAGON_SCALE_BY_ID[activeCompanion] ?? 0.55;
              const dispW = DRAGON_FRAME_W * scale;
              const dispH = DRAGON_FRAME_H * scale;
              if (!dragonInitRef.current) {
                dragonPosRef.current = { x: px - 70, y: py + 30 };
                dragonInitRef.current = true;
              }
              // Follow a slot to the player's side with a gentle bob.
              const bob = Math.sin(now / 320) * 7;
              const targetX = px - 72;
              const targetY = py + 34 + bob;
              const follow = Math.min(1, (dt / 16.7) * 0.12);
              dragonPosRef.current.x += (targetX - dragonPosRef.current.x) * follow;
              dragonPosRef.current.y += (targetY - dragonPosRef.current.y) * follow;
              const dScreenX = dragonPosRef.current.x - cx + w / 2;
              const dScreenY = dragonPosRef.current.y - cy + h / 2;
              drawGroundShadow(ctx, dScreenX, dScreenY + dispH / 2 - 6, 14, 5);
              const frameMs = moving ? 90 : 140;
              const frameIdx = Math.floor(now / frameMs) % DRAGON_FRAMES;
              const col = frameIdx % DRAGON_COLS;
              const row = Math.floor(frameIdx / DRAGON_COLS);
              dragonEl.style.width = `${dispW}px`;
              dragonEl.style.height = `${dispH}px`;
              dragonEl.style.backgroundImage = `url(${dragonSrcFor(playerDirRef.current, activeCompanion)})`;
              dragonEl.style.backgroundSize = `${dispW * DRAGON_COLS}px ${dispH * DRAGON_ROWS}px`;
              dragonEl.style.backgroundPosition = `-${col * dispW}px -${row * dispH}px`;
              dragonEl.style.backgroundRepeat = 'no-repeat';
              dragonEl.style.imageRendering = 'pixelated';
              dragonEl.style.opacity = isDying ? '0' : '1';
              dragonEl.style.zIndex = String(Z_BASE + Math.round(dragonPosRef.current.y + 30));
              dragonEl.style.transform = `translate(${dScreenX - dispW / 2}px, ${dScreenY - dispH / 2}px)`;
            }
          }
        }

        const secondSkill = secondSkillRef.current;
        const skillStartedAt = secondSkillStartedAtRef.current;
        if (secondSkill && skillStartedAt !== null) {
          const skillAge = now - skillStartedAt;
          if (skillAge >= SECOND_SKILL_DURATION_MS) {
            secondSkill.style.opacity = "0";
            secondSkillStartedAtRef.current = null;
          } else {
            const skillFrame = Math.min(
              SECOND_SKILL_FRAME_COUNT - 1,
              Math.floor(
                (skillAge / SECOND_SKILL_DURATION_MS) * SECOND_SKILL_FRAME_COUNT
              )
            );
            secondSkill.style.width = `${SECOND_SKILL_FRAME_SIZE}px`;
            secondSkill.style.height = `${SECOND_SKILL_FRAME_SIZE}px`;
            secondSkill.style.backgroundImage = "url(/skill.png)";
            secondSkill.style.backgroundSize = `${
              SECOND_SKILL_FRAME_SIZE * SECOND_SKILL_FRAME_COUNT
            }px ${SECOND_SKILL_FRAME_SIZE * 9}px`;
            secondSkill.style.backgroundPosition = `-${
              skillFrame * SECOND_SKILL_FRAME_SIZE
            }px -${SECOND_SKILL_ROW * SECOND_SKILL_FRAME_SIZE}px`;
            secondSkill.style.opacity = "1";
            secondSkill.style.transform = `translate(${pScreenX - SECOND_SKILL_FRAME_SIZE / 2}px, ${
              pScreenY - SECOND_SKILL_FRAME_SIZE / 2
            }px) scale(4)`;
            secondSkill.style.zIndex = String(Z_BASE + Math.round(py + 70));
          }
        }

        for (let i = dodgeSmokeRef.current.length - 1; i >= 0; i--) {
          const smoke = dodgeSmokeRef.current[i];
          const smokeAge = now - smoke.startedAt;
          if (smokeAge >= DODGE_SMOKE_DURATION_MS) {
            smoke.el.remove();
            dodgeSmokeRef.current.splice(i, 1);
            continue;
          }
          const smokeFrame = Math.min(
            DODGE_SMOKE_FRAME_COUNT - 1,
            Math.floor(
              (smokeAge / DODGE_SMOKE_DURATION_MS) * DODGE_SMOKE_FRAME_COUNT
            )
          );
          const smokeScreenX = smoke.x - cx + w / 2;
          const smokeScreenY = smoke.y - cy + h / 2;
          smoke.el.style.width = `${SECOND_SKILL_FRAME_SIZE}px`;
          smoke.el.style.height = `${SECOND_SKILL_FRAME_SIZE}px`;
          smoke.el.style.backgroundImage = "url(/smoke.png)";
          smoke.el.style.backgroundSize = `${
            SECOND_SKILL_FRAME_SIZE * DODGE_SMOKE_FRAME_COUNT
          }px ${SECOND_SKILL_FRAME_SIZE * DODGE_SMOKE_SHEET_ROWS}px`;
          smoke.el.style.backgroundPosition = `-${
            smokeFrame * SECOND_SKILL_FRAME_SIZE
          }px -${DODGE_EFFECT_ROW * SECOND_SKILL_FRAME_SIZE}px`;
          smoke.el.style.opacity = String(
            0.75 * (1 - smokeAge / DODGE_SMOKE_DURATION_MS)
          );
          smoke.el.style.transform = `translate(${
            smokeScreenX - SECOND_SKILL_FRAME_SIZE / 2
          }px, ${smokeScreenY - SECOND_SKILL_FRAME_SIZE / 2}px) scale(2.5)`;
          smoke.el.style.zIndex = String(Z_BASE + Math.round(smoke.y + 60));
        }

        for (let i = cloneSmokeRef.current.length - 1; i >= 0; i--) {
          const smoke = cloneSmokeRef.current[i];
          const smokeAge = now - smoke.startedAt;
          if (smokeAge >= CLONE_SMOKE_DURATION_MS) {
            smoke.el.remove();
            cloneSmokeRef.current.splice(i, 1);
            continue;
          }
          const smokeFrame = Math.min(
            CLONE_SMOKE_FRAME_COUNT - 1,
            Math.floor(
              (smokeAge / CLONE_SMOKE_DURATION_MS) * CLONE_SMOKE_FRAME_COUNT
            )
          );
          const smokeScreenX = smoke.x - cx + w / 2;
          const smokeScreenY = smoke.y - cy + h / 2;
          smoke.el.style.width = `${CLONE_SMOKE_FRAME_SIZE}px`;
          smoke.el.style.height = `${CLONE_SMOKE_FRAME_SIZE}px`;
          smoke.el.style.backgroundImage = "url(/smoke2.png)";
          smoke.el.style.backgroundSize = `${
            CLONE_SMOKE_FRAME_SIZE * CLONE_SMOKE_FRAME_COUNT
          }px ${CLONE_SMOKE_FRAME_SIZE * 11}px`;
          smoke.el.style.backgroundPosition = `-${
            smokeFrame * CLONE_SMOKE_FRAME_SIZE
          }px -${CLONE_SMOKE_ROW * CLONE_SMOKE_FRAME_SIZE}px`;
          smoke.el.style.opacity = String(
            0.85 * (1 - smokeAge / CLONE_SMOKE_DURATION_MS)
          );
          smoke.el.style.transform = `translate(${
            smokeScreenX - CLONE_SMOKE_FRAME_SIZE / 2
          }px, ${smokeScreenY - CLONE_SMOKE_FRAME_SIZE / 2}px) scale(2.2)`;
          smoke.el.style.zIndex = String(Z_BASE + Math.round(smoke.y + 55));
        }

        for (let i = hitEffectsRef.current.length - 1; i >= 0; i--) {
          const effect = hitEffectsRef.current[i];
          const age = now - effect.startedAt;
          const duration = 420;
          if (age >= duration) {
            effect.numberEl.remove();
            effect.flashEl.remove();
            hitEffectsRef.current.splice(i, 1);
            continue;
          }
          const progress = age / duration;
          const screenX = effect.x - cx + w / 2;
          const screenY = effect.y - cy + h / 2;
          effect.numberEl.style.transform = `translate(${screenX - 12}px, ${screenY - 42 - progress * 28}px)`;
          effect.numberEl.style.opacity = String(1 - progress);
          effect.flashEl.style.transform = `translate(${screenX - 18}px, ${screenY - 18}px) scale(${1 + progress * 0.8})`;
          effect.flashEl.style.opacity = String(Math.max(0, 0.7 - progress));
          effect.numberEl.style.zIndex = String(Z_BASE + Math.round(effect.y + 120));
          effect.flashEl.style.zIndex = String(Z_BASE + Math.round(effect.y + 110));
        }

        for (const drop of groundDropsRef.current) {
          const screenX = drop.x - cx + w / 2;
          const screenY = drop.y - cy + h / 2;
          const distance = Math.hypot(drop.x - px, drop.y - py);
          drop.el?.style.setProperty("transform", `translate(${screenX - 28}px, ${screenY - 28}px)`);
          drop.el?.style.setProperty("opacity", distance <= 72 ? "1" : "0.72");
          if (drop.el) drop.el.style.zIndex = String(Z_BASE + Math.round(drop.y + 45));
        }
        const lootNearby = groundDropsRef.current.some(
          (drop) => Math.hypot(drop.x - px, drop.y - py) <= 72
        );
        if (lootNearby !== lootNearbyRef.current) {
          lootNearbyRef.current = lootNearby;
          onLootNearby?.(lootNearby);
        }

        const hpLabelEl = playerHpRef.current;
        if (hpLabelEl) {
          const pct =
            maxHpRef.current > 0 ? hpRef.current / maxHpRef.current : 0;
          const fillColor =
            pct > 0.5 ? "#35b94f" : pct > 0.25 ? "#ffb52e" : "#e11d2e";
          hpLabelEl.innerHTML = `<span class="hpTrack"><span class="hpFill" style="width:${Math.max(0, Math.min(100, pct * 100))}%;background:${fillColor}"></span></span>`;
        }
      }

      // 3b. Mana regenerates over time; sync to the page only when the
      // shown integer changes so the HUD doesn't re-render every frame.
      if (playerDeathStartedAtRef.current === null && manaRef.current < maxManaRef.current) {
        manaRef.current = Math.min(
          maxManaRef.current,
          manaRef.current + ((maxManaRef.current * MANA_REGEN_MAX_FRACTION_PER_SEC + MANA_REGEN_BASE_PER_SEC) * dt) / 1000
        );
        const shown = Math.floor(manaRef.current);
        if (shown !== lastSyncedManaRef.current) {
          lastSyncedManaRef.current = shown;
          onStatsChange((s) => ({ ...s, mana: manaRef.current }));
        }
      }

      // 4. Enemies
      const combatContext = getCombatContext();
      updateEnemies(
        enemiesRef.current,
        now,
        dt,
        px,
        py,
        cx,
        cy,
        w,
        h,
        ctx,
        treesRef.current,
        lastHitRef,
        dodgeInvulnUntilRef.current,
        hpRef,
        (dmg) => {
          // Taken hits refresh the combat window but never START combat —
          // only player aggression does (see signalCombat).
          combatManagerRef.current?.ping();
          // hpRef is the single source of truth for combat: apply here, then
          // force page state to the exact same value so HUD and label match.
          const newHp = Math.max(0, hpRef.current - dmg);
          hpRef.current = newHp;
          onStatsChange((s) => ({ ...s, hp: newHp }));
          applyDamageGlow(playerRef.current);
          // Enemy hits stun the player briefly (dodge still escapes).
          playerStunUntilRef.current = Math.max(
            playerStunUntilRef.current,
            performance.now() + PLAYER_STUN_MS
          );
          arenaShakeUntilRef.current = performance.now() + 180;
          arenaShakeStrengthRef.current = 8;
          if (hpRef.current <= 0 && playerDeathStartedAtRef.current === null) {
            playerDeathStartedAtRef.current = performance.now();
            playerActionRef.current = null;
            keysRef.current = {};
          }
        },
        signalCombat,
        clonesRef.current,
        { defense: combatStatsRef.current.defense, armor: combatStatsRef.current.armor },
        (dmg) => onBaseHitRef.current?.(dmg),
        warriorsRef.current
      );

      const boss = enemiesRef.current.find(
        (enemy) => enemy.kind === "skeletonKing" && enemy.hp > 0
      );
      const bossHpBar = bossHpRef.current;
      if (bossHpBar) {
        if (boss) {
          const percentage = Math.round(
            Math.max(0, Math.min(1, boss.hp / boss.maxHp)) * 100
          );
          const signature = `${Math.round(boss.hp)}:${boss.maxHp}:${percentage}`;
          if (bossHpBar.dataset.signature !== signature) {
            bossHpBar.innerHTML = `<strong>SKELETON KING</strong><span class="bossHpTrack"><span style="width:${percentage}%"></span><em>${Math.max(0, Math.round(boss.hp))}/${boss.maxHp} (${percentage}%)</em></span>`;
            bossHpBar.dataset.signature = signature;
          }
          bossHpBar.style.opacity = "1";
        } else {
          bossHpBar.style.opacity = "0";
          bossHpBar.dataset.signature = "";
        }
      }

      if (
        playerDeathStartedAtRef.current !== null &&
        now - playerDeathStartedAtRef.current >= PLAYER_DEATH_DURATION_MS
      ) {
        posRef.current.x = 0;
        posRef.current.y = 0;
        camPosRef.current.x = 0;
        camPosRef.current.y = 0;
        hpRef.current = maxHpRef.current;
        manaRef.current = maxManaRef.current;
        lastSyncedManaRef.current = Math.floor(manaRef.current);
        playerDeathStartedAtRef.current = null;
        onStatsChange((s) => ({ ...s, hp: s.maxHp, mana: s.maxMana }));
      }

      // 5. Corpses
      updateCorpses(
        now,
        cx,
        cy,
        w,
        h,
        bmCorpsesRef,
        skCorpsesRef,
        necroCorpsesRef,
        skKingCorpsesRef
      );

      // 6. NPCs
      updateNpcs(
        npcsRef.current,
        enemiesRef.current,
        now,
        dt,
        px,
        py,
        cx,
        cy,
        w,
        h,
        combatContext
      );

      // 7. Clones
      updateClones(
        clonesRef,
        enemiesRef.current,
        now,
        dt,
        cx,
        cy,
        w,
        h,
        combatContext
      );

      // 8. Warriors (unleashed in defence: no leash, no homing)
      updateWarriors(
        warriorsRef.current,
        enemiesRef.current,
        now,
        dt,
        cx,
        cy,
        w,
        h,
        combatContext,
        () => {
          // Fires only from the herald branch (role already flipped).
          heraldsArrivedRef.current += 1;
          onHeraldArrivedRef.current?.(heraldsArrivedRef.current, HERALD_COUNT);
        },
        mode === "defence"
      );

      // 8b. Defence intro script (warning → arming → uprising).
      if (mode === "defence" && introStateRef.current.stage !== "idle" && introStateRef.current.stage !== "done") {
        updateDefenceIntro(
          introStateRef.current,
          warriorsRef.current,
          npcsRef.current,
          now,
          {
            onBanner: (line) => onStoryBannerRef.current?.(line),
            onConvert: () => convertVillagersToKnights(),
            onDone: () => onIntroDoneRef.current?.(),
          }
        );
      }

      // 9. Minimap
      renderMinimap(
        minimapCanvasRef.current,
        px,
        py,
        enemiesRef.current,
        npcsRef.current,
        clonesRef.current,
        warriorsRef.current
      );

      // 9b. Biome weather (graveyard fog, final shards, demon embers)
      renderBiomeWeather(ctx, w, h, cx, cy, now);

      // 10. Lighting Overlay
      renderLightingOverlay(ctx, w, h, cx, cy, gameMinute);

      // 10b. Biome lighting (night-lane darkness, base sanctuary glow)
      renderBiomeLighting(ctx, w, h, cx, cy, gameMinute, worldZoneAt(px, py)?.id ?? null);

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      container.removeEventListener("mousedown", onMouseDown);
      container.removeEventListener("mousemove", onMouseMove);
      container.removeEventListener("click", onInspectClick);
      window.removeEventListener("mouseup", onMouseUp);
      container.removeEventListener("contextmenu", onContextMenu);
      mmCanvas.removeEventListener("click", onMinimapClick);
      combatManager.dispose();
      combatManagerRef.current = null;

      cleanupEnemies(
        enemiesRef.current,
        bmCorpsesRef.current,
        skCorpsesRef.current,
        necroCorpsesRef.current,
        skKingCorpsesRef.current
      );
      enemiesRef.current = [];
      bmCorpsesRef.current = [];
      skCorpsesRef.current = [];
      necroCorpsesRef.current = [];
      skKingCorpsesRef.current = [];

      cleanupNpcs(npcsRef.current);
      npcsRef.current = [];

      cleanupClones(clonesRef.current);
      clonesRef.current = [];

      cleanupWarriors(warriorsRef.current);
      warriorsRef.current = [];

      treesRef.current.forEach((t) => t.el.remove());
      treesRef.current.clear();
      demonFiresRef.current.forEach((fire) => fire.remove());
      demonFiresRef.current.clear();
      cleanupDemonProps(demonPropsRef.current);
      cleanupBaseProps(basePropsRef.current, basePropLabelsRef.current);
      vendorNearbyRef.current = null;
      onVendorNearby?.(null);
      houseElsRef.current.forEach((el) => el.remove());
      houseElsRef.current = [];
      campfireElRef.current?.remove();
      campfireElRef.current = null;
      dodgeSmokeRef.current.forEach((smoke) => smoke.el.remove());
      dodgeSmokeRef.current = [];
      cloneSmokeRef.current.forEach((smoke) => smoke.el.remove());
      cloneSmokeRef.current = [];
      hitEffectsRef.current.forEach((effect) => {
        effect.numberEl.remove();
        effect.flashEl.remove();
      });
      hitEffectsRef.current = [];
      groundDropsRef.current.forEach((drop) => drop.el?.remove());
      groundDropsRef.current = [];
      lootNearbyRef.current = false;
      onLootNearby?.(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={containerRef} className={styles.arena}>
      <div
        ref={worldLayerRef}
        className={styles.worldLayer}
      >
        <canvas ref={canvasRef} className={styles.canvas} />
        <div ref={secondSkillRef} className={styles.secondSkill} />
        <div ref={dragonRef} className={styles.dragonCompanion} />
        <div ref={playerRef} className={styles.player}>
          <div ref={playerHpRef} className={styles.playerHpLabel}></div>
        </div>
      </div>
      <div
        className={`${styles.minimapContainer} ${
          isExpanded ? styles.expandedMinimap : ""
        }`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <canvas
          ref={minimapCanvasRef}
          className={styles.minimapCanvas}
          width={isExpanded ? 400 : 160}
          height={isExpanded ? 400 : 160}
        />
      </div>
      <div ref={bossHpRef} className={styles.bossHealthBar} />
    </div>
  );
});

export default InfiniteArena;