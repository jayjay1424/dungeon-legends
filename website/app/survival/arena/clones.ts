// arena/clones.ts
import { Clone, Enemy } from "./types";
import { renderHpLabel, Z_BASE } from "./world";
import { applyDamageGlow, CombatContext, damageEnemy, rollPlayerDamage } from "./combat";
import styles from "../survival.module.css";

export const PLAYER_FRAME_W = 96;
export const PLAYER_FRAME_H = 80;
export const PLAYER_COLS = 8;
export const PLAYER_RUN_ANIM_MS = 90;
export const PLAYER_IDLE_ANIM_MS = 160;
export const PLAYER_ATTACK_ANIM_MS = 55;

export const SKILL_COOLDOWN = 9000;
export const CLONE_COUNT_PER_CAST = 2;
export const CLONE_MAX_HP = 30;
export const CLONE_ATTACK_INTERVAL = 650;
export const CLONE_RETALIATE_DAMAGE = 5;
export const CLONE_RANGE = 46;
export const CLONE_SPEED = 0.2;
export const CLONE_SCALE = 2.6;
export const CLONE_DISPLAY_W = PLAYER_FRAME_W * CLONE_SCALE;
export const CLONE_DISPLAY_H = PLAYER_FRAME_H * CLONE_SCALE;

export function doCastClones(
  container: HTMLDivElement | null,
  clonesRef: { current: Clone[] },
  nextCloneId: { current: number },
  px: number,
  py: number,
  lastSkillAtRef: { current: number },
  onCloneSpawn?: (x: number, y: number) => void
) {
  const now = performance.now();
  if (now - lastSkillAtRef.current < SKILL_COOLDOWN) return false;
  if (!container) return false;
  lastSkillAtRef.current = now;

  for (let i = 0; i < CLONE_COUNT_PER_CAST; i++) {
    const angle =
      (i / CLONE_COUNT_PER_CAST) * Math.PI * 2 + Math.random() * 0.6;
    const x = px + Math.cos(angle) * 60;
    const y = py + Math.sin(angle) * 60;
    onCloneSpawn?.(x, y);

    const el = document.createElement("div");
    el.className = styles.clone;
    container.appendChild(el);

    const hpEl = document.createElement("div");
    hpEl.className = styles.hpLabel;
    container.appendChild(hpEl);

    clonesRef.current.push({
      id: nextCloneId.current++,
      x,
      y,
      hp: CLONE_MAX_HP,
      maxHp: CLONE_MAX_HP,
      dir: "down",
      targetId: null,
      lastAttackAt: 0,
      action: null,
      el,
      hpEl,
    });
  }
  return true;
}

export function damageClone(clone: Clone, dmg: number) {
  if (clone.hp <= 0) return;
  clone.hp -= dmg;
  applyDamageGlow(clone.el);
  if (clone.hp <= 0) {
    clone.el?.remove();
    clone.hpEl?.remove();
  }
}

export function updateClones(
  clonesRef: { current: Clone[] },
  enemies: Enemy[],
  now: number,
  dt: number,
  cx: number,
  cy: number,
  w: number,
  h: number,
  combatContext: CombatContext
) {
  // Sweep clones chewed apart by enemies.
  clonesRef.current = clonesRef.current.filter((clone) => clone.hp > 0);
  for (const clone of clonesRef.current) {
    let target =
      enemies.find((e) => e.id === clone.targetId) ?? null;
    if (!target) {
      let nearestDist = Infinity;
      for (const e of enemies) {
        const d = Math.hypot(e.x - clone.x, e.y - clone.y);
        if (d < nearestDist) {
          nearestDist = d;
          target = e;
        }
      }
      clone.targetId = target ? target.id : null;
    }

    let cloneMoving = false;
    if (target) {
      const ddx = target.x - clone.x;
      const ddy = target.y - clone.y;
      const dist = Math.hypot(ddx, ddy) || 1;
      clone.dir =
        Math.abs(ddx) > Math.abs(ddy)
          ? ddx > 0
            ? "right"
            : "left"
          : ddy > 0
          ? "down"
          : "up";

      if (dist > CLONE_RANGE) {
        clone.x += (ddx / dist) * CLONE_SPEED * dt;
        clone.y += (ddy / dist) * CLONE_SPEED * dt;
        cloneMoving = true;
      } else if (now - clone.lastAttackAt > CLONE_ATTACK_INTERVAL) {
        clone.lastAttackAt = now;
        const targetScreenX = target.x - cx + w / 2;
        const hit = rollPlayerDamage(6, combatContext.combatStatsRef.current, { attackRatio: 0.25 });
        damageEnemy(
          target,
          hit.damage,
          combatContext,
          "companion",
          targetScreenX,
          hit.crit
        );
        clone.hp -= CLONE_RETALIATE_DAMAGE;
        applyDamageGlow(clone.el);
        clone.action = { kind: "attack1", startedAt: now };
      }
    }

    if (clone.hp <= 0) {
      clone.el?.remove();
      clone.hpEl?.remove();
      continue;
    }

    const screenX = clone.x - cx + w / 2;
    const screenY = clone.y - cy + h / 2;
    const offscreen =
      screenX < -80 || screenX > w + 80 || screenY < -80 || screenY > h + 80;

    if (clone.el) {
      let state: "idle" | "run" | "attack1" = cloneMoving ? "run" : "idle";
      let frame: number;

      if (clone.action) {
        const frameIdx = Math.floor(
          (now - clone.action.startedAt) / PLAYER_ATTACK_ANIM_MS
        );
        if (frameIdx >= PLAYER_COLS) {
          clone.action = null;
          frame =
            state === "run"
              ? Math.floor(now / PLAYER_RUN_ANIM_MS) % PLAYER_COLS
              : Math.floor(now / PLAYER_IDLE_ANIM_MS) % PLAYER_COLS;
        } else {
          state = clone.action.kind;
          frame = frameIdx;
        }
      } else {
        frame =
          state === "run"
            ? Math.floor(now / PLAYER_RUN_ANIM_MS) % PLAYER_COLS
            : Math.floor(now / PLAYER_IDLE_ANIM_MS) % PLAYER_COLS;
      }

      clone.el.style.width = `${CLONE_DISPLAY_W}px`;
      clone.el.style.height = `${CLONE_DISPLAY_H}px`;
      clone.el.style.backgroundImage = `url(/player/${state}_${clone.dir}.png)`;
      clone.el.style.backgroundSize = `${
        CLONE_DISPLAY_W * PLAYER_COLS
      }px ${CLONE_DISPLAY_H}px`;
      clone.el.style.backgroundPosition = `-${frame * CLONE_DISPLAY_W}px 0px`;
      clone.el.style.transform = `translate(${
        screenX - CLONE_DISPLAY_W / 2
      }px, ${screenY - CLONE_DISPLAY_H / 2}px)`;
      clone.el.style.opacity = offscreen ? "0" : "0.92";
      clone.el.style.zIndex = String(
        Z_BASE + Math.round(clone.y + CLONE_DISPLAY_H / 2 - 6)
      );
    }

    renderHpLabel(
      clone.hpEl,
      clone.hp,
      clone.maxHp,
      screenX - 14,
      screenY - CLONE_DISPLAY_H / 2 - 20,
      offscreen
    );
  }

  if (clonesRef.current.some((c) => c.hp <= 0)) {
    clonesRef.current = clonesRef.current.filter((c) => c.hp > 0);
  }
}

export function cleanupClones(clones: Clone[]) {
  clones.forEach((c) => {
    c.el?.remove();
    c.hpEl?.remove();
  });
}

