// arena/combat.ts
import { playSwordSwingSound, playSlimeHitSound } from "../audio";
import {
  Enemy,
  BmCorpse,
  SkCorpse,
  NecroCorpse,
  SkKingCorpse,
  Npc,
  Clone,
  Warrior,
  Stats,
  PlayerDir,
  PlayerAction,
  Tree,
  DamageSource,
} from "./types";
import { resolveAllPlayerCollisions } from "./world";
import {
  BM_DISPLAY,
  BM_FRAMES,
  BM_SHEET_SRC,
  GOBLIN_BEAST_DISPLAY,
  GOBLIN_BEAST_FRAME_COUNTS,
  goblinBeastSpriteSrc,
  GOBLIN_RIDER_DISPLAY,
  GOBLIN_RIDER_FRAME_COUNTS,
  goblinRiderSpriteSrc,
  DEMON_FRAMES,
  DEMON_SHEET_SRC,
  SKELETON_DISPLAY,
  SKELETON_FRAME_COUNTS,
  skeletonSpriteSrc,
  SKELETON_BOW_DISPLAY,
  SKELETON_BOW_FRAME_COUNTS,
  skeletonBowSpriteSrc,
  NECRO_DISPLAY,
  NECRO_FRAMES,
  NECRO_SHEET_SRC,
  SK_KING_SCALE,
  SK_KING_FRAME_COUNTS,
  skeletonKingSpriteSrc,
  spawnWave,
  spawnBloodMonsters,
  spawnDemons,
  spawnGoblinBeasts,
  spawnGoblinRiders,
  spawnSkeletons,
  spawnSkeletonBows,
  spawnVampires,
  VAMPIRE_DISPLAY,
  VAMPIRE_FRAME_COUNTS,
  VAMPIRE_SHEET_ROWS,
  vampireSpriteSrc,
  spawnNecromancers,
  spawnSkeletonKing,
  MONSTER_CAMPS,
} from "./enemies";

