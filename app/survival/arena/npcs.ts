// arena/npcs.ts
import { Npc, Enemy } from "./types";
import { nearestHouse, renderHpLabel, Z_BASE } from "./world";
import { applyDamageGlow, CombatContext, damageEnemy } from "./combat";
import styles from "../survival.module.css";

export const NPC_FRAME_W = 16;
export const NPC_FRAME_H = 24;
export const NPC_COLS = 4;
export const NPC_ROWS = 4;
export const NPC_CHAR_COUNT = 15;
export const NPC_SCALE = 3;
export const NPC_DISPLAY_W = NPC_FRAME_W * NPC_SCALE;
export const NPC_DISPLAY_H = NPC_FRAME_H * NPC_SCALE;
export const NPC_SPEED = 0.03;
export const NPC_WANDER_RADIUS = 320;
export const NPC_ANIM_MS = 160;

export const SHEET_ROW_FOR_DIR = [0, 3, 1, 2];

export const NPC_FIGHT_DETECT_RADIUS = 260;
export const NPC_FIGHT_CHANCE = 0.35;
export const NPC_FIGHT_RANGE = 34;
export const NPC_FIGHT_INTERVAL = 700;
export const NPC_FIGHT_DAMAGE = 6;
export const NPC_FIGHT_SPEED_MULT = 1.5;
export const NPC_MAX_HP = 40;
export const NPC_RETALIATE_DAMAGE = 4;

export const NPC_CHAT_DETECT_RADIUS = 70;
export const NPC_CHAT_CHANCE = 0.3;
export const NPC_CHAT_MIN_MS = 2500;
export const NPC_CHAT_MAX_MS = 5500;
export const NPC_BUBBLE_TOGGLE_MS = 900;

export const NPC_LOW_HP_FRAC = 0.3;
export const NPC_REST_HEAL_MS = 3000;
export const NPC_REST_REGEN_PER_MS = NPC_MAX_HP / NPC_REST_HEAL_MS;
export const NPC_GOHOME_SPEED_MULT = 1.4;

export function spawnNpcs(
  container: HTMLDivElement,
  npcsRef: { current: Npc[] },
  px: number,
  py: number,
  onSelect?: (npc: Npc) => void
) {
  const sheetW = NPC_FRAME_W * NPC_COLS * NPC_SCALE;
  const sheetH = NPC_FRAME_H * NPC_ROWS * NPC_CHAR_COUNT * NPC_SCALE;

  for (let i = 0; i < NPC_CHAR_COUNT; i++) {
    const angle = (i / NPC_CHAR_COUNT) * Math.PI * 2 + Math.random() * 0.5;
    const dist = 150 + Math.random() * 400;
    const x = px + Math.cos(angle) * dist;
    const y = py + Math.sin(angle) * dist;

    const el = document.createElement("div");
    el.className = styles.npc;
    el.style.width = `${NPC_DISPLAY_W}px`;
    el.style.height = `${NPC_DISPLAY_H}px`;
    el.style.backgroundImage = "url(/npc-sheet.png)";
    el.style.backgroundSize = `${sheetW}px ${sheetH}px`;
    container.appendChild(el);

    const statusEl = document.createElement("div");
    statusEl.className = styles.npcStatus;
    container.appendChild(statusEl);

    const hpEl = document.createElement("div");
    hpEl.className = styles.hpLabel;
    container.appendChild(hpEl);

    const menuEl = document.createElement("div");
    menuEl.className = styles.npcMenu;
    menuEl.style.display = "none";
    menuEl.innerHTML = `
      <button class="hiBtn">Say Hi</button>
      <button class="followBtn">Follow Me</button>
    `;
    container.appendChild(menuEl);

    const npcObj: Npc = {
      id: i,
      x,
      y,
      homeX: x,
      homeY: y,
      vx: 0,
      vy: 0,
      dirRow: 0,
      charIndex: i,
      nextDecisionAt: Math.random() * 1500,
      state: "wander",
      chatPartnerId: null,
      chatUntil: 0,
      fightTargetId: null,
      lastFightHitAt: 0,
      hp: NPC_MAX_HP,
      maxHp: NPC_MAX_HP,
      dialogueOpen: false,
      restDoorX: null,
      restDoorY: null,
      el,
      statusEl,
      hpEl,
      menuEl,
    };

    el.addEventListener("mousedown", (e) => {
      // Don't swing the weapon when interacting with a villager.
      e.stopPropagation();
    });

    el.addEventListener("click", (e) => {
      e.stopPropagation();
      if (npcObj.state === "resting" || npcObj.state === "goHome") return;
      npcObj.dialogueOpen = !npcObj.dialogueOpen;
      onSelect?.(npcObj);
    });

    const hiBtn = menuEl.querySelector(".hiBtn");
    hiBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (npcObj.state === "resting" || npcObj.state === "goHome") return;
      if (statusEl) {
        statusEl.textContent = "👋 Hi!";
        statusEl.style.opacity = "1";
        setTimeout(() => {
          if (npcObj.state !== "chat") statusEl.textContent = "";
        }, 2000);
      }
      npcObj.dialogueOpen = false;
    });

    const followBtn = menuEl.querySelector(".followBtn");
    followBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (npcObj.state === "resting" || npcObj.state === "goHome") return;
      npcObj.state = "follow";
      npcObj.dialogueOpen = false;
      if (statusEl) {
        statusEl.textContent = "🛡️ Following";
        statusEl.style.opacity = "1";
      }
    });

    npcsRef.current.push(npcObj);
  }
}

