// arena/warriors.ts
import { Warrior, WarriorDir, WarriorAnim, Enemy } from "./types";
import { warriorDirFromVector } from "./enemies";
import { renderHpLabel, Z_BASE, VILLAGE_BASE_CENTER } from "./world";
import { FORMATION_GUARD_RADIUS } from "./formation";
import { applyDamageGlow, CombatContext, damageEnemy } from "./combat";
import styles from "../survival.module.css";
import { playGuardianAttackSound } from "../audio";

export const WARRIOR_FRAME = 48;
export const WARRIOR_SCALE = 3.0;
export const WARRIOR_DISPLAY = WARRIOR_FRAME * WARRIOR_SCALE;

export const WARRIOR_FRAME_COUNTS: Record<WarriorAnim, number> = {
  Idle: 5,
  Walk: 8,
  Attack01: 6,
  Attack02: 6,
  Attack03: 5,
  Hurt: 4,
  Death: 5,
};

export function warriorFrameCount(dir: WarriorDir, anim: WarriorAnim): number {
  if (anim === "Death" && dir === "Up") return 6;
  return WARRIOR_FRAME_COUNTS[anim];
}

export const WARRIOR_FRAME_MS: Record<WarriorAnim, number> = {
  Idle: 160,
  Walk: 110,
  Attack01: 70,
  Attack02: 70,
  Attack03: 70,
  Hurt: 120,
  Death: 160,
};

export const WARRIOR_ATTACK_ANIMS: WarriorAnim[] = [
  "Attack01",
  "Attack02",
  "Attack03",
];

export const WARRIOR_SPEED = 0.22;
export const WARRIOR_MAX_HP = 200;
export const WARRIOR_DAMAGE = 12;
export const WARRIOR_RETALIATE_DAMAGE = 4;
export const WARRIOR_DETECT_RADIUS = 340;
export const WARRIOR_GUARD_RADIUS = 420;
export const WARRIOR_RANGE = 40;
export const WARRIOR_ATTACK_INTERVAL = 650;
export const WARRIOR_DOWNED_PAUSE_MS = 2500;
export const WARRIOR_COUNT = 4;
export const WARRIOR_SPAWN_RADIUS = 220;
// Defence draft buffs (run-local, reset per run): guard damage multiplier
// and bonus max HP for newly raised guards.
export const guardBuffs = { damageMult: 1, maxHpBonus: 0 };
export function resetGuardBuffs() {
  guardBuffs.damageMult = 1;
  guardBuffs.maxHpBonus = 0;
}
export function buffGuardDamage(mult: number) {
  guardBuffs.damageMult = Math.max(1, guardBuffs.damageMult + mult);
}
export function buffGuardMaxHp(bonus: number) {
  guardBuffs.maxHpBonus = Math.max(0, guardBuffs.maxHpBonus + bonus);
}

/** Enemies chewing through a knight: HP, glow, downed/death handling. */
export function damageWarrior(warrior: Warrior, dmg: number, now: number): boolean {
  if (warrior.hp <= 0 || warrior.state === "dead") return false;
  warrior.hp -= dmg;
  applyDamageGlow(warrior.el);
  if (warrior.hp <= 0) {
    warrior.hp = 0;
    warrior.state = "dead";
    warrior.targetId = null;
    warrior.deathStartedAt = now;
    const deathFrames = warriorFrameCount(warrior.dir, "Death");
    warrior.downedUntil =
      now + deathFrames * WARRIOR_FRAME_MS.Death + WARRIOR_DOWNED_PAUSE_MS;
    return true;
  }
  return false;
}
// Defence intro: herald knights ride in from afar to warn the base.
export const HERALD_COUNT = 5;
export const HERALD_SPAWN_DIST = 900;
export const HERALD_SPEED_MULT = 1.6;
export const HERALD_ARRIVE_DIST = 90;

