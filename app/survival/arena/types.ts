// arena/types.ts

export type PlayerDir = "down" | "left" | "right" | "up";

export type PlayerAction = {
  kind: "attack1" | "attack2" | "flashTriangle";
  startedAt: number;
};

export type ArenaHandle = {
  attack: () => void;
  skill: () => void;
  flashTriangle: () => void;
  /** Remaining/total ms per skill for the dock countdown overlay. Attack has no cooldown. */
  getCooldowns: () => SkillCooldowns;
  /** Defence mode: spawn a base-hunting wave at the map edge ring. */
  spawnDefenceWave?: (groups: { kind: DefenceWaveKind; count: number }[], wave: number) => void;
  /** Living enemies right now (wave-cleared detection). */
  getHostileCount?: () => number;
  /** Defence intro: ride 5 heralds out to warn the base. */
  beginWarningRun?: () => void;
  /** Defence intro: turn every living villager into a guard knight. */
  convertVillagersToKnights?: () => number;
  /** Defence intro: play the warning script (after heralds arrive). */
  playWarning?: () => void;
  /** Defence intro SKIP: arm villagers immediately. Returns converts. */
  skipWarning?: () => number;
  /** Defence draft: raise living guards' max HP and heal them. */
  reinforceGuards?: (bonus: number) => number;
  /** Defence: line knights up on the formation ring. */
  formRanks?: () => void;
  /** Defence draft: raise one extra guard (cap 30 allies). */
  addGuardAlly?: () => boolean;
};

export type DefenceWaveKind =
  | "slime"
  | "bloodMonster"
  | "demon"
  | "goblinBeast"
  | "goblinRider"
  | "vampire"
  | "skeleton"
  | "skeletonBow"
  | "necromancer"
  | "skeletonKing";

export type SkillKey = "spin" | "dodge" | "clones" | "flash";

export type SkillCooldown = { remainingMs: number; totalMs: number; locked: boolean; unlockLevel: number };

export type SkillCooldowns = Record<SkillKey, SkillCooldown>;