export const DIR_VECTORS: Record<PlayerDir, { x: number; y: number }> = {
  down: { x: 0, y: 1 },
  up: { x: 0, y: -1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export const DODGE_DISTANCE = 210;
export const DODGE_COOLDOWN = 2200;
export const DODGE_INVULN_MS = 280;

export function applyDamageGlow(el: HTMLElement | null) {
  if (!el) return;
  el.style.filter =
    "brightness(1.5) sepia(1) hue-rotate(-50deg) saturate(5) drop-shadow(0px 0px 8px red)";
  setTimeout(() => {
    if (el) el.style.filter = "";
  }, 150);
}

export type CombatStatSnapshot = {
  attack: number;
  critChance: number;
  critDamage: number;
  skillPower: number;
  moveSpeed: number;
  attackSpeed: number;
  luck: number;
  defense: number;
  armor: number;
};

export type CombatContext = {
  container: HTMLDivElement;
  containerWidth: number;
  playerPos: { x: number; y: number };
  camPos: { x: number; y: number };
  enemiesRef: { current: Enemy[] };
  bmCorpsesRef: { current: BmCorpse[] };
  skCorpsesRef: { current: SkCorpse[] };
  necroCorpsesRef: { current: NecroCorpse[] };
  skKingCorpsesRef: { current: SkKingCorpse[] };
  npcsRef: { current: Npc[] };
  clonesRef: { current: Clone[] };
  warriorsRef: { current: Warrior[] };
  nextEnemyId: { current: number };
  waveRef: { current: number };
  hpRef: { current: number };
  maxHpRef: { current: number };
  /** Live player stats (ref so mount-closure handlers never go stale). */
  combatStatsRef: { current: CombatStatSnapshot };
  onStatsChange: (updater: (prev: Stats) => Stats) => void;
  onExpEarned?: (amount: number, enemyName: string) => void;
  onCombatEvent?: () => void;
  onDamageEffect?: (x: number, y: number, damage: number, source: DamageSource, crit?: boolean) => void;
  onEnemyDefeated?: (x: number, y: number, kind: Enemy["kind"], playerContributed: boolean) => void;
};

/**
 * Player damage from live stats: base + attack scaling + skill scaling,
 * attack-speed bonus, luck variance, crit rolls. Low stats = weak hits.
 * Returns the rounded damage plus whether it crit (for gold numbers).
 */
export function rollPlayerDamage(
  base: number,
  s: CombatStatSnapshot,
  opts?: { attackRatio?: number; skillRatio?: number }
): { damage: number; crit: boolean } {
  const attackRatio = opts?.attackRatio ?? 1;
  const skillRatio = opts?.skillRatio ?? 0;
  const raw = base + s.attack * attackRatio + s.skillPower * skillRatio;
  const speedMult = 1 + Math.max(0, s.attackSpeed - 1) * 0.15;
  const variance =
    0.9 + Math.random() * 0.2 + Math.min(0.1, Math.max(0, s.luck - 1) * 0.01);
  let dmg = raw * speedMult * variance;
  const crit = Math.random() * 100 < s.critChance;
  if (crit) dmg *= s.critDamage / 100;
  return { damage: Math.max(1, Math.round(dmg)), crit };
}

export function damageEnemy(
  enemy: Enemy,
  dmg: number,
  context: CombatContext,
  source: DamageSource = "enemy",
  screenX?: number,
  crit: boolean = false
) {
  const targetScreenX =
    screenX ?? (enemy.x - context.camPos.x + context.containerWidth / 2);
  applyDamageGlow(enemy.el);
  enemy.lastDamager = source;
  enemy.damageContributors ??= new Set<DamageSource>();
  enemy.damageContribution ??= {};
  enemy.damageContributors.add(source);
  enemy.damageContribution[source] =
    (enemy.damageContribution[source] ?? 0) + dmg;
  context.onDamageEffect?.(enemy.x, enemy.y, dmg, source, crit);
  if (source === "player") enemy.targetPlayer = true;
  if (source === "player") context.onCombatEvent?.();
  enemy.hp -= dmg;

  if (enemy.hp > 0) {
    if (enemy.kind === "bloodMonster" || enemy.kind === "demon" || enemy.kind === "goblinBeast" || enemy.kind === "goblinRider" || enemy.kind === "vampire") {
      enemy.bmHurtStartedAt = performance.now();
    }
    
    if (enemy.kind === "skeleton" || enemy.kind === "skeletonBow") {
      enemy.skHurtStartedAt = performance.now();
    }
    if (enemy.kind === "necromancer") {
      enemy.bmHurtStartedAt = performance.now();
    }
    if (enemy.kind === "skeletonKing") {
      enemy.skHurtStartedAt = performance.now();
    }
    return;
  }

  enemy.attackAudioStop?.();
  enemy.attackAudioStop = undefined;

  if (enemy.kind === "slime") {
    const killDistance = Math.hypot(
      enemy.x - context.playerPos.x,
      enemy.y - context.playerPos.y
    );
    const killPan = Math.max(
      -1,
      Math.min(1, (enemy.x - context.playerPos.x) / 500)
    );
    playSlimeHitSound(
      killPan,
      Math.max(0, 1 - killDistance / 700)
    );
  }

  // Hand element off to corpse animation
  if ((enemy.kind === "bloodMonster" || enemy.kind === "demon") && enemy.el) {
    const deathSrc =
      enemy.kind === "demon" ? DEMON_SHEET_SRC.death : BM_SHEET_SRC.death;
    const deathFrames =
      enemy.kind === "demon" ? DEMON_FRAMES.death : BM_FRAMES.death;
    const corpseEl = enemy.el;
    corpseEl.style.backgroundImage = `url(${deathSrc})`;
    corpseEl.style.backgroundSize = `${BM_DISPLAY * deathFrames}px ${BM_DISPLAY}px`;
    corpseEl.dataset.bmAnim = "death";
    context.bmCorpsesRef.current.push({
      x: enemy.x,
      y: enemy.y,
      startedAt: performance.now(),
      el: corpseEl,
    });
    enemy.el = null;
  }

  if (enemy.kind === "goblinBeast" && enemy.el) {
    const corpseEl = enemy.el;
    const dir = enemy.skDir ?? "Down";
    corpseEl.style.width = `${GOBLIN_BEAST_DISPLAY}px`;
    corpseEl.style.height = `${GOBLIN_BEAST_DISPLAY}px`;
    corpseEl.style.backgroundImage = `url(${goblinBeastSpriteSrc(dir, "death")})`;
    corpseEl.style.backgroundSize = `${GOBLIN_BEAST_DISPLAY * GOBLIN_BEAST_FRAME_COUNTS.death}px ${GOBLIN_BEAST_DISPLAY}px`;
    corpseEl.dataset.goblinAnim = "death";
    corpseEl.dataset.goblinDir = dir;
    context.bmCorpsesRef.current.push({
      x: enemy.x,
      y: enemy.y,
      startedAt: performance.now(),
      el: corpseEl,
    });
    enemy.el = null;
  }

  if (enemy.kind === "goblinRider" && enemy.el) {
    const corpseEl = enemy.el;
    const dir = enemy.skDir ?? "Down";
    corpseEl.style.width = `${GOBLIN_RIDER_DISPLAY}px`;
    corpseEl.style.height = `${GOBLIN_RIDER_DISPLAY}px`;
    corpseEl.style.backgroundImage = `url(${goblinRiderSpriteSrc(dir, "death")})`;
    corpseEl.style.backgroundSize = `${GOBLIN_RIDER_DISPLAY * GOBLIN_RIDER_FRAME_COUNTS.death}px ${GOBLIN_RIDER_DISPLAY}px`;
    corpseEl.dataset.goblinRiderAnim = "death";
    context.bmCorpsesRef.current.push({
      x: enemy.x,
      y: enemy.y,
      startedAt: performance.now(),
      el: corpseEl,
    });
    enemy.el = null;
  }

  if (enemy.kind === "vampire" && enemy.el) {
    const corpseEl = enemy.el;
    corpseEl.style.backgroundImage = `url(${vampireSpriteSrc("death")})`;
    corpseEl.style.backgroundSize = `${VAMPIRE_DISPLAY * VAMPIRE_FRAME_COUNTS.death}px ${VAMPIRE_DISPLAY * VAMPIRE_SHEET_ROWS}px`;
    corpseEl.dataset.vampireAnim = "death";
    context.bmCorpsesRef.current.push({
      x: enemy.x,
      y: enemy.y,
      startedAt: performance.now(),
      el: corpseEl,
    });
    enemy.el = null;
  }

  if (enemy.kind === "skeleton" && enemy.el) {
    const dir = enemy.skDir ?? "Down";
    const corpseEl = enemy.el;
    corpseEl.style.backgroundImage = `url(${skeletonSpriteSrc(dir, "Death")})`;
    corpseEl.style.backgroundSize = `${
      SKELETON_DISPLAY * SKELETON_FRAME_COUNTS.Death
    }px ${SKELETON_DISPLAY}px`;
    corpseEl.dataset.skKey = `${dir}_Death`;
    context.skCorpsesRef.current.push({
      x: enemy.x,
      y: enemy.y,
      dir,
      startedAt: performance.now(),
      el: corpseEl,
    });
    enemy.el = null;
  }

  if (enemy.kind === "skeletonBow" && enemy.el) {
    const dir = enemy.skDir ?? "Down";
    const corpseEl = enemy.el;
    corpseEl.style.backgroundImage = `url(${skeletonBowSpriteSrc(dir, "Death")})`;
    corpseEl.style.backgroundSize = `${
      SKELETON_BOW_DISPLAY * SKELETON_BOW_FRAME_COUNTS.Death
    }px ${SKELETON_BOW_DISPLAY}px`;
    corpseEl.dataset.skKey = `Bow_${dir}_Death`;
    context.skCorpsesRef.current.push({
      x: enemy.x,
      y: enemy.y,
      dir,
      bow: true,
      startedAt: performance.now(),
      el: corpseEl,
    });
    enemy.el = null;
  }

  if (enemy.kind === "necromancer" && enemy.el) {
    const corpseEl = enemy.el;
    corpseEl.style.backgroundImage = `url(${NECRO_SHEET_SRC.death})`;
    corpseEl.style.backgroundSize = `${
      NECRO_DISPLAY * NECRO_FRAMES.death
    }px ${NECRO_DISPLAY}px`;
    corpseEl.dataset.necroAnim = "death";
    context.necroCorpsesRef.current.push({
      x: enemy.x,
      y: enemy.y,
      startedAt: performance.now(),
      facingLeft: enemy.bmFacingLeft ?? false,
      el: corpseEl,
    });
    enemy.el = null;
  }

  if (enemy.kind === "skeletonKing" && enemy.el) {
    const dir = enemy.skDir ?? "Down";
    const corpseEl = enemy.el;
    const dispSize = 48 * SK_KING_SCALE;
    corpseEl.style.width = `${dispSize}px`;
    corpseEl.style.height = `${dispSize}px`;
    corpseEl.style.backgroundImage = `url(${skeletonKingSpriteSrc(dir, "Death")})`;
    corpseEl.style.backgroundSize = `${
      dispSize * SK_KING_FRAME_COUNTS.Death
    }px ${dispSize}px`;
    corpseEl.dataset.skKingKey = `${dir}_Death`;
    context.skKingCorpsesRef.current.push({
      x: enemy.x,
      y: enemy.y,
      dir,
      startedAt: performance.now(),
      el: corpseEl,
    });
    enemy.el = null;
  }

  enemy.el?.remove();
  enemy.hpEl?.remove();
  enemy.killer = source;
  context.enemiesRef.current = context.enemiesRef.current.filter(
    (e) => e.id !== enemy.id
  );

  for (const npc of context.npcsRef.current) {
    if (npc.state === "fight" && npc.fightTargetId === enemy.id) {
      npc.state = "wander";
      npc.fightTargetId = null;
      npc.nextDecisionAt = performance.now() + 300 + Math.random() * 600;
    }
  }

  for (const clone of context.clonesRef.current) {
    if (clone.targetId === enemy.id) clone.targetId = null;
  }

  for (const warrior of context.warriorsRef.current) {
    if (warrior.targetId === enemy.id) {
      warrior.targetId = null;
      warrior.state = "guard";
    }
  }

  const goldReward = enemy.kind === "skeletonKing" ? 50 : 15;
  const xpReward = enemy.kind === "skeletonKing" ? 80 : 22;
  const playerContributed =
    enemy.targetPlayer === true || enemy.damageContributors?.has("player");
  context.onStatsChange((s) => ({
    ...s,
    gold: s.gold + goldReward,
    ...(playerContributed ? { xp: s.xp + xpReward } : {}),
  }));
  if (playerContributed) {
    context.onExpEarned?.(xpReward, enemy.kind?.replace(/([A-Z])/g, " $1").toUpperCase() ?? "MONSTER");
  }
  context.onEnemyDefeated?.(enemy.x, enemy.y, enemy.kind, playerContributed);

  if (context.enemiesRef.current.length === 0) {
    context.waveRef.current += 1;
    context.hpRef.current = Math.min(
      context.maxHpRef.current,
      context.hpRef.current + 20
    );
    context.onStatsChange((s) => ({
      ...s,
      wave: context.waveRef.current,
      hp: Math.min(s.maxHp, s.hp + 20),
    }));

  }
}



export function doAttack1(
  context: CombatContext,
  playerActionRef: { current: PlayerAction | null }
) {
  playSwordSwingSound(0);
  let closest: Enemy | null = null;
  let closestDist = Infinity;

  for (const e of context.enemiesRef.current) {
    const d = Math.hypot(e.x - context.playerPos.x, e.y - context.playerPos.y);
    if (d < 90 && d < closestDist) {
      closest = e;
      closestDist = d;
    }
  }
  if (closest) {
    const screenX =
      closest.x - context.camPos.x + context.containerWidth / 2;
    const hit = rollPlayerDamage(10, context.combatStatsRef.current);
    damageEnemy(closest, hit.damage, context, "player", screenX, hit.crit);
  }
  playerActionRef.current = { kind: "attack1", startedAt: performance.now() };
}

export function doAttack2(
  context: CombatContext,
  playerActionRef: { current: PlayerAction | null }
) {
  playSwordSwingSound(0);
  [...context.enemiesRef.current].forEach((e) => {
    const d = Math.hypot(e.x - context.playerPos.x, e.y - context.playerPos.y);
    if (d < 180) {
      const screenX =
        e.x - context.camPos.x + context.containerWidth / 2;
      const hit = rollPlayerDamage(5, context.combatStatsRef.current, { skillRatio: 0.2 });
      damageEnemy(e, hit.damage, context, "player", screenX, hit.crit);
    }
  });
  playerActionRef.current = { kind: "attack2", startedAt: performance.now() };
}

export function doDodge(
  posRef: { current: { x: number; y: number } },
  playerDir: PlayerDir,
  lastDodgeAtRef: { current: number },
  dodgeInvulnUntilRef: { current: number },
  treesMap: Map<string, Tree>
) {
  const now = performance.now();
  if (now - lastDodgeAtRef.current < DODGE_COOLDOWN) return;
  lastDodgeAtRef.current = now;

  const v = DIR_VECTORS[playerDir];
  posRef.current.x += v.x * DODGE_DISTANCE;
  posRef.current.y += v.y * DODGE_DISTANCE;
  const resolved = resolveAllPlayerCollisions(
    posRef.current.x,
    posRef.current.y,
    treesMap
  );
  posRef.current.x = resolved.x;
  posRef.current.y = resolved.y;
  dodgeInvulnUntilRef.current = now + DODGE_INVULN_MS;
}