export function spawnWarriorAt(
  container: HTMLDivElement,
  warriorsRef: { current: Warrior[] },
  nextWarriorId: { current: number },
  x: number,
  y: number,
  role: "guard" | "herald" = "guard",
  onSelect?: (warrior: Warrior) => void
): Warrior {
  const el = document.createElement("div");
  el.className = styles.warrior;
  el.style.width = `${WARRIOR_DISPLAY}px`;
  el.style.height = `${WARRIOR_DISPLAY}px`;
  el.style.backgroundImage = "url(/WarriorDownIdle.png)";
  el.style.backgroundSize = `${
    WARRIOR_DISPLAY * warriorFrameCount("Down", "Idle")
  }px ${WARRIOR_DISPLAY}px`;
  el.dataset.wAnim = "Idle";
  el.dataset.wDir = "Down";
  // Clickable so players can inspect their bodyguard. Block the arena
  // attack swing on mousedown (same pattern as villagers).
  el.style.pointerEvents = "auto";
  el.style.cursor = "pointer";
  container.appendChild(el);

  const hpEl = document.createElement("div");
  hpEl.className = styles.hpLabel;
  container.appendChild(hpEl);

  const warriorObj: Warrior = {
    id: nextWarriorId.current++,
    x,
    y,
    homeX: x,
    homeY: y,
    dir: "Down",
    state: "guard",
    role,
    targetId: null,
    lastAttackAt: 0,
    hp: WARRIOR_MAX_HP + guardBuffs.maxHpBonus,
    maxHp: WARRIOR_MAX_HP + guardBuffs.maxHpBonus,
    hurtUntil: 0,
    attackAnim: null,
    attackStartedAt: 0,
    deathStartedAt: 0,
    downedUntil: 0,
    el,
    hpEl,
  };

  el.addEventListener("mousedown", (e) => {
    e.stopPropagation();
  });

  el.addEventListener("click", (e) => {
    e.stopPropagation();
    if (warriorObj.state === "dead") return;
    onSelect?.(warriorObj);
  });

  warriorsRef.current.push(warriorObj);
  return warriorObj;
}

export function spawnWarriors(
  container: HTMLDivElement,
  warriorsRef: { current: Warrior[] },
  nextWarriorId: { current: number },
  px: number,
  py: number,
  onSelect?: (warrior: Warrior) => void
) {
  for (let i = 0; i < WARRIOR_COUNT; i++) {
    const angle = Math.PI / 4 + i * (Math.PI / 2); // NE, SE, SW, NW ring
    const x = px + Math.cos(angle) * WARRIOR_SPAWN_RADIUS;
    const y = py + Math.sin(angle) * WARRIOR_SPAWN_RADIUS;
    spawnWarriorAt(container, warriorsRef, nextWarriorId, x, y, "guard", onSelect);
  }
}

/** Defence intro: 5 heralds spawn far out and ride for the base. */
export function spawnHeralds(
  container: HTMLDivElement,
  warriorsRef: { current: Warrior[] },
  nextWarriorId: { current: number },
  onSelect?: (warrior: Warrior) => void
) {
  for (let i = 0; i < HERALD_COUNT; i++) {
    const angle = (i / HERALD_COUNT) * Math.PI * 2 + Math.random() * 0.4;
    const x = VILLAGE_BASE_CENTER.x + Math.cos(angle) * HERALD_SPAWN_DIST;
    const y = VILLAGE_BASE_CENTER.y + Math.sin(angle) * HERALD_SPAWN_DIST;
    spawnWarriorAt(container, warriorsRef, nextWarriorId, x, y, "herald", onSelect);
  }
}