export type Stats = {
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

export type ArenaProps = {
  onStatsChange: (updater: (prev: Stats) => Stats) => void;
  playerAttack?: number;
  playerCritChance?: number;
  playerCritDamage?: number;
  playerSkillPower?: number;
  playerMoveSpeed?: number;
  playerAttackSpeed?: number;
  playerLuck?: number;
  playerDefense?: number;
  playerArmor?: number;
  playerLevel?: number;
  playerHp?: number;
  playerMaxHp?: number;
  /** Current mana mirror (page stats stay the source of truth). */
  playerMana?: number;
  playerMaxMana?: number;
  /** Fired when a skill fizzles from insufficient mana. */
  onSkillDenied?: (skill: SkillKey) => void;
  /** Fired on player-caused kills (kind only, for quests). */
  onKill?: (kind: Enemy["kind"]) => void;
  /** Fired every ~50 world units the player walks (quest progress). */
  onDistanceMoved?: (units: number) => void;
  /** Fired after a skill successfully casts (quest progress). */
  onSkillCast?: (skill: SkillKey) => void;
  /** Fired when the player stun state flips (HUD toast). */
  onStunChange?: (stunned: boolean) => void;
  /** Run mode: survival (zone armies) or defence (base waves). */
  mode?: "survival" | "defence";
  /** Defence mode: the base took a hit. */
  onBaseHit?: (dmg: number) => void;
  /** Defence mode: campfire renders cold/destroyed. */
  baseDestroyed?: boolean;
  /** Defence intro: a herald reached the base (arrived/total). */
  onHeraldArrived?: (arrived: number, total: number) => void;
  /** Defence intro: story banner line. */
  onStoryBanner?: (line: string) => void;
  /** Defence intro: script finished, start wave 1. */
  onIntroDone?: () => void;
  /** Equipped companion dragon id (e.g. "dragon_whelp"). Shows a red-dragon follower at the player's side. */
  companionId?: string | null;
  onExpEarned?: (amount: number, enemyName: string) => void;
  onCombatChange?: (phase: import("./combatState").CombatPhase) => void;
  onLootCollected?: (item: import("../items/types").ItemDefinition, amount: number) => void;
  onLootNearby?: (nearby: boolean) => void;
  onTimeChange?: (time: { label: string; isNight: boolean }) => void;
  onZoneChange?: (zoneName: string) => void;
  onVendorNearby?: (vendor: "store" | "craft" | "incubator" | null) => void;
  /** Click an enemy in the arena to inspect it (portrait + stats card). */
  onInspectEnemy?: (info: import("./inspect").InspectedEnemy | null) => void;
  /** Click an ambient villager to inspect it. */
  onInspectNpc?: (info: import("./inspect").NpcInspect | null) => void;
  /** Click a warrior bodyguard to inspect it. */
  onInspectWarrior?: (info: import("./inspect").WarriorInspect | null) => void;
  /** Click a vendor stall to inspect it. */
  onInspectVendor?: (vendor: import("./inspect").VendorId | null) => void;
  /** Camera zoom (0.5 = far, 1 = native). Canvas renders a larger region and the world layer scales to fit. */
  zoom?: number;
};

export type DamageSource = "player" | "companion" | "npc" | "enemy" | "environment";

export type Tree = {
  tx: number;
  ty: number;
  el: HTMLDivElement;
};

export type NpcState = "wander" | "chat" | "fight" | "follow" | "goHome" | "resting";

export type Npc = {
  id: number;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  vx: number;
  vy: number;
  dirRow: number;
  charIndex: number;
  nextDecisionAt: number;
  state: NpcState;
  chatPartnerId: number | null;
  chatUntil: number;
  fightTargetId: number | null;
  lastFightHitAt: number;
  hp: number;
  maxHp: number;
  dialogueOpen: boolean;
  restDoorX: number | null;
  restDoorY: number | null;
  el: HTMLDivElement | null;
  statusEl: HTMLDivElement | null;
  hpEl: HTMLDivElement | null;
  menuEl: HTMLDivElement | null;
};

export type WarriorDir = "Down" | "Up" | "Left" | "Right";

export type WarriorAnim =
  | "Idle"
  | "Walk"
  | "Attack01"
  | "Attack02"
  | "Attack03"
  | "Hurt"
  | "Death";

export type SkeletonAnim = "Idle" | "Move" | "Attack01" | "Hurt" | "Death";

export type BmAnim =
  | "idle"
  | "walk"
  | "attack1"
  | "attack2"
  | "attack3"
  | "hurt"
  | "death";

export type VampireAnim = "idle" | "walk" | "run" | "attack" | "hurt" | "death";

export type NecroAnim =
  | "idle"
  | "walk"
  | "attack1"
  | "attack2"
  | "attack3"
  | "hurt"
  | "death";

export type SkeletonKingAnim =
  | "Idle"
  | "Walk"
  | "Attack01"
  | "Attack02"
  | "Attack03"
  | "Hurt"
  | "Death";

export type Enemy = {
  id: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  colorRow: number;
  lastDamager?: DamageSource;
  damageContributors?: Set<DamageSource>;
  damageContribution?: Partial<Record<DamageSource, number>>;
  killer?: DamageSource;
  targetPlayer?: boolean;
  combatTargetingPlayer?: boolean;
  spawnedAt?: number;
  campId?: string;
  groupId?: string;
  homeX?: number;
  homeY?: number;
  territoryRadius?: number;
  kind?:
    | "slime"
    | "bloodMonster"
    | "demon"
    | "goblinBeast"
    | "goblinRider"
    | "skeleton"
    | "skeletonBow"
    | "vampire"
    | "necromancer"
    | "skeletonKing";
  bmBehavior?: "idle" | "walk" | "attack1" | "attack2" | "attack3";
  bmBehaviorStartedAt?: number;
  bmFacingLeft?: boolean;
  bmLastAttackAt?: number;
  wanderAngle?: number;
  nextWanderAt?: number;
  bmHurtStartedAt?: number;
  skDir?: WarriorDir;
  skBehavior?: "idle" | "walk" | "attack1" | "attack2" | "attack3";
  skBehaviorStartedAt?: number;
  skLastAttackAt?: number;
  skHurtStartedAt?: number;
  attackAudioStop?: () => void;
  stunnedUntil?: number;
  skKingAnim?: SkeletonKingAnim;
  /** Defence mode: march on the village base instead of the player. */
  targetBase?: boolean;
  el: HTMLDivElement | null;
  hpEl: HTMLDivElement | null;
};

export type Clone = {
  id: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  dir: PlayerDir;
  targetId: number | null;
  lastAttackAt: number;
  action: { kind: "attack1"; startedAt: number } | null;
  el: HTMLDivElement | null;
  hpEl: HTMLDivElement | null;
};

export type WarriorState = "guard" | "chase" | "attack" | "dead";

export type Warrior = {
  id: number;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  dir: WarriorDir;
  state: WarriorState;
  /** Defence intro: heralds run to the base, then become guards. */
  role?: "guard" | "herald";
  /** Defence: holds a formation post instead of roaming. */
  formation?: boolean;
  /** Floating speech text + expiry + element (herald warnings). */
  sayText?: string | null;
  sayUntil?: number;
  speechEl?: HTMLDivElement | null;
  targetId: number | null;
  lastAttackAt: number;
  hp: number;
  maxHp: number;
  hurtUntil: number;
  attackAnim: WarriorAnim | null;
  attackStartedAt: number;
  deathStartedAt: number;
  downedUntil: number;
  el: HTMLDivElement | null;
  hpEl: HTMLDivElement | null;
};

export type BmCorpse = {
  x: number;
  y: number;
  startedAt: number;
  el: HTMLDivElement;
};

export type SkCorpse = {
  x: number;
  y: number;
  dir: WarriorDir;
  bow?: boolean;
  startedAt: number;
  el: HTMLDivElement;
};

export type NecroCorpse = {
  x: number;
  y: number;
  facingLeft: boolean;
  startedAt: number;
  el: HTMLDivElement;
};

export type SkKingCorpse = {
  x: number;
  y: number;
  dir: WarriorDir;
  startedAt: number;
  el: HTMLDivElement;
};