export function updateNpcs(
  npcs: Npc[],
  enemies: Enemy[],
  now: number,
  dt: number,
  px: number,
  py: number,
  cx: number,
  cy: number,
  w: number,
  h: number,
  combatContext: CombatContext
) {
  for (const npc of npcs) {
    // Hurt NPCs break off whatever they're doing and head home to rest.
    if (
      npc.hp > 0 &&
      npc.hp <= npc.maxHp * NPC_LOW_HP_FRAC &&
      npc.state !== "resting" &&
      npc.state !== "goHome"
    ) {
      if (npc.chatPartnerId !== null) {
        const partner = npcs.find((p) => p.id === npc.chatPartnerId);
        if (partner && partner.chatPartnerId === npc.id) {
          partner.state = "wander";
          partner.chatPartnerId = null;
          partner.nextDecisionAt = now + 300;
        }
      }
      const door = nearestHouse(npc.x, npc.y);
      npc.state = "goHome";
      npc.fightTargetId = null;
      npc.chatPartnerId = null;
      npc.dialogueOpen = false;
      npc.restDoorX = door.x;
      npc.restDoorY = door.y;
    }

    if (npc.state === "fight") {
      const target = enemies.find((e) => e.id === npc.fightTargetId);
      if (!target) {
        npc.state = "wander";
        npc.fightTargetId = null;
        npc.vx = 0;
        npc.vy = 0;
        npc.nextDecisionAt = now;
      } else {
        const ddx = target.x - npc.x;
        const ddy = target.y - npc.y;
        const dist = Math.hypot(ddx, ddy) || 1;

        if (dist > NPC_FIGHT_RANGE) {
          npc.vx = (ddx / dist) * NPC_SPEED * NPC_FIGHT_SPEED_MULT;
          npc.vy = (ddy / dist) * NPC_SPEED * NPC_FIGHT_SPEED_MULT;
          npc.x += npc.vx * dt;
          npc.y += npc.vy * dt;
        } else {
          npc.vx = 0;
          npc.vy = 0;
          if (now - npc.lastFightHitAt > NPC_FIGHT_INTERVAL) {
            npc.lastFightHitAt = now;
            const targetScreenX = target.x - cx + w / 2;
            damageEnemy(target, NPC_FIGHT_DAMAGE, combatContext, "npc", targetScreenX);
            npc.hp -= NPC_RETALIATE_DAMAGE;
            applyDamageGlow(npc.el);
            if (npc.hp <= 0) {
              // Downed: whisked home instantly to respawn from the house.
              const door = nearestHouse(npc.x, npc.y);
              npc.state = "resting";
              npc.fightTargetId = null;
              npc.chatPartnerId = null;
              npc.dialogueOpen = false;
              npc.hp = 0;
              npc.restDoorX = door.x;
              npc.restDoorY = door.y;
              npc.x = door.x;
              npc.y = door.y;
              npc.vx = 0;
              npc.vy = 0;
            }
          }
        }
        npc.dirRow =
          Math.abs(ddx) > Math.abs(ddy)
            ? ddx > 0
              ? 2
              : 1
            : ddy > 0
            ? 0
            : 3;
      }
    } else if (npc.state === "chat") {
      const partner = npcs.find((p) => p.id === npc.chatPartnerId);
      if (!partner || partner.state !== "chat" || now > npc.chatUntil) {
        npc.state = "wander";
        npc.chatPartnerId = null;
        npc.nextDecisionAt = now + 400 + Math.random() * 900;
      } else {
        npc.vx = 0;
        npc.vy = 0;
        const ddx = partner.x - npc.x;
        const ddy = partner.y - npc.y;
        npc.dirRow =
          Math.abs(ddx) > Math.abs(ddy)
            ? ddx > 0
              ? 2
              : 1
            : ddy > 0
            ? 0
            : 3;
      }
    } else if (npc.state === "follow") {
      let nearestEnemy: Enemy | null = null;
      let nearestDist = NPC_FIGHT_DETECT_RADIUS;
      for (const e of enemies) {
        const d = Math.hypot(e.x - npc.x, e.y - npc.y);
        if (d < nearestDist) {
          nearestDist = d;
          nearestEnemy = e;
        }
      }

      if (nearestEnemy) {
        npc.state = "fight";
        npc.fightTargetId = nearestEnemy.id;
      } else {
        const ddx = px - npc.x;
        const ddy = py - npc.y;
        const dist = Math.hypot(ddx, ddy);
        if (dist > 60) {
          npc.vx = (ddx / dist) * NPC_SPEED * 1.2;
          npc.vy = (ddy / dist) * NPC_SPEED * 1.2;
          npc.x += npc.vx * dt;
          npc.y += npc.vy * dt;
        } else {
          npc.vx = 0;
          npc.vy = 0;
        }
        npc.dirRow =
          Math.abs(ddx) > Math.abs(ddy)
            ? ddx > 0
              ? 2
              : 1
            : ddy > 0
            ? 0
            : 3;
      }
    } else if (npc.state === "goHome") {
      const doorX = npc.restDoorX ?? npc.homeX;
      const doorY = npc.restDoorY ?? npc.homeY;
      const ddx = doorX - npc.x;
      const ddy = doorY - npc.y;
      const dist = Math.hypot(ddx, ddy) || 1;
      if (dist < 16) {
        npc.state = "resting";
        npc.x = doorX;
        npc.y = doorY;
        npc.vx = 0;
        npc.vy = 0;
      } else {
        npc.vx = (ddx / dist) * NPC_SPEED * NPC_GOHOME_SPEED_MULT;
        npc.vy = (ddy / dist) * NPC_SPEED * NPC_GOHOME_SPEED_MULT;
        npc.x += npc.vx * dt;
        npc.y += npc.vy * dt;
        npc.dirRow =
          Math.abs(ddx) > Math.abs(ddy)
            ? ddx > 0
              ? 2
              : 1
            : ddy > 0
            ? 0
            : 3;
      }
    } else if (npc.state === "resting") {
      npc.vx = 0;
      npc.vy = 0;
      npc.hp = Math.min(npc.maxHp, npc.hp + NPC_REST_REGEN_PER_MS * dt);
      if (npc.hp >= npc.maxHp) {
        npc.hp = npc.maxHp;
        npc.state = "wander";
        npc.x = npc.restDoorX ?? npc.homeX;
        npc.y = (npc.restDoorY ?? npc.homeY) + 30;
        npc.restDoorX = null;
        npc.restDoorY = null;
        npc.nextDecisionAt = now;
      }
    } else {
      if (now >= npc.nextDecisionAt) {
        let nearestEnemy: Enemy | null = null;
        let nearestDist = NPC_FIGHT_DETECT_RADIUS;
        for (const e of enemies) {
          const d = Math.hypot(e.x - npc.x, e.y - npc.y);
          if (d < nearestDist) {
            nearestDist = d;
            nearestEnemy = e;
          }
        }

        let partner: Npc | null = null;
        if (!nearestEnemy || Math.random() >= NPC_FIGHT_CHANCE) {
          for (const other of npcs) {
            if (other.id === npc.id || other.state !== "wander") continue;
            const d = Math.hypot(other.x - npc.x, other.y - npc.y);
            if (d < NPC_CHAT_DETECT_RADIUS) {
              partner = other;
              break;
            }
          }
        }

        if (nearestEnemy && Math.random() < NPC_FIGHT_CHANCE) {
          npc.state = "fight";
          npc.fightTargetId = nearestEnemy.id;
          npc.vx = 0;
          npc.vy = 0;
        } else if (partner && Math.random() < NPC_CHAT_CHANCE) {
          const chatLen =
            NPC_CHAT_MIN_MS + Math.random() * (NPC_CHAT_MAX_MS - NPC_CHAT_MIN_MS);
          npc.state = "chat";
          npc.chatPartnerId = partner.id;
          npc.chatUntil = now + chatLen;
          npc.vx = 0;
          npc.vy = 0;
          partner.state = "chat";
          partner.chatPartnerId = npc.id;
          partner.chatUntil = now + chatLen;
          partner.vx = 0;
          partner.vy = 0;
        } else {
          const distFromHome = Math.hypot(npc.x - npc.homeX, npc.y - npc.homeY);
          let angle = Math.random() * Math.PI * 2;
          if (distFromHome > NPC_WANDER_RADIUS) {
            angle = Math.atan2(npc.homeY - npc.y, npc.homeX - npc.x);
            angle += (Math.random() - 0.5) * 0.8;
          }
          const willMove = Math.random() > 0.25;
          npc.vx = willMove ? Math.cos(angle) * NPC_SPEED : 0;
          npc.vy = willMove ? Math.sin(angle) * NPC_SPEED : 0;
        }

        npc.nextDecisionAt = now + 1500 + Math.random() * 2500;
      }

      if (npc.state === "wander") {
        npc.x += npc.vx * dt;
        npc.y += npc.vy * dt;

        if (npc.vx !== 0 || npc.vy !== 0) {
          npc.dirRow =
            Math.abs(npc.vx) > Math.abs(npc.vy)
              ? npc.vx > 0
                ? 2
                : 1
              : npc.vy > 0
              ? 0
              : 3;
        }
      }
    }

    const screenX = npc.x - cx + w / 2;
    const screenY = npc.y - cy + h / 2;
    const isResting = npc.state === "resting";
    const offscreen =
      isResting ||
      screenX < -80 ||
      screenX > w + 80 ||
      screenY < -80 ||
      screenY > h + 80;

    if (npc.el) {
      const moving =
        (npc.state === "wander" ||
          npc.state === "follow" ||
          npc.state === "goHome") &&
        (npc.vx !== 0 || npc.vy !== 0);
      const chasing = npc.state === "fight" && (npc.vx !== 0 || npc.vy !== 0);
      const animCol =
        moving || chasing ? Math.floor(now / NPC_ANIM_MS) % NPC_COLS : 0;
      const sheetRow = SHEET_ROW_FOR_DIR[npc.dirRow];
      const rowIndex = npc.charIndex * NPC_ROWS + sheetRow;
      npc.el.style.backgroundPosition = `-${animCol * NPC_DISPLAY_W}px -${
        rowIndex * NPC_DISPLAY_H
      }px`;
      npc.el.style.transform = `translate(${screenX - NPC_DISPLAY_W / 2}px, ${
        screenY - NPC_DISPLAY_H / 2
      }px)`;
      npc.el.style.opacity = offscreen ? "0" : "1";
      npc.el.style.zIndex = String(
        Z_BASE + Math.round(npc.y + NPC_DISPLAY_H / 2 - 6)
      );
    }

    if (npc.statusEl) {
      let icon = "";
      if (npc.state === "chat") {
        const turn = Math.floor(now / NPC_BUBBLE_TOGGLE_MS) % 2 === 0;
        const isSpeaker = turn
          ? npc.id < (npc.chatPartnerId ?? 0)
          : npc.id > (npc.chatPartnerId ?? 0);
        icon = isSpeaker ? "💬" : "";
      } else if (npc.state === "follow") {
        icon = "🛡️";
      } else if (npc.state === "goHome") {
        icon = "💤";
      }
      npc.statusEl.textContent = icon;
      npc.statusEl.style.transform = `translate(${screenX - 9}px, ${
        screenY - NPC_DISPLAY_H / 2 - 20
      }px)`;
      npc.statusEl.style.opacity = offscreen || !icon ? "0" : "1";
      npc.statusEl.style.zIndex = String(Z_BASE * 2);
    }

    if (npc.menuEl) {
      npc.menuEl.style.display =
        npc.dialogueOpen && !offscreen ? "flex" : "none";
      npc.menuEl.style.transform = `translate(${screenX - 45}px, ${
        screenY - NPC_DISPLAY_H / 2 - 65
      }px)`;
      npc.menuEl.style.zIndex = String(Z_BASE * 3);
    }

    renderHpLabel(
      npc.hpEl,
      npc.hp,
      npc.maxHp,
      screenX - 14,
      screenY - NPC_DISPLAY_H / 2 - 36,
      offscreen
    );
  }
}

export function cleanupNpcs(npcs: Npc[]) {
  npcs.forEach((n) => {
    n.el?.remove();
    n.statusEl?.remove();
    n.hpEl?.remove();
    n.menuEl?.remove();
  });
}