export function updateWarriors(
  warriors: Warrior[],
  enemies: Enemy[],
  now: number,
  dt: number,
  cx: number,
  cy: number,
  w: number,
  h: number,
  combatContext: CombatContext,
  onHeraldArrived?: (warrior: Warrior) => void,
  unleashed: boolean = false
) {
  for (const warrior of warriors) {
    // Heralds ride straight for the base, ignoring combat. On arrival
    // they take up guard posts and report in. Falls through to shared
    // render + speech below (never `continue` past it).
    const isRidingHerald = warrior.role === "herald" && warrior.state !== "dead";
    if (isRidingHerald) {
      const ddx = VILLAGE_BASE_CENTER.x - warrior.x;
      const ddy = VILLAGE_BASE_CENTER.y - warrior.y;
      const dist = Math.hypot(ddx, ddy) || 1;
      if (dist <= HERALD_ARRIVE_DIST) {
        warrior.role = "guard";
        warrior.homeX = warrior.x;
        warrior.homeY = warrior.y;
        warrior.state = "guard";
        warrior.dir = "Down";
        onHeraldArrived?.(warrior);
      } else {
        warrior.dir = warriorDirFromVector(ddx, ddy);
        warrior.state = "chase";
        warrior.x += (ddx / dist) * WARRIOR_SPEED * HERALD_SPEED_MULT * dt;
        warrior.y += (ddy / dist) * WARRIOR_SPEED * HERALD_SPEED_MULT * dt;
      }
    }
    if (isRidingHerald) {
      // No combat while delivering the warning — straight to render.
    } else if (warrior.state === "dead") {
      if (now >= warrior.downedUntil) {
        warrior.state = "guard";
        warrior.hp = warrior.maxHp;
        warrior.x = warrior.homeX;
        warrior.y = warrior.homeY;
        warrior.dir = "Down";
        warrior.targetId = null;
      }
    } else {
      let target = enemies.find((e) => e.id === warrior.targetId) ?? null;

      if (!target) {
        warrior.targetId = null;
        let nearestDist = WARRIOR_DETECT_RADIUS;
        for (const e of enemies) {
          const d = Math.hypot(e.x - warrior.x, e.y - warrior.y);
          if (d < nearestDist) {
            nearestDist = d;
            target = e;
          }
        }
        if (target) warrior.targetId = target.id;
      }

      const distFromHome = Math.hypot(
        warrior.x - warrior.homeX,
        warrior.y - warrior.homeY
      );

      // Formation knights always hold their tight ring; roaming guards
      // obey the unleashed flag (defence) or the 420 leash (survival).
      const leash = warrior.formation
        ? FORMATION_GUARD_RADIUS
        : WARRIOR_GUARD_RADIUS;
      const leashed = warrior.formation === true || !unleashed;
      if (target && distFromHome > leash && leashed) {
        target = null;
        warrior.targetId = null;
      }

      if (target) {
        const ddx = target.x - warrior.x;
        const ddy = target.y - warrior.y;
        const dist = Math.hypot(ddx, ddy) || 1;
        warrior.dir = warriorDirFromVector(ddx, ddy);

        if (dist > WARRIOR_RANGE) {
          warrior.state = "chase";
          warrior.x += (ddx / dist) * WARRIOR_SPEED * dt;
          warrior.y += (ddy / dist) * WARRIOR_SPEED * dt;
        } else {
          warrior.state = "attack";
          if (now - warrior.lastAttackAt > WARRIOR_ATTACK_INTERVAL) {
            warrior.lastAttackAt = now;
            const playerDistance = Math.hypot(
              warrior.x - combatContext.playerPos.x,
              warrior.y - combatContext.playerPos.y
            );
            const directionX = warrior.x - combatContext.playerPos.x;
            const guardianPan = Math.max(-1, Math.min(1, directionX / 220));
            playGuardianAttackSound(playerDistance, guardianPan);
            warrior.attackAnim =
              WARRIOR_ATTACK_ANIMS[
                Math.floor(Math.random() * WARRIOR_ATTACK_ANIMS.length)
              ];
            warrior.attackStartedAt = now;
            const targetScreenX = target.x - cx + w / 2;
            damageEnemy(
              target,
              Math.round(WARRIOR_DAMAGE * guardBuffs.damageMult),
              combatContext,
              "companion",
              targetScreenX
            );
            warrior.hp -= WARRIOR_RETALIATE_DAMAGE;
            warrior.hurtUntil =
              now + WARRIOR_FRAME_MS.Hurt * WARRIOR_FRAME_COUNTS.Hurt;
            applyDamageGlow(warrior.el);
            if (warrior.hp <= 0) {
              warrior.hp = 0;
              warrior.state = "dead";
              warrior.targetId = null;
              warrior.deathStartedAt = now;
              const deathFrames = warriorFrameCount(warrior.dir, "Death");
              warrior.downedUntil =
                now +
                deathFrames * WARRIOR_FRAME_MS.Death +
                WARRIOR_DOWNED_PAUSE_MS;
            }
          }
        }
      } else if (unleashed) {
        // No home to return to — hold position and watch for foes.
        warrior.state = "guard";
      } else {
        const ddx = warrior.homeX - warrior.x;
        const ddy = warrior.homeY - warrior.y;
        const dist = Math.hypot(ddx, ddy);
        if (dist > 8) {
          warrior.state = "chase";
          warrior.dir = warriorDirFromVector(ddx, ddy);
          warrior.x += (ddx / dist) * WARRIOR_SPEED * dt;
          warrior.y += (ddy / dist) * WARRIOR_SPEED * dt;
        } else {
          warrior.state = "guard";
        }
      }
    }

    const screenX = warrior.x - cx + w / 2;
    const screenY = warrior.y - cy + h / 2;
    const offscreen =
      screenX < -80 || screenX > w + 80 || screenY < -80 || screenY > h + 80;

    if (warrior.el) {
      let anim: WarriorAnim;
      let frame: number;

      if (warrior.state === "dead") {
        const frameCount = warriorFrameCount(warrior.dir, "Death");
        anim = "Death";
        frame = Math.min(
          frameCount - 1,
          Math.floor((now - warrior.deathStartedAt) / WARRIOR_FRAME_MS.Death)
        );
      } else if (
        warrior.attackAnim &&
        now - warrior.attackStartedAt <
          WARRIOR_FRAME_MS[warrior.attackAnim] *
            warriorFrameCount(warrior.dir, warrior.attackAnim)
      ) {
        anim = warrior.attackAnim;
        frame = Math.floor(
          (now - warrior.attackStartedAt) / WARRIOR_FRAME_MS[anim]
        );
      } else if (now < warrior.hurtUntil) {
        const frameCount = WARRIOR_FRAME_COUNTS.Hurt;
        anim = "Hurt";
        frame = Math.min(
          frameCount - 1,
          Math.floor(
            (now -
              (warrior.hurtUntil -
                WARRIOR_FRAME_MS.Hurt * frameCount)) /
              WARRIOR_FRAME_MS.Hurt
          )
        );
      } else {
        if (warrior.attackAnim) warrior.attackAnim = null;
        if (warrior.state === "chase") {
          anim = "Walk";
          frame =
            Math.floor(now / WARRIOR_FRAME_MS.Walk) %
            WARRIOR_FRAME_COUNTS.Walk;
        } else {
          anim = "Idle";
          frame =
            Math.floor(now / WARRIOR_FRAME_MS.Idle) %
            WARRIOR_FRAME_COUNTS.Idle;
        }
      }

      const frameCount = warriorFrameCount(warrior.dir, anim);
      const spriteKey = `${warrior.dir}${anim}`;
      if (warrior.el.dataset.wKey !== spriteKey) {
        warrior.el.style.backgroundImage = `url(/Warrior${spriteKey}.png)`;
        warrior.el.style.backgroundSize = `${
          WARRIOR_DISPLAY * frameCount
        }px ${WARRIOR_DISPLAY}px`;
        warrior.el.dataset.wKey = spriteKey;
      }
      warrior.el.style.backgroundPosition = `-${frame * WARRIOR_DISPLAY}px 0px`;
      warrior.el.style.transform = `translate(${
        screenX - WARRIOR_DISPLAY / 2
      }px, ${screenY - WARRIOR_DISPLAY / 2}px)`;
      warrior.el.style.opacity = offscreen
        ? "0"
        : warrior.state === "dead"
        ? "0.85"
        : "1";
      warrior.el.style.zIndex = String(
        Z_BASE + Math.round(warrior.y + WARRIOR_DISPLAY / 2 - 6)
      );
    }

    if (warrior.state !== "dead") {
      renderHpLabel(
        warrior.hpEl,
        warrior.hp,
        warrior.maxHp,
        screenX - 14,
        screenY - WARRIOR_DISPLAY / 2 - 20,
        offscreen
      );
    } else if (warrior.hpEl) {
      warrior.hpEl.style.opacity = "0";
    }

    // Floating speech (herald warnings): gold pixel bubble over the head.
    if (warrior.sayText && now < (warrior.sayUntil ?? 0) && warrior.state !== "dead") {
      if (!warrior.speechEl) {
        const bubble = document.createElement("div");
        bubble.className = styles.speechBubble;
        combatContext.container.appendChild(bubble);
        warrior.speechEl = bubble;
      }
      warrior.speechEl.textContent = warrior.sayText;
      warrior.speechEl.style.opacity = offscreen ? "0" : "1";
      warrior.speechEl.style.transform = `translate(${
        screenX - warrior.speechEl.offsetWidth / 2
      }px, ${screenY - WARRIOR_DISPLAY / 2 - 64}px)`;
      warrior.speechEl.style.zIndex = String(
        Z_BASE + Math.round(warrior.y + WARRIOR_DISPLAY / 2 + 60)
      );
    } else if (warrior.speechEl) {
      warrior.speechEl.remove();
      warrior.speechEl = null;
      warrior.sayText = null;
    }
  }
}

export function cleanupWarriors(warriors: Warrior[]) {
  warriors.forEach((wa) => {
    wa.el?.remove();
    wa.hpEl?.remove();
    wa.speechEl?.remove();
    wa.speechEl = null;
  });
}

